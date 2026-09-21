export interface PayPalCredentials {
  clientId: string
  clientSecret: string
}

export const PAYPAL_CREDENTIALS = Symbol('PAYPAL_CREDENTIALS')
