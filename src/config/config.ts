import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseEnv } from 'node:util'

/**
 * Dir with .env files, relative to working dir: /var/task in Lambda, repo root in local run and openapi generation
 */
const PROFILES_DIR = 'config'

/**
 * Config items from .env files of APP_PROFILES, for ConfigModule 'load' (see README).
 * ConfigService checks 'load' values first and env vars after, so here env var (Lambda config, IDE run config)
 * replaces file value of the same key to make env var win. Env vars are not touched
 */
export function loadConfig(): Record<string, string> {
  const items = readProfiles(PROFILES_DIR)
  for (const key of Object.keys(items)) {
    const fromEnv = process.env[key]
    if (fromEnv !== undefined) {
      items[key] = fromEnv
    }
  }
  return items
}

/**
 * Reads {dir}/.env, then {dir}/.env.{profile} for each of profiles into one object (later file wins),
 * missing files are skipped
 */
function readProfiles(dir: string): Record<string, string> {
  const files = ['.env', ...profiles().map(p => `.env.${p}`)]
  const merged: Record<string, string> = {}
  for (const file of files) {
    const path = join(dir, file)
    if (existsSync(path)) {
      Object.assign(merged, parseEnv(readFileSync(path, 'utf8')))
    }
  }
  return merged
}

/**
 * APP_PROFILES as a list, order: {environment},{runtime},{runtime}-{environment} (see README)
 */
function profiles(): string[] {
  return (process.env['APP_PROFILES'] ?? '')
    .split(',')
    .map(p => p.trim())
    .filter(p => p !== '')
}
