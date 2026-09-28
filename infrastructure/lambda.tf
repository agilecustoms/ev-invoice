locals {
  binary_key = "${local.dist_bucket_prefix}/app.zip"
}

data "aws_s3_object" "binary" {
  bucket = var.dist_bucket
  key    = local.binary_key
}

resource "aws_lambda_function" "app" {
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

  environment {
    variables = {
      AIRTABLE_SECRET_ID = aws_secretsmanager_secret.airtable.name
      EVENT_BUS_ARN      = var.event_bus_arn
      PAYPAL_SECRET_ID   = aws_secretsmanager_secret.paypal.name
      SCHEDULE_GROUP     = aws_scheduler_schedule_group.app.id
      SCHEDULE_ROLE_ARN  = aws_iam_role.scheduler.arn
    }
  }

  logging_config {
    log_format = "JSON"
    log_group  = local.log_group_name
  }
}

resource "aws_lambda_event_source_mapping" "sqs" {
  function_name    = aws_lambda_function.app.arn
  event_source_arn = aws_sqs_queue.app.arn
  batch_size       = 1

  # the mapping polls the queue with the lambda role, so it needs sqs permissions attached first
  depends_on = [aws_iam_role_policy_attachment.app]
}
