import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ConfigService } from '@nestjs/config'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadConfig } from '../../src/config/config.js'

const cwd = process.cwd()

/**
 * Makes temp dir with config/{files} the working dir: loadConfig reads config/.env files relative to it
 */
function chdirWithConfig(files: Record<string, string>): void {
  const dir = mkdtempSync(join(tmpdir(), 'config-'))
  mkdirSync(join(dir, 'config'))
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(join(dir, 'config', name), content)
  }
  process.chdir(dir)
}

describe('loadConfig', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    process.chdir(cwd)
  })

  it('should let later file win', () => {
    vi.stubEnv('APP_PROFILES', ' prod, aws ,,aws-prod') // spaces and empty items are ignored
    chdirWithConfig({
      '.env': 'T_DEFAULT=default\nT_ENV=default\nT_RUNTIME=default\nT_OVERRIDE=default',
      '.env.prod': 'T_ENV=prod\nT_RUNTIME=prod\nT_OVERRIDE=prod',
      '.env.aws': 'T_RUNTIME=aws\nT_OVERRIDE=aws',
      '.env.aws-prod': 'T_OVERRIDE=aws-prod'
    })

    expect(loadConfig()).toEqual({ T_DEFAULT: 'default', T_ENV: 'prod', T_RUNTIME: 'aws', T_OVERRIDE: 'aws-prod' })
  })

  it('should let env var win over files', () => {
    vi.stubEnv('APP_PROFILES', 'prod')
    vi.stubEnv('T_VAR', 'from-env')
    chdirWithConfig({ '.env.prod': 'T_VAR=from-file' })

    expect(loadConfig()).toEqual({ T_VAR: 'from-env' })
  })

  it('should not set env vars', () => {
    vi.stubEnv('APP_PROFILES', '')
    vi.stubEnv('T_NOT_SET', undefined)
    chdirWithConfig({ '.env': 'T_NOT_SET=1' })

    loadConfig()

    expect(process.env['T_NOT_SET']).toBeUndefined()
  })

  it('should skip missing files', () => {
    vi.stubEnv('APP_PROFILES', 'prod,aws,aws-prod')
    chdirWithConfig({})

    expect(loadConfig()).toEqual({})
  })

  it('should parse comments and quotes', () => {
    vi.stubEnv('APP_PROFILES', undefined)
    chdirWithConfig({ '.env': '# comment\n\nT_PLAIN=plain\nT_DOUBLE="double quoted"\nT_SINGLE=\'single\'\nT_EQ=a=b\n' })

    expect(loadConfig()).toEqual({ T_PLAIN: 'plain', T_DOUBLE: 'double quoted', T_SINGLE: 'single', T_EQ: 'a=b' })
  })

  it('should give ConfigService env var first, then file, then other env vars', () => {
    vi.stubEnv('APP_PROFILES', 'prod')
    vi.stubEnv('T_BOTH', 'from-env')
    vi.stubEnv('T_ENV_ONLY', 'from-env')
    chdirWithConfig({ '.env.prod': 'T_BOTH=from-file\nT_FILE_ONLY=from-file' })

    const config = new ConfigService(loadConfig()) // same as ConfigModule 'load'

    expect(config.getOrThrow('T_BOTH')).toBe('from-env')
    expect(config.getOrThrow('T_FILE_ONLY')).toBe('from-file')
    expect(config.getOrThrow('T_ENV_ONLY')).toBe('from-env')
  })

  it('should read real config files of aws prod', () => {
    vi.stubEnv('APP_PROFILES', 'prod,aws,aws-prod')
    vi.stubEnv('DEPOSIT_TERM', undefined)

    const config = loadConfig()

    expect(config['AIRTABLE_BASE_ID']).toBeDefined() // config/.env
    expect(config['DEPOSIT_TERM']).toBe('PT24H') // config/.env.prod
    expect(config['PAYPAL_URL']).toBe('https://api-m.paypal.com') // config/.env.prod
  })
})
