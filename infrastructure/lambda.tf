locals {
  binary_key = "${local.dist_bucket_prefix}/app.zip"
}

data "aws_s3_object" "binary" {
  bucket = var.dist_bucket
  key    = local.binary_key
}

resource "aws_lambda_function" "lambda" {
  architectures    = ["arm64"]
  memory_size      = 256
  function_name    = local.full_app_name
  role             = aws_iam_role.app.arn
  runtime          = "nodejs24.x"
  s3_bucket        = var.dist_bucket
  s3_key           = local.binary_key
  handler          = "dist/lambda.handler"
  source_code_hash = data.aws_s3_object.binary.etag

  timeout = 10

  logging_config {
    log_format = "JSON"
    log_group  = local.log_group_name
  }
}

# resource "aws_lambda_permission" "agw_cli_authorizer" {
#   statement_id  = "AllowExecutionFromApiGatewayCliAuthorizer"
#   principal     = "apigateway.amazonaws.com"
#   source_arn    = "${var.agw_execution_arn}/authorizers/*"
#   action        = "lambda:InvokeFunction"
#   function_name = aws_lambda_function.lambda.function_name
# }
