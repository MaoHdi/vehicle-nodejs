'use strict'

const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager')
const logger = require('../shared/logger')

let client
let cached

/** Prefijo del secreto propio del servicio; el sufijo es el stage (`dev`, `nonprod`, `prod`). */
const SECRET_NAME_PREFIX = 'co-hdi-vehicle-services-iaxis-secret-'

/** Llaves obligatorias del secreto. */
const REQUIRED_KEYS = ['username', 'password', 'connectString']

/**
 * Nombre del secreto para un stage: `co-hdi-vehicle-services-iaxis-secret-<stage>`.
 * @param {string} stage
 * @returns {string}
 */
function secretNameForStage (stage) {
  return `${SECRET_NAME_PREFIX}${stage}`
}

/**
 * Valida el contenido del secreto y lo devuelve como `{username, password, connectString}`.
 *
 * Formato esperado:
 *   { "username": "...", "password": "...", "connectString": "host:puerto/servicio" }
 *
 * @param {object} secret
 * @returns {{username: string, password: string, connectString: string}}
 */
function parseCredentials (secret) {
  const missing = REQUIRED_KEYS.filter((key) => !secret || !secret[key])
  if (missing.length) {
    // Solo se reportan los nombres de las llaves, nunca sus valores.
    throw new Error(`El secreto de base de datos no contiene: ${missing.join(', ')}`)
  }

  return {
    username: secret.username,
    password: secret.password,
    connectString: String(secret.connectString).trim()
  }
}

/**
 * Lee el secreto con las credenciales de Oracle (iAxis) desde AWS Secrets Manager.
 *
 * El secreto es propio de este servicio (`co-hdi-vehicle-services-iaxis-secret-<stage>`).
 * El nombre llega como `IAXIS_SECRET_NAME` desde el despliegue. El valor se cachea en
 * memoria del contenedor Lambda y nunca se escribe en logs.
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
    ? response.SecretString
    : response.SecretBinary
      ? Buffer.from(response.SecretBinary).toString('utf8')
      : null

  if (!raw) throw new Error('El secreto de base de datos esta vacio')

  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('El secreto de base de datos no es un JSON valido')
  }

  cached = parseCredentials(parsed)
  logger.info('Credenciales de base de datos obtenidas de Secrets Manager', { secreto: secretName })
  return cached
}

/** Solo para pruebas: limpia el cache del contenedor. */
function resetCache () {
  cached = undefined
  client = undefined
}

module.exports = {
  getDbCredentials,
  resetCache,
  parseCredentials,
  secretNameForStage,
  SECRET_NAME_PREFIX
}
