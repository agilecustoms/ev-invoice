import { Injectable } from '@nestjs/common'
import type { Context, EventBridgeEvent, SQSEvent } from 'aws-lambda'
import { PinoLogger } from 'nestjs-pino'
import { InvoiceService } from '../service/invoice.service.js'

// what the expiry check schedule puts to the event bus, see ScheduleClient.scheduleExpiryCheck
type ExpiryCheckEvent = EventBridgeEvent<'invoice.expiry-check', { recordId: string, invoiceId: string }>

// every event routed to the queue by the EventBridge rule in infrastructure/sqs.tf (add new ones to both)
type SqsEvent = ExpiryCheckEvent

/**
 * EventBridge rule routes events to the SQS queue, the queue invokes this lambda (see infrastructure/sqs.tf).
 * Throwing makes SQS redeliver the message, after 2 failures it goes to DLQ
 */
@Injectable()
export class SqsController {
  // use explicit PinoLogger to access runInContext (MDC for code outside of HTTP request)
  constructor(
    private readonly invoiceService: InvoiceService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(SqsController.name)
  }

  public async handle(event: SQSEvent, context: Context): Promise<void> {
    for (const record of event.Records) { // batch_size = 1, but don't rely on it
      const bindings = { requestId: context.awsRequestId, sqsMessageId: record.messageId }
      await this.logger.runInContext(async () => {
        try {
          const eventBridgeEvent = JSON.parse(record.body) as SqsEvent // not validated, route() rejects unknown types
          await this.route(eventBridgeEvent)
        } catch (error) {
          // Lambda logs the thrown error in its own format, so log it ourselves (even though it causes double logging)
          this.logger.error({ error, body: record.body }, 'error processing SQS event')
          throw error
        }
      }, { bindings })
    }
  }

  private async route(event: SqsEvent): Promise<void> {
    const detailType = event['detail-type']
    this.logger.info(`process event ${detailType}`)
    switch (detailType) {
      case 'invoice.expiry-check': {
        const { recordId, invoiceId } = event.detail
        await this.invoiceService.checkExpiry(recordId, invoiceId)
        return
      }
      default:
        throw new Error(`Unknown event type ${detailType as string}`)
    }
  }
}
