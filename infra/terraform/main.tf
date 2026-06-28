# SplitSmart infrastructure — skeleton (Milestone 0).
# No real resources are provisioned yet. Networking, RDS (Postgres),
# ElastiCache (Redis), S3, and ECS/EKS are added in later milestones.

terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Configure remote state (S3 + DynamoDB lock) before team use.
  # backend "s3" {}
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "SplitSmart"
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}
