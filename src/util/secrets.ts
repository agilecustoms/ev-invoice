import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from '@aws-sdk/client-secrets-manager'

const client = new SecretsManagerClient({})

async function getSecretString(secretId: string): Promise<string> {
  const response = await client.send(
    new GetSecretValueCommand({
      SecretId: secretId,
    }),
  )

  if (!response.SecretString) {
    throw new Error(`Secret ${secretId} has no SecretString`)
  }

  return response.SecretString
}

export async function loadSecret<T>(secretId: string): Promise<T> {
  return JSON.parse(await getSecretString(secretId)) as T
}

/**
 * For a secret stored as a plain string value (not JSON), so it can be typed into
 * Secrets Manager as-is, with no quoting gotcha
 */
export async function loadPlainSecret(secretId: string): Promise<string> {
  return getSecretString(secretId)
}
