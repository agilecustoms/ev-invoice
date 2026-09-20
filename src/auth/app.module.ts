import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import cognitoConfig from './../auth/config/CognitoConfig.js'
import { AuthController } from './controller/auth.controller.js'
import { HealthController } from './controller/health.controller.js'
import { AuthService } from './service/auth.service.js'

const profile = process.env['APP_PROFILE']

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [cognitoConfig],
      envFilePath: [`.env.${profile}`]
    })
  ],
  controllers: [
    AuthController,
    HealthController
  ],
  providers: [AuthService]
})
export class AppModule {}
