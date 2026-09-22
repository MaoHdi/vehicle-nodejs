'use strict'

const logger = require('../../shared/logger')
const { COMMON } = require('../../config/properties')
const { escapeXml, parseXml } = require('../../protocol/xml')
const { PREFIX_ENV, SOAP_NS } = require('../../protocol/soapEnvelope')
const { EXTERNAL_SERVICES, execute } = require('../../infrastructure/soap/soapClient')

/**
 * Port de `co.com.libertymutual.vehicleservices.service.ConsultarSiniestrosPlaca`.
 *
 * Consulta el historico de siniestros de una placa en SISA. Los fallos no
 * interrumpen la inspeccion: se devuelve el mensaje de error de FASECOLDA con la
 * lista vacia, igual que el legacy.
 */

const NS_CLAIMS = 'http://Indemnizacion/ClaimsAutos'
/** Constante heredada del legacy (`createInfoRequest`). */
const REQUEST_ID_SISA = '1254125412'

const el = (tag, value) => (value === null || value === undefined ? '' : `<${tag}>${escapeXml(value)}</${tag}>`)

/**
 * Construye el mensaje SOAP `consultarSiniestrosHistoricosSisaV201306`.
 * @param {string} placa
 * @returns {string}
 */
function buildRequest (placa) {
  const rq =
    '<consultarSiniestrosHistoricosSisaRq>' +
    `<infoRequest>${el('requestID', REQUEST_ID_SISA)}</infoRequest>` +
    `<placa>${el('placa', placa)}${el('tipoPlaca', '1')}</placa>` +
    el('chasis', '') +
    el('motor', '') +
    '</consultarSiniestrosHistoricosSisaRq>'

  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    `<${PREFIX_ENV}:Envelope xmlns:${PREFIX_ENV}="${SOAP_NS}">` +
    `<${PREFIX_ENV}:Header/><${PREFIX_ENV}:Body>` +
    `<cla:consultarSiniestrosHistoricosSisaV201306 xmlns:cla="${NS_CLAIMS}">${rq}</cla:consultarSiniestrosHistoricosSisaV201306>` +
    `</${PREFIX_ENV}:Body></${PREFIX_ENV}:Envelope>`
  )
}

/**
 * Port de `createSiniestros`: normaliza un siniestro de SISA al modelo de respuesta.
 * @param {object} sisa
 * @returns {object}
 */
function mapSiniestro (sisa) {
  const garantias = []
  const origen = sisa.garantias ?? sisa.Garantias ?? []
  for (const garantia of Array.isArray(origen) ? origen : [origen]) {
    if (garantia && garantia.nombreGarantia !== undefined) garantias.push(garantia.nombreGarantia)
  }
  // Regla del legacy: si solo hay una garantia se agrega "OTROS".
  if (garantias.length === 1) garantias.push(COMMON.GARANTIAS_OTROS)

  return {
    nombreCompania: sisa.nombreCompania ?? null,
    placa: sisa.placa ?? null,
    fechaOcurrenciaSiniestro: sisa.fechaOcurrenciaSiniestro ?? null,
    valorAsegurado: sisa.valorAsegurado ?? null,
    garantias
  }
}

/**
 * @param {string} placa
 * @returns {Promise<{mensaje: string, siniestros: object[]}>}
 */
async function procesar (placa) {
  const consulta = { mensaje: null, siniestros: [] }
  try {
    const responseXml = await execute(buildRequest(placa), EXTERNAL_SERVICES.SINIESTROS_SISA)
    if (!responseXml) throw new Error('Respuesta vacia del servicio SISA')

    const doc = parseXml(responseXml)
    const body = doc.Envelope?.Body ?? doc
    const response = body.consultarSiniestrosHistoricosSisaV201306Response ?? body
    const rs = response.consultarSiniestrosHistoricosSisaRs

    if (rs && rs.siniestros) {
      const list = Array.isArray(rs.siniestros) ? rs.siniestros : [rs.siniestros]
      consulta.mensaje = COMMON.FASECOLDA_OK
      consulta.siniestros = list.map(mapSiniestro)
      return consulta
    }

    logger.info('La consulta de siniestros no devolvio registros')
    return consulta
  } catch (error) {
    logger.error('Failed execute procesar consulta de siniestros', { error: error.message })
    return { mensaje: COMMON.FASECOLDA_ERROR, siniestros: [] }
  }
}

module.exports = { procesar, buildRequest, mapSiniestro, REQUEST_ID_SISA }
