import { Temporal } from '@js-temporal/polyfill'

const UNITS = ['days', 'hours', 'minutes', 'seconds'] as const

/**
 * Parses an ISO 8601 duration from config (e.g. PT24H, PT10M), so a typo fails at startup, not on first use
 */
export function parsePositiveDuration(key: string, value: string): Temporal.Duration {
  const duration = Temporal.Duration.from(value) // throws RangeError on a malformed value
  if (duration.sign <= 0) {
    throw new RangeError(`${key} must be a positive duration, got ${value}`)
  }
  return duration
}

/**
 * Human-readable, for texts the customer reads: PT24H -> '24 hours', PT1H30M -> '1 hour 30 minutes'
 */
export function formatDuration(duration: Temporal.Duration): string {
  return UNITS
    .filter(unit => duration[unit] !== 0)
    .map(unit => `${duration[unit]} ${duration[unit] === 1 ? unit.slice(0, -1) : unit}`)
    .join(' ')
}
