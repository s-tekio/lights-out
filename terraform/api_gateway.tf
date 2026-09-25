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
}
