# Same permissions as the lambda role, but developers can assume it, to run the app locally against real AWS.
# A separate role, bcz with such trust policy on the lambda role itself, can't enable DEBUG log level for lambda

data "aws_iam_policy_document" "trust_debug" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]
    principals {
      type        = "AWS"
      identifiers = ["arn:aws:iam::${local.account_id}:root"] # anyone in the account whose own policy allows sts:AssumeRole
    }
  }
}

resource "aws_iam_role" "debug" {
  path                 = "/app/"
  name                 = "${local.full_app_name}-debug"
  assume_role_policy   = data.aws_iam_policy_document.trust_debug.json
  permissions_boundary = "arn:aws:iam::${local.account_id}:policy/boundary/boundary-app"
}

resource "aws_iam_role_policy_attachment" "debug" {
  count      = length(local.lambda_policies)
  role       = aws_iam_role.debug.name
  policy_arn = local.lambda_policies[count.index]
}
