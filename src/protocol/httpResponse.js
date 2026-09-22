'use strict'

const env = require('../config/env')

const CHARSET = ';charset=UTF-8'

/**
 * Mapeo del `codigoEstado` de negocio a un HTTP status para el canal REST.
 * En SOAP la respuesta siempre es 200 (el estado viaja dentro del mensaje),
 * tal como lo hacia el controlador Spring del legacy.
 */
const STATUS_BY_CODIGO_ESTADO = {
  0: 200,
  1: 500,
  2: 400,
  3: 500,
  4: 409
}

/**
 * @param {object} canonicalResponse respuesta de negocio (`infoResponse.estado`)
 * @returns {number}
 */
function restStatusFor (canonicalResponse) {
  if (!env.restHttpStatusMapping) return 200
  const codigo = canonicalResponse?.infoResponse?.estado?.codigoEstado
  if (codigo === undefined || codigo === null) return 200
  return STATUS_BY_CODIGO_ESTADO[Number(codigo)] ?? 200
}

/**
 * Respuesta SOAP. Replica los encabezados que devolvia VehicleServiceController.
 * @param {string} xml
 * @param {number} [statusCode]
 * @returns {object}
 */
function soap (xml, statusCode = 200) {
  return {
    statusCode,
    headers: {
      'Content-Type': `text/xml${CHARSET}`,
      SOAPaction: '""',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    },
    body: xml
  }
}

/**
 * Respuesta REST/JSON.
 * @param {object} payload
 * @param {number} [statusCode]
 * @returns {object}
 */
function json (payload, statusCode = 200) {
  return {
    statusCode,
    headers: {
      'Content-Type': `application/json${CHARSET}`,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    },
    body: JSON.stringify(payload)
  }
}

/**
 * Respuesta del contrato WSDL.
 * @param {string} wsdl
 * @returns {object}
 */
function wsdl (wsdlContent) {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': `text/xml${CHARSET}`,
      SOAPaction: '',
      'X-Content-Type-Options': 'nosniff'
    },
    body: wsdlContent
  }
}

module.exports = { soap, json, wsdl, restStatusFor, STATUS_BY_CODIGO_ESTADO }
