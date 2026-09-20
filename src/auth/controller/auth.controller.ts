import { Controller, Get, Logger, Req, HttpException, HttpStatus, Query, Res } from '@nestjs/common'
import type { Request, Response } from 'express'
import type { StatusResponse } from '../model/status-responses.js'
import { AuthService } from '../service/auth.service.js'

@Controller()
export class AuthController {
  private readonly logger = new Logger(AuthController.name)

  constructor(
    private readonly authService: AuthService
  ) { }

  @Get('/status')
  public status(@Req() request: Request): StatusResponse {
    const refreshToken = request.cookies['refreshToken'] as string
    if (!refreshToken) {
      throw new HttpException(
        { signInUrl: this.authService.generateLoginUrl() },
        HttpStatus.UNAUTHORIZED
      )
    }
    this.logger.log(`hit status endpoint with token starting with ${refreshToken.substring(0, 6)}`)
    return {
      accessToken: 'test-token',
      email: 'john@gmail.com'
    }
  }

  /**
   * The callback endpoint which will be called by Cognito upon finishing sign-in flow.
   * @param state - redirect URL which points to FE
   * @param code - Cognito's code to obtain JWT tokens
   * @param response - raw response object to send data back to the client
   */
  @Get('/authorize')
  public async authorize(
    @Query('state') state: string,
    @Query('code') code: string,
    @Res({ passthrough: true }) response: Response
  ) {
    this.logger.log(`Auth request received, redirect=${state}`)
    const redirectUrl = this.parseAndCheckRedirect(state)
    try {
      const cognitoData = await this.authService.fetchCognitoToken(code)
      response.cookie('refreshToken', cognitoData.refresh_token)
      response.cookie('accessToken', cognitoData.access_token)
    } catch (err) {
      const stack = err instanceof Error ? err.stack : err
      this.logger.error('An exception occurred during fetch of Cognito token', stack)
      throw new HttpException(
        { message: 'An exception happened' },
        HttpStatus.INTERNAL_SERVER_ERROR
      )
    }

    response.redirect(redirectUrl.href)
  }

  private parseAndCheckRedirect(state: string): URL {
    let redirectUrl: URL
    try {
      redirectUrl = new URL(state)
    } catch (err) {
      const stack = err instanceof Error ? err.stack : err
      this.logger.error(`URL construction failed for input ${state}`, stack)
      throw new HttpException(`Redirect URL was in incorrect format - ${state}`, HttpStatus.BAD_REQUEST)
    }
    if (!this.authService.isAllowedRedirectUrl(redirectUrl)) {
      throw new HttpException(`Redirect URL ${state} is not allowed`, HttpStatus.BAD_REQUEST)
    }
    return redirectUrl
  }
}
