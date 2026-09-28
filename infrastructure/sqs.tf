# Async events: EventBridge rule -> SQS queue -> Lambda (event source mapping, see lambda.tf)
# The queue sits in between to retry failed events and keep the ones that keep failing in DLQ

resource "aws_sqs_queue" "app" {
  name                       = local.full_app_name
  delay_seconds              = 0       # delivery delay is not needed
  message_retention_seconds  = 1209600 # 14 days - max value
  receive_wait_time_seconds  = 20      # long polling, recommended
  visibility_timeout_seconds = 60      # AWS recommends at least 6x lambda timeout
  max_message_size           = 2048    # 2KiB
}
# no queue policy for the lambda (resource based policy), access is from within same AWS account so go with Identity based policies

resource "aws_sqs_queue" "dlq" {
  name                       = "${local.full_app_name}-dlq"
  delay_seconds              = 0       # delivery delay is not needed
  message_retention_seconds  = 1209600 # 14 days - max value
  receive_wait_time_seconds  = 20      # long polling, recommended
  visibility_timeout_seconds = 60
  max_message_size           = 2048 # 2KiB

  redrive_allow_policy = jsonencode({
    redrivePermission = "byQueue"
    sourceQueueArns   = [aws_sqs_queue.app.arn]
  })
}

resource "aws_sqs_queue_redrive_policy" "app" {
  queue_url = aws_sqs_queue.app.id

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.dlq.arn
    maxReceiveCount     = 2 # if 2 failures, send to DLQ
  })
}

# the expiry check schedule (see scheduler.tf and schedule.client.ts) puts this event to the event bus
resource "aws_cloudwatch_event_rule" "expiry_check" {
  event_bus_name = var.event_bus_arn
  name           = "${local.full_app_name}-expiry-check"
  event_pattern = jsonencode({
    source      = ["ev-invoice.scheduler"]
    detail-type = ["invoice.expiry-check"]
  })
}

resource "aws_cloudwatch_event_target" "sqs" {
  event_bus_name = var.event_bus_arn
  rule           = aws_cloudwatch_event_rule.expiry_check.name
  arn            = aws_sqs_queue.app.arn
}

resource "aws_sqs_queue_policy" "allow_eventbridge" {
  queue_url = aws_sqs_queue.app.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "events.amazonaws.com"
        }
        Action   = "sqs:SendMessage"
        Resource = aws_sqs_queue.app.arn
        Condition = {
          ArnEquals = {
            "aws:SourceArn" = aws_cloudwatch_event_rule.expiry_check.arn
          }
        }
      }
    ]
  })
}
