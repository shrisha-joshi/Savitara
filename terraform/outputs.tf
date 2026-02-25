# =============================================================================
# Savitara — Terraform outputs
# Apply, then use these values to configure DNS, CI/CD push targets, etc.
# =============================================================================

output "alb_dns_name" {
  description = "ALB DNS name (set as CNAME in DNS or use route53_record)"
  value       = aws_lb.main.dns_name
}

output "alb_zone_id" {
  description = "ALB Route 53 hosted zone ID (for alias records)"
  value       = aws_lb.main.zone_id
}

output "api_url" {
  description = "Full HTTPS API base URL"
  value       = "https://api.${var.domain_name}"
}

output "ecr_repository_url" {
  description = "ECR URL to push backend Docker images to"
  value       = aws_ecr_repository.backend.repository_url
}

output "ecs_cluster_name" {
  description = "ECS cluster name (for manual deployments / CLI)"
  value       = aws_ecs_cluster.main.name
}

output "ecs_service_name" {
  description = "ECS service name"
  value       = aws_ecs_service.backend.name
}

output "redis_endpoint" {
  description = "ElastiCache Redis primary endpoint (private)"
  value       = "${aws_elasticache_cluster.redis.cache_nodes[0].address}:6379"
  sensitive   = true
}

output "atlas_connection_string_srv" {
  description = "MongoDB Atlas SRV connection string (sans credentials)"
  value       = mongodbatlas_cluster.main.connection_strings[0].standard_srv
  sensitive   = true
}

output "atlas_project_id" {
  description = "MongoDB Atlas project ID"
  value       = mongodbatlas_project.main.id
}

output "app_secrets_arn" {
  description = "AWS Secrets Manager ARN for the application secrets"
  value       = aws_secretsmanager_secret.app_secrets.arn
}

output "uploads_bucket_name" {
  description = "S3 bucket name for user uploads"
  value       = aws_s3_bucket.uploads.bucket
}

output "vpc_id" {
  description = "VPC ID"
  value       = aws_vpc.main.id
}

output "private_subnet_ids" {
  description = "Private subnet IDs (use for ECS / ElastiCache)"
  value       = aws_subnet.private[*].id
}
