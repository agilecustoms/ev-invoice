# EventBridge Scheduler: the app creates one-time schedules (invoice expiry check) in this group,
# on time a schedule puts an event to the event bus. Deleting the group deletes all its schedules

resource "aws_scheduler_schedule_group" "app" {
  name = local.full_app_name
}

# EventBridge Scheduler requires an IAM role to operate on the target (put event to the event bus)

data "aws_iam_policy_document" "scheduler_events" {
  statement {
    effect = "Allow"
    actions = [
      "events:PutEvents",
    ]
    resources = [var.event_bus_arn]
  }
}

data "aws_iam_policy_document" "scheduler" {
  source_policy_documents = [
    data.aws_iam_policy_document.scheduler_events.json,
  ]
}

resource "aws_iam_policy" "scheduler" {
  path   = "/app/"
  name   = "${local.full_app_name}-scheduler"
  policy = data.aws_iam_policy_document.scheduler.json
}

# Role

data "aws_iam_policy_document" "scheduler_trust" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["scheduler.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "scheduler" {
  path                 = "/app/"
  name                 = "${local.full_app_name}-scheduler"
  assume_role_policy   = data.aws_iam_policy_document.scheduler_trust.json
  permissions_boundary = "arn:aws:iam::${local.account_id}:policy/boundary/boundary-app"
}

resource "aws_iam_role_policy_attachment" "scheduler" {
  role       = aws_iam_role.scheduler.name
  policy_arn = aws_iam_policy.scheduler.arn
}
