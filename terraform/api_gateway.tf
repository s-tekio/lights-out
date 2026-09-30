resource "aws_apigatewayv2_api" "api" {
  name          = "${var.project_name}-${var.environment}-api"
  protocol_type = "HTTP"
}

# The stage is named $default so requests carry no path prefix.
#
# With a named stage, API Gateway passes the stage name inside the request path
# and the Lambda receives event.rawPath = "/dev/api/health" instead of
# "/api/health". The application router matches exact paths, so every route
# answered 404 on the first deployment. $default fixes that at the deployment
# layer instead of teaching the application about the stage name, and it also
# keeps the CloudFront origin path at "/" when the frontend stack is added.
resource "aws_apigatewayv2_stage" "api" {
  api_id      = aws_apigatewayv2_api.api.id
  name        = "$default"
  auto_deploy = true

  # Anti-abuse throttle: burst limit 20, rate limit 10 req/s.
  #
  # This is the protection this application actually needs: it has no login to
  # protect, so a WAF's ACL rules would be mostly noise. On a pay-per-request
  # backend, unthrottled traffic is also unbilled traffic the other way around,
  # so the throttle is also a cost guard. The values are deliberately modest so
  # a person playing the game never notices them.
  default_route_settings {
    throttling_burst_limit = 20
    throttling_rate_limit  = 10
  }
}
