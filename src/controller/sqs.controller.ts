import { Injectable } from '@nestjs/common'
import type { Context, SQSEvent } from 'aws-lambda'
import { PinoLogger } from 'nestjs-pino'
import { InvoiceService } from '../service/invoice.service.js'

type Event = { 'detail-type': string, 'detail': unknown } // each case in route() casts detail to its own shape

// what the expiry check schedule puts to the event bus, see ScheduleClient.scheduleExpiryCheck
type ExpiryCheckDetail = { recordId: string, invoiceId: string }

/**
 * EventBridge rule routes events to the SQS queue, the queue invokes this lambda (see infrastructure/sqs.tf).
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
          const eventBridgeEvent = JSON.parse(record.body) // not validated, route() rejects unknown types
          await this.route(eventBridgeEvent)
        } catch (error) {
          // Lambda logs the thrown error in its own format, so log it ourselves (even though it causes double logging)
          this.logger.error({ error, body: record.body }, 'error processing SQS event')
          throw error // Throwing makes SQS redeliver the message, after 2 failures it goes to DLQ
        }
      }, { bindings })
    }
  }

  private async route(event: Event): Promise<void> {
    const detailType = event['detail-type']
    this.logger.info(`process event ${detailType}`)
    switch (detailType) {
      case 'invoice.expiry-check': {
        const { recordId, invoiceId } = event.detail as ExpiryCheckDetail
        await this.invoiceService.checkExpiry(recordId, invoiceId)
        return
      }
      default:
        throw new Error(`Unknown event type ${detailType}`)
    }
  }
}
