export type CognitoTokenRequest = {
  grant_type: string
  client_id: string
  code: string
  redirect_uri: string
}

export type CognitoTokenResponse = {
  access_token: string
  refresh_token: string
}
