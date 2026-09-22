'use strict'

/**
 * Punto de entrada unico del paquete.
 *
 * Cada lambda declara su propio `Handler` en CloudFormation:
 *  - `src/handlers/crearConsultaInspMils.handler`
 *  - `src/handlers/crearPolizaIaxis.handler`
 *
 * Este modulo solo reexporta ambos para facilitar pruebas e invocaciones locales.
 */
const crearConsultaInspMils = require('./handlers/crearConsultaInspMils')
const crearPolizaIaxis = require('./handlers/crearPolizaIaxis')

module.exports = {
  crearConsultaInspMils: crearConsultaInspMils.handler,
  crearPolizaIaxis: crearPolizaIaxis.handler
}
