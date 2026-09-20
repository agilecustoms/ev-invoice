output "api" {
  value = {
    name        = local.app_name
    version     = var.aVersion
    invoke_arn  = aws_lambda_function.app.invoke_arn # arn:aws:apigateway:{region}:lambda:path/2015-03-31/functions/{lambda.arn}/invocations
    healthcheck = "/public/health"
  }
}
