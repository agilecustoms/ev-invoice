import { CreateScheduleCommand, SchedulerClient } from '@aws-sdk/client-scheduler'
import { Temporal } from '@js-temporal/polyfill'
import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

const EXPIRY_CHECK_DELAY = Temporal.Duration.from({ hours: 48 })

/**
 * Schedules one-time events in EventBridge Scheduler. On time, the schedule puts an event to the event bus,
 * so whoever handles it subscribes with an EventBridge rule
 */
@Injectable()
export class ScheduleClient {
  private readonly scheduler = new SchedulerClient({})

  constructor(private readonly config: ConfigService) {}

  /**
   * In 48 hours emits event 'invoice.expiry-check' (source 'ev-invoice.scheduler') to check if the deposit is paid.
   * The handler must check the invoice status, since the invoice may be paid (or not even sent) by then
   * @param recordId AirTable record id (recXXXXXXXXXXXXXX)
   * @param invoiceId PayPal invoice id, e.g. INV2-XXXX-XXXX-XXXX-XXXX
   */
  public async scheduleExpiryCheck(recordId: string, invoiceId: string): Promise<void> {
    // read lazily: set by Terraform in AWS only, so bootstrap (local, OpenAPI generation) never requires them
    const groupName = this.config.getOrThrow<string>('SCHEDULE_GROUP')
    const roleArn = this.config.getOrThrow<string>('SCHEDULE_ROLE_ARN')
    const eventBusArn = this.config.getOrThrow<string>('EVENT_BUS_ARN')

    const at = Temporal.Now.plainDateTimeISO('UTC').add(EXPIRY_CHECK_DELAY).toString({ smallestUnit: 'second' })

    await this.scheduler.send(new CreateScheduleCommand({
      GroupName: groupName,
      Name: `expiry-check-${invoiceId}`, // unique per invoice: creating it twice fails instead of scheduling two checks
      ScheduleExpression: `at(${at})`, // e.g. at(2026-09-28T21:47:00)
      ScheduleExpressionTimezone: 'UTC',
      FlexibleTimeWindow: { Mode: 'OFF' },
      ActionAfterCompletion: 'DELETE',
      Target: {
        Arn: eventBusArn,
        RoleArn: roleArn,
        Input: JSON.stringify({ recordId, invoiceId }),
        EventBridgeParameters: {
          Source: 'ev-invoice.scheduler',
          DetailType: 'invoice.expiry-check'
        }
      }
    }))
  }
}
