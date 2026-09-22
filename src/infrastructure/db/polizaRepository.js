'use strict'

const oracle = require('./oracle')
const sql = require('./sql')

/**
 * Port de `CrearPolizaIaxisRepository`.
 * Se usa tanto por crearPolizaIAXIS como por crearConsultarInspMIILS (consultas de
 * vehiculo y persona restringidos).
 */

const str = (value) => (value === null || value === undefined ? null : String(value))
const num = (value) => (value === null || value === undefined ? null : Number(value))

/**
 * @param {string} placa
 * @param {string} motor
 * @param {string} chasis
 * @param {string} vin
 * @returns {Promise<object[]>}
 */
async function consultaVehiculoRestringido (placa, motor, chasis, vin) {
  const rows = await oracle.query(sql.CONSULTA_VEHICULO_RESTRINGIDO, [
    placa ?? null,
    motor ?? null,
    chasis ?? null,
    vin ?? null
  ])
  return rows.map((row) => ({
    smatriclre: num(row.SMATRICLRE),
    cmatric: str(row.CMATRIC),
    codmotor: str(row.CODMOTOR),
    cchasis: str(row.CCHASIS),
    nbastid: str(row.NBASTID),
    cclalis: num(row.CCLALIS),
    ctiplis: num(row.CTIPLIS),
    finclus: row.FINCLUS ?? null,
    fexclus: row.FEXCLUS ?? null,
    cinclus: num(row.CINCLUS),
    cexclus: num(row.CEXCLUS)
  }))
}

/**
 * @param {string} tipoDocumento
 * @param {string} numeroDocumento
 * @returns {Promise<object[]>}
 */
async function consultaPersonaRestringida (tipoDocumento, numeroDocumento) {
  const rows = await oracle.query(sql.CONSULTA_PERSONA_RESTRINGIDA, [tipoDocumento ?? null, numeroDocumento ?? null])
  return rows.map((row) => ({
    tipodocumento: num(row.TIPODOCUMENTO),
    numerodocumento: str(row.NUMERODOCUMENTO),
    claselista: num(row.CLASELISTA),
    tipolista: num(row.TIPOLISTA),
    fechainclusion: row.FECHAINCLUSION ?? null,
    fechaexclusion: row.FECHAEXCLUSION ?? null,
    motivoinclusion: num(row.MOTIVOINCLUSION),
    motivoexclusion: num(row.MOTIVOEXCLUSION)
  }))
}

/**
 * @param {string} poliza
 * @param {string} movimiento
 * @returns {Promise<object[]>}
 */
async function consultaPolizaIaxis (poliza, movimiento) {
  const rows = await oracle.query(sql.CONSULTA_POLIZA_IAXIS, [poliza, movimiento])
  return rows.map((row) => ({
    npoliza: str(row.NPOLIZA),
    ncertif: str(row.NCERTIF),
    nsuplem: str(row.NSUPLEM),
    nmovimi: str(row.NMOVIMI),
    sseguro: str(row.SSEGURO),
    cmodali: str(row.CMODALI),
    ccolect: str(row.CCOLECT),
    ctipseg: str(row.CTIPSEG),
    casegur: str(row.CASEGUR),
    cagente: str(row.CAGENTE),
    cramo: str(row.CRAMO)
  }))
}

/**
 * @param {string} poliza
 * @returns {Promise<Array<{proceso: string}>>}
 */
async function consultaPolizaProcesoIaxis (poliza) {
  const rows = await oracle.query(sql.CONSULTA_POLIZA_PROCESO_IAXIS, [poliza])
  return rows.map((row) => ({ proceso: str(row.PROCESO) }))
}

/**
 * @param {string} numeroRecibo
 * @returns {Promise<object[]>}
 */
async function consultaReciboIaxis (numeroRecibo) {
  const rows = await oracle.query(sql.CONSULTA_RECIBO_IAXIS, [numeroRecibo])
  return rows.map((row) => ({
    nrecibo: num(row.NRECIBO),
    sseguro: num(row.SSEGURO),
    nmovimi: num(row.NMOVIMI)
  }))
}

module.exports = {
  consultaVehiculoRestringido,
  consultaPersonaRestringida,
  consultaPolizaIaxis,
  consultaPolizaProcesoIaxis,
  consultaReciboIaxis
}
