'use strict'

const { isXmlPayload } = require('./soapEnvelope')

/**
 * Negociacion de protocolo.
 *
 * Los dos servicios se publican como REST/JSON, pero deben seguir atendiendo a los
 * consumidores legacy que envian SOAP sobre el mismo endpoint. La deteccion es
 * tolerante a clientes que no informan correctamente el `Content-Type`.
 */

/**
 * Normaliza los encabezados a minusculas.
 * @param {object} headers
 * @returns {object}
 */
function lowerHeaders (headers) {
  const out = {}
  for (const [key, value] of Object.entries(headers || {})) out[String(key).toLowerCase()] = value
  return out
}

/**
 * Extrae metodo, ruta, query, encabezados y cuerpo de un evento de API Gateway
 * (REST API v1 o HTTP API v2) o de una invocacion directa de Lambda.
 *
 * @param {object} event
 * @returns {{method: string, path: string, query: object, headers: object, body: string, directInvoke: boolean}}
 */
function extractRequest (event) {
  const isHttpEvent =
    event && (typeof event.body === 'string' || event.requestContext || event.httpMethod || event.rawPath)

  if (!isHttpEvent) {
    // Invocacion directa (Step Functions, SDK, pruebas): el evento ES el payload.
    return {
      method: 'POST',
      path: '/',
      query: {},
      headers: {},
      body: JSON.stringify(event ?? {}),
      directInvoke: true
    }
  }

  const headers = lowerHeaders(event.headers)
  const method = event.httpMethod || event.requestContext?.http?.method || 'POST'
  const path = event.path || event.rawPath || '/'

  let query = event.queryStringParameters || {}
  if (!event.queryStringParameters && event.rawQueryString) {
    query = Object.fromEntries(new URLSearchParams(event.rawQueryString).entries())
  }

  let body = event.body ?? ''
  if (event.isBase64Encoded && body) body = Buffer.from(body, 'base64').toString('utf8')

  return { method, path, query, headers, body, directInvoke: false }
}

/**
 * Determina el modo de atencion de la peticion.
 *
 * @param {{method: string, path: string, query: object, headers: object, body: string}} request
 * @returns {'wsdl'|'soap'|'rest'}
 */
function detectMode (request) {
  const { method, path, query, headers, body } = request

  if (method === 'GET') {
    const wantsWsdl = path.toLowerCase().endsWith('.wsdl') || Object.keys(query || {}).some((k) => k.toLowerCase() === 'wsdl')
    if (wantsWsdl) return 'wsdl'
  }

  const contentType = String(headers['content-type'] || '').toLowerCase()
  if (contentType.includes('xml')) return 'soap'
  if (headers.soapaction !== undefined || headers['soap-action'] !== undefined) return 'soap'
  if (isXmlPayload(body)) return 'soap'

  return 'rest'
}

module.exports = { extractRequest, detectMode, lowerHeaders }
