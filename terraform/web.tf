# Frontend hosting: private S3 bucket served through CloudFront.
#
# CloudFront provides the HTTPS URL, routes everything under /api/* to the
# API Gateway origin, and serves the React SPA from S3 for every other path.
# This keeps the browser's API calls same-origin, so no CORS handling or
# development proxy flag is needed in production.

data "aws_caller_identity" "current" {}

locals {
  web_dist_path  = "${path.module}/../apps/web/dist"
  web_dist_files = toset(fileset(local.web_dist_path, "**"))
}

# Guard against a missing build. fileset over a non-existent directory returns
# an empty set without error, which would silently deploy a broken site.
resource "terraform_data" "web_build_guard" {
  lifecycle {
    precondition {
      condition     = fileexists("${local.web_dist_path}/index.html")
      error_message = "The web build is missing. Run 'npm run build' first so apps/web/dist/index.html exists before deploying the frontend."
    }
  }
}

resource "aws_s3_bucket" "web" {
  # Bucket names are global, so append the AWS account id from a data source.
  bucket = "${var.project_name}-${var.environment}-web-${data.aws_caller_identity.current.account_id}"

  # force_destroy is safe here: the bucket holds only build artifacts that can
  # be recreated from source. The stateful DynamoDB table is protected by
  # deletion_protection_enabled and prevent_destroy instead.
  force_destroy = true
}

resource "aws_s3_bucket_public_access_block" "web" {
  bucket = aws_s3_bucket.web.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "web" {
  bucket = aws_s3_bucket.web.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_versioning" "web" {
  bucket = aws_s3_bucket.web.id

  versioning_configuration {
    status = "Disabled"
  }
}

locals {
  # Content types for the files vite emits. Browsers reject assets served with
  # the wrong type, so every uploaded object must declare one.
  web_content_types = {
    "html" = "text/html"
    "js"   = "application/javascript"
    "css"  = "text/css"
    "svg"  = "image/svg+xml"
    "png"  = "image/png"
    "ico"  = "image/x-icon"
    "json" = "application/json"
  }
}

resource "aws_s3_object" "web" {
  for_each = local.web_dist_files

  bucket = aws_s3_bucket.web.id
  key    = each.value
  source = "${local.web_dist_path}/${each.value}"
  etag   = filemd5("${local.web_dist_path}/${each.value}")

  content_type = lookup(
    local.web_content_types,
    regex("\\.([^.]+)$", each.value)[0],
    "application/octet-stream"
  )

  # index.html must never be cached by the browser because it references the
  # hashed asset filenames, which change on every build. Hashed assets under
  # assets/ are immutable, so they can be cached by the browser for a year.
  cache_control = each.value == "index.html" ? "no-cache" : (
    startswith(each.value, "assets/") ? "public, max-age=31536000, immutable" : null
  )

  depends_on = [terraform_data.web_build_guard]
}

resource "aws_cloudfront_origin_access_control" "web" {
  name                              = "${var.project_name}-${var.environment}-web-oac"
  description                       = "OAC for the Lights Out static site bucket"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_distribution" "web" {
  # Distribution for the Lights Out React app.
  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"
  price_class         = "PriceClass_100" # Europe and North America, cheapest class.

  origin {
    origin_id                = "S3-${aws_s3_bucket.web.id}"
    domain_name              = aws_s3_bucket.web.bucket_regional_domain_name
    origin_access_control_id = aws_cloudfront_origin_access_control.web.id
  }

  origin {
    origin_id = "APIGW-${aws_apigatewayv2_api.api.id}"
    # aws_apigatewayv2_api.api.api_endpoint includes the https:// scheme,
    # which CloudFront rejects as a domain_name.
    domain_name = trimprefix(aws_apigatewayv2_api.api.api_endpoint, "https://")

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }

    # No origin_path: the API Gateway stage is $default and serves at the root.
  }

  default_cache_behavior {
    target_origin_id = "S3-${aws_s3_bucket.web.id}"

    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true

    # AWS managed policy: CachingDisabled (4135ea2d-6df8-44a3-9df3-4b5a84be39ad).
    # index.html is not hashed, so it must be revalidated against S3 on every request
    # instead of being served from the edge.
    cache_policy_id = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad"
  }

  ordered_cache_behavior {
    path_pattern     = "/assets/*"
    target_origin_id = "S3-${aws_s3_bucket.web.id}"

    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true

    cache_policy_id = aws_cloudfront_cache_policy.web_assets.id
  }

  ordered_cache_behavior {
    path_pattern     = "/api/*"
    target_origin_id = "APIGW-${aws_apigatewayv2_api.api.id}"

    # Must include DELETE or the purge endpoint is rejected by CloudFront
    # before it reaches Lambda, returning a 403 that looks like a permission issue.
    allowed_methods = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods  = ["GET", "HEAD"]

    # https-only rather than redirect-to-https. A redirect is not harmless on an API
    # call: most clients follow a 301 or 302 from a POST as a GET, dropping both the
    # method and the body, so a submission sent over HTTP would fail in a way that
    # looks like a server bug. Redirecting is the friendly answer for a page; an API
    # request that is not already on HTTPS should simply be refused.
    viewer_protocol_policy = "https-only"
    compress               = true

    # AWS managed policy: CachingDisabled (4135ea2d-6df8-44a3-9df3-4b5a84be39ad)
    cache_policy_id = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad"

    # AWS managed policy: Managed-AllViewer (216adef6-5c7f-47e4-b989-5492eafa07d3)
    # forwards query strings, so ?confirm=DELETE, sort and limit reach the API.
    origin_request_policy_id = "216adef6-5c7f-47e4-b989-5492eafa07d3"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
      locations        = []
    }
  }

  viewer_certificate {
    # No custom domain: CloudFront's default certificate already serves HTTPS.
    cloudfront_default_certificate = true
  }
}

# There is deliberately no custom cache policy for index.html. The AWS-managed
# "CachingDisabled" policy already means exactly "never cache", and hand-writing one
# is a trap: the first attempt was rejected because EnableAcceptEncodingGzip is
# invalid when caching is disabled, and the attribute after that could have failed
# the same way. A managed policy is valid by construction. A custom policy is kept
# only where the requirement is genuinely custom, which here is the long asset TTL
# below.

resource "aws_cloudfront_cache_policy" "web_assets" {
  name        = "${var.project_name}-${var.environment}-web-assets"
  comment     = "Long-lived cache for hashed Vite assets. Filenames contain a content hash, so they are immutable."
  default_ttl = 31536000
  max_ttl     = 31536000
  min_ttl     = 0

  parameters_in_cache_key_and_forwarded_to_origin {
    # Hashed asset contents are addressed entirely by filename, so cookies,
    # headers and query strings do not belong in the cache key.
    enable_accept_encoding_gzip = true

    headers_config {
      header_behavior = "none"
    }

    cookies_config {
      cookie_behavior = "none"
    }

    query_strings_config {
      query_string_behavior = "none"
    }
  }
}

resource "aws_s3_bucket_policy" "web" {
  bucket = aws_s3_bucket.web.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCloudFrontOAC"
        Effect = "Allow"
        Principal = {
          Service = "cloudfront.amazonaws.com"
        }
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.web.arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.web.arn
          }
        }
      }
    ]
  })
}

output "cloudfront_distribution_domain_name" {
  description = "CloudFront domain name serving the React app."
  value       = aws_cloudfront_distribution.web.domain_name
}

output "app_url" {
  description = "HTTPS URL of the deployed Lights Out game."
  value       = "https://${aws_cloudfront_distribution.web.domain_name}"
}

output "web_bucket_name" {
  description = "Name of the private S3 bucket holding the built React app."
  value       = aws_s3_bucket.web.id
}

output "cloudfront_distribution_id" {
  description = "ID of the CloudFront distribution serving the React app."
  value       = aws_cloudfront_distribution.web.id
}
