'use strict'

/**
 * Enmascaramiento de datos personales (PII) antes de escribirlos en logs o en la
 * tabla de auditoria.
 *
 * Los payloads de estos servicios transportan datos de identificacion de personas
 * naturales (documento, nombres, fecha de nacimiento, direcciones, telefonos, correo)
 * y de identificacion de vehiculos (placa, chasis, motor, VIN). Bajo GDPR
 * (minimizacion de datos) y los controles SOC2 de manejo de informacion, esos valores
 * no deben quedar en claro en CloudWatch ni en la auditoria.
 */

/** Campos cuyo valor se enmascara conservando una pista para trazabilidad. */
const PII_FIELDS = new Set([
  'numerodocumento',
  'nnumide',
  'primernombre',
  'segundonombre',
  'primerapellido',
  'segundoapellido',
  'razonsocial',
  'fechanacimiento',
  'fechaconstitucion',
  'textocontacto',
  'textodireccion',
  'numerodocumentopromotor',
  'ip',
  'terminal'
])

/** Identificadores de vehiculo: se conservan los ultimos caracteres. */
const VEHICLE_FIELDS = new Set(['placa', 'chasis', 'motor', 'vin', 'cmatric', 'codmotor', 'cchasis'])

/** Etiquetas XML cuyo contenido se enmascara en payloads crudos. */
const XML_PII_TAGS = [
  'numeroDocumento',
  'primerNombre',
  'segundoNombre',
  'primerApellido',
  'segundoApellido',
  'razonSocial',
  'fechaNacimiento',
  'fechaConstitucion',
  'textoContacto',
  'textoDireccion',
  'numeroDocumentoPromotor',
  'placa',
  'chasis',
  'motor',
  'vin',
  'ip',
  'terminal'
]

/**
 * Enmascara dejando visibles los ultimos `keep` caracteres.
 * @param {string} value
 * @param {number} keep
 * @returns {string}
 */
function maskTail (value, keep = 3) {
  const str = String(value)
  if (str.length <= keep) return '*'.repeat(str.length)
  return '*'.repeat(str.length - keep) + str.slice(-keep)
}

/**
 * Enmascara un valor segun el nombre del campo que lo contiene.
 * @param {string} fieldName
 * @param {*} value
 * @returns {*}
 */
function maskValue (fieldName, value) {
  if (value === null || value === undefined) return value
  const key = String(fieldName).toLowerCase()
  if (VEHICLE_FIELDS.has(key)) return maskTail(value, 3)
  if (PII_FIELDS.has(key)) return maskTail(value, 2)
  return value
}

/**
 * Recorre una estructura JS y devuelve una copia con los campos PII enmascarados.
 * @param {*} input
 * @returns {*}
 */
function redactObject (input) {
  if (input === null || input === undefined) return input
  if (Array.isArray(input)) return input.map(redactObject)
  if (input instanceof Date) return input
  if (typeof input !== 'object') return input

  const out = {}
  for (const [key, value] of Object.entries(input)) {
    const lower = key.toLowerCase()
    if (VEHICLE_FIELDS.has(lower) || PII_FIELDS.has(lower)) {
      out[key] = typeof value === 'object' && value !== null ? redactObject(value) : maskValue(key, value)
    } else {
      out[key] = redactObject(value)
    }
  }
  return out
}

/**
 * Enmascara los valores PII dentro de un payload XML/SOAP crudo.
 * @param {string} xml
 * @returns {string}
 */
function redactXml (xml) {
  if (typeof xml !== 'string' || xml.length === 0) return xml
  let out = xml
  for (const tag of XML_PII_TAGS) {
    const re = new RegExp(`(<(?:[A-Za-z0-9_.-]+:)?${tag}>)([^<]*)(</(?:[A-Za-z0-9_.-]+:)?${tag}>)`, 'g')
    out = out.replace(re, (_m, open, value, close) => {
      const keep = VEHICLE_FIELDS.has(tag.toLowerCase()) ? 3 : 2
      return `${open}${value ? maskTail(value, keep) : value}${close}`
    })
  }
  return out
}

/**
 * Enmascara un payload sin conocer de antemano si es XML o JSON.
 * @param {string|object} payload
 * @returns {string|object}
 */
function redactPayload (payload) {
  if (typeof payload === 'string') {
    const trimmed = payload.trimStart()
    if (trimmed.startsWith('<')) return redactXml(payload)
    try {
      return JSON.stringify(redactObject(JSON.parse(payload)))
    } catch {
      return payload
    }
  }
  return redactObject(payload)
}

module.exports = { maskTail, maskValue, redactObject, redactXml, redactPayload }
