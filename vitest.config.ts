import { coverageConfigDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  // tsconfig.json includes only 'src', so tests do not get its 'experimentalDecorators': enable Nest (legacy) decorators here
  oxc: {
    decorator: { legacy: true, emitDecoratorMetadata: true }
  },
  test: {
    setupFiles: ['./test/setup.ts'],
    coverage: {
      exclude: [
        'src/lambda_handler.ts',
        'src/run_local.ts',
        'src/invoke.ts',
        'src/openapi.ts',
        '**/*.module.ts',
        'src/auth/model/**',
        ...coverageConfigDefaults.exclude
      ],
      reporter: ['text'], // other: 'html', 'clover', 'json'
      thresholds: {
        lines: 75,
        branches: 60,
      }
    }
  }
})
