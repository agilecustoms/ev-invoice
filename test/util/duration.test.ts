import { Temporal } from '@js-temporal/polyfill'
import { describe, expect, it } from 'vitest'
import { formatDuration } from '../../src/util/duration.js'

describe('formatDuration', () => {
  it.each([
    ['PT24H', '24 hours'],
    ['PT10M', '10 minutes'],
    ['PT1H', '1 hour'],
    ['PT1H30M', '1 hour 30 minutes'],
    ['P2D', '2 days'],
  ])('formats %s as %s', (iso, text) => {
    expect(formatDuration(Temporal.Duration.from(iso))).toBe(text)
  })
})
