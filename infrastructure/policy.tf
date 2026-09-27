# TODO: ----------------------------------------------------------------------------------------------------------------
# TODO: often you need to modify permission boundary policy (/infrastructure-core/aws/common_dev_prod/boundary-app.tf)
# TODO: ----------------------------------------------------------------------------------------------------------------

data "aws_iam_policy_document" "app_iam" {
  # a schedule runs on behalf of the scheduler role, so creating a schedule requires passing that role
  statement {
    effect = "Allow"
    actions = [
      "iam:PassRole"
    ]
    resources = [aws_iam_role.scheduler.arn]
    condition {
      test     = "StringEquals"
      variable = "iam:PassedToService"
      values   = ["scheduler.amazonaws.com"]
    }
  }
}

data "aws_iam_policy_document" "app_logs" {
  statement {
    effect = "Allow"
    actions = [
      "logs:CreateLogStream",
      "logs:PutLogEvents",
    ]
    resources = [
      # "${aws_cloudwatch_log_group.logs.arn}:log-stream:*" - can not do that, bcz many envs share same log group
      "arn:aws:logs:${local.region}:${local.account_id}:log-group:${local.log_group_name}:log-stream:*"
    ]
  }
}

data "aws_iam_policy_document" "app_secrets" {
  statement {
    effect  = "Allow"
    actions = ["secretsmanager:GetSecretValue"]
    resources = [
      aws_secretsmanager_secret.paypal.arn,
      aws_secretsmanager_secret.airtable.arn
    ]
  }
}

data "aws_iam_policy_document" "app_scheduler" {
  statement {
    effect = "Allow"
    actions = [
      "scheduler:CreateSchedule",
    ]
    resources = [
      "arn:aws:scheduler:${local.region}:${local.account_id}:schedule/${aws_scheduler_schedule_group.app.id}/*",
    ]
  }
}

data "aws_iam_policy_document" "app" {
  source_policy_documents = [
    data.aws_iam_policy_document.app_iam.json,
    data.aws_iam_policy_document.app_logs.json,
    data.aws_iam_policy_document.app_scheduler.json,
    data.aws_iam_policy_document.app_secrets.json,
  ]
}

resource "aws_iam_policy" "app" {
  path   = "/app/"
  name   = local.full_app_name
  policy = data.aws_iam_policy_document.app.json
}
