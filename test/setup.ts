// Runs before every test file. DTOs use class-transformer/class-validator decorators, which need
// Reflect.getMetadata at class-definition time. In the real app this comes as a side effect of
// importing @nestjs/common (see src/lambda.ts et al. for the explicit, defensive import there);
// a test can import a DTO before that happens, so load the polyfill deterministically here instead
import 'reflect-metadata'
