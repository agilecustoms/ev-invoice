import { coverageConfigDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      exclude: [
        'src/lambda.ts',
        'src/local.ts',
        'src/openapi.ts',
        '**/*.module.ts',
        'src/auth/model/**',
        ...coverageConfigDefaults.exclude
      ],
      reporter: ['text'], // other: 'html', 'clover', 'json'
      thresholds: {
        lines: 13,
        branches: 0,
      }
    }
  }
})
