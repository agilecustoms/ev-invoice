import { createRequire } from 'node:module'
import { type Logger, pino } from 'pino'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { captureLibraryLogs } from '../../src/util/library-logs.js'

// depd is a transitive dependency (express), no types
const depd = createRequire(import.meta.url)('depd') as (namespace: string) => (message: string) => void

describe('captureLibraryLogs', () => {
  const originalConsole = { ...console }
  const originalWarningListeners = process.listeners('warning')
  let lines: string[]
  let logger: Logger

  beforeEach(() => {
    lines = []
    logger = pino({ messageKey: 'message', errorKey: 'error', level: 'debug' }, { write: (line: string) => lines.push(line) })
    captureLibraryLogs(() => logger)
  })

  afterEach(() => {
    Object.assign(console, originalConsole)
    process.removeAllListeners('warning')
    originalWarningListeners.forEach(listener => process.on('warning', listener))
    process.removeAllListeners('deprecation')
  })

  function records(): Record<string, unknown>[] {
    return lines.map(line => JSON.parse(line))
  }

  it('routes console methods to logger with matching level', () => {
    console.log('log %s', 'formatted', { a: 1 })
    console.debug('debug')
    console.warn('warn')

    const [log, debug, warn] = records()
    expect(log).toMatchObject({ level: 30, logger: 'console', message: 'log formatted { a: 1 }' })
    expect(debug).toMatchObject({ level: 20, message: 'debug' })
    expect(warn).toMatchObject({ level: 40, message: 'warn' })
  })

  it('logs error argument with stack trace', () => {
    console.error('Failed to construct URL', new Error('boom'))
    console.error(new Error('error only'))

    const [withMessage, errorOnly] = records()
    expect(withMessage).toMatchObject({ level: 50, message: 'Failed to construct URL', error: { message: 'boom' } })
    expect((withMessage!['error'] as { stack: string }).stack).toContain('library-logs.test.ts')
    expect(errorOnly).toMatchObject({ message: 'error only', error: { message: 'error only' } })
  })

  it('routes process warnings to logger', async () => {
    process.emitWarning('The AWS SDK for JavaScript (v3) will no longer support Node.js', 'NodeVersionSupportWarning')
    await new Promise(resolve => process.nextTick(resolve)) // warning is emitted on next tick

    expect(records()).toEqual([expect.objectContaining({
      level: 40,
      logger: 'node',
      message: 'NodeVersionSupportWarning: The AWS SDK for JavaScript (v3) will no longer support Node.js',
      error: expect.objectContaining({ stack: expect.stringContaining('library-logs.test.ts') })
    })])
  })

  it('routes depd deprecations to logger', () => {
    depd('express')('res.redirect(url, status): Use res.redirect(status, url) instead')

    expect(records()).toEqual([expect.objectContaining({
      level: 40,
      logger: 'express',
      message: 'express deprecated res.redirect(url, status): Use res.redirect(status, url) instead',
      // depd stack starts at the caller of the deprecated function (here: vitest runner), not at depd call
      error: expect.objectContaining({ stack: expect.stringMatching(/^DeprecationError: express deprecated res.redirect/) })
    })])
  })
})
