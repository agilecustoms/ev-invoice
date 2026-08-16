data "aws_iam_policy_document" "trust" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "app" {
  path                 = "/app/"
  name                 = local.full_app_name
  assume_role_policy   = data.aws_iam_policy_document.trust.json
  permissions_boundary = "arn:aws:iam::${local.account_id}:policy/boundary/boundary-app"
}

locals {
  lambda_policies = [
    aws_iam_policy.app.arn,
  ]
}

resource "aws_iam_role_policy_attachment" "app" {
  count      = length(local.lambda_policies)
  role       = aws_iam_role.app.name
  policy_arn = local.lambda_policies[count.index]
}
