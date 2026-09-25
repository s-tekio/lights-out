variable "aws_region" {
  type        = string
  description = "AWS region where the ranking API infrastructure is deployed."
  default     = "eu-west-1"
}

variable "project_name" {
  type        = string
  description = "Prefix used for named resources."
  default     = "lights-out"
}

variable "environment" {
  type        = string
  description = "Deployment environment."
  default     = "dev"

  validation {
    condition     = contains(["dev", "prod"], var.environment)
    error_message = "environment must be either 'dev' or 'prod'."
  }
}

variable "owner" {
  type        = string
  description = "Owner tag applied to every resource. Environment specific."
}

variable "alert_email" {
  type        = string
  description = "Email address for CloudWatch alarms and budget notifications."
}

variable "lambda_role_name" {
  type        = string
  description = "Name of the existing IAM execution role for the Lambda function."
  default     = "studentLambdaExecutionRole"
}

variable "log_retention_days" {
  type        = number
  description = "CloudWatch Logs retention period in days."
  default     = 14

  validation {
    condition = contains([
      1, 3, 5, 7, 14, 30, 60, 90, 120, 150, 180, 365, 400, 545, 731, 1096,
      1827, 2192, 2557, 2922, 3288, 3653
    ], var.log_retention_days)
    error_message = "log_retention_days must be a value supported by CloudWatch Logs."
  }
}

variable "budget_limit_usd" {
  type        = number
  description = "Monthly AWS Budget limit in US dollars."
  default     = 5

  validation {
    condition     = var.budget_limit_usd > 0
    error_message = "budget_limit_usd must be a positive number."
  }
}

variable "lambda_memory_mb" {
  type        = number
  description = "Memory allocated to the Lambda function in megabytes."
  default     = 256
}

variable "lambda_timeout_seconds" {
  type        = number
  description = "Lambda function timeout in seconds."
  default     = 10
}
