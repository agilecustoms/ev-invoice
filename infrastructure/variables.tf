variable "aVersion" {}
variable "dist_bucket" {}
variable "env" {}
variable "event_bus_arn" {} # from ev-core, the expiry check schedule puts its event there
variable "env_type" {
  description = "Environment type (dev, test, prod)"
  type        = string
  validation {
    condition     = contains(["dev", "test", "prod"], var.env_type)
    error_message = "The env_type must be one of: dev, test, prod."
  }
}
