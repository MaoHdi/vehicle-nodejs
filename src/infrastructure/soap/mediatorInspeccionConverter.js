'use strict'

const { msg } = require('../../config/properties')
const { escapeXml } = require('../../protocol/xml')
const { PREFIX_ENV, SOAP_NS } = require('../../protocol/soapEnvelope')
const { toXmlDateTime } = require('../../shared/dates')

/**
 * Port de `co.com.libertymutual.vehicleservices.converter.MediatorInspeccionConverter`.
 *
 * Construye el mensaje `BO_OrdenInspeccion` que se envia al mediador BPM de
 * inspecciones (Oracle SOA). Los namespaces replican los `package-info` JAXB de
 * `com.oracle.xmlns.bpm.bpmobject.modelo_inspecciones.*`.
 */

const NS_ORDEN = 'http://xmlns.oracle.com/bpm/bpmobject/Modelo_Inspecciones/BO_OrdenInspeccion'
const NS_INFO_REQUEST = 'http://xmlns.oracle.com/bpm/bpmobject/Modelo_Inspecciones/BO_InfoRequest'
const NS_INSPECCION = 'http://xmlns.oracle.com/bpm/bpmobject/Modelo_Inspecciones/BO_Inspeccion'

const el = (tag, value) => (value === null || value === undefined ? '' : `<${tag}>${escapeXml(value)}</${tag}>`)

/**
 * @param {object} infoRequest infoRequest del mensaje entrante
 * @param {object} datosInspeccionAuto datos de la inspeccion del request
 * @param {string} idInspeccion id de la inspeccion creada en MIILS
 * @returns {string} mensaje SOAP listo para enviar al mediador BPM
 */
function transformToXml (infoRequest, datosInspeccionAuto, idInspeccion) {
  const info = infoRequest || {}
  const datos = datosInspeccionAuto || {}

  const infoRequestXml =
    '<ord:infoRequest>' +
    el('inf:requestID', info.requestID) +
    el('inf:fecha', toXmlDateTime()) +
    el('inf:aplicacionCliente', info.aplicacionCliente) +
    el('inf:terminal', info.terminal) +
    el('inf:ip', info.ip) +
    '</ord:infoRequest>'

  const consultaInspectorXml =
    '<ins:datosConsultaInspector>' +
    el('ins:codigoActividad', msg('mediacion_insp.codigoactividad')) +
    el('ins:valorInspeccion', msg('mediacion_insp.valorinsp')) +
    el('ins:activo', msg('mediacion_insp.activo')) +
    el('ins:provincia', msg('mediacion_insp.provincia')) +
    el('ins:poblado', msg('mediacion_insp.poblado')) +
    el('ins:codigoServicio', msg('mediacion_insp.codservicio')) +
    '</ins:datosConsultaInspector>'

  const ordenInspeccionXml =
    '<ord:ordenInspeccion>' +
    el('ins:idInspeccion', Number.parseInt(idInspeccion, 10)) +
    el('ins:rolCreador', datos.usuarioCreador) +
    el('ins:usuarioAsignado', datos.usuarioCreador) +
    el('ins:tipoInspeccion', msg('mediacion_insp.lineanegocio_autos')) +
    el('ins:diasAgendamiento', Number.parseInt(msg('mediacion_insp.dias_agendamiento'), 10)) +
    el('ins:diasInspeccion', Number.parseInt(msg('mediacion_insp.dias_inspeccion'), 10)) +
    consultaInspectorXml +
    '</ord:ordenInspeccion>'

  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    `<${PREFIX_ENV}:Envelope xmlns:${PREFIX_ENV}="${SOAP_NS}">` +
    `<${PREFIX_ENV}:Header/><${PREFIX_ENV}:Body>` +
    `<ord:BO_OrdenInspeccion xmlns:ord="${NS_ORDEN}" xmlns:inf="${NS_INFO_REQUEST}" xmlns:ins="${NS_INSPECCION}">` +
    infoRequestXml +
    ordenInspeccionXml +
    '</ord:BO_OrdenInspeccion>' +
    `</${PREFIX_ENV}:Body></${PREFIX_ENV}:Envelope>`
  )
}

module.exports = { transformToXml, NS_ORDEN, NS_INFO_REQUEST, NS_INSPECCION }
