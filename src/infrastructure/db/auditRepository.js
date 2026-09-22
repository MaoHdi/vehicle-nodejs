'use strict'

const oracle = require('./oracle')
const sql = require('./sql')
const env = require('../../config/env')
const logger = require('../../shared/logger')
const { redactPayload } = require('../../shared/redact')

/**
 * Port de `InsertAuditServiceWebRepository` / `InsertarLogAuditService`.
 *
 * Diferencia deliberada frente al legacy: el request y el response se persisten
 * enmascarados (`AUDIT_STORE_RAW=false`, valor por defecto). La tabla
 * `axis.audit_services_web` es de trazabilidad tecnica y no requiere los datos
 * personales en claro; almacenarlos ampliaria el alcance del tratamiento bajo GDPR
 * y del inventario de datos sensibles de SOC2. Con `AUDIT_STORE_RAW=true` se
 * recupera el comportamiento original.
 *
 * Nota: en Spring la insercion era `@Async`. En Lambda no existe trabajo en segundo
 * plano despues de responder, por lo que la escritura se espera antes de retornar.
 * Un fallo de auditoria nunca interrumpe la operacion de negocio.
 */

const MAX_PAYLOAD_CHARS = Number(process.env.AUDIT_MAX_PAYLOAD_CHARS || 30000)

function prepare (payload) {
  const value = env.auditStoreRaw ? payload : redactPayload(payload)
  const text = typeof value === 'string' ? value : JSON.stringify(value)
  if (!text) return null
  return text.length > MAX_PAYLOAD_CHARS ? text.slice(0, MAX_PAYLOAD_CHARS) : text
}

/**
 * @param {string} request payload de entrada
 * @param {string} response payload de salida
 * @param {string} code codigo de interfaz (`UI04` inspecciones, `UI05` poliza)
 * @returns {Promise<void>}
 */
async function insertAuditServiceWeb (request, response, code) {
  if (!env.auditEnabled) return
  try {
    await oracle.update(sql.INSERT_AUDIT_SERVICES_WEB, [code, prepare(request), prepare(response)])
  } catch (error) {
    logger.error('failed execute InsertAuditServiceWeb', { error: error.message })
  }
}

module.exports = { insertAuditServiceWeb }
