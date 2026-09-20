import { Controller, Get } from '@nestjs/common'
import { PinoLogger } from 'nestjs-pino'

@Controller('/health')
export class HealthController {
  // use explicit PinoLogger to access MDC api (method assign)
  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(HealthController.name)
  }

  @Get()
  checkHealth(): string {
    this.logger.assign({ endpoint: 'health' })
    this.logger.info('hit health check')
    return 'Health check: OK'
  }
}
