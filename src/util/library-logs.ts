import { format } from 'node:util'
import type { Logger } from 'pino'

const levels = { trace: 'trace', debug: 'debug', info: 'info', log: 'info', warn: 'warn', error: 'error' } as const

/**
 * Libraries bypass pino: they log with console.* (AWS SDK, class-validator...), Node prints process warnings to stderr,
 * depd prints deprecations of express and co. to stderr. In Lambda the runtime turns console.* into JSON of its own
 * shape (no service, env, logger, ftime...) and stderr comes as plain text
 * This routes all three to pino, so all log records of the app have the same format
 * Not covered: direct process.stdout/stderr.write (ex: 'debug' library, only when DEBUG env var is set)
 * Call once in the entry point, as early as possible. Not in unit tests: it replaces console of the test runner
 * @param getLogger returns logger of the current request (to get its keys, ex: requestId) or the root one
 */
export function captureLibraryLogs(getLogger: () => Logger): void {
  for (const [method, level] of Object.entries(levels)) {
    console[method as keyof typeof levels] = (...args: unknown[]) => {
      const error = args.find(Error.isError)
      const message = format(...args.filter(arg => arg !== error)) || error?.message
      getLogger()[level]({ logger: 'console', ...error && { error } }, message)
    }
  }
  // Both are events on 'process', a library emits them and a listener decides what to do (print, log, ignore)
  // 'warning' - Node itself registers a listener that prints to stderr, it is replaced here.
  //   Example: (node:1234) [DEP0005] DeprecationWarning: Buffer() is deprecated due to security and usability issues...
  // 'deprecation' - there is no default listener, but if we do not add it, then 'depd' (library often used by express) will
  //   Example: express deprecated res.redirect(url, status): Use res.redirect(status, url) instead
  process.removeAllListeners('warning')
  // name in the message: serialized error has 'type' Error (class name), not the warning name (ex: DeprecationWarning)
  process.on('warning', warning => getLogger().warn({ logger: 'node', error: warning }, `${warning.name}: ${warning.message}`))
  process.on('deprecation', (error: Error & { namespace: string }) =>
    getLogger().warn({ logger: error.namespace, error }, `${error.namespace} deprecated ${error.message}`))
}
