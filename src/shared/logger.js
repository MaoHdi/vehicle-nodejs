'use strict'

const { redactPayload } = require('./redact')

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 }
const CURRENT = LEVELS[(process.env.LOG_LEVEL || 'info').toLowerCase()] ?? LEVELS.info

/**
 * `full` solo se permite fuera de produccion; en cualquier otro caso los payloads
 * se escriben enmascarados. Ver src/shared/redact.js.
 */
const PAYLOAD_MODE = process.env.APP_ENV === 'prod' ? 'redacted' : (process.env.LOG_PAYLOADS || 'redacted')

let context = {}

/**
 * Fija los campos que acompañan a cada linea de log durante la invocacion.
 * @param {object} fields
 */
function setContext (fields) {
  context = { ...context, ...fields }
}

/** Limpia el contexto entre invocaciones del contenedor Lambda. */
function resetContext () {
  context = {}
}

function emit (level, message, meta) {
  if (LEVELS[level] > CURRENT) return
  const line = { level, message, ...context }
  if (meta !== undefined) line.meta = meta
  line.timestamp = new Date().toISOString()
  // eslint-disable-next-line no-console
  console[level === 'debug' ? 'log' : level](JSON.stringify(line))
}

/**
 * Registra un payload aplicando enmascaramiento de PII.
 * @param {string} label
 * @param {string|object} payload
 */
function payload (label, payload_) {
  if (LEVELS.debug > CURRENT && PAYLOAD_MODE !== 'full') return
  emit('debug', label, PAYLOAD_MODE === 'full' ? payload_ : redactPayload(payload_))
}

module.exports = {
  error: (message, meta) => emit('error', message, meta),
  warn: (message, meta) => emit('warn', message, meta),
  info: (message, meta) => emit('info', message, meta),
  debug: (message, meta) => emit('debug', message, meta),
  payload,
  setContext,
  resetContext
}
