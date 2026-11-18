# ev-invoice
Lambda function to create invoice for Evelin business

## @codegenie/serverless-express

- express — minimal and unopinionated web framework for Node.js
- nestjs — high-level framework that uses express under the hood (alternative is Fastify)
- @codegenie/serverless-express is express adapter to use in AWS Lambda

## Profiles
App gets up to 4 profiles via env var `APP_PROFILES`, in this order (later wins)
1. default - always loaded
2. environment - `dev`, `test`, `prod` (Terraform `var.env_type`)
3. runtime - `aws`, `localaws` (local app + AWS resources of env prod), `openapi` (openapi.json generation)
4. runtime-environment - `{runtime}-{environment}`, e.g. `aws-prod`, for overrides

`src/config/config.ts` reads `config/.env`, then `config/.env.{profile}` for each profile. Missing files are fine.
Values are given to `ConfigService` (ConfigModule `load`), env vars already set (Lambda config, IDE run config) win over files.
Files never change env vars (NestJS env file loading is off).
`config` dir is relative to working dir: `/var/task` in Lambda (packed in `app.zip`), repo root in local run and openapi generation

| runtime    | `APP_PROFILES`              | set by                                                              |
|------------|-----------------------------|---------------------------------------------------------------------|
| `aws`      | `{env},aws,aws-{env}`       | `infrastructure/lambda.tf`                                          |
| `localaws` | `dev,localaws,localaws-dev` | `npm run start:localaws` (IDE `.run/localaws`, `make run-localaws`) |
| `openapi`  | `openapi`                   | `npm run openapi` (`make app3-generate-openapi`)                    |

`openapi` has no environment: spec is built once for all envs

## Run locally

No `local` runtime: dependencies are PayPal (sandbox), AirTable and EventBridge Scheduler, there are no local substitutes,
tests mock them (see Integration tests)

## Run locally with AWS resources (localaws)

Uses AWS resources of env prod (event bus, EventBridge Scheduler), PayPal sandbox and AirTable

- `make app0-install-deps`
- place the following profile in `~/.aws/config`
```
[profile ac-ev-prod-invoice]
role_arn = arn:aws:iam::930413537050:role/app/prod-ev-invoice-debug
source_profile = ac-ev-prod-admin
region = us-east-1
```
- create `config/.env.localaws` (gitignored) from `config/.env.localaws.example`: PayPal sandbox credentials, AirTable token
- start the app: IDE run configuration "localaws" (debug) or `make run-localaws`, `make run-localaws-watch` reloads on code change
- send GET http://localhost:3000/health
- or invoke: the Lambda handler once with an event from a file (`events/`: API Gateway request, SQS message), prints JSON logs
  as in CloudWatch and the response, exit code 1 on error or HTTP 5xx: `make invoke-localaws EVENT=events/health.json`.
  Runs with the same config and credentials as above, refuses runtime `aws`

## PayPal integration

- invoice data type definition https://developer.paypal.com/api/invoicing/v2/definitions/invoice
- 

## Integration tests

No integration tests: PayPal, AirTable (`fetch`) and EventBridge Scheduler (SDK client) are mocked in client tests,
they run as part of `make app2-test`
