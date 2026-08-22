locals {
  log_group_name = "/aws/lambda/${local.app_name}"
  # shared among multiple environments, so retention depends on account, not env_size
  logs_retention = var.env_type == "dev" ? 30 : 365
}

# all environments within AWS Account (mainly Dev) share same log group
# so logic - if not exist - create, if exists - use
data "aws_cloudwatch_log_groups" "logs" {
  log_group_name_prefix = local.log_group_name
}

resource "aws_cloudwatch_log_group" "logs" {
  count             = length(data.aws_cloudwatch_log_groups.logs.arns) == 0 ? 1 : 0
  name              = local.log_group_name
  retention_in_days = local.logs_retention
  skip_destroy      = true # can review logs after CI build fail and env destroyed
}
