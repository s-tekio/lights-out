resource "aws_apigatewayv2_api" "api" {
  name          = "${var.project_name}-${var.environment}-api"
  protocol_type = "HTTP"
}

resource "aws_apigatewayv2_stage" "api" {
  api_id      = aws_apigatewayv2_api.api.id
  name        = var.environment
  auto_deploy = true
}

# With auto_deploy, the stage name becomes a path prefix. When CloudFront is
# added later its API Gateway origin will need an origin path of
# "/<environment>" so that browser-facing /api/... URLs keep working unchanged.
