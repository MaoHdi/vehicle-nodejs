'use strict'

// Debe ir primero: carga src/env/<stage>.env antes que cualquier modulo lea process.env.
require('../config/loadEnv')

const { createOperationHandler } = require('../protocol/httpAdapter')
const { COMMON } = require('../config/properties')
const gestionInspeccionMiilsService = require('../domain/inspeccion/gestionInspeccionMiilsService')

/**
 * Lambda `crearConsultaInspMILS`.
 *
 * Migracion de la operacion SOAP `crearConsultarInspMIILS` (y de su alias
 * `crearInspMIILS`) del servicio Java VehicleServices.
 *
 * Canales soportados:
 *  - REST  : `POST` con JSON `{ "infoRequest": {...}, "solicitud": {...} }`
 *  - SOAP  : `POST` con el sobre SOAP 1.1 que ya envian los consumidores legacy
 *  - WSDL  : `GET ...?wsdl`
 */
const handler = createOperationHandler({
  operations: {
    crearConsultarInspMIILSRq: {
      responseElement: 'crearConsultarInspMIILSRs',
      responseType: 'CrearConsultarInspMIILSRs'
    },
    crearInspMIILSRq: {
      responseElement: 'crearInspMIILSRs',
      responseType: 'CrearInspMIILSRs'
    }
  },
  defaultOperation: 'crearConsultarInspMIILSRq',
  auditCode: COMMON.INSP_MILLS,
  legacyTagFixes: true,
  execute: (request, options) => gestionInspeccionMiilsService.procesar(request, options)
})

module.exports = { handler }
