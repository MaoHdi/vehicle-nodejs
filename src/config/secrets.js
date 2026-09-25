'use strict'

const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager')
const logger = require('../shared/logger')

let client
let cached

/** Llaves del secreto que ya usa el servicio Java (`DatabasePropertiesListener`). */
const LEGACY_USERNAME_KEY = 'SPRING.DATASOURCE.USERNAME'
const LEGACY_PASSWORD_KEY = 'SPRING.DATASOURCE.PASSWORD'
const LEGACY_URL_KEY = 'SPRING.DATASOURCE.URL'

/**
 * Convierte una URL JDBC de Oracle al formato de cadena de conexion que espera
 * node-oracledb.
 *
 *   jdbc:oracle:thin:@host:1521/servicio    -> host:1521/servicio
 *   jdbc:oracle:thin:@//host:1521/servicio  -> host:1521/servicio
 *   jdbc:oracle:thin:@host:1521:SID         -> descriptor con SID
 *   jdbc:oracle:thin:@(DESCRIPTION=...)     -> el descriptor tal cual
 *
 * @param {string} jdbcUrl
 * @returns {string}
 */
function jdbcUrlToConnectString (jdbcUrl) {
  if (!jdbcUrl) return jdbcUrl

  let value = String(jdbcUrl).trim()
  value = value.replace(/^jdbc:oracle:(thin|oci):@/i, '')
  value = value.replace(/^\/\//, '')

  // Un descriptor TNS completo se pasa sin tocar.
  if (value.startsWith('(')) return value

  // `host:puerto:SID` (la forma con dos puntos no existe en EZConnect).
  const sid = /^([^:/]+):(\d+):([^:/]+)$/.exec(value)
  if (sid) {
    const [, host, port, sidName] = sid
    return `(DESCRIPTION=(ADDRESS=(PROTOCOL=TCP)(HOST=${host})(PORT=${port}))(CONNECT_DATA=(SID=${sidName})))`
  }

  return value
}

/**
 * Normaliza el contenido del secreto a `{username, password, connectString}`.
 *
 * Se aceptan dos formatos:
 *  - el del servicio Java (`SPRING.DATASOURCE.USERNAME` / `.PASSWORD` / `.URL`), que
 *    permite reutilizar el mismo secreto sin duplicar credenciales;
 *  - el formato simple `{username, password, connectString}`.
 *
 * @param {object} secret
 * @returns {{username: string, password: string, connectString: string, format: string}}
 */
function normalizeCredentials (secret) {
  if (secret[LEGACY_USERNAME_KEY] !== undefined || secret[LEGACY_URL_KEY] !== undefined) {
    return {
      username: secret[LEGACY_USERNAME_KEY],
      password: secret[LEGACY_PASSWORD_KEY],
      connectString: jdbcUrlToConnectString(secret[LEGACY_URL_KEY]),
      format: 'java'
    }
  }

  return {
    username: secret.username,
    password: secret.password,
    // El formato simple puede traer igualmente una URL JDBC.
    connectString: jdbcUrlToConnectString(secret.connectString),
    format: 'simple'
  }
}

/**
 * Lee el secreto con las credenciales de Oracle (iAxis) desde AWS Secrets Manager.
 *
 * Es el mismo secreto que consume el servicio Java, que lo recibe en la variable de
 * entorno `secretBD`. El nombre lo define el repositorio de infraestructura
 * (`environments/<stage>.yml`) y llega como `IAXIS_SECRET_NAME`. El valor se cachea
 * en memoria del contenedor Lambda y nunca se escribe en logs.
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

  const credentials = normalizeCredentials(parsed)

  if (!credentials.username || !credentials.password) {
    throw new Error(
      'El secreto de base de datos no contiene usuario/clave. Se esperaba el formato del ' +
        `servicio Java (${LEGACY_USERNAME_KEY}) o {username, password, connectString}`
    )
  }

  logger.info('Credenciales de base de datos obtenidas de Secrets Manager', {
    formato: credentials.format
  })

  cached = credentials
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
  jdbcUrlToConnectString,
  normalizeCredentials,
  LEGACY_USERNAME_KEY,
  LEGACY_PASSWORD_KEY,
  LEGACY_URL_KEY
}
