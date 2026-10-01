locals {
  function_name = "${var.project_name}-${var.environment}-api"
}

# The execution role is looked up by name so no account id or ARN literal is
# committed. The role must already exist; this stack does not create or modify
# IAM resources.
data "aws_iam_role" "lambda_execution" {
  name = var.lambda_role_name
}

data "archive_file" "api" {
  type        = "zip"
  source_file = "${path.module}/../apps/api/dist/lambda.js"
  output_path = "${path.module}/api.zip"
}

resource "aws_lambda_function" "api" {
  function_name = local.function_name
  role          = data.aws_iam_role.lambda_execution.arn
  handler       = "lambda.handler"
  runtime       = "nodejs22.x"
  architectures = ["arm64"]

  filename         = data.archive_file.api.output_path
  source_code_hash = data.archive_file.api.output_base64sha256

  memory_size = var.lambda_memory_mb
  timeout     = var.lambda_timeout_seconds

  environment {
    variables = {
      LOG_LEVEL         = "info"
      SCORES_TABLE_NAME = aws_dynamodb_table.scores.name
    }
  }

  # Create the explicit, time-bounded log group before the first invocation, or
  # Lambda creates one that never expires.
  depends_on = [aws_cloudwatch_log_group.api]
}

resource "aws_apigatewayv2_integration" "api" {
  api_id                 = aws_apigatewayv2_api.api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.api.invoke_arn
  integration_method     = "POST"
  payload_format_version = "2.0"
}

# A single catch-all route lets the Lambda router dispatch all endpoints.
# Keeping routing in one place avoids drift with API Gateway.
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
