# =============================================================================
# Savitara — Terraform IaC: Provider & version constraints
# Target: AWS (ECS Fargate + ElastiCache + ALB)
# MongoDB: MongoDB Atlas (via mongodbatlas provider)
# =============================================================================

terraform {
  required_version = ">= 1.7.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.40"
    }
    mongodbatlas = {
      source  = "mongodb/mongodbatlas"
      version = "~> 1.17"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  # Remote state — update bucket/key/region for your AWS account
  backend "s3" {
    bucket         = "savitara-terraform-state"
    key            = "production/terraform.tfstate"
    region         = "ap-south-1"
    encrypt        = true
    dynamodb_table = "savitara-terraform-locks"
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "savitara"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

provider "mongodbatlas" {
  public_key  = var.atlas_public_key
  private_key = var.atlas_private_key
}
