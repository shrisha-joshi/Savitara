# =============================================================================
# Savitara — Data layer: ElastiCache Redis + MongoDB Atlas
# =============================================================================

# ── ElastiCache Redis ────────────────────────────────────────────────────────
resource "aws_elasticache_subnet_group" "redis" {
  name       = "${local.name_prefix}-redis-subnets"
  subnet_ids = aws_subnet.private[*].id
  tags       = { Name = "${local.name_prefix}-redis-subnet-group" }
}

resource "aws_elasticache_parameter_group" "redis" {
  name   = "${local.name_prefix}-redis-params"
  family = "redis7"

  parameter {
    name  = "maxmemory-policy"
    value = "allkeys-lru"
  }

  parameter {
    name  = "notify-keyspace-events"
    value = ""
  }
}

resource "aws_elasticache_cluster" "redis" {
  cluster_id           = "${local.name_prefix}-redis"
  engine               = "redis"
  engine_version       = "7.1"
  node_type            = var.redis_node_type
  num_cache_nodes      = var.redis_num_cache_nodes
  parameter_group_name = aws_elasticache_parameter_group.redis.name
  subnet_group_name    = aws_elasticache_subnet_group.redis.name
  security_group_ids   = [aws_security_group.redis.id]

  snapshot_retention_limit = 1
  snapshot_window          = "05:00-06:00"
  maintenance_window       = "sun:06:00-sun:07:00"

  apply_immediately = false

  tags = { Name = "${local.name_prefix}-redis" }
}

# ── MongoDB Atlas ─────────────────────────────────────────────────────────────

resource "mongodbatlas_project" "main" {
  name   = var.atlas_project_name
  org_id = var.atlas_org_id
}

resource "mongodbatlas_cluster" "main" {
  project_id = mongodbatlas_project.main.id
  name       = "${local.name_prefix}-cluster"

  # M10 = 2 vCPU, 2 GB RAM, 10 GB storage — good for production start
  provider_name               = "AWS"
  provider_region_name        = var.atlas_region
  provider_instance_size_name = var.atlas_cluster_tier

  cloud_backup                 = true
  auto_scaling_disk_gb_enabled = true

  replication_specs {
    num_shards = 1

    regions_config {
      region_name     = var.atlas_region
      electable_nodes = 3
      priority        = 7
      read_only_nodes = 0
    }
  }

  advanced_configuration {
    javascript_enabled           = false
    minimum_enabled_tls_protocol = "TLS1_2"
    no_table_scan                = false
  }

  labels {
    key   = "environment"
    value = var.environment
  }
}

# Atlas IP access: allow traffic from the NAT gateway EIP (ECS tasks)
resource "mongodbatlas_project_ip_access_list" "ecs_nat" {
  project_id = mongodbatlas_project.main.id
  ip_address = aws_eip.nat.public_ip
  comment    = "ECS Fargate via NAT gateway"
}

# Atlas database user for the backend service
resource "random_password" "atlas_db" {
  length  = 32
  special = false
}

resource "mongodbatlas_database_user" "backend" {
  project_id         = mongodbatlas_project.main.id
  username           = "savitara-backend"
  password           = random_password.atlas_db.result
  auth_database_name = "admin"

  roles {
    role_name     = "readWrite"
    database_name = "savitara"
  }
}

# Store the Atlas connection string in Secrets Manager (appended to app secrets)
resource "aws_secretsmanager_secret" "atlas_connection" {
  name        = "${local.name_prefix}/atlas-connection"
  description = "MongoDB Atlas connection string for Savitara backend"

  tags = { Name = "${local.name_prefix}-atlas-connection" }
}

resource "aws_secretsmanager_secret_version" "atlas_connection" {
  secret_id = aws_secretsmanager_secret.atlas_connection.id
  secret_string = jsonencode({
    MONGODB_URL = "mongodb+srv://savitara-backend:${random_password.atlas_db.result}@${replace(mongodbatlas_cluster.main.connection_strings[0].standard_srv, "mongodb+srv://", "")}/savitara?retryWrites=true&w=majority"
  })
}
