import { Inject, Injectable, Logger } from '@nestjs/common'
import type { ConfigType } from '@nestjs/config'
import CognitoConfig, { default as cognitoConfig } from '../config/CognitoConfig.js'
import type { CognitoTokenRequest, CognitoTokenResponse } from '../model/cognito-models.js'

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name)

  constructor(
    @Inject(cognitoConfig.KEY) private readonly cognitoConfiguration: ConfigType<typeof CognitoConfig>
  ) { }

  /**
   * Generate Login URL returned to unauthorized user as legitimate way to sign in
   * We use Cognito hosted login page - it can be bound to custom (agilecustoms.com) domain,
   *  but path and parameters are dictated by Cognito
   */
  public generateLoginUrl(): string {
    const result = new URL('/login', this.cognitoConfiguration.url)
    const getParams = result.searchParams
    getParams.set('client_id', this.cognitoConfiguration.clientId)
    getParams.set('response_type', 'code')
    getParams.set('scope', 'email openid')
    getParams.set('redirect_uri', this.cognitoConfiguration.authEndpointUrl)
    return result.href
  }

  public isAllowedRedirectUrl(redirectUrl: URL): boolean {
    return this.cognitoConfiguration.allowedRedirectOrigin == redirectUrl.origin
  }

  public async fetchCognitoToken(code: string): Promise<CognitoTokenResponse> {
    this.logger.log(`Started the flow to obtain Cognito JWT tokens`)
    const cognitoTokenServiceUrl = `${this.cognitoConfiguration.url}/oauth2/token`
    const body: CognitoTokenRequest = {
      grant_type: 'authorization_code',
      client_id: this.cognitoConfiguration.clientId,
      code: code,
      redirect_uri: this.cognitoConfiguration.authEndpointUrl
    }
    const options: RequestInit = {
      method: 'post',
      body: new URLSearchParams(body)
    }
    const cognitoResponse = await fetch(cognitoTokenServiceUrl, options)
    if (cognitoResponse.status != 200) {
      const responseBody = await cognitoResponse.text()
      throw new Error(`Received status ${cognitoResponse.status} from Cognito, response body=${responseBody}`)
    }
    return await cognitoResponse.json() as CognitoTokenResponse
  }
}
