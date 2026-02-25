# =============================================================================
# Savitara — AWS Secrets Manager entries
#
# All secrets are stored as a single JSON secret (reduces cost vs. individual
# secrets) and injected into ECS tasks as individual env vars via the
# "secrets" block in the task definition.
# =============================================================================

resource "aws_secretsmanager_secret" "app_secrets" {
  name        = "${local.name_prefix}/app-secrets"
  description = "Savitara application secrets (injected into ECS tasks)"

  recovery_window_in_days = 7

  tags = { Name = "${local.name_prefix}-app-secrets" }
}

resource "aws_secretsmanager_secret_version" "app_secrets" {
  secret_id = aws_secretsmanager_secret.app_secrets.id

  # terraform apply will set the initial values from variables.
  # Rotate secrets via the AWS Console or CLI — do NOT re-apply with new
  # values through Terraform (it will force a new ECS task rollout).
  secret_string = jsonencode({
    SECRET_KEY           = var.secret_key
    JWT_SECRET_KEY       = var.jwt_secret_key
    GOOGLE_CLIENT_ID     = var.google_client_id
    GOOGLE_CLIENT_SECRET = var.google_client_secret
    RAZORPAY_KEY_ID      = var.razorpay_key_id
    RAZORPAY_KEY_SECRET  = var.razorpay_key_secret
    SENTRY_DSN           = var.sentry_dsn
  })

  lifecycle {
    # Prevent accidental secret overwrite when variables change in Terraform.
    # Use AWS Secrets Manager rotation or manual update for production secrets.
    ignore_changes = [secret_string]
  }
}

# ── Secret rotation (optional) ────────────────────────────────────────────────
# Uncomment to enable automatic rotation via a Lambda function.
# resource "aws_secretsmanager_secret_rotation" "app_secrets" {
#   secret_id           = aws_secretsmanager_secret.app_secrets.id
#   rotation_lambda_arn = aws_lambda_function.secret_rotator.arn
#
#   rotation_rules {
#     automatically_after_days = 30
#   }
# }
