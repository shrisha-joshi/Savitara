# =============================================================================
# Savitara — Terraform variables
# Fill in terraform.tfvars or set via TF_VAR_* env vars in CI
# =============================================================================

# ── AWS ──────────────────────────────────────────────────────────────────────
variable "aws_region" {
  description = "AWS region to deploy resources into"
  type        = string
  default     = "ap-south-1"
}

variable "environment" {
  description = "Deployment environment (production | staging)"
  type        = string
  validation {
    condition     = contains(["production", "staging"], var.environment)
    error_message = "environment must be 'production' or 'staging'."
  }
}

variable "project" {
  description = "Project name used as a prefix in resource names"
  type        = string
  default     = "savitara"
}

# ── VPC ──────────────────────────────────────────────────────────────────────
variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "List of AZs to spread resources across (3 recommended)"
  type        = list(string)
  default     = ["ap-south-1a", "ap-south-1b", "ap-south-1c"]
}

variable "public_subnet_cidrs" {
  type    = list(string)
  default = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
}

variable "private_subnet_cidrs" {
  type    = list(string)
  default = ["10.0.11.0/24", "10.0.12.0/24", "10.0.13.0/24"]
}

# ── ECS / Container ──────────────────────────────────────────────────────────
variable "backend_image" {
  description = "Full ECR image URI with tag (e.g. 123456789.dkr.ecr.ap-south-1.amazonaws.com/savitara-backend:v1.2.0)"
  type        = string
}

variable "backend_cpu" {
  description = "ECS task CPU units (256 = 0.25 vCPU)"
  type        = number
  default     = 512
}

variable "backend_memory" {
  description = "ECS task memory in MiB"
  type        = number
  default     = 1024
}

variable "backend_desired_count" {
  description = "Desired number of ECS tasks"
  type        = number
  default     = 2
}

variable "backend_min_count" {
  type    = number
  default = 1
}

variable "backend_max_count" {
  type    = number
  default = 6
}

# ── ElastiCache ──────────────────────────────────────────────────────────────
variable "redis_node_type" {
  description = "ElastiCache node type"
  type        = string
  default     = "cache.t4g.small"
}

variable "redis_num_cache_nodes" {
  type    = number
  default = 1
}

# ── ACM / TLS ────────────────────────────────────────────────────────────────
variable "domain_name" {
  description = "Root domain (e.g. savitara.in)"
  type        = string
  default     = "savitara.in"
}

variable "acm_certificate_arn" {
  description = "ARN of the ACM certificate for HTTPS listener"
  type        = string
}

# ── MongoDB Atlas ────────────────────────────────────────────────────────────
variable "atlas_public_key" {
  description = "MongoDB Atlas organisation public API key"
  type        = string
  sensitive   = true
}

variable "atlas_private_key" {
  description = "MongoDB Atlas organisation private API key"
  type        = string
  sensitive   = true
}

variable "atlas_org_id" {
  description = "MongoDB Atlas organisation ID"
  type        = string
}

variable "atlas_project_name" {
  type    = string
  default = "savitara-production"
}

variable "atlas_cluster_tier" {
  description = "Atlas cluster tier (e.g. M10, M30)"
  type        = string
  default     = "M10"
}

variable "atlas_region" {
  description = "Atlas cloud region (must match aws_region)"
  type        = string
  default     = "AP_SOUTH_1"
}

# ── Application secrets (stored in AWS Secrets Manager) ──────────────────────
variable "secret_key" {
  description = "APPLICATION secret key (min 32 chars)"
  type        = string
  sensitive   = true
}

variable "jwt_secret_key" {
  description = "JWT signing secret (min 32 chars)"
  type        = string
  sensitive   = true
}

variable "google_client_id" {
  type      = string
  sensitive = true
}

variable "google_client_secret" {
  type      = string
  sensitive = true
}

variable "razorpay_key_id" {
  type      = string
  sensitive = true
}

variable "razorpay_key_secret" {
  type      = string
  sensitive = true
}

variable "sentry_dsn" {
  type      = string
  sensitive = true
  default   = ""
}
