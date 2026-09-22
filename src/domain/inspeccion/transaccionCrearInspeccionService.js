'use strict'

const logger = require('../../shared/logger')
const { msg } = require('../../config/properties')
const repository = require('../../infrastructure/db/transaccionInspeccionRepository')

/**
 * Port de `TransaccionCrearInspeccionService`.
 *
 * Consulta la persona en iAxis y, si existe, invoca el procedimiento
 * `AXIS.P_MIILS_CREA_INSPECCION_EXT` para crear la orden de inspeccion.
 */

/**
 * Equivalente a `Integer.parseInt`: lanza cuando el valor no es numerico
 * (el legacy propaga la `NumberFormatException` hasta el catch del servicio).
 * @param {*} value
 * @returns {number}
 */
function parseIntStrict (value) {
  const parsed = Number.parseInt(String(value), 10)
  if (Number.isNaN(parsed)) throw new Error(`Valor numerico invalido: ${value}`)
  return parsed
}

/**
 * Port de `crearInspeccionAutos`: calcula el kilometraje anual.
 * @param {object} datosInsAuto
 * @returns {number|null}
 */
function calcularKilometrajeAnio (datosInsAuto) {
  const vehiculo = datosInsAuto.vehiculo || {}
  const modelo = String(vehiculo.modelo)
  let kilometroAnio = null

  if (modelo !== '') {
    const anio = new Date().getFullYear()
    const modeloNum = parseIntStrict(vehiculo.modelo)
    const diferencia = anio - modeloNum

    if (diferencia !== 0 && vehiculo.kilometraje !== null && vehiculo.kilometraje !== undefined) {
      kilometroAnio = Number.parseFloat(vehiculo.kilometraje)
    } else if (vehiculo.kilometraje !== null && vehiculo.kilometraje !== undefined && vehiculo.kilometraje !== '0.0') {
      kilometroAnio = Number.parseFloat(vehiculo.kilometraje) / diferencia
    }
  }

  return kilometroAnio
}

const codigoOrDefault = (elemento) =>
  elemento && elemento.codigo !== null && elemento.codigo !== undefined ? String(elemento.codigo) : '0'

/**
 * Port de `crearInspeccionAutosProcedure`.
 * @param {object} datosInsAuto
 * @param {number|null} kilometroAnio
 * @param {number} sperson
 * @returns {Promise<{poutIdInspeccion: number|null, pSperson: number|null}|null>}
 */
async function crearInspeccionAutosProcedure (datosInsAuto, kilometroAnio, sperson) {
  const vehiculo = datosInsAuto.vehiculo || {}
  const placa = vehiculo.placa || {}

  try {
    return await repository.crearOrdenInspeccionAutos({
      pIdUsuarioCreador: String(datosInsAuto.usuarioCreador).toUpperCase(),
      pCodigoProducto: datosInsAuto.codigoProducto?.codigo ?? null,
      pIdIntermediario: datosInsAuto.claveAgente ?? null,
      pMotivoInspeccion: datosInsAuto.codigoMotivoInspeccion?.codigo ?? null,
      pTipoPlaca: placa.tipoPlaca?.codigo ?? null,
      pPlaca: placa.placa ?? null,
      pFasecolda: vehiculo.codigoFasecolda ?? null,
      pChasis: vehiculo.chasis ?? null,
      pMotor: vehiculo.motor ?? null,
      pNumeroSerie: vehiculo.vin ?? null,
      pModelo: vehiculo.modelo === null || vehiculo.modelo === undefined ? null : Number(vehiculo.modelo),
      pColor: codigoOrDefault(vehiculo.color),
      pKilometraje: vehiculo.kilometraje ?? null,
      pKilometrajeAnio: kilometroAnio,
      pTipoPintura: codigoOrDefault(vehiculo.tipoPintura),
      pTipoCaja: codigoOrDefault(vehiculo.tipoCaja),
      pTipoCarroceria: codigoOrDefault(vehiculo.tipoCarroceria),
      pTipoServicio: codigoOrDefault(vehiculo.tipoServicio),
      pTipoVehiculo: codigoOrDefault(vehiculo.tipoVehiculo),
      pValor: vehiculo.valor === null || vehiculo.valor === undefined ? null : Number(vehiculo.valor),
      pTiposInspQueAplica: datosInsAuto.tiposInspQueAplica ?? '0',
      pSperson: sperson
    })
  } catch (error) {
    logger.info('Error procedimiento crearOrdenInspAutos', { error: error.message })
    return null
  }
}

/**
 * Port de `procesarTransaccion` / `consultarPersonaIAXIS`.
 * @param {object} rq request canonico de crearConsultarInspMIILS
 * @returns {Promise<object>} respuesta parcial con la inspeccion creada
 */
async function procesarTransaccion (rq) {
  if (!rq) return null

  const solicitud = rq.solicitud || {}
  const inspeccion = solicitud.inspeccion || {}
  const datosInsAuto = inspeccion.datosInspeccionAuto || {}
  const perInspeccion = datosInsAuto.clienteInspeccion || {}

  let spersonConsulta = null
  try {
    spersonConsulta = await repository.consultarPersonaAXIS(
      perInspeccion.numeroDocumento,
      perInspeccion.tipoDocumento?.codigo
    )
    logger.info('Persona localizada en iAxis', { encontrada: spersonConsulta !== null })
  } catch (error) {
    logger.error('No se encontro persona en IAXIS', { error: error.message })
  }

  const rs = { solicitud: { ...solicitud } }
  let estado = {}

  if (spersonConsulta !== null) {
    const kilometroAnio = calcularKilometrajeAnio(datosInsAuto)
    const crearInspAutos = await crearInspeccionAutosProcedure(datosInsAuto, kilometroAnio, spersonConsulta)

    estado = {
      codigoEstado: msg('codigo_estado70'),
      codigoEstadoServidor: msg('codigo_estado0'),
      descripcionEstado: msg('msg_error_creando_orden_insp'),
      severidad: msg('severidad_error')
    }

    if (crearInspAutos && crearInspAutos.poutIdInspeccion !== null && crearInspAutos.poutIdInspeccion !== undefined) {
      const idInspeccion = String(crearInspAutos.poutIdInspeccion)
      const codPersona = String(crearInspAutos.pSperson)

      if (idInspeccion !== '') {
        estado.codigoEstado = msg('codigo_estado0')
        estado.descripcionEstado = msg('descripcion_estado_ok')
        estado.severidad = msg('severidad_info')

        perInspeccion.codigoPersona = codPersona
        datosInsAuto.clienteInspeccion = perInspeccion
        rs.solicitud.inspeccion = { idInspeccion, datosInspeccionAuto: datosInsAuto }
      }
    }
  }

  rs.infoResponse = { estado, requestID: rq.infoRequest?.requestID ?? null }
  return rs
}

module.exports = { procesarTransaccion, calcularKilometrajeAnio, crearInspeccionAutosProcedure, parseIntStrict }
