resource "aws_apigatewayv2_api" "api" {
  name          = "${var.project_name}-${var.environment}-api"
  protocol_type = "HTTP"
}

# The $default stage carries no path prefix. A named stage puts the stage name
# in the request path, so the Lambda receives "/dev/api/health" instead of
# "/api/health"; the router matches exact paths and every route returned 404 on
# the first deployment. $default fixes that at the deployment layer and keeps
# the CloudFront origin path at "/".
resource "aws_apigatewayv2_stage" "api" {
  api_id      = aws_apigatewayv2_api.api.id
  name        = "$default"
  auto_deploy = true

  # Anti-abuse throttle: burst 20, rate 10 req/s.
  #
  # The app has no login, so WAF ACL rules would be mostly noise. On a
  # pay-per-request backend, unthrottled traffic is also unbilled traffic the
  # other way around, so the throttle is also a cost guard. The values are
  # modest enough that a player never notices them.
  default_route_settings {
    throttling_burst_limit = 20
    throttling_rate_limit  = 10
  }
}
