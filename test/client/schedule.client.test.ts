import { CreateScheduleCommand, DeleteScheduleCommand, ResourceNotFoundException, SchedulerClient } from '@aws-sdk/client-scheduler'
import type { ConfigService } from '@nestjs/config'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ScheduleClient } from '../../src/client/schedule.client.js'

const CONFIG: Record<string, string> = {
  SCHEDULE_GROUP: 'dev-ev-invoice',
  SCHEDULE_ROLE_ARN: 'arn:aws:iam::123456789012:role/app/dev-ev-invoice-scheduler',
  EVENT_BUS_ARN: 'arn:aws:events:us-east-1:123456789012:event-bus/dev-ev-core',
}
const config = { getOrThrow: (key: string) => CONFIG[key] } as unknown as ConfigService

describe('ScheduleClient', () => {
  let send: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-09-26T21:47:08.123Z'))
    send = vi.spyOn(SchedulerClient.prototype, 'send').mockResolvedValue({} as never)
  })

  afterEach(() => {
    vi.useRealTimers()
    send.mockRestore()
  })

  it('schedules an expiry check event in 48 hours', async () => {
    await new ScheduleClient(config).scheduleExpiryCheck('recDkcV8BUDP5kfkX', 'INV2-Z56S-5LLA-Q52L-CPZ5')

    const command = send.mock.calls[0]![0] as CreateScheduleCommand
    expect(command).toBeInstanceOf(CreateScheduleCommand)
    expect(command.input).toEqual({
      GroupName: 'dev-ev-invoice',
      Name: 'expiry-check-INV2-Z56S-5LLA-Q52L-CPZ5',
      ScheduleExpression: 'at(2026-09-28T21:47:08)',
      ScheduleExpressionTimezone: 'UTC',
      FlexibleTimeWindow: { Mode: 'OFF' },
      ActionAfterCompletion: 'DELETE',
      Target: {
        Arn: CONFIG['EVENT_BUS_ARN'],
        RoleArn: CONFIG['SCHEDULE_ROLE_ARN'],
        Input: JSON.stringify({ recordId: 'recDkcV8BUDP5kfkX', invoiceId: 'INV2-Z56S-5LLA-Q52L-CPZ5' }),
        EventBridgeParameters: {
          Source: 'ev-invoice.scheduler',
          DetailType: 'invoice.expiry-check'
        }
      }
    })
  })

  it('deletes the expiry check of an invoice', async () => {
    await new ScheduleClient(config).deleteExpiryCheck('INV2-Z56S-5LLA-Q52L-CPZ5')

    const command = send.mock.calls[0]![0] as DeleteScheduleCommand
    expect(command).toBeInstanceOf(DeleteScheduleCommand)
    expect(command.input).toEqual({ GroupName: 'dev-ev-invoice', Name: 'expiry-check-INV2-Z56S-5LLA-Q52L-CPZ5' })
  })

  it('ignores a missing expiry check on delete', async () => {
    send.mockRejectedValueOnce(new ResourceNotFoundException({ message: 'Schedule not found', $metadata: {} }))

    await expect(new ScheduleClient(config).deleteExpiryCheck('INV2-1')).resolves.toBeUndefined()
  })

  it('rethrows other errors on delete', async () => {
    send.mockRejectedValueOnce(new Error('AccessDenied'))

    await expect(new ScheduleClient(config).deleteExpiryCheck('INV2-1')).rejects.toThrow('AccessDenied')
  })
})
