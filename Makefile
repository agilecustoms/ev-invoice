APP_NAME = ev-invoice
ENV := "prod"

_aws-login:
	@aws sso login

# npm list --all - show dependency tree
app0-install-deps:
	@npm install

app0-update-deps:
	@npm update; npm install; npm outdated; npm find-dupes

app1-lint:
	@npm run lint

app1-lint-fix: # not called by CI (local only: fixes lint errors in place)
	@npm run lint:fix

app2-test:
	@npm run test

app3-build:
	@rm -rf dist; npm run build

app3-generate-openapi: # needs to be called after build (ts ~~> js)
	@npm run openapi

app3-package:
	@set -e; \
	rm -rf tmp dist/app.zip; \
	zip -rq dist/app.zip dist -x 'dist/*.map' 'dist/run_local.*' 'dist/openapi.*'; \
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

# ---------------------------------------------------

# server on http://localhost:3000 with AWS resources of env prod, PayPal sandbox, AirTable (config/.env.localaws, see README)
run-localaws:
	@npm run start:localaws

# same with reload on code change
run-localaws-watch:
	@npm run start:localaws:watch

# ---------------------------------------------------

hot-redeploy: app3-build app3-package
	@export AWS_PROFILE=ac-ev-prod-admin; \
	aws lambda update-function-code --function-name $(ENV)-$(APP_NAME) --zip-file fileb://dist/app.zip --no-cli-pager > /dev/null

# ---------------------------------------------------

# Download Terraform modules to satisfy IDE
terraform-get:
	@cd infrastructure; terraform get -update

terraform-init:
	@cd infrastructure; terraform init

terraform-validate:
	@cd infrastructure; terraform validate

terraform-format:
	@cd infrastructure; terraform fmt -recursive
