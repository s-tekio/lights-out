output "api_endpoint" {
  description = "Base URL of the API Gateway stage."
  value       = aws_apigatewayv2_stage.api.invoke_url
}

output "api_health_url" {
  description = "URL of the health endpoint exposed by the deployed API."
  value       = "${aws_apigatewayv2_stage.api.invoke_url}/api/health"
}

output "lambda_function_name" {
  description = "Name of the deployed Lambda function."
  value       = aws_lambda_function.api.function_name
}

output "lambda_execution_role_arn" {
  description = "ARN of the IAM execution role used by the Lambda function, looked up by name."
  value       = data.aws_iam_role.lambda_execution.arn
}

output "log_group_name" {
  description = "Name of the CloudWatch Logs group for the Lambda function."
  value       = aws_cloudwatch_log_group.api.name
}
