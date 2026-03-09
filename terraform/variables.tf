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
  description = "CIDR blocks for public subnets (one per AZ; must be within vpc_cidr)"
  type    = list(string)
  default = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
}

variable "private_subnet_cidrs" {
  description = "CIDR blocks for private subnets (one per AZ; ECS tasks and DB run here)"
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
  description = "Minimum number of ECS tasks (auto-scaling floor)"
  type    = number
  default = 1
}

variable "backend_max_count" {
  description = "Maximum number of ECS tasks (auto-scaling ceiling)"
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
  description = "Number of ElastiCache nodes (1 for dev/staging, 2+ for production HA)"
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
  description = "MongoDB Atlas project name (must match the project created in your Atlas org)"
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
  description = "Google OAuth 2.0 Client ID for user sign-in (from GCP Console)"
  type      = string
  sensitive = true
}

variable "google_client_secret" {
  description = "Google OAuth 2.0 Client Secret — rotate every 6 months via GCP Console"
  type      = string
  sensitive = true
}

variable "razorpay_key_id" {
  description = "Razorpay API key ID (public key, starts with rzp_live_ in production)"
  type      = string
  sensitive = true
}

variable "razorpay_key_secret" {
  description = "Razorpay API key secret — rotate immediately if leaked; update in AWS Secrets Manager"
  type      = string
  sensitive = true
}

variable "sentry_dsn" {
  description = "Sentry DSN for error tracking (format: https://<key>@<host>/<project>). Leave empty to disable."
  type      = string
  sensitive = true
  default   = ""
}
