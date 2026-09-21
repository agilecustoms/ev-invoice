import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from '@aws-sdk/client-secrets-manager'

const client = new SecretsManagerClient({})

export async function loadSecret<T>(secretId: string): Promise<T> {
  const response = await client.send(
    new GetSecretValueCommand({
      SecretId: secretId,
    }),
  )

  if (!response.SecretString) {
    throw new Error(`Secret ${secretId} has no SecretString`)
  }

  return JSON.parse(response.SecretString) as T
}
