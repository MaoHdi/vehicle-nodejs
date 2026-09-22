'use strict'

jest.mock('../../src/infrastructure/db/inspeccionRepository')
jest.mock('../../src/infrastructure/db/polizaRepository')
jest.mock('../../src/infrastructure/db/utilRepository')
jest.mock('../../src/infrastructure/db/transaccionInspeccionRepository')
jest.mock('../../src/infrastructure/db/auditRepository')
jest.mock('../../src/infrastructure/soap/soapClient')

const inspeccionRepository = require('../../src/infrastructure/db/inspeccionRepository')
const polizaRepository = require('../../src/infrastructure/db/polizaRepository')
const utilRepository = require('../../src/infrastructure/db/utilRepository')
const transaccionRepository = require('../../src/infrastructure/db/transaccionInspeccionRepository')
const auditRepository = require('../../src/infrastructure/db/auditRepository')
const soapClient = require('../../src/infrastructure/soap/soapClient')
const { handler } = require('../../src/handlers/crearConsultaInspMils')

const CONTEXT = { awsRequestId: 'test-request' }

const inspeccionEncontrada = {
  idInspeccion: '778899',
  lineaNegocio: 'AUTOS',
  estadoInspeccion: 'CREADA - ASEGURABLE',
  usuarioCreador: 'UNQORK',
  fechaCreacion: '2024-06-01 09:30:00',
  codigoProducto: '6031',
  claveAgente: '1234',
  codigoCDA: '55',
  motivoInspeccion: '7',
  tipoSelInspector: '1',
  tipoPlaca: '1',
  placa: 'ABC123',
  codigoFasecolda: '01234567',
  chasis: 'CH-0000000001',
  motor: 'M-1',
  vin: 'V-1',
  modelo: '2022',
  codigoColor: 12,
  kilometrajeVehiculo: '15000',
  codigoTipoPintura: '1',
  codigoTipoCaja: '2',
  codigoTipoCarroceria: '3',
  codigoTipoServicio: '4',
  codigoTipoVehiculo: '5',
  valorVehiculo: '50000000',
  codigoPersona: '4455',
  numeroDocumento: '1020304050',
  tipoDocumento: '1',
  fechaNacimiento: null,
  tipoPersona: '1',
  primerApellido: 'Restrepo',
  segundoApellido: null,
  primerNombre: 'Mariana',
  segundoNombre: null,
  codigoOcupacion: '10',
  codigoEstadoCivil: '1',
  codigoGenero: '2',
  fechaFinInspeccion: '2024-06-05 14:00:00'
}

const restEvent = (payload) => ({
  httpMethod: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(payload)
})

const consultaPorId = () => ({
  infoRequest: { requestID: 'REQ-1' },
  solicitud: {
    operacion: 'CONSULTAR',
    lineaNegocio: 'AUTOS',
    inspeccion: { idInspeccion: '778899' }
  }
})

beforeEach(() => {
  jest.clearAllMocks()
  auditRepository.insertAuditServiceWeb.mockResolvedValue(undefined)
  utilRepository.consultarPersonaIAXIS.mockResolvedValue('4455')
  utilRepository.altaRapidaPersonaIAXIS.mockResolvedValue('4455')
  polizaRepository.consultaVehiculoRestringido.mockResolvedValue([])
  polizaRepository.consultaPersonaRestringida.mockResolvedValue([])
  inspeccionRepository.consultarInspeccionMIILS.mockResolvedValue([inspeccionEncontrada])
  inspeccionRepository.consultarInspeccionPorPlaca.mockResolvedValue([inspeccionEncontrada])
  inspeccionRepository.consultarInspeccionPorChasis.mockResolvedValue([inspeccionEncontrada])
  inspeccionRepository.consultaPolizaProcesoIaxis.mockResolvedValue([])
  inspeccionRepository.consultaContactosCliente.mockResolvedValue([
    { idContacto: '1', codigoTipoContacto: '3', nombreTipoContacto: 'CORREO', textoContacto: 'correo@example.com' }
  ])
  inspeccionRepository.consultaDireccionesCliente.mockResolvedValue([
    {
      idDireccion: '1',
      codigoTipoDireccion: '1',
      nombreTipoDireccion: 'RESIDENCIA',
      textoDireccion: 'CL 1',
      codigoDepartamento: '05',
      nombreDepartamento: 'ANTIOQUIA',
      codigoPais: '170',
      nombrePais: 'COLOMBIA',
      codigoCiudad: '001',
      nombreCiudad: 'MEDELLIN'
    }
  ])
  inspeccionRepository.consultarAccesoriosVehiculos.mockResolvedValue([])
  soapClient.EXTERNAL_SERVICES = { MIILS_INSPECCIONES: {}, SINIESTROS_SISA: {} }
  soapClient.execute.mockResolvedValue('<ok/>')
})

describe('lambda crearConsultaInspMILS - consulta', () => {
  it('devuelve la inspeccion consultada por id', async () => {
    const response = await handler(restEvent(consultaPorId()), CONTEXT)
    const rs = JSON.parse(response.body).crearConsultarInspMIILSRs

    expect(response.statusCode).toBe(200)
    expect(rs.infoResponse.estado.codigoEstado).toBe('0')
    expect(rs.infoResponse.requestID).toBe('REQ-1')
    expect(rs.solicitud.inspeccion.idInspeccion).toBe('778899')
    expect(rs.solicitud.inspeccion.estadoInspeccion).toBe('CREADA - ASEGURABLE')
    expect(rs.solicitud.inspeccion.datosInspeccionAuto.vehiculo.placa.placa).toBe('ABC123')
  })

  it('aplica el patron de fecha del legacy (reloj de 12 horas)', async () => {
    const response = await handler(restEvent(consultaPorId()), CONTEXT)
    const rs = JSON.parse(response.body).crearConsultarInspMIILSRs

    expect(rs.solicitud.inspeccion.fechaFinInspeccion).toBe('2024-06-05T02:00:00.000-05:00')
    expect(rs.solicitud.inspeccion.datosInspeccionAuto.fechaCreacion).toBe('2024-06-01T09:30:00.000-05:00')
  })

  it('incluye contactos y direcciones del cliente', async () => {
    const response = await handler(restEvent(consultaPorId()), CONTEXT)
    const cliente = JSON.parse(response.body).crearConsultarInspMIILSRs.solicitud.inspeccion.datosInspeccionAuto
      .clienteInspeccion

    expect(cliente.contacto).toHaveLength(1)
    expect(cliente.contacto[0].textoContacto).toBe('correo@example.com')
    expect(cliente.direccion[0].ciudad).toEqual({ codigo: '001', nombre: 'MEDELLIN' })
  })

  it('soporta el formato directo (placa dentro de inspeccion)', async () => {
    const request = {
      infoRequest: { requestID: 'REQ-2' },
      solicitud: { operacion: 'C', lineaNegocio: 'AUTOS', inspeccion: { placa: 'ABC123' } }
    }

    const response = await handler(restEvent(request), CONTEXT)
    const rs = JSON.parse(response.body).crearConsultarInspMIILSRs

    expect(inspeccionRepository.consultarInspeccionPorPlaca).toHaveBeenCalledWith('ABC123')
    expect(rs.infoResponse.estado.codigoEstado).toBe('0')
  })

  it('responde sin id de inspeccion cuando la busqueda por id no encuentra nada', async () => {
    // Igual que el legacy: la busqueda por idInspeccion devuelve un DTO vacio (no
    // nulo), por lo que el flujo termina en `sinIdInspeccion` (-110) y no en -25.
    inspeccionRepository.consultarInspeccionMIILS.mockResolvedValue([])

    const response = await handler(restEvent(consultaPorId()), CONTEXT)
    const estado = JSON.parse(response.body).crearConsultarInspMIILSRs.infoResponse.estado

    expect(estado.codigoEstado).toBe('2')
    expect(estado.codigoEstadoServidor).toBe('-110')
  })

  it('responde no encontrada cuando la busqueda por placa no arroja resultados', async () => {
    inspeccionRepository.consultarInspeccionPorPlaca.mockResolvedValue([])
    const request = {
      infoRequest: { requestID: 'REQ-4' },
      solicitud: { operacion: 'CONSULTAR', lineaNegocio: 'AUTOS', inspeccion: { placa: 'ABC123' } }
    }

    const response = await handler(restEvent(request), CONTEXT)
    const estado = JSON.parse(response.body).crearConsultarInspMIILSRs.infoResponse.estado

    expect(estado.codigoEstado).toBe('2')
    expect(estado.codigoEstadoServidor).toBe('-25')
  })

  it('rechaza una linea de negocio no soportada', async () => {
    const request = consultaPorId()
    request.solicitud.lineaNegocio = 'HOGAR'

    const response = await handler(restEvent(request), CONTEXT)
    const estado = JSON.parse(response.body).crearConsultarInspMIILSRs.infoResponse.estado

    expect(estado.codigoEstadoServidor).toBe('-10')
  })

  it('reporta el conductor restringido en iAxis', async () => {
    polizaRepository.consultaPersonaRestringida.mockResolvedValue([{ numerodocumento: '1020304050' }])

    const response = await handler(restEvent(consultaPorId()), CONTEXT)
    const estado = JSON.parse(response.body).crearConsultarInspMIILSRs.infoResponse.estado

    expect(estado.codigoEstado).toBe('4')
    expect(estado.codigoEstadoServidor).toBe('-70')
  })
})

describe('lambda crearConsultaInspMILS - creacion', () => {
  const creacion = () => ({
    infoRequest: { requestID: 'REQ-3' },
    solicitud: {
      operacion: 'CREAR',
      lineaNegocio: 'AUTOS',
      inspeccion: {
        datosInspeccionAuto: {
          usuarioCreador: 'unqork',
          claveAgente: '1234',
          codigoProducto: { codigo: '6031' },
          codigoMotivoInspeccion: { codigo: '7' },
          clienteInspeccion: {
            tipoDocumento: { codigo: '1' },
            numeroDocumento: '1020304050',
            tipoPersona: { codigo: '1' },
            personaNatural: { primerNombre: 'Mariana', primerApellido: 'Restrepo' }
          },
          vehiculo: {
            placa: { placa: 'ABC123', tipoPlaca: { codigo: '1' } },
            codigoFasecolda: '01234567',
            modelo: '2022',
            kilometraje: '15000',
            chasis: 'CH-0000000001',
            motor: 'M-1',
            vin: 'V-1'
          }
        }
      }
    }
  })

  it('crea la orden de inspeccion y devuelve el id generado', async () => {
    transaccionRepository.consultarPersonaAXIS.mockResolvedValue(4455)
    transaccionRepository.crearOrdenInspeccionAutos.mockResolvedValue({ poutIdInspeccion: 778899, pSperson: 4455 })

    const response = await handler(restEvent(creacion()), CONTEXT)
    const rs = JSON.parse(response.body).crearConsultarInspMIILSRs

    expect(rs.infoResponse.estado.codigoEstado).toBe('0')
    expect(rs.solicitud.inspeccion.idInspeccion).toBe('778899')
    expect(soapClient.execute).toHaveBeenCalled()
  })

  it('bloquea la creacion cuando la placa ya tiene una inspeccion vigente', async () => {
    inspeccionRepository.consultaPolizaProcesoIaxis.mockResolvedValue([{ idInspeccion: '112233' }])

    const response = await handler(restEvent(creacion()), CONTEXT)
    const estado = JSON.parse(response.body).crearConsultarInspMIILSRs.infoResponse.estado

    expect(estado.codigoEstadoServidor).toBe('-120')
    expect(estado.descripcionEstado).toContain('112233')
    expect(transaccionRepository.crearOrdenInspeccionAutos).not.toHaveBeenCalled()
  })

  it('bloquea la creacion cuando el vehiculo esta restringido', async () => {
    polizaRepository.consultaVehiculoRestringido.mockResolvedValue([{ smatriclre: 981 }])

    const response = await handler(restEvent(creacion()), CONTEXT)
    const estado = JSON.parse(response.body).crearConsultarInspMIILSRs.infoResponse.estado

    expect(estado.codigoEstado).toBe('4')
    expect(estado.codigoEstadoServidor).toBe('-80')
  })

  it('informa error cuando el procedimiento no crea la inspeccion', async () => {
    transaccionRepository.consultarPersonaAXIS.mockResolvedValue(4455)
    transaccionRepository.crearOrdenInspeccionAutos.mockResolvedValue({ poutIdInspeccion: null, pSperson: 4455 })

    const response = await handler(restEvent(creacion()), CONTEXT)
    const estado = JSON.parse(response.body).crearConsultarInspMIILSRs.infoResponse.estado

    expect(estado.codigoEstado).toBe('3')
    expect(estado.codigoEstadoServidor).toBe('-30')
  })
})

describe('lambda crearConsultaInspMILS - canal SOAP legacy', () => {
  const soapRequest = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ia="http://www.libertycolombia.com/ia/">
  <soapenv:Body>
    <ia:crearConsultarInspMIILSRq>
      <infoRequest><requestID>REQ-SOAP</requestID></infoRequest>
      <solicitud>
        <operacion>CONSULTAR</operacion>
        <lineaNegocio>AUTOS</lineaNegocio>
        <inspeccion><idInspeccion>778899</idInspeccion></inspeccion>
      </solicitud>
    </ia:crearConsultarInspMIILSRq>
  </soapenv:Body>
</soapenv:Envelope>`

  it('responde SOAP cuando la peticion llega en SOAP', async () => {
    const response = await handler(
      { httpMethod: 'POST', headers: { 'Content-Type': 'text/xml' }, body: soapRequest },
      CONTEXT
    )

    expect(response.headers['Content-Type']).toBe('text/xml;charset=UTF-8')
    expect(response.body).toContain('<tns:crearConsultarInspMIILSRs>')
    expect(response.body).toContain('<idInspeccion>778899</idInspeccion>')
    expect(response.body).toContain('<requestID>REQ-SOAP</requestID>')
  })

  it('acepta el alias crearInspMIILSRq y responde con su propio elemento', async () => {
    transaccionRepository.consultarPersonaAXIS.mockResolvedValue(4455)
    transaccionRepository.crearOrdenInspeccionAutos.mockResolvedValue({ poutIdInspeccion: 778899, pSperson: 4455 })

    const alias = soapRequest
      .replace(/crearConsultarInspMIILSRq/g, 'crearInspMIILSRq')
      .replace('<operacion>CONSULTAR</operacion>', '<operacion>CREAR</operacion>')

    const response = await handler({ httpMethod: 'POST', headers: { 'Content-Type': 'text/xml' }, body: alias }, CONTEXT)

    expect(response.body).toContain('<tns:crearInspMIILSRs>')
  })

  it('registra la interfaz UI04 en audit_services_web', async () => {
    await handler(restEvent(consultaPorId()), CONTEXT)

    expect(auditRepository.insertAuditServiceWeb).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      'UI04'
    )
  })
})
