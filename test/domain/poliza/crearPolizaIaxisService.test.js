'use strict'

jest.mock('../../../src/infrastructure/db/polizaRepository')
jest.mock('../../../src/domain/poliza/crearPolizaIaxisCallout')

const polizaRepository = require('../../../src/infrastructure/db/polizaRepository')
const callout = require('../../../src/domain/poliza/crearPolizaIaxisCallout')
const service = require('../../../src/domain/poliza/crearPolizaIaxisService')

const auto = () => ({
  infoRequest: { requestID: 'REQ-1' },
  poliza: {
    producto: { codigo: '6031' },
    datosPolizaAuto: {
      datosGestion: { numeroPoliza: '900001', numeroRecibo: '70001' },
      vehiculo: {
        identificacion: { codigoFasecolda: '01234567', placa: { placa: 'XYZ000' }, motor: 'M-1', chasis: 'CH-1' }
      },
      conductor: { persona: { tipoDocumento: { codigo: '1' }, numeroDocumento: '1000000001' } }
    }
  }
})

const home = (codigo = '900758', ubicacionRiesgo = { textoDeVia: 'CALLE 1', departamento: '11', ciudad: '001' }) => ({
  poliza: {
    producto: { codigo },
    datosPolizaHome: [{ datosGestion: { numeroPoliza: '800001', numeroRecibo: '70002' }, riesgoHome: { ubicacionRiesgo } }]
  }
})

const cumplimiento = (naturalezaRiesgo = 'OBRA') => ({
  poliza: {
    producto: { codigo: '10004' },
    datosPolizaCumplimiento: {
      datosGestion: { numeroPoliza: '700001' },
      riesgoCumplimiento: { descripcionRiesgo: { naturalezaRiesgo } }
    }
  }
})

beforeEach(() => {
  jest.clearAllMocks()
  polizaRepository.consultaVehiculoRestringido.mockResolvedValue([])
  polizaRepository.consultaPersonaRestringida.mockResolvedValue([])
  polizaRepository.consultaPolizaIaxis.mockResolvedValue([])
  polizaRepository.consultaPolizaProcesoIaxis.mockResolvedValue([])
  polizaRepository.consultaReciboIaxis.mockResolvedValue([])
  callout.postRouting.mockResolvedValue(true)
})

describe('crearPolizaIaxisService - autos', () => {
  it('recorre todas las validaciones y delega en el callout', async () => {
    const rs = await service.crearPoliza(auto())

    expect(rs.infoResponse.estado.codigoEstado).toBe('0')
    expect(rs.infoResponse.requestID).toBe('REQ-1')
    expect(rs.emisionPoliza).toEqual({ codigoProducto: { codigo: '6031' }, numeroPoliza: '900001' })
    expect(callout.postRouting).toHaveBeenCalled()
  })

  it('rechaza cuando faltan datos del vehiculo', async () => {
    const rq = auto()
    delete rq.poliza.datosPolizaAuto.vehiculo.identificacion.motor

    const rs = await service.crearPoliza(rq)

    expect(rs.infoResponse.estado.codigoEstado).toBe('2')
    expect(rs.emisionPoliza).toEqual({ codigoProducto: {} })
  })

  it('rechaza cuando no hay datos de autos', async () => {
    const rs = await service.crearPoliza({ poliza: { producto: { codigo: '6033' } } })

    expect(rs.infoResponse.estado.codigoEstado).toBe('2')
    expect(rs.infoResponse.requestID).toBeNull()
  })

  it('rechaza un vehiculo restringido', async () => {
    polizaRepository.consultaVehiculoRestringido.mockResolvedValue([{ smatriclre: 'XYZ000' }])

    const rs = await service.crearPoliza(auto())

    expect(rs.infoResponse.estado.codigoEstado).toBe('4')
    expect(polizaRepository.consultaPersonaRestringida).not.toHaveBeenCalled()
  })

  it('continua cuando el vehiculo restringido viene vacio', async () => {
    polizaRepository.consultaVehiculoRestringido.mockResolvedValue([{ smatriclre: '' }])

    expect((await service.crearPoliza(auto())).infoResponse.estado.codigoEstado).toBe('0')
  })

  it('rechaza una persona restringida', async () => {
    polizaRepository.consultaPersonaRestringida.mockResolvedValue([{ numerodocumento: '1000000001' }])

    expect((await service.crearPoliza(auto())).infoResponse.estado.codigoEstado).toBe('4')
  })

  it('continua cuando la persona restringida viene vacia', async () => {
    polizaRepository.consultaPersonaRestringida.mockResolvedValue([{ numerodocumento: '' }])

    expect((await service.crearPoliza(auto())).infoResponse.estado.codigoEstado).toBe('0')
  })

  it('rechaza una poliza ya existente', async () => {
    polizaRepository.consultaPolizaIaxis.mockResolvedValue([{ npoliza: '900001' }])

    expect((await service.crearPoliza(auto())).infoResponse.estado.codigoEstado).toBe('2')
  })

  it('continua cuando la poliza existente viene vacia', async () => {
    polizaRepository.consultaPolizaIaxis.mockResolvedValue([{ npoliza: '' }])

    expect((await service.crearPoliza(auto())).infoResponse.estado.codigoEstado).toBe('0')
  })

  it('rechaza una poliza con proceso de cargue existente', async () => {
    polizaRepository.consultaPolizaProcesoIaxis.mockResolvedValue([{ proceso: '123' }])

    const rs = await service.crearPoliza(auto())

    expect(rs.infoResponse.estado.codigoEstado).toBe('2')
    expect(rs.infoResponse.estado.descripcionEstado).toContain('900001')
  })

  it('continua cuando el proceso viene vacio', async () => {
    polizaRepository.consultaPolizaProcesoIaxis.mockResolvedValue([{ proceso: '' }])

    expect((await service.crearPoliza(auto())).infoResponse.estado.codigoEstado).toBe('0')
  })

  it('rechaza un recibo existente', async () => {
    polizaRepository.consultaReciboIaxis.mockResolvedValue([{ nrecibo: '70001' }])

    expect((await service.crearPoliza(auto())).infoResponse.estado.codigoEstado).toBe('2')
  })

  it('acepta un recibo sin numero', async () => {
    polizaRepository.consultaReciboIaxis.mockResolvedValue([{ nrecibo: null }])

    expect((await service.crearPoliza(auto())).infoResponse.estado.codigoEstado).toBe('0')
  })

  it('responde error general cuando falla un repositorio', async () => {
    polizaRepository.consultaVehiculoRestringido.mockRejectedValue(new Error('ORA-12541'))

    const rs = await service.crearPoliza(auto())

    expect(rs.infoResponse.estado.codigoEstado).toBe('1')
    expect(rs.infoResponse.requestID).toBe('REQ-1')
  })
})

describe('crearPolizaIaxisService - home', () => {
  it('valida la ubicacion del riesgo y delega en el callout', async () => {
    const rs = await service.crearPoliza(home())

    expect(rs.infoResponse.estado.codigoEstado).toBe('0')
    expect(rs.emisionPoliza.numeroPoliza).toBe('800001')
    expect(callout.postRouting).toHaveBeenCalled()
  })

  it('omite la validacion de poliza y proceso para 10024', async () => {
    polizaRepository.consultaPolizaIaxis.mockResolvedValue([{ npoliza: '800001' }])
    polizaRepository.consultaPolizaProcesoIaxis.mockResolvedValue([{ proceso: '123' }])

    expect((await service.crearPoliza(home('10024'))).infoResponse.estado.codigoEstado).toBe('0')
  })

  it('rechaza cuando falta la ciudad del riesgo', async () => {
    const rs = await service.crearPoliza(home('6071', { textoDeVia: 'CALLE 1', departamento: '11', ciudad: '' }))

    expect(rs.infoResponse.estado.codigoEstado).toBe('2')
    expect(callout.postRouting).not.toHaveBeenCalled()
  })

  it('rechaza cuando no hay ubicacion del riesgo', async () => {
    expect((await service.crearPoliza(home('10003', null))).infoResponse.estado.codigoEstado).toBe('2')
  })
})

describe('crearPolizaIaxisService - cumplimiento', () => {
  it('toma datosGestion de cumplimiento y delega en el callout', async () => {
    const rs = await service.crearPoliza(cumplimiento())

    expect(polizaRepository.consultaPolizaIaxis).toHaveBeenCalledWith('700001', '1')
    expect(rs.emisionPoliza.numeroPoliza).toBe('700001')
    expect(callout.postRouting).toHaveBeenCalled()
  })

  it('rechaza cuando falta la naturaleza del riesgo', async () => {
    const rs = await service.crearPoliza(cumplimiento(''))

    expect(rs.infoResponse.estado.codigoEstado).toBe('2')
  })
})

describe('crearPolizaIaxisService - otros casos', () => {
  it('rechaza un producto no soportado', async () => {
    const rs = await service.crearPoliza({ poliza: { producto: { codigo: '1' } } })

    expect(rs.infoResponse.estado.codigoEstado).toBe('2')
    expect(rs.emisionPoliza).toEqual({ codigoProducto: {} })
  })

  it('rechaza un request sin poliza', async () => {
    expect((await service.crearPoliza({})).infoResponse.estado.codigoEstado).toBe('2')
  })

  it('responde error general con un request nulo', async () => {
    const rs = await service.crearPoliza(null)

    expect(rs.infoResponse.estado.codigoEstado).toBe('1')
    expect(rs.infoResponse.requestID).toBeNull()
  })

  it('consultarRecibo no consulta sin producto o sin recibo', async () => {
    await service.consultarRecibo({ numeroRecibo: '1' }, {}, {}, undefined)
    await service.consultarRecibo({}, {}, {}, '6031')

    expect(polizaRepository.consultaReciboIaxis).not.toHaveBeenCalled()
  })

  it('consultarPoliza usa datosGestion vacio cuando no hay riesgo', async () => {
    const rs = {}
    await service.consultarPoliza({ producto: {} }, rs, {}, '6031')

    expect(polizaRepository.consultaPolizaIaxis).toHaveBeenCalledWith('undefined', '1')
  })

  it('consultarVehiculoRestringido tolera la ausencia de identificacion', async () => {
    await service.consultarVehiculoRestringido({ poliza: {} }, {}, {}, '6031')

    expect(polizaRepository.consultaVehiculoRestringido).toHaveBeenCalledWith(undefined, undefined, undefined, undefined)
  })
})

describe('crearPolizaIaxisService - LEGACY_BUG_COMPAT', () => {
  it('reproduce el fallo del legacy en cumplimiento', async () => {
    process.env.LEGACY_BUG_COMPAT = 'true'
    try {
      await jest.isolateModulesAsync(async () => {
        const repo = require('../../../src/infrastructure/db/polizaRepository')
        repo.consultaPolizaIaxis.mockResolvedValue([])
        const legacy = require('../../../src/domain/poliza/crearPolizaIaxisService')

        const rs = await legacy.crearPoliza(cumplimiento())

        expect(rs.infoResponse.estado.codigoEstado).toBe('1')
      })
    } finally {
      delete process.env.LEGACY_BUG_COMPAT
    }
  })
})
