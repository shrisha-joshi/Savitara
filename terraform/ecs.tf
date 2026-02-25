# =============================================================================
# Savitara — ECR repository + ECS Fargate cluster / service / autoscaling
# =============================================================================

# ── ECR Repository ───────────────────────────────────────────────────────────
resource "aws_ecr_repository" "backend" {
  name                 = "${local.name_prefix}-backend"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "KMS"
  }

  tags = { Name = "${local.name_prefix}-backend-ecr" }
}

resource "aws_ecr_lifecycle_policy" "backend" {
  repository = aws_ecr_repository.backend.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Retain last 10 production images"
        selection = {
          tagStatus   = "tagged"
          tagPrefixList = ["v"]
          countType   = "imageCountMoreThan"
          countNumber = 10
        }
        action = { type = "expire" }
      },
      {
        rulePriority = 2
        description  = "Expire untagged images after 7 days"
        selection = {
          tagStatus = "untagged"
          countType = "sinceImagePushed"
          countUnit = "days"
          countNumber = 7
        }
        action = { type = "expire" }
      }
    ]
  })
}

# ── ECS Cluster ──────────────────────────────────────────────────────────────
resource "aws_ecs_cluster" "main" {
  name = "${local.name_prefix}-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = { Name = "${local.name_prefix}-ecs-cluster" }
}

resource "aws_ecs_cluster_capacity_providers" "main" {
  cluster_name = aws_ecs_cluster.main.name

  capacity_providers = ["FARGATE", "FARGATE_SPOT"]

  default_capacity_provider_strategy {
    base              = 1
    weight            = 70
    capacity_provider = "FARGATE"
  }

  default_capacity_provider_strategy {
    weight            = 30
    capacity_provider = "FARGATE_SPOT"
  }
}

# ── IAM: ECS task execution role ─────────────────────────────────────────────
data "aws_iam_policy_document" "ecs_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "ecs_task_execution" {
  name               = "${local.name_prefix}-ecs-task-exec"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json
}

resource "aws_iam_role_policy_attachment" "ecs_task_execution" {
  role       = aws_iam_role.ecs_task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Allow task execution role to read secrets
resource "aws_iam_role_policy" "ecs_secrets" {
  name = "${local.name_prefix}-ecs-secrets-access"
  role = aws_iam_role.ecs_task_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["secretsmanager:GetSecretValue"]
        Resource = aws_secretsmanager_secret.app_secrets.arn
      }
    ]
  })
}

# Task role (what the application itself can do)
resource "aws_iam_role" "ecs_task" {
  name               = "${local.name_prefix}-ecs-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json
}

resource "aws_iam_role_policy" "ecs_task_s3" {
  name = "${local.name_prefix}-ecs-s3-access"
  role = aws_iam_role.ecs_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"]
        Resource = "arn:aws:s3:::${local.name_prefix}-uploads/*"
      },
      {
        Effect   = "Allow"
        Action   = ["s3:ListBucket"]
        Resource = "arn:aws:s3:::${local.name_prefix}-uploads"
      }
    ]
  })
}

# ── CloudWatch Log Group ──────────────────────────────────────────────────────
resource "aws_cloudwatch_log_group" "backend" {
  name              = "/ecs/${local.name_prefix}-backend"
  retention_in_days = 30
  tags              = { Name = "${local.name_prefix}-backend-logs" }
}

# ── ECS Task Definition ───────────────────────────────────────────────────────
resource "aws_ecs_task_definition" "backend" {
  family                   = "${local.name_prefix}-backend"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.backend_cpu
  memory                   = var.backend_memory
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name      = "backend"
      image     = var.backend_image
      essential = true

      portMappings = [
        {
          containerPort = 8000
          protocol      = "tcp"
        }
      ]

      environment = [
        { name = "APP_ENV",      value = var.environment },
        { name = "REDIS_URL",    value = "redis://${aws_elasticache_cluster.redis.cache_nodes[0].address}:6379/0" },
        { name = "MONGODB_URL",  value = "mongodb+srv://${mongodbatlas_cluster.main.connection_strings[0].standard_srv}" },
        { name = "LOG_LEVEL",    value = "INFO" }
      ]

      secrets = [
        {
          name      = "SECRET_KEY"
          valueFrom = "${aws_secretsmanager_secret.app_secrets.arn}:SECRET_KEY::"
        },
        {
          name      = "JWT_SECRET_KEY"
          valueFrom = "${aws_secretsmanager_secret.app_secrets.arn}:JWT_SECRET_KEY::"
        },
        {
          name      = "GOOGLE_CLIENT_ID"
          valueFrom = "${aws_secretsmanager_secret.app_secrets.arn}:GOOGLE_CLIENT_ID::"
        },
        {
          name      = "GOOGLE_CLIENT_SECRET"
          valueFrom = "${aws_secretsmanager_secret.app_secrets.arn}:GOOGLE_CLIENT_SECRET::"
        },
        {
          name      = "RAZORPAY_KEY_ID"
          valueFrom = "${aws_secretsmanager_secret.app_secrets.arn}:RAZORPAY_KEY_ID::"
        },
        {
          name      = "RAZORPAY_KEY_SECRET"
          valueFrom = "${aws_secretsmanager_secret.app_secrets.arn}:RAZORPAY_KEY_SECRET::"
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.backend.name
          awslogs-region        = var.aws_region
          awslogs-stream-prefix = "ecs"
        }
      }

      healthCheck = {
        command     = ["CMD-SHELL", "curl -f http://localhost:8000/health || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 60
      }

      readonlyRootFilesystem = false
      privileged             = false
    }
  ])

  tags = { Name = "${local.name_prefix}-backend-task" }
}

# ── ECS Service ───────────────────────────────────────────────────────────────
resource "aws_ecs_service" "backend" {
  name                               = "${local.name_prefix}-backend"
  cluster                            = aws_ecs_cluster.main.id
  task_definition                    = aws_ecs_task_definition.backend.arn
  desired_count                      = var.backend_desired_count
  launch_type                        = "FARGATE"
  platform_version                   = "LATEST"
  health_check_grace_period_seconds  = 60
  force_new_deployment               = true

  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = [aws_security_group.backend.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.backend.arn
    container_name   = "backend"
    container_port   = 8000
  }

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  deployment_controller {
    type = "ECS"
  }

  depends_on = [aws_lb_listener.https]

  lifecycle {
    ignore_changes = [desired_count]   # managed by autoscaling
  }

  tags = { Name = "${local.name_prefix}-backend-service" }
}

# ── Auto Scaling ──────────────────────────────────────────────────────────────
resource "aws_appautoscaling_target" "backend" {
  max_capacity       = var.backend_max_count
  min_capacity       = var.backend_min_count
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.backend.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "cpu" {
  name               = "${local.name_prefix}-cpu-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.backend.resource_id
  scalable_dimension = aws_appautoscaling_target.backend.scalable_dimension
  service_namespace  = aws_appautoscaling_target.backend.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value       = 70.0
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
  }
}

resource "aws_appautoscaling_policy" "memory" {
  name               = "${local.name_prefix}-memory-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.backend.resource_id
  scalable_dimension = aws_appautoscaling_target.backend.scalable_dimension
  service_namespace  = aws_appautoscaling_target.backend.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageMemoryUtilization"
    }
    target_value       = 80.0
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
  }
}

# ── S3 Bucket for uploads ─────────────────────────────────────────────────────
resource "aws_s3_bucket" "uploads" {
  bucket = "${local.name_prefix}-uploads"
  tags   = { Name = "${local.name_prefix}-uploads" }
}

resource "aws_s3_bucket_versioning" "uploads" {
  bucket = aws_s3_bucket.uploads.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "uploads" {
  bucket                  = aws_s3_bucket.uploads.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
