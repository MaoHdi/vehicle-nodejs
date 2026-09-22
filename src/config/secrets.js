'use strict'

const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager')
const logger = require('../shared/logger')

let client
let cached

/**
 * Lee el secreto con las credenciales de Oracle (iAxis) desde AWS Secrets Manager.
 *
 * El nombre del secreto lo define `environments/<stage>.yml` y `serverless.yml` lo
 * inyecta como `IAXIS_SECRET_NAME`. El valor se cachea en memoria del contenedor
 * Lambda y nunca se escribe en logs.
 *
 * Formato esperado del secreto:
 * `{"username":"...","password":"...","connectString":"host:puerto/servicio"}`
 *
 * @param {string} secretName nombre o ARN del secreto
 * @returns {Promise<{username: string, password: string, connectString: string}>}
 */
async function getDbCredentials (secretName) {
  if (cached) return cached
  if (!secretName) throw new Error('IAXIS_SECRET_NAME no configurado')

  client = client || new SecretsManagerClient({})
  const response = await client.send(new GetSecretValueCommand({ SecretId: secretName }))
  const raw = response.SecretString
  if (!raw) throw new Error('El secreto de base de datos no contiene SecretString')

  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('El secreto de base de datos no es un JSON valido')
  }

  if (!parsed.username || !parsed.password) {
    throw new Error('El secreto de base de datos no contiene username/password')
  }

  logger.info('Credenciales de base de datos obtenidas de Secrets Manager')
  cached = parsed
  return cached
}

/** Solo para pruebas: limpia el cache del contenedor. */
function resetCache () {
  cached = undefined
  client = undefined
}

module.exports = { getDbCredentials, resetCache }
