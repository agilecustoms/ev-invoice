# TODO: ----------------------------------------------------------------------------------------------------------------
# TODO: often you need to modify permission boundary policy (/infrastructure-core/aws/common_dev_prod/boundary-app.tf)
# TODO: ----------------------------------------------------------------------------------------------------------------

data "aws_iam_policy_document" "logs" {
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

data "aws_iam_policy_document" "secrets" {
  statement {
    effect    = "Allow"
    actions   = ["secretsmanager:GetSecretValue"]
    resources = [aws_secretsmanager_secret.paypal.arn]
  }
}

data "aws_iam_policy_document" "app" {
  source_policy_documents = [
    data.aws_iam_policy_document.logs.json,
    data.aws_iam_policy_document.secrets.json,
  ]
}

resource "aws_iam_policy" "app" {
  path   = "/app/"
  name   = local.full_app_name
  policy = data.aws_iam_policy_document.app.json
}
