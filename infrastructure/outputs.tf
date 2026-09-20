output "api" {
  value = {
    name        = local.app_name
    version     = var.aVersion
    invoke_arn  = aws_lambda_function.app.arn
    healthcheck = "/public/health"
  }
}
