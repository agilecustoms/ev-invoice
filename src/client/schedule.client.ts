import {
  CreateScheduleCommand,
  DeleteScheduleCommand,
  ResourceNotFoundException,
  SchedulerClient
} from '@aws-sdk/client-scheduler'
import { Temporal } from '@js-temporal/polyfill'
import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

function expiryCheckName(invoiceId: string): string {
  return `expiry-check-${invoiceId}`
}

/**
 * Schedules one-time events in EventBridge Scheduler. On time, the schedule puts an event to the event bus,
 * so whoever handles it subscribes with an EventBridge rule
 */
@Injectable()
export class ScheduleClient {
  private readonly scheduler = new SchedulerClient({})

  constructor(private readonly config: ConfigService) {}

  /**
   * After the deposit term emits event 'invoice.expiry-check' (source 'ev-invoice.scheduler') to check if the deposit is paid.
   * The handler must check the invoice status, since the invoice may be paid (or not even sent) by then
   * @param recordId AirTable record id (recXXXXXXXXXXXXXX)
   * @param invoiceId PayPal invoice id, e.g. INV2-XXXX-XXXX-XXXX-XXXX
   * @param depositTerm how long the customer has to pay the deposit, from now
   */
  public async scheduleExpiryCheck(recordId: string, invoiceId: string, depositTerm: Temporal.Duration): Promise<void> {
    // read lazily: set by Terraform in AWS only, so bootstrap (local, OpenAPI generation) never requires them
    const groupName = this.config.getOrThrow<string>('SCHEDULE_GROUP')
    const roleArn = this.config.getOrThrow<string>('SCHEDULE_ROLE_ARN')
    const eventBusArn = this.config.getOrThrow<string>('EVENT_BUS_ARN')

    const at = Temporal.Now.plainDateTimeISO('UTC').add(depositTerm).toString({ smallestUnit: 'second' })

    await this.scheduler.send(new CreateScheduleCommand({
      GroupName: groupName,
      Name: expiryCheckName(invoiceId), // unique per invoice: creating it twice fails instead of scheduling two checks
      ScheduleExpression: `at(${at})`, // e.g. at(2026-09-28T21:47:00)
      ScheduleExpressionTimezone: 'UTC',
      FlexibleTimeWindow: { Mode: 'OFF' },
      ActionAfterCompletion: 'DELETE',
      Target: {
        Arn: eventBusArn,
        RoleArn: roleArn,
        Input: JSON.stringify({ recordId, invoiceId }),
        EventBridgeParameters: {
          Source: 'ev-invoice.scheduler', // who produced this event
          DetailType: 'invoice.expiry-check' // What kind of event is this?
        }
      }
    }))
  }

  /**
   * Deletes the expiry check of an invoice that is being discarded. No-op if there is none: a failed attempt could
   * have created the draft invoice but not yet its schedule, and the schedule deletes itself once fired
   * @param invoiceId PayPal invoice id, e.g. INV2-XXXX-XXXX-XXXX-XXXX
   */
  public async deleteExpiryCheck(invoiceId: string): Promise<void> {
    const command = new DeleteScheduleCommand({
      GroupName: this.config.getOrThrow<string>('SCHEDULE_GROUP'),
      Name: expiryCheckName(invoiceId)
    })
    try {
      await this.scheduler.send(command)
    } catch (error) {
      if (!(error instanceof ResourceNotFoundException)) {
        throw error
      }
    }
  }
}
