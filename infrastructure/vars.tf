variable "aVersion" {}
variable "dist_bucket" {}
variable "env" {}
variable "env_type" {
  description = "Environment type (dev, test, prod)"
  type        = string
  validation {
    condition     = contains(["dev", "test", "prod"], var.env_type)
    error_message = "The env_type must be one of: dev, test, prod."
  }
}

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

locals {
  app_name           = "ev-invoice"
  full_app_name      = "${var.env}-${local.app_name}" # env-ev-invoice
  dist_bucket_prefix = "${local.app_name}/${var.aVersion}"

  account_id = data.aws_caller_identity.current.account_id
  region     = data.aws_region.current.region
}
