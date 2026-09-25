locals {
  function_name = "${var.project_name}-${var.environment}-api"
}

# The execution role is looked up by name so that no account id or ARN literal
# is committed to the repository. The role must already exist in the target
# account; this stack does not create or modify IAM resources.
data "aws_iam_role" "lambda_execution" {
  name = var.lambda_role_name
}

data "archive_file" "api" {
  type        = "zip"
  source_dir  = "${path.module}/../apps/api/dist"
  output_path = "${path.module}/api.zip"

  # Exclude the local development server and its source map; they are not part
  # of the production Lambda package.
  excludes = [
    "local-server.js",
    "local-server.js.map",
  ]
}

resource "aws_lambda_function" "api" {
  function_name = local.function_name
  role          = data.aws_iam_role.lambda_execution.arn
  handler       = "http/lambda.handler"
  runtime       = "nodejs22.x"
  architectures = ["arm64"]

  filename         = data.archive_file.api.output_path
  source_code_hash = data.archive_file.api.output_base64sha256

  memory_size = var.lambda_memory_mb
  timeout     = var.lambda_timeout_seconds

  environment {
    variables = {
      LOG_LEVEL = "info"
    }
  }

  # Ensure the explicit, time-bounded log group is created before the first
  # invocation, otherwise Lambda creates one that never expires.
  depends_on = [aws_cloudwatch_log_group.api]
}

resource "aws_apigatewayv2_integration" "api" {
  api_id                 = aws_apigatewayv2_api.api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.api.invoke_arn
  integration_method     = "POST"
  payload_format_version = "2.0"
}

# A single catch-all route lets the Lambda's own router dispatch /api/health,
# /api/scores and any future endpoints. Keeping routing in one place avoids
# drift between API Gateway and the application.
resource "aws_apigatewayv2_route" "api" {
  api_id    = aws_apigatewayv2_api.api.id
  route_key = "ANY /api/{proxy+}"
  target    = "integrations/${aws_apigatewayv2_integration.api.id}"
}

resource "aws_lambda_permission" "api_gateway" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.api.execution_arn}/*/*"
}
