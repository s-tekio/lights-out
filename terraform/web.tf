# Frontend hosting: private S3 bucket served through CloudFront.
#
# CloudFront routes /api/* to the API Gateway origin and serves the React SPA
# from S3 for every other path. This keeps API calls same-origin, so no CORS
# handling or proxy flag is needed in production.

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
  # Bucket names are global, so append the account id from a data source.
  bucket = "${var.project_name}-${var.environment}-web-${data.aws_caller_identity.current.account_id}"

  # force_destroy is safe here: the bucket holds only build artifacts that can
  # be recreated from source. The DynamoDB table is protected separately.
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
  # Content types for Vite's output. Browsers reject assets with the wrong type,
  # so every uploaded object must declare one.
  web_content_types = {
    "html"  = "text/html"
    "js"    = "application/javascript"
    "css"   = "text/css"
    "svg"   = "image/svg+xml"
    "png"   = "image/png"
    "ico"   = "image/x-icon"
    "json"  = "application/json"
    "mp3"   = "audio/mpeg"
    "woff2" = "font/woff2"
  }

  # A fallback of application/octet-stream is silent. Collect every extension
  # the build emitted that has no entry, including files with no extension, so
  # the precondition fails and names them instead of deploying generic bytes.
  web_file_extensions = toset([
    for file in local.web_dist_files : try(regex("\\.([^.]+)$", file)[0], "")
  ])

  web_unknown_extensions = toset([
    for extension in local.web_file_extensions : extension
    if !contains(keys(local.web_content_types), extension)
  ])
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

  lifecycle {
    precondition {
      condition     = length(local.web_unknown_extensions) == 0
      error_message = "The build emitted file types with no content type declared: ${join(", ", local.web_unknown_extensions)}. Add each one to local.web_content_types in terraform/web.tf, or it would ship as application/octet-stream."
    }
  }

  # index.html references hashed asset filenames that change on every build, so
  # it must never be cached. Hashed assets under assets/ are immutable and can
  # be cached for a year.
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
    # The API Gateway endpoint includes the https:// scheme, which CloudFront
    # rejects as a domain_name.
    domain_name = trimprefix(aws_apigatewayv2_api.api.api_endpoint, "https://")

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }

    # No origin_path: the $default stage serves at the root.
  }

  default_cache_behavior {
    target_origin_id = "S3-${aws_s3_bucket.web.id}"

    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true

    # AWS managed CachingDisabled policy. index.html is not hashed, so it must be
    # revalidated against S3 on every request instead of served from the edge.
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

    # Must include DELETE or CloudFront rejects the purge endpoint before it
    # reaches Lambda, returning a 403 that looks like a permission issue.
    allowed_methods = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods  = ["GET", "HEAD"]

    # https-only, not redirect-to-https. A redirect is not harmless for an API
    # call: most clients follow a 301/302 from a POST as a GET, dropping the method
    # and body, so an HTTP submission fails in a way that looks like a server bug.
    # Redirecting is fine for pages; an API request not already on HTTPS should be
    # refused.
    viewer_protocol_policy = "https-only"
    compress               = true

    # AWS managed policy: CachingDisabled (4135ea2d-6df8-44a3-9df3-4b5a84be39ad)
    cache_policy_id = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad"

    # AWS managed Managed-AllViewerExceptHostHeader policy. It forwards every query
    # string so ?confirm=DELETE, sort and limit reach the API.
    #
    # It must not be Managed-AllViewer, which also forwards the Host header. The
    # viewer's Host is the CloudFront domain, and API Gateway refuses a request whose
    # Host is not its own with 403 {"message":"Forbidden"}. That was the first
    # deployment's symptom; calling the API directly returned 200.
    origin_request_policy_id = "b689b0a8-53d0-40ab-baf2-68738e2966ac"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
      locations        = []
    }
  }

  viewer_certificate {
    # No custom domain needed: CloudFront's default certificate already serves HTTPS.
    cloudfront_default_certificate = true
  }
}

# No custom cache policy for index.html. The AWS-managed "CachingDisabled" policy
# already means "never cache", and hand-writing one is a trap: the first attempt
# was rejected because EnableAcceptEncodingGzip is invalid when caching is disabled,
# and later attributes could fail the same way. A managed policy is valid by
# construction. A custom policy is kept only where the requirement is genuinely
# custom, which here is the long asset TTL below.

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
