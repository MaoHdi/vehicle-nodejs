'use strict'

const fs = require('fs')
const path = require('path')

const logger = require('../shared/logger')
const env = require('../config/env')
const { extractRequest, detectMode } = require('./negotiation')
const { unwrap, wrap, applyLegacyTagFixes, fault, SoapClientError } = require('./soapEnvelope')
const { normalizeRepeated } = require('./xml')
const httpResponse = require('./httpResponse')
const auditRepository = require('../infrastructure/db/auditRepository')

/**
 * Adaptador HTTP compartido por las dos lambdas.
 *
 * Expone cada operacion como REST/JSON y, al mismo tiempo, sigue atendiendo el
 * contrato SOAP que consumen los clientes legacy sobre el mismo endpoint:
 *
 *  - `POST` con `Content-Type: text/xml` (o con un cuerpo que empieza por `<`, o con
 *    encabezado `SOAPAction`) -> se procesa como SOAP y se responde SOAP;
 *  - `POST` con JSON -> se procesa y responde como REST;
 *  - `GET ...?wsdl` o `GET ....wsdl` -> devuelve el contrato WSDL, igual que
 *    `VehicleServiceController.wsdlVehicleServices`.
 *
 * El nucleo de negocio solo conoce el modelo canonico, que es identico en ambos
 * protocolos: el JSON REST es la proyeccion 1:1 del cuerpo SOAP.
 */

let wsdlCache

/** @returns {string} contenido del WSDL publicado. */
function loadWsdl () {
  if (wsdlCache === undefined) {
    wsdlCache = fs.readFileSync(path.join(__dirname, '..', '..', 'resources', 'wsdl', 'VehicleServices.wsdl'), 'utf8')
  }
  return wsdlCache
}

/**
 * Extrae el modelo canonico de un cuerpo JSON. Se aceptan las dos formas:
 * el objeto plano (`{infoRequest, ...}`) y el envuelto por el nombre de la
 * operacion (`{crearPolizaIAXISRq: {...}}`).
 *
 * @param {string} body
 * @param {object} operations
 * @param {string} defaultOperation
 * @returns {{operation: string, payload: object}}
 */
function parseJsonRequest (body, operations, defaultOperation) {
  let parsed
  try {
    parsed = body && body.trim() !== '' ? JSON.parse(body) : {}
  } catch {
    const error = new Error('El cuerpo de la peticion no es un JSON valido')
    error.statusCode = 400
    throw error
  }

  const wrapper = Object.keys(parsed).find((key) => operations[key])
  if (wrapper) return { operation: wrapper, payload: normalizeRepeated(parsed[wrapper]) }
  return { operation: defaultOperation, payload: normalizeRepeated(parsed) }
}

/**
 * Crea el handler Lambda de una operacion.
 *
 * @param {object} config
 * @param {object} config.operations mapa `elementoRq -> {responseElement, responseType}`
 * @param {string} config.defaultOperation operacion usada cuando el JSON no viene envuelto
 * @param {string} config.auditCode codigo de interfaz para `audit_services_web`
 * @param {(request: object, options: {operation: string}) => Promise<object>} config.execute
 * @param {boolean} [config.legacyTagFixes] aplica `XmlUtil.updayeValues` a la salida SOAP
 * @returns {(event: object, context: object) => Promise<object>}
 */
function createOperationHandler (config) {
  const { operations, defaultOperation, auditCode, execute, legacyTagFixes = false } = config

  return async function handler (event, context) {
    logger.resetContext()
    logger.setContext({ awsRequestId: context?.awsRequestId, operation: defaultOperation })

    const request = extractRequest(event)
    const mode = detectMode(request)

    if (mode === 'wsdl') {
      logger.info('Entregando contrato WSDL')
      return httpResponse.wsdl(loadWsdl())
    }

    let soapMode = mode === 'soap'

    try {
      const { operation, payload } = soapMode
        ? unwrap(request.body)
        : parseJsonRequest(request.body, operations, defaultOperation)

      const descriptor = operations[operation]
      if (!descriptor) {
        const error = new SoapClientError(`Operacion no soportada por esta lambda: ${operation}`)
        error.statusCode = 400
        throw error
      }

      logger.setContext({ operation, protocol: soapMode ? 'soap' : 'rest' })
      logger.payload('Solicitud recibida', request.body)

      const canonicalResponse = await execute(payload, { operation })

      let responseBody
      let result
      if (soapMode || env.responseProtocol === 'soap') {
        let xml = wrap(descriptor.responseElement, descriptor.responseType, canonicalResponse)
        if (legacyTagFixes) xml = applyLegacyTagFixes(xml)
        responseBody = xml
        result = httpResponse.soap(xml)
      } else {
        const payloadRest = { [descriptor.responseElement]: canonicalResponse }
        responseBody = JSON.stringify(payloadRest)
        result = httpResponse.json(payloadRest, httpResponse.restStatusFor(canonicalResponse))
      }

      logger.payload('Respuesta generada', responseBody)
      await auditRepository.insertAuditServiceWeb(request.body, responseBody, auditCode)

      return result
    } catch (error) {
      const isClientError = error instanceof SoapClientError || error.statusCode === 400
      logger[isClientError ? 'warn' : 'error']('Error atendiendo la peticion', {
        error: error.message,
        stack: isClientError ? undefined : error.stack
      })

      if (soapMode) {
        return httpResponse.soap(
          fault(isClientError ? 'env:Client' : 'env:Server', error.message),
          isClientError ? 400 : 500
        )
      }
      return httpResponse.json(
        { error: isClientError ? 'BAD_REQUEST' : 'INTERNAL_ERROR', mensaje: error.message },
        isClientError ? 400 : 500
      )
    } finally {
      logger.resetContext()
    }
  }
}

module.exports = { createOperationHandler, loadWsdl, parseJsonRequest }
