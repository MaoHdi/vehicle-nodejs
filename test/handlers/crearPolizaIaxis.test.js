'use strict'

jest.mock('../../src/infrastructure/db/polizaRepository')
jest.mock('../../src/infrastructure/db/auditRepository')
jest.mock('../../src/domain/poliza/grabarPolizaIaxisDao')

const polizaRepository = require('../../src/infrastructure/db/polizaRepository')
const auditRepository = require('../../src/infrastructure/db/auditRepository')
const dao = require('../../src/domain/poliza/grabarPolizaIaxisDao')
const { handler } = require('../../src/handlers/crearPolizaIaxis')

const CONTEXT = { awsRequestId: 'test-request' }

const requestAuto = () => ({
  infoRequest: { requestID: 'REQ-1' },
  poliza: {
    producto: { codigo: '6031' },
    datosPolizaAuto: {
      datosGestion: { numeroPoliza: '900123', numeroRecibo: '77001' },
      vehiculo: {
        identificacion: {
          codigoFasecolda: '01234567',
          placa: { placa: 'ABC123' },
          motor: 'M-1',
          chasis: 'CH-1',
          vin: 'V-1'
        }
      },
      conductor: { persona: { tipoDocumento: { codigo: '1' }, numeroDocumento: '1020304050' } }
    }
  }
})

const soapEvent = (bodyXml) => ({
  httpMethod: 'POST',
  headers: { 'Content-Type': 'text/xml; charset=UTF-8', SOAPAction: '""' },
  body: bodyXml
})

const restEvent = (payload) => ({
  httpMethod: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(payload)
})

beforeEach(() => {
  jest.clearAllMocks()
  auditRepository.insertAuditServiceWeb.mockResolvedValue(undefined)
  polizaRepository.consultaVehiculoRestringido.mockResolvedValue([])
  polizaRepository.consultaPersonaRestringida.mockResolvedValue([])
  polizaRepository.consultaPolizaIaxis.mockResolvedValue([])
  polizaRepository.consultaPolizaProcesoIaxis.mockResolvedValue([])
  polizaRepository.consultaReciboIaxis.mockResolvedValue([])
  dao.grabarPolizaIAXISAuto.mockResolvedValue('4455')
})

describe('lambda crearPolizaIAXIS - canal REST', () => {
  it('crea la poliza y devuelve el codigo de proceso de cargue', async () => {
    const response = await handler(restEvent(requestAuto()), CONTEXT)
    const body = JSON.parse(response.body)

    expect(response.statusCode).toBe(200)
    expect(response.headers['Content-Type']).toContain('application/json')
    expect(body.crearPolizaIAXISRs.infoResponse.estado.codigoEstado).toBe('0')
    expect(body.crearPolizaIAXISRs.emisionPoliza.resultadoPolizaAuto.codigoProcesoCargue).toBe('4455')
  })

  it('acepta el JSON envuelto por el nombre de la operacion', async () => {
    const response = await handler(restEvent({ crearPolizaIAXISRq: requestAuto() }), CONTEXT)
    expect(JSON.parse(response.body).crearPolizaIAXISRs.infoResponse.estado.codigoEstado).toBe('0')
  })

  it('rechaza el producto no soportado con el mensaje del contrato', async () => {
    const request = requestAuto()
    request.poliza.producto.codigo = '9999'

    const response = await handler(restEvent(request), CONTEXT)
    const estado = JSON.parse(response.body).crearPolizaIAXISRs.infoResponse.estado

    expect(response.statusCode).toBe(400)
    expect(estado.codigoEstado).toBe('2')
    expect(estado.codigoEstadoServidor).toBe('-10')
    expect(estado.descripcionEstado).toContain('9999')
  })

  it('reporta el vehiculo restringido sin llegar a grabar', async () => {
    polizaRepository.consultaVehiculoRestringido.mockResolvedValue([{ smatriclre: 981 }])

    const response = await handler(restEvent(requestAuto()), CONTEXT)
    const estado = JSON.parse(response.body).crearPolizaIAXISRs.infoResponse.estado

    expect(estado.codigoEstado).toBe('4')
    expect(estado.codigoEstadoServidor).toBe('-60')
    expect(dao.grabarPolizaIAXISAuto).not.toHaveBeenCalled()
  })

  it('reporta el recibo ya existente en iAxis', async () => {
    polizaRepository.consultaReciboIaxis.mockResolvedValue([{ nrecibo: 77001 }])

    const response = await handler(restEvent(requestAuto()), CONTEXT)
    const estado = JSON.parse(response.body).crearPolizaIAXISRs.infoResponse.estado

    expect(estado.codigoEstadoServidor).toBe('-25')
    expect(dao.grabarPolizaIAXISAuto).not.toHaveBeenCalled()
  })

  it('exige los datos de identificacion del vehiculo', async () => {
    const request = requestAuto()
    request.poliza.datosPolizaAuto.vehiculo.identificacion.motor = ''

    const response = await handler(restEvent(request), CONTEXT)
    const estado = JSON.parse(response.body).crearPolizaIAXISRs.infoResponse.estado

    expect(estado.codigoEstadoServidor).toBe('-35')
  })

  it('devuelve 400 cuando el JSON es invalido', async () => {
    const response = await handler({ httpMethod: 'POST', headers: { 'content-type': 'application/json' }, body: '{' }, CONTEXT)
    expect(response.statusCode).toBe(400)
  })
})

describe('lambda crearPolizaIAXIS - canal SOAP legacy', () => {
  const soapRequest = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ia="http://www.libertycolombia.com/ia/">
  <soapenv:Body>
    <ia:crearPolizaIAXISRq>
      <infoRequest><requestID>REQ-SOAP</requestID></infoRequest>
      <poliza>
        <producto><codigo>6031</codigo></producto>
        <datosPolizaAuto>
          <vehiculo><identificacion>
            <codigoFasecolda>01234567</codigoFasecolda>
            <placa><placa>ABC123</placa></placa>
            <motor>M-1</motor><chasis>CH-1</chasis><vin>V-1</vin>
          </identificacion></vehiculo>
          <conductor><persona><tipoDocumento><codigo>1</codigo></tipoDocumento><numeroDocumento>1020304050</numeroDocumento></persona></conductor>
          <datosGestion><numeroPoliza>900123</numeroPoliza><numeroRecibo>77001</numeroRecibo></datosGestion>
        </datosPolizaAuto>
      </poliza>
    </ia:crearPolizaIAXISRq>
  </soapenv:Body>
</soapenv:Envelope>`

  it('responde un sobre SOAP con los encabezados del servicio original', async () => {
    const response = await handler(soapEvent(soapRequest), CONTEXT)

    expect(response.statusCode).toBe(200)
    expect(response.headers['Content-Type']).toBe('text/xml;charset=UTF-8')
    expect(response.headers.SOAPaction).toBe('""')
    expect(response.body).toContain('<tns:crearPolizaIAXISRs>')
    expect(response.body).toContain('<codigoProcesoCargue>4455</codigoProcesoCargue>')
    expect(response.body).toContain('<requestID>REQ-SOAP</requestID>')
  })

  it('devuelve SOAP Fault si la operacion no corresponde a esta lambda', async () => {
    const otraOperacion = soapRequest.replace(/crearPolizaIAXISRq/g, 'crearConsultarInspMIILSRq')
    const response = await handler(soapEvent(otraOperacion), CONTEXT)

    expect(response.statusCode).toBe(400)
    expect(response.body).toContain('<faultcode>env:Client</faultcode>')
  })

  it('entrega el WSDL en GET ?wsdl', async () => {
    const response = await handler(
      { httpMethod: 'GET', headers: {}, queryStringParameters: { wsdl: '' }, body: null },
      CONTEXT
    )

    expect(response.statusCode).toBe(200)
    expect(response.body).toContain('wsdl:definitions')
    expect(response.body).toContain('crearPolizaIAXIS')
  })
})

describe('auditoria', () => {
  it('registra la interfaz UI05 en audit_services_web', async () => {
    await handler(restEvent(requestAuto()), CONTEXT)

    expect(auditRepository.insertAuditServiceWeb).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      'UI05'
    )
  })
})
