'use strict'

const { msg } = require('../../config/properties')
const logger = require('../../shared/logger')
const dao = require('./grabarPolizaIaxisDao')

/**
 * Port de `co.com.libertymutual.vehicleservices.callOut.CrearPolizaIAXISCallout`.
 *
 * Una vez superadas las validaciones de negocio, graba la poliza en iAxis y
 * completa la respuesta con el codigo de proceso de cargue.
 */

const PRODUCTOS_AUTO = new Set(['6031', '6033', '6034', '6038', '6039'])
const PRODUCTOS_HOME = new Set(['900758', '10024', '800020', '6071', '10003'])
const PRODUCTOS_EBONDS = new Set(['10004', '10005'])

/** `true` reproduce los defectos del legacy en el flujo de cumplimiento (EBonds). */
const LEGACY_BUG_COMPAT = process.env.LEGACY_BUG_COMPAT === 'true'

const esNumerico = (value) => value !== null && value !== undefined && /^-?\d+$/.test(String(value).trim())

function estadoErrorConversion (resultadoProceso) {
  return {
    codigoEstado: msg('codigo_estado3'),
    codigoEstadoServidor: msg('cod_estadoservidor20'),
    descripcionEstado: `${msg('crearpolizaiaxis.error.convertir_resultadoproceso')}${resultadoProceso}-`,
    severidad: msg('severidad_error')
  }
}

/**
 * @param {object} rq request canonico de crearPolizaIAXIS
 * @param {object} response respuesta que se esta construyendo (se muta)
 * @returns {Promise<boolean>}
 */
async function postRouting (rq, response) {
  let estado = {}

  try {
    if (!rq || !rq.poliza) {
      estado = {
        codigoEstado: msg('codigo_estado3'),
        codigoEstadoServidor: msg('cod_estadoservidor50'),
        descripcionEstado: msg('msg_error_request_crearpolizaIAXIS'),
        severidad: msg('severidad_error')
      }
      response.infoResponse.estado = estado
      return true
    }

    try {
      estado = response.infoResponse.estado
      if (estado.codigoEstado !== msg('codigo_estado0')) return true

      const producto = String(rq.poliza.producto?.codigo ?? '')

      if (PRODUCTOS_AUTO.has(producto)) {
        const resultadoProceso = await dao.grabarPolizaIAXISAuto(rq.poliza.datosPolizaAuto, rq.poliza.producto)
        if (!esNumerico(resultadoProceso)) {
          estado = estadoErrorConversion(resultadoProceso)
          response.infoResponse.estado = estado
          return true
        }
        response.emisionPoliza = {
          codigoProducto: { codigo: producto },
          numeroPoliza: rq.poliza.datosPolizaAuto?.datosGestion?.numeroPoliza,
          resultadoPolizaAuto: { codigoProcesoCargue: resultadoProceso }
        }
        return true
      }

      if (PRODUCTOS_HOME.has(producto)) {
        const resultadoProceso = await dao.grabarPolizaIAXISHome(rq.poliza.datosPolizaHome, rq.poliza.producto)
        if (!esNumerico(resultadoProceso)) {
          estado = estadoErrorConversion(resultadoProceso)
          return true
        }
        response.emisionPoliza = response.emisionPoliza || {}
        response.emisionPoliza.resultadoPolizaHome = { codigoProcesoCargue: resultadoProceso }
        return true
      }

      if (PRODUCTOS_EBONDS.has(producto)) {
        const resultadoProceso = await dao.grabarPolizaIAXISEBonds(
          rq.poliza.datosPolizaCumplimiento,
          rq.poliza.producto
        )
        if (!esNumerico(resultadoProceso)) {
          estado = estadoErrorConversion(resultadoProceso)
          return true
        }
        response.emisionPoliza = response.emisionPoliza || {}
        // DEFECTO DEL LEGACY: asignaba el codigo de proceso sobre `resPolizaHome`
        // (campo de instancia nulo), lo que producia un NullPointerException y hacia
        // que cumplimiento SIEMPRE respondiera error. Aqui se informa el resultado
        // en `resultadoPolizaCumplimiento`, que es el campo correcto.
        if (LEGACY_BUG_COMPAT) {
          estado = estadoErrorConversion(resultadoProceso)
          response.emisionPoliza.resultadoPolizaCumplimiento = {}
        } else {
          response.emisionPoliza.resultadoPolizaCumplimiento = { codigoProcesoCargue: resultadoProceso }
        }
        return true
      }

      return true
    } catch (error) {
      logger.error('Error consultando el codigo de producto en el mensaje de origen', { error: error.message })
      estado = {
        codigoEstado: msg('codigo_estado2'),
        codigoEstadoServidor: msg('cod_estadoservidor30'),
        descripcionEstado: msg('grabarpolizaiaxis.error.codigoproducto'),
        severidad: msg('severidad_error')
      }
      return true
    }
  } catch (error) {
    logger.error('Error no controlado en postRouting de crearPolizaIAXIS', { error: error.message })
    return true
  } finally {
    response.infoResponse.estado = estado
  }
}

module.exports = { postRouting, PRODUCTOS_AUTO, PRODUCTOS_HOME, PRODUCTOS_EBONDS }
