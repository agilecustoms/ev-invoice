.PHONY: test

APP_NAME = ev-invoice
ENV := "prod"

_aws-login:
	@aws sso login

# npm list --all - show dependency tree
deps-install:
	@npm install

deps-update:
	@npm update; npm install; npm outdated; npm find-dupes

# eslint, then type check (tsc)
# fix: npm run lint -- --fix
lint-app:
	@npm run lint && npm run typecheck

# fix: terraform fmt -recursive infrastructure
lint-tf:
	@terraform fmt -check -recursive infrastructure

test:
	@npm run test

build:
	@rm -rf dist; npm run build
	@set -e; \
	rm -rf tmp dist/app.zip; \
	zip -rq dist/app.zip dist -x 'dist/*.map' 'dist/run_local.*' 'dist/invoke.*' 'dist/local.module.*' 'dist/openapi.*'; \
	zip -rq dist/app.zip config -x 'config/.env.localaws*'; \
	mkdir tmp; \
	cp -R package.json package-lock.json node_modules tmp/; \
	cd tmp; \
	npm prune --omit=dev; \
	zip -rq ../dist/app.zip node_modules -x '*.md' '*.ts' '*.yml' '*.markdown' '*.html' '*.sh' '*.un~' '*.cmd' '*.d.cts' \
	 '*.d.ts.map' '*.js.map' \
	 '**/LICENSE*' '**/license*' '**/ChangeLog' '**/AUTHORS' '**/CopyrightNotice.txt' '**/NOTICE.txt' \
	 '**/tsconfig*' '**/bower.json' '**/.package-lock.json' \
	 '**/.jshintrc' '**/.editorconfig' '**/.eslintrc' '**/.eslintrc.js' '**/.nycrc' '**/.npmignore' '**/.prettierrc.json' \
	 '**/.gitkeep' '**/Makefile' '**/karma.conf.js' '**/.nycrc' '**/.eslintignore' '**/.babelrc' \
	 '**/__tests__/**' '**/test/**' '**/tests/**' '**/.claude/**' '**/.idea/**' '**/.vscode/**' '**/.husky/**' \
	 'node_modules/aws-sdk/apis/**' 'node_modules/aws-sdk/Crashpad/**' 'node_modules/aws-sdk/dist-tools/**' 'node_modules/aws-sdk/scripts/**' \
	 'node_modules/.vite*'; \
	rm -rf ../tmp

openapi: # needs to be called after build (ts ~~> js)
	@npm run openapi

# ---------------------------------------------------

# server on http://localhost:3000 with AWS resources of env prod, PayPal sandbox, AirTable (config/.env.localaws, see README)
run-localaws:
	@npm run start:localaws

# same with reload on code change
run-localaws-watch:
	@npm run start:localaws:watch

# Lambda handler once with an event from a file (no local runtime, so localaws as run-localaws): make invoke-localaws EVENT=events/health.json
invoke-localaws:
	@npm run invoke:localaws -- $(EVENT)

# ---------------------------------------------------

hot-redeploy: build
	@export AWS_PROFILE=ac-ev-prod-admin; \
	aws lambda update-function-code --function-name $(ENV)-$(APP_NAME) --zip-file fileb://dist/app.zip --no-cli-pager > /dev/null

# ---------------------------------------------------

# Download Terraform modules to satisfy IDE
terraform-get:
	@cd infrastructure; terraform get -update

terraform-init:
	@cd infrastructure; terraform init
