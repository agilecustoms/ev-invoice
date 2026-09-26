# Only the secret "containers" are managed here - the value is NOT in Terraform, so it never lands in the state.
# Set it once per environment (JSON with client id and client secret from PayPal for Business):

resource "aws_secretsmanager_secret" "paypal" {
  name                    = "${local.full_app_name}/paypal" # {env}-ev-invoice/paypal
  description             = "PayPal REST API credentials"
  recovery_window_in_days = var.env_type == "prod" ? 30 : 0
}

resource "aws_secretsmanager_secret" "airtable" {
  name                    = "${local.full_app_name}/airtable" # {env}-ev-invoice/airtable
  description             = "AirTable API credentials"
  recovery_window_in_days = var.env_type == "prod" ? 30 : 0
}
