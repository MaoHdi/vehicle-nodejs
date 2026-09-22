'use strict'

const oracle = require('./oracle')
const sql = require('./sql')

const { oracledb } = oracle

/**
 * Port de `TransaccionCrearInspeccionRepository`.
 */

/**
 * @param {string} nnumide numero de documento
 * @param {string} ctipide tipo de documento
 * @returns {Promise<number|null>} sperson
 */
async function consultarPersonaAXIS (nnumide, ctipide) {
  const rows = await oracle.query(sql.CONSULTAR_PERSONA, { nnumide, ctipide })
  if (rows.length === 0) return null
  const value = rows[0].SPERSON
  return value === null || value === undefined ? null : Number(value)
}

/**
 * Invoca `AXIS.P_MIILS_CREA_INSPECCION_EXT`.
 *
 * `P_SPERSON` es IN OUT: entra con el sperson consultado y sale con el codigo de
 * persona definitivo (tal como lo resolvia SimpleJdbcCall en el legacy).
 *
 * @param {object} params
 * @returns {Promise<{poutIdInspeccion: number|null, pSperson: number|null}>}
 */
async function crearOrdenInspeccionAutos (params) {
  const binds = {
    P_ID_USUARIO_CREADOR: params.pIdUsuarioCreador ?? null,
    P_CODIGO_PRODUCTO: params.pCodigoProducto ?? null,
    P_ID_INTERMEDIARIO: params.pIdIntermediario ?? null,
    P_MOTIVO_INSPECCION: params.pMotivoInspeccion ?? null,
    P_TIPO_PLACA: params.pTipoPlaca ?? null,
    P_PLACA: params.pPlaca ?? null,
    P_FASECOLDA: params.pFasecolda ?? null,
    P_CHASIS: params.pChasis ?? null,
    P_MOTOR: params.pMotor ?? null,
    P_NUMERO_SERIE: params.pNumeroSerie ?? null,
    P_MODELO: params.pModelo ?? null,
    P_COLOR: params.pColor ?? null,
    P_KILOMETRAJE: params.pKilometraje ?? null,
    P_KILOMETRAJE_ANIO: params.pKilometrajeAnio ?? null,
    P_TIPO_PINTURA: params.pTipoPintura ?? null,
    P_TIPO_CAJA: params.pTipoCaja ?? null,
    P_TIPO_CARROCERIA: params.pTipoCarroceria ?? null,
    P_TIPO_SERVICIO: params.pTipoServicio ?? null,
    P_TIPO_VEHICULO: params.pTipoVehiculo ?? null,
    P_VALOR: params.pValor ?? null,
    P_TIPOS_INSP_QUE_APLICA: params.pTiposInspQueAplica ?? null,
    P_SPERSON: { dir: oracledb.BIND_INOUT, type: oracledb.NUMBER, val: params.pSperson ?? null },
    POUT_ID_INSPECCION: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
  }

  const placeholders = Object.keys(binds)
    .map((key) => `${key} => :${key}`)
    .join(', ')

  const result = await oracle.withConnection((connection) =>
    connection.execute(`BEGIN AXIS.${sql.SP_CREA_INSPECCION}(${placeholders}); END;`, binds, { autoCommit: true })
  )

  const out = result.outBinds || {}
  return {
    poutIdInspeccion: out.POUT_ID_INSPECCION ?? null,
    pSperson: out.P_SPERSON ?? null
  }
}

module.exports = { consultarPersonaAXIS, crearOrdenInspeccionAutos }
