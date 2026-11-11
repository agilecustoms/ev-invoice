terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 6.0"
    }
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
