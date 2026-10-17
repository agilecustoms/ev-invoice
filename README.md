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
3. runtime - `aws`, `local`, `openapi` (openapi.json generation)
4. runtime-environment - `{runtime}-{environment}`, e.g. `aws-prod`, for overrides

`src/config/config.ts` reads `config/.env`, then `config/.env.{profile}` for each profile. Missing files are fine.
Values are given to `ConfigService` (ConfigModule `load`), env vars already set (Lambda config, IDE run config) win over files.
Files never change env vars (NestJS env file loading is off).
`config` dir is relative to working dir: `/var/task` in Lambda (packed in `app.zip`), repo root in local run and openapi generation

| runtime   | `APP_PROFILES`        | set by                     |
|-----------|-----------------------|----------------------------|
| `aws`     | `{env},aws,aws-{env}` | `infrastructure/lambda.tf` |
| `local`   | `dev,local,local-dev` | `npm run start`            |
| `openapi` | `openapi`             | `npm run openapi`          |

`openapi` has no environment: spec is built once for all envs

## Local run
- `npm install` install dependencies
- create file `config/.env.local` (copy from `config/.env.local.example`), it is gitignored
- `npm run start` start the server

## PayPal integration

- invoice data type definition https://developer.paypal.com/api/invoicing/v2/definitions/invoice
- 