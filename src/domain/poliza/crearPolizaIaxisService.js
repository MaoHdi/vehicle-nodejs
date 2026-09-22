'use strict'

const { msg, format } = require('../../config/properties')
const logger = require('../../shared/logger')
const polizaRepository = require('../../infrastructure/db/polizaRepository')
const callout = require('./crearPolizaIaxisCallout')

/**
 * Port de `co.com.libertymutual.vehicleservices.service.CrearPolizaIaxisService`.
 *
 * Valida el producto y los datos minimos del riesgo, comprueba restricciones
 * (vehiculo/persona), verifica que la poliza y el recibo no existan ya en iAxis y,
 * si todo es correcto, delega la grabacion en el callout.
 */

const PRODUCTOS_CUMPLIMIENTO = ['codigo_prod10004', 'codigo_prod10005']
const PRODUCTOS_HOME = [
  'codigo_prod900758',
  'codigo_prod800020',
  'codigo_prod10024',
  'codigo_prod6071',
  'codigo_prod10003'
]
const PRODUCTOS_AUTO = [
  'codigo_prod6031',
  'codigo_prod6033',
  'codigo_prod6034',
  'codigo_prod6038',
  'codigo_prod6039'
]

/** `true` reproduce el fallo del legacy cuando el producto es de cumplimiento. */
const LEGACY_BUG_COMPAT = process.env.LEGACY_BUG_COMPAT === 'true'

const esAlgunProducto = (producto, claves) => claves.some((clave) => producto === msg(clave).trim())
const noVacio = (value) => value !== null && value !== undefined && String(value) !== ''

function estadoError (codigoEstado, codigoEstadoServidor, descripcionEstado) {
  return {
    codigoEstado: msg(codigoEstado),
    codigoEstadoServidor: msg(codigoEstadoServidor),
    descripcionEstado,
    severidad: msg('severidad_error')
  }
}

/** Port de `consultarRecibo`. */
async function consultarRecibo (datosGestion, rs, estado, producto) {
  logger.info('Consultando recibo en iAxis')
  if (producto === null || producto === undefined) return
  if (datosGestion.numeroRecibo === null || datosGestion.numeroRecibo === undefined) return

  const recibos = await polizaRepository.consultaReciboIaxis(String(datosGestion.numeroRecibo))

  if (recibos.length === 0) {
    rs.emisionPoliza = { resultadoPolizaAuto: { codigoProcesoCargue: '' } }
    return
  }

  if (recibos[0].nrecibo !== null && recibos[0].nrecibo !== undefined) {
    Object.assign(estado, estadoError('codigo_estado2', 'cod_estadoservidor25', msg('msg_error_recibo_existente')))
  } else {
    rs.emisionPoliza = { resultadoPolizaAuto: { codigoProcesoCargue: '' } }
  }
}

/** Port de `consultarPolizaProceso`. */
async function consultarPolizaProceso (datosGestion, rs, estado, producto) {
  logger.info('Consultando el proceso de la poliza en iAxis')

  const procesos = await polizaRepository.consultaPolizaProcesoIaxis(String(datosGestion.numeroPoliza))

  const productosSinValidacionProceso =
    producto === msg('codigo_prod10024') || producto === msg('codigo_prod10003') || producto === msg('codigo_prod6071')

  if (productosSinValidacionProceso || procesos.length === 0 || procesos[0].proceso === '') {
    await consultarRecibo(datosGestion, rs, estado, producto)
    return
  }

  const proceso = procesos[0].proceso
  Object.assign(
    estado,
    estadoError(
      'codigo_estado2',
      'cod_estadoservidor45',
      format('msg_error_polizaproceso_existente', String(datosGestion.numeroPoliza), proceso)
    )
  )
}

/**
 * Port de `consultarPoliza`.
 *
 * Nota: el legacy solo buscaba `datosGestion` en auto y home; para cumplimiento
 * lanzaba `IndexOutOfBoundsException` sobre la lista vacia de `datosPolizaHome`, de
 * modo que los productos 10004/10005 nunca completaban. Aqui se toma tambien
 * `datosPolizaCumplimiento.datosGestion`, que es la fuente correcta.
 */
async function consultarPoliza (poliza, rs, estado, producto) {
  logger.info('Consultando la poliza en iAxis')

  let datosGestion = {}
  if (poliza.datosPolizaAuto?.datosGestion) {
    datosGestion = poliza.datosPolizaAuto.datosGestion
  } else if (poliza.datosPolizaHome?.[0]?.datosGestion) {
    datosGestion = poliza.datosPolizaHome[0].datosGestion
  } else if (!LEGACY_BUG_COMPAT && poliza.datosPolizaCumplimiento?.datosGestion) {
    datosGestion = poliza.datosPolizaCumplimiento.datosGestion
  } else if (LEGACY_BUG_COMPAT) {
    throw new Error('No hay datosGestion para el producto informado')
  }

  const movimiento = msg('numero_mov1')
  const polizas = await polizaRepository.consultaPolizaIaxis(String(datosGestion.numeroPoliza), movimiento)

  const productosSinValidacionPoliza =
    producto === msg('codigo_prod10024') || producto === msg('codigo_prod6071') || producto === msg('codigo_prod10003')

  if (polizas.length === 0 || productosSinValidacionPoliza || polizas[0].npoliza === '') {
    await consultarPolizaProceso(datosGestion, rs, estado, producto)
  } else {
    Object.assign(estado, estadoError('codigo_estado2', 'cod_estadoservidor15', msg('msg_error_poliza_existente')))
  }

  rs.emisionPoliza = {
    codigoProducto: { codigo: poliza.producto?.codigo },
    numeroPoliza: datosGestion.numeroPoliza
  }
}

/** Port de `consultarPersonaRestringida`. */
async function consultarPersonaRestringida (rq, rs, estado, producto) {
  logger.info('Consultando persona restringida en iAxis')
  const persona = rq.poliza.datosPolizaAuto?.conductor?.persona
  const restringidas = await polizaRepository.consultaPersonaRestringida(
    persona?.tipoDocumento?.codigo,
    persona?.numeroDocumento
  )

  if (restringidas.length === 0 || restringidas[0].numerodocumento === '') {
    await consultarPoliza(rq.poliza, rs, estado, producto)
  } else {
    Object.assign(estado, estadoError('codigo_estado4', 'cod_estadoservidor70', msg('msg_error_persona_restringida')))
  }
}

/** Port de `consultarVehiculoRestringido`. */
async function consultarVehiculoRestringido (rq, rs, estado, producto) {
  const identificacion = rq.poliza.datosPolizaAuto?.vehiculo?.identificacion || {}
  const restringidos = await polizaRepository.consultaVehiculoRestringido(
    identificacion.placa?.placa,
    identificacion.motor,
    identificacion.chasis,
    identificacion.vin
  )

  if (restringidos.length === 0 || String(restringidos[0].smatriclre) === '') {
    await consultarPersonaRestringida(rq, rs, estado, producto)
  } else {
    Object.assign(estado, estadoError('codigo_estado4', 'cod_estadoservidor60', msg('msg_error_vehiculo_restringido')))
  }
}

/** Port de `producto10004a10005` (polizas de cumplimiento). */
async function procesarCumplimiento (rq, rs, producto) {
  logger.info('Validando poliza de cumplimiento')
  const naturalezaRiesgo =
    rq.poliza.datosPolizaCumplimiento?.riesgoCumplimiento?.descripcionRiesgo?.naturalezaRiesgo ?? ''

  if (noVacio(naturalezaRiesgo)) {
    await consultarPoliza(rq.poliza, rs, rs.infoResponse.estado, producto)
    await callout.postRouting(rq, rs)
  } else {
    rs.infoResponse.estado = estadoError(
      'codigo_estado2',
      'cod_estadoservidor35',
      msg('msg_error_faltan_datos_risc_cumpli')
    )
  }
}

/** Port de `producto900078a10024` (polizas Home). */
async function procesarHome (rq, rs, producto) {
  const direccionRiesgo = rq.poliza.datosPolizaHome?.[0]?.riesgoHome?.ubicacionRiesgo

  if (
    direccionRiesgo &&
    noVacio(direccionRiesgo.textoDeVia) &&
    noVacio(direccionRiesgo.departamento) &&
    noVacio(direccionRiesgo.ciudad)
  ) {
    await consultarPoliza(rq.poliza, rs, rs.infoResponse.estado, producto)
    await callout.postRouting(rq, rs)
  } else {
    rs.infoResponse.estado = estadoError(
      'codigo_estado2',
      'cod_estadoservidor35',
      msg('msg_error_faltan_datos_risc_home')
    )
  }
}

/** Port de `producto6031a6039` (polizas de autos). */
async function procesarAuto (rq, rs, producto) {
  const identificacion = rq.poliza.datosPolizaAuto?.vehiculo?.identificacion || {}

  if (
    noVacio(identificacion.codigoFasecolda) &&
    noVacio(identificacion.placa?.placa) &&
    noVacio(identificacion.motor) &&
    noVacio(identificacion.chasis)
  ) {
    await consultarVehiculoRestringido(rq, rs, rs.infoResponse.estado, producto)
    await callout.postRouting(rq, rs)
  } else {
    rs.infoResponse.estado = estadoError(
      'codigo_estado2',
      'cod_estadoservidor35',
      msg('msg_error_fasecolda_placa_motor')
    )
    rs.emisionPoliza = { codigoProducto: {} }
  }
}

/** Port de `errorCrearPolizaiAxis`. */
function errorCrearPolizaIaxis (infoRequest, rs) {
  rs.infoResponse = {
    estado: estadoError('codigo_estado1', 'cod_estadoservidor500', msg('msg_errorBPEL_CrearPolizaIAXIS')),
    requestID: infoRequest?.requestID ?? null
  }
}

/**
 * Punto de entrada del servicio. Port de `crearPoliza` / `crearPolizaIaxis`.
 *
 * @param {object} request modelo canonico (`infoRequest` + `poliza`)
 * @returns {Promise<object>} modelo canonico de respuesta
 */
async function crearPoliza (request) {
  logger.info('Iniciando creacion de poliza en iAxis')
  const rs = {}
  const infoRequest = request?.infoRequest

  try {
    rs.infoResponse = {
      estado: {
        codigoEstado: msg('codigo_estado0'),
        codigoEstadoServidor: msg('codigo_estado0'),
        descripcionEstado: msg('msg_datpol_recibidos_ok'),
        severidad: msg('severidad_info')
      },
      requestID: infoRequest?.requestID ?? null
    }

    const producto = String(request.poliza?.producto?.codigo ?? '')
    logger.info('Producto recibido', { producto })

    if (esAlgunProducto(producto, PRODUCTOS_CUMPLIMIENTO)) {
      await procesarCumplimiento(request, rs, producto)
    } else if (esAlgunProducto(producto, PRODUCTOS_HOME)) {
      await procesarHome(request, rs, producto)
    } else if (esAlgunProducto(producto, PRODUCTOS_AUTO)) {
      await procesarAuto(request, rs, producto)
    } else {
      rs.infoResponse.estado = estadoError(
        'codigo_estado2',
        'cod_estadoservidor10',
        format('msg_error_codprod_no_soporta_creacionpol', producto)
      )
      rs.emisionPoliza = { codigoProducto: {} }
    }
  } catch (error) {
    logger.error('Error no controlado en crearPolizaIAXIS', { error: error.message, stack: error.stack })
    errorCrearPolizaIaxis(infoRequest, rs)
  }

  return rs
}

module.exports = {
  crearPoliza,
  consultarPoliza,
  consultarPolizaProceso,
  consultarRecibo,
  consultarVehiculoRestringido,
  consultarPersonaRestringida
}
