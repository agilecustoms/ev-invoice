import { registerAs } from '@nestjs/config'

// noinspection GrazieInspection
export interface CognitoConfig {
  /**
   * Cognito base URL, needed to send user to login page:
   * acc dev, env_size min          https://env-dev-tt-agilecustoms.auth.us-east-1.amazoncognito.com
   * acc dev, env_size small/full   https://cognito-env.dev.tt.agilecustoms.com
   * acc prod, env_size full        https://cognito.tt.agilecustoms.com
   */
  url: string

  /**
   * Main entity is a Cognito User Pool. Then you "plug" client(s) (basically UI) identified clientId
   */
  clientId: string

  /**
   * Endpoint /authorize has GET parameter state which is URL to redirect after successful authorization
   * As additional security measure, we check that this URL is the same were UI was served from
   */
  allowedRedirectOrigin: string

  /**
   * URL used as redirect_uri parameter when build login URL
   * After successful login, Cognito will redirect user back to this URL
   * In fact this URL is this service URL/authorize
   */
  authEndpointUrl: string
}

function loadRequiredEnvVar(name: string): string {
  const result = process.env[name]
  if (result != null) {
    return result
  }
  throw new Error(`Env var ${name} is required but was not found`)
}

export default registerAs('cognitoConfig', (): CognitoConfig => {
  return {
    url: loadRequiredEnvVar('APP_COGNITO_URL'),
    clientId: loadRequiredEnvVar('APP_COGNITO_CLIENT_ID'),
    allowedRedirectOrigin: loadRequiredEnvVar('APP_COGNITO_ALLOWED_REDIRECT_ORIGIN'),
    authEndpointUrl: loadRequiredEnvVar('APP_COGNITO_AUTH_URL')
  }
})
