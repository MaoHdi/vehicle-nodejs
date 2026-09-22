'use strict'

const { parseXml, serialize, escapeXml, normalizeRepeated } = require('./xml')
const { NAMESPACE_LIBERTY } = require('../config/properties')

/**
 * Envoltura SOAP 1.1 del contrato VehicleServices.
 *
 * Nota sobre compatibilidad: `XmlUtil.parseXML` del legacy eliminaba la declaracion
 * del namespace SOAP y declaraba `xmlns:env="env:ENVELOPE"`, lo que produce un sobre
 * no estandar. Aqui se emite el namespace correcto de SOAP 1.1; si algun consumidor
 * legacy dependiera literalmente del sobre anterior, basta con
 * `SOAP_LEGACY_ENVELOPE_NS=true` para reproducirlo byte a byte.
 */

const SOAP_NS = 'http://schemas.xmlsoap.org/soap/envelope/'
const LEGACY_ENVELOPE_NS = 'env:ENVELOPE'
const PREFIX_ENV = 'env'
const PREFIX_TNS = 'tns'

const envelopeNs = () => (process.env.SOAP_LEGACY_ENVELOPE_NS === 'true' ? LEGACY_ENVELOPE_NS : SOAP_NS)

/**
 * Indica si el texto recibido es un mensaje SOAP/XML.
 * @param {string} body
 * @returns {boolean}
 */
function isXmlPayload (body) {
  return typeof body === 'string' && body.trimStart().startsWith('<')
}

/**
 * Extrae el contenido del `Body` SOAP (o el elemento raiz si el XML viene sin sobre).
 *
 * @param {string} xml
 * @returns {{ operation: string, payload: object }}
 */
function unwrap (xml) {
  const doc = parseXml(xml)

  const root = doc.Envelope || doc.envelope
  const container = root ? (root.Body || root.body) : doc

  if (!container || typeof container !== 'object') {
    throw new SoapClientError('El mensaje no contiene un Body SOAP valido')
  }

  const operation = Object.keys(container).find((key) => !key.startsWith('@_') && !key.startsWith('?'))
  if (!operation) throw new SoapClientError('El Body SOAP no contiene ninguna operacion')

  const payload = container[operation]
  return {
    operation,
    payload: normalizeRepeated(typeof payload === 'object' && payload !== null ? payload : {})
  }
}

/**
 * Serializa una respuesta dentro de un sobre SOAP.
 *
 * @param {string} elementName nombre del elemento de respuesta, por ejemplo `crearPolizaIAXISRs`
 * @param {string} typeName tipo declarado en `schema.types`
 * @param {object} value modelo canonico de la respuesta
 * @returns {string}
 */
function wrap (elementName, typeName, value) {
  const body = serialize(elementName, typeName, value, `${PREFIX_TNS}:`)
  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    `<${PREFIX_ENV}:Envelope xmlns:${PREFIX_ENV}="${envelopeNs()}" xmlns:${PREFIX_TNS}="${NAMESPACE_LIBERTY}">` +
    `<${PREFIX_ENV}:Header/>` +
    `<${PREFIX_ENV}:Body>${body}</${PREFIX_ENV}:Body>` +
    `</${PREFIX_ENV}:Envelope>`
  )
}

/**
 * Port de `XmlUtil.updayeValues`: ajustes textuales que el legacy aplica sobre el XML
 * ya marshalled de crearConsultarInspMIILS. Se mantiene para no alterar el contrato
 * que consumen los clientes SOAP actuales.
 *
 * @param {string} xml
 * @returns {string}
 */
function applyLegacyTagFixes (xml) {
  if (xml.includes('<otherData>null</otherData>')) {
    return xml.replace(/<otherData>null<\/otherData>/g, 'null').replace(/otherSiniestros/g, 'siniestros')
  }
  if (xml.includes('<otherSiniestros><')) {
    return xml.replace(/<otherSiniestros>/g, '').replace(/<\/otherSiniestros>/g, '')
  }
  return xml
}

/**
 * Construye un SOAP Fault.
 * @param {string} faultCode por ejemplo `env:Client`
 * @param {string} faultString
 * @returns {string}
 */
function fault (faultCode, faultString) {
  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    `<${PREFIX_ENV}:Envelope xmlns:${PREFIX_ENV}="${envelopeNs()}">` +
    `<${PREFIX_ENV}:Body><${PREFIX_ENV}:Fault>` +
    `<faultcode>${escapeXml(faultCode)}</faultcode>` +
    `<faultstring>${escapeXml(faultString)}</faultstring>` +
    `</${PREFIX_ENV}:Fault></${PREFIX_ENV}:Body></${PREFIX_ENV}:Envelope>`
  )
}

/** Error de mensaje SOAP mal formado o no soportado (se traduce a `env:Client`). */
class SoapClientError extends Error {}

module.exports = {
  SOAP_NS,
  PREFIX_ENV,
  PREFIX_TNS,
  isXmlPayload,
  unwrap,
  wrap,
  applyLegacyTagFixes,
  fault,
  SoapClientError
}
