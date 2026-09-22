'use strict'

const env = require('../../config/env')
const logger = require('../../shared/logger')

/**
 * Port de `co.com.libertymutual.vehicleservices.proxy.SOAPClient` y de
 * `SoapExternalClientEnum`.
 *
 * Mantiene el comportamiento del legacy: los errores se registran y se devuelve
 * `null`, sin propagar la excepcion al flujo de negocio.
 */

/** Servicios SOAP externos consumidos por estas lambdas. */
const EXTERNAL_SERVICES = {
  MIILS_INSPECCIONES: { urlKey: 'urlMediationInspeccion', operation: 'CrearInstanciaInspeccion' },
  SINIESTROS_SISA: { urlKey: 'urlAutoSisa', operation: 'ConsultarSiniestrosSisa' }
}

/**
 * Invoca un servicio SOAP externo.
 * @param {string} requestXml
 * @param {{urlKey: string, operation: string}} service
 * @returns {Promise<string|null>} cuerpo de la respuesta o `null` si hubo error
 */
async function execute (requestXml, service) {
  const url = env[service.urlKey]
  if (!url) {
    logger.error('URL del servicio SOAP externo no configurada', { service: service.operation })
    return null
  }

  logger.info('Invocando servicio SOAP externo', { operation: service.operation, timeoutMs: env.soapTimeoutMs })

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'text/xml',
        SOAPAction: service.operation
      },
      body: requestXml,
      signal: AbortSignal.timeout(env.soapTimeoutMs)
    })

    logger.info('Respuesta del servicio SOAP externo', {
      operation: service.operation,
      statusCode: response.status
    })
    return await response.text()
  } catch (error) {
    logger.error('SOAPCLIENT ERROR', { operation: service.operation, error: error.message })
    return null
  }
}

module.exports = { EXTERNAL_SERVICES, execute }
