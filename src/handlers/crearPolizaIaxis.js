'use strict'

// Debe ir primero: carga src/env/<stage>.env antes que cualquier modulo lea process.env.
require('../config/loadEnv')

const { createOperationHandler } = require('../protocol/httpAdapter')
const { COMMON } = require('../config/properties')
const crearPolizaIaxisService = require('../domain/poliza/crearPolizaIaxisService')

/**
 * Lambda `crearPolizaIAXIS`.
 *
 * Migracion de la operacion SOAP `crearPolizaIAXIS` del servicio Java
 * VehicleServices: valida el producto y las restricciones de iAxis y graba la
 * poliza (autos, home o cumplimiento) a traves de los procedimientos de carga.
 *
 * Canales soportados:
 *  - REST  : `POST` con JSON `{ "infoRequest": {...}, "poliza": {...} }`
 *  - SOAP  : `POST` con el sobre SOAP 1.1 que ya envian los consumidores legacy
 *  - WSDL  : `GET ...?wsdl`
 */
const handler = createOperationHandler({
  operations: {
    crearPolizaIAXISRq: {
      responseElement: 'crearPolizaIAXISRs',
      responseType: 'CrearPolizaIAXISRs'
    }
  },
  defaultOperation: 'crearPolizaIAXISRq',
  auditCode: COMMON.POLIZA_IAXIS,
  execute: (request) => crearPolizaIaxisService.crearPoliza(request)
})

module.exports = { handler }
