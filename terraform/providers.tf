terraform {
  required_version = "~> 1.15"

  backend "s3" {
    bucket       = "commit-academy-tf-lo"
    key          = "lights-out/terraform.tfstate"
    region       = "eu-west-1"
    encrypt      = true
    use_lockfile = true
    # Intentionally no `profile` attribute. Credentials come from the standard
    # credential chain (CI role, environment variables, etc.), not a named
    # profile that only exists on a single machine.
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }

    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.0"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      Owner       = var.owner
      ManagedBy   = "terraform"
    }
  }
}
