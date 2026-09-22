'use strict'

const { extractRequest, detectMode } = require('../../src/protocol/negotiation')
const { unwrap, wrap, applyLegacyTagFixes, fault } = require('../../src/protocol/soapEnvelope')
const { serialize, normalizeRepeated } = require('../../src/protocol/xml')

const SOAP_REQUEST = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ia="http://www.libertycolombia.com/ia/">
  <soapenv:Header/>
  <soapenv:Body>
    <ia:crearConsultarInspMIILSRq>
      <infoRequest><requestID>REQ-1</requestID></infoRequest>
      <solicitud>
        <operacion>CONSULTAR</operacion>
        <lineaNegocio>AUTOS</lineaNegocio>
        <inspeccion><idInspeccion>12345</idInspeccion></inspeccion>
      </solicitud>
    </ia:crearConsultarInspMIILSRq>
  </soapenv:Body>
</soapenv:Envelope>`

describe('protocol/negotiation', () => {
  it('detecta SOAP por el Content-Type', () => {
    const request = extractRequest({ httpMethod: 'POST', headers: { 'Content-Type': 'text/xml' }, body: SOAP_REQUEST })
    expect(detectMode(request)).toBe('soap')
  })

  it('detecta SOAP aunque el cliente no informe el Content-Type', () => {
    const request = extractRequest({ httpMethod: 'POST', headers: {}, body: SOAP_REQUEST })
    expect(detectMode(request)).toBe('soap')
  })

  it('detecta SOAP por el encabezado SOAPAction', () => {
    const request = extractRequest({ httpMethod: 'POST', headers: { SOAPAction: '""' }, body: '' })
    expect(detectMode(request)).toBe('soap')
  })

  it('detecta REST cuando el cuerpo es JSON', () => {
    const request = extractRequest({
      httpMethod: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"infoRequest":{"requestID":"REQ-1"}}'
    })
    expect(detectMode(request)).toBe('rest')
  })

  it('reconoce la peticion del WSDL', () => {
    const request = extractRequest({ httpMethod: 'GET', headers: {}, queryStringParameters: { wsdl: '' }, body: null })
    expect(detectMode(request)).toBe('wsdl')
  })

  it('soporta eventos de HTTP API (payload v2)', () => {
    const request = extractRequest({
      requestContext: { http: { method: 'POST' } },
      rawPath: '/inspecciones',
      headers: { 'content-type': 'application/json' },
      body: '{}'
    })
    expect(request.method).toBe('POST')
    expect(detectMode(request)).toBe('rest')
  })

  it('decodifica cuerpos en base64', () => {
    const request = extractRequest({
      httpMethod: 'POST',
      headers: {},
      body: Buffer.from(SOAP_REQUEST).toString('base64'),
      isBase64Encoded: true
    })
    expect(request.body).toContain('crearConsultarInspMIILSRq')
  })

  it('trata una invocacion directa como REST', () => {
    const request = extractRequest({ infoRequest: { requestID: 'REQ-1' } })
    expect(request.directInvoke).toBe(true)
    expect(detectMode(request)).toBe('rest')
  })
})

describe('protocol/soapEnvelope', () => {
  it('extrae la operacion y el cuerpo del sobre SOAP', () => {
    const { operation, payload } = unwrap(SOAP_REQUEST)
    expect(operation).toBe('crearConsultarInspMIILSRq')
    expect(payload.infoRequest.requestID).toBe('REQ-1')
    expect(payload.solicitud.operacion).toBe('CONSULTAR')
    expect(payload.solicitud.inspeccion.idInspeccion).toBe('12345')
  })

  it('acepta XML sin sobre SOAP', () => {
    const { operation, payload } = unwrap('<crearPolizaIAXISRq><infoRequest><requestID>X</requestID></infoRequest></crearPolizaIAXISRq>')
    expect(operation).toBe('crearPolizaIAXISRq')
    expect(payload.infoRequest.requestID).toBe('X')
  })

  it('serializa la respuesta respetando el orden del contrato', () => {
    const xml = wrap('crearPolizaIAXISRs', 'CrearPolizaIAXISRs', {
      infoResponse: {
        estado: { codigoEstado: '0', codigoEstadoServidor: '0', descripcionEstado: 'OK', severidad: 'INFO' },
        requestID: 'REQ-1'
      },
      emisionPoliza: {
        codigoProducto: { codigo: '6031' },
        numeroPoliza: '900123',
        resultadoPolizaAuto: { codigoProcesoCargue: '4455' }
      }
    })

    expect(xml).toContain('<tns:crearPolizaIAXISRs>')
    expect(xml.indexOf('<codigoEstado>')).toBeLessThan(xml.indexOf('<descripcionEstado>'))
    expect(xml).toContain('<codigoProcesoCargue>4455</codigoProcesoCargue>')
    expect(xml).toContain('xmlns:tns="http://www.libertycolombia.com/ia/"')
  })

  it('omite los campos nulos y escapa el contenido', () => {
    const xml = serialize('estado', 'Estado', { codigoEstado: '2', descripcionEstado: 'a & b', severidad: null })
    expect(xml).toBe('<estado><codigoEstado>2</codigoEstado><descripcionEstado>a &amp; b</descripcionEstado></estado>')
  })

  it('aplica los ajustes de etiquetas heredados de XmlUtil', () => {
    const xml = '<consultaSiniestros><otherSiniestros><placa>ABC123</placa></otherSiniestros></consultaSiniestros>'
    expect(applyLegacyTagFixes(xml)).toBe('<consultaSiniestros><placa>ABC123</placa></consultaSiniestros>')
  })

  it('construye un SOAP Fault', () => {
    expect(fault('env:Client', 'mensaje invalido')).toContain('<faultstring>mensaje invalido</faultstring>')
  })
})

describe('protocol/xml', () => {
  it('normaliza a arreglo los elementos repetibles del contrato', () => {
    const result = normalizeRepeated({ poliza: { datosPolizaAuto: { asegurado: { numeroDocumento: '1' } } } })
    expect(Array.isArray(result.poliza.datosPolizaAuto.asegurado)).toBe(true)
  })
})
