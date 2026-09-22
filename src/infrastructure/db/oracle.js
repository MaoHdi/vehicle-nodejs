'use strict'

const oracledb = require('oracledb')
const env = require('../../config/env')
const { getDbCredentials } = require('../../config/secrets')
const logger = require('../../shared/logger')

/**
 * Acceso a la base de datos iAxis (Oracle).
 *
 * Sustituye al `JdbcTemplate` de Spring. El pool se crea una sola vez por
 * contenedor Lambda y se reutiliza entre invocaciones.
 */

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT
oracledb.fetchAsString = [oracledb.CLOB, oracledb.NCLOB]

let poolPromise

async function createPool () {
  const credentials = await getDbCredentials(env.iaxisSecretName)
  const pool = await oracledb.createPool({
    user: credentials.username,
    password: credentials.password,
    connectString: credentials.connectString || env.dbConnectString,
    poolMin: env.dbPoolMin,
    poolMax: env.dbPoolMax,
    poolTimeout: env.dbPoolTimeout,
    queueTimeout: env.dbCallTimeoutMs
  })
  logger.info('Pool de conexiones Oracle inicializado', { poolMax: env.dbPoolMax })
  return pool
}

/** @returns {Promise<import('oracledb').Pool>} */
function getPool () {
  if (!poolPromise) {
    poolPromise = createPool().catch((error) => {
      poolPromise = undefined
      throw error
    })
  }
  return poolPromise
}

/**
 * Ejecuta `fn` con una conexion del pool y la devuelve siempre.
 * @template T
 * @param {(connection: import('oracledb').Connection) => Promise<T>} fn
 * @returns {Promise<T>}
 */
async function withConnection (fn) {
  const pool = await getPool()
  const connection = await pool.getConnection()
  try {
    connection.callTimeout = env.dbCallTimeoutMs
    return await fn(connection)
  } finally {
    try {
      await connection.close()
    } catch (error) {
      logger.warn('No fue posible devolver la conexion al pool', { error: error.message })
    }
  }
}

/**
 * Traduce los placeholders posicionales `?` del SQL heredado a binds de Oracle.
 * @param {string} sql
 * @returns {string}
 */
function toOracleBinds (sql) {
  let index = 0
  return sql.replace(/\?/g, () => `:b${++index}`)
}

/**
 * Ejecuta una consulta y devuelve las filas como objetos.
 * @param {string} sql
 * @param {Array|object} [binds]
 * @returns {Promise<object[]>}
 */
async function query (sql, binds = []) {
  const statement = Array.isArray(binds) ? toOracleBinds(sql) : sql
  return withConnection(async (connection) => {
    const result = await connection.execute(statement, binds)
    return result.rows || []
  })
}

/**
 * Ejecuta un DML y confirma la transaccion.
 * @param {string} sql
 * @param {Array|object} [binds]
 * @returns {Promise<number>} filas afectadas
 */
async function update (sql, binds = []) {
  const statement = Array.isArray(binds) ? toOracleBinds(sql) : sql
  return withConnection(async (connection) => {
    const result = await connection.execute(statement, binds, { autoCommit: true })
    return result.rowsAffected || 0
  })
}

/** Cierra el pool. Solo se usa en pruebas y en el apagado del contenedor. */
async function close () {
  if (!poolPromise) return
  try {
    const pool = await poolPromise
    await pool.close(0)
  } catch (error) {
    logger.warn('Error cerrando el pool Oracle', { error: error.message })
  } finally {
    poolPromise = undefined
  }
}

module.exports = { oracledb, getPool, withConnection, query, update, toOracleBinds, close }
