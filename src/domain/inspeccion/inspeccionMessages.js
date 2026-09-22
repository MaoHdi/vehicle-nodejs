'use strict'

const { msg } = require('../../config/properties')
const logger = require('../../shared/logger')

/**
 * Port de `GestionInspeccionMIILSMsgImpl`.
 *
 * Cada funcion muta el objeto de respuesta `rs`, igual que en el legacy. Se conservan
 * literalmente los codigos, severidades y descripciones, incluidas las combinaciones
 * que en el original parecen invertidas (ver `datosInvalidos` y `operacionNoSoportada`),
 * porque los clientes actuales ya dependen de esos textos.
 */

function estado (codigoEstado, codigoEstadoServidor, descripcionEstado, severidad) {
  return { codigoEstado, codigoEstadoServidor, descripcionEstado, severidad }
}

/** Estado inicial OK con el eco de la solicitud recibida. */
function responseInfoOK (rs, rq) {
  logger.debug('responseInfoOK')
  rs.solicitud = {
    operacion: rq.solicitud?.operacion ?? null,
    lineaNegocio: rq.solicitud?.lineaNegocio ?? null
  }
  rs.infoResponse = {
    estado: estado(msg('codigo_estado0'), msg('codigo_estado0'), msg('descripcion_estado_ok'), msg('severidad_info')),
    requestID: rq.infoRequest?.requestID ?? null
  }
}

/** Estado OK definitivo de la operacion. */
function responseInfoSuccesfull (rs, rq) {
  rs.infoResponse = {
    estado: estado(msg('codigo_estado0'), msg('codigo_estado0'), msg('msg_info_ok'), msg('severidad_info')),
    requestID: rq.infoRequest?.requestID ?? null
  }
}

function lineaNegNoSoportada (rs) {
  logger.debug('lineaNegNoSoportada')
  rs.solicitud = null
  rs.infoResponse = {
    estado: estado(
      msg('codigo_estado2'),
      msg('codigo_estado_servidor10'),
      msg('msg_error_linea_neg_nosoportada'),
      msg('severidad_error')
    )
  }
}

/**
 * ATENCION: el legacy usa aqui `msg_error_datosinvalidos` (no el mensaje de operacion
 * no soportada). Se preserva.
 */
function operacionNoSoportada (rs) {
  logger.debug('operacionNoSoportada')
  rs.solicitud = null
  rs.infoResponse = {
    estado: estado(
      msg('codigo_estado2'),
      msg('codigo_estado_servidor100'),
      msg('msg_error_datosinvalidos'),
      msg('severidad_error')
    )
  }
}

/**
 * ATENCION: el legacy usa aqui `msg_error_linea_neg_nosoportada`. Se preserva.
 */
function datosInvalidos (rs) {
  logger.debug('datosInvalidos')
  rs.solicitud = null
  rs.infoResponse = {
    estado: estado(
      msg('codigo_estado2'),
      msg('codigo_estado_servidor100'),
      msg('msg_error_linea_neg_nosoportada'),
      msg('severidad_error')
    )
  }
}

function vehiculoRestringido (rs) {
  logger.debug('vehiculoRestringido')
  rs.solicitud = {}
  rs.infoResponse = {
    estado: estado(
      msg('codigo_estado4'),
      msg('codigo_estado_servidor80'),
      msg('msg_error_vehiculorestringido'),
      msg('severidad_error')
    )
  }
}

function conductorRestringido (rs) {
  logger.debug('conductorRestringido')
  rs.solicitud = {}
  rs.infoResponse = {
    estado: estado(
      msg('codigo_estado4'),
      msg('codigo_estado_servidor70'),
      msg('msg_error_conductorrestringido'),
      msg('severidad_error')
    )
  }
}

function personaRestringIAXIS (rs) {
  logger.debug('personaRestringIAXIS')
  rs.solicitud = {}
  rs.infoResponse = {
    estado: estado(
      msg('codigo_estado4'),
      msg('codigo_estado_servidor90'),
      msg('msg_error_personarestringida_iaxis'),
      msg('severidad_error')
    )
  }
}

function placaVigenteMIILS (rs, rq, idInspeccion) {
  logger.debug('placaVigenteMIILS')
  rs.solicitud = {
    operacion: rq.solicitud?.operacion ?? null,
    lineaNegocio: rq.solicitud?.lineaNegocio ?? null,
    inspeccion: { fechaFinInspeccion: 'null' }
  }
  rs.infoResponse = {
    estado: estado(
      msg('codigo_estado2'),
      msg('codigo_estado_servidor120'),
      `${msg('msg_error_inspeccion')} ${idInspeccion}`,
      msg('severidad_error')
    ),
    requestID: rq.infoRequest?.requestID ?? null
  }
}

function inspeccionNoCreada (rs) {
  logger.debug('inspeccionNoCreada')
  rs.infoResponse = {
    estado: estado(
      msg('codigo_estado3'),
      msg('codigo_estado_servidor30'),
      msg('msg_error_inspeccionnocreada'),
      msg('severidad_error')
    )
  }
}

function noEncontrada (rs) {
  logger.debug('noEncontrada')
  rs.infoResponse = {
    estado: estado(
      msg('codigo_estado3'),
      msg('codigo_estado_servidor35'),
      msg('msg_error_codigo_inspeccionnoencontrada'),
      msg('severidad_error')
    )
  }
}

function noEncontradaConsulta (rs) {
  logger.debug('noEncontradaConsulta')
  const requestID = rs.infoResponse?.requestID ?? null
  rs.infoResponse = {
    estado: estado(
      msg('codigo_estado2'),
      msg('codigo_estado_servidor25'),
      msg('msg_error_noencontrado_consulta'),
      msg('severidad_error')
    ),
    requestID
  }
}

function sinIdInspeccion (rs) {
  logger.debug('sinIdInspeccion')
  rs.infoResponse = {
    estado: estado(
      msg('codigo_estado2'),
      msg('codigo_estado_servidor110'),
      msg('msg_error_sin_idinspeccion'),
      msg('severidad_error')
    )
  }
}

/** Port de `_catch`: error tecnico no controlado. */
function catchError (rs) {
  logger.debug('catchError')
  rs.infoResponse = {
    estado: estado(
      msg('codigo_estado3'),
      msg('cod_estadoservidor500'),
      msg('msg_error_gestion_inspMIILS'),
      msg('severidad_error')
    )
  }
}

module.exports = {
  responseInfoOK,
  responseInfoSuccesfull,
  lineaNegNoSoportada,
  operacionNoSoportada,
  datosInvalidos,
  vehiculoRestringido,
  conductorRestringido,
  personaRestringIAXIS,
  placaVigenteMIILS,
  inspeccionNoCreada,
  noEncontrada,
  noEncontradaConsulta,
  sinIdInspeccion,
  catchError
}
