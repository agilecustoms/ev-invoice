import { describe, expect, it } from 'vitest'
import type { CognitoConfig } from '../../../src/auth/config/CognitoConfig.js'
import { AuthService } from '../../../src/auth/service/auth.service.js'

describe('AuthService', () => {
  const cognitoConfig: CognitoConfig = {
    url: 'https://cognito.com',
    clientId: 'clientId',
    allowedRedirectOrigin: '', // no-matter-for-this-test
    authEndpointUrl: 'https://auth-service.com/authorize'
  }
  const authService = new AuthService(cognitoConfig)

  it('should be defined', () => {
    const url = authService.generateLoginUrl()
    expect(url).toBe('https://cognito.com/login?client_id=clientId'
      + '&response_type=code'
      + '&scope=email+openid'
      + '&redirect_uri=https%3A%2F%2Fauth-service.com%2Fauthorize')
  })
})
