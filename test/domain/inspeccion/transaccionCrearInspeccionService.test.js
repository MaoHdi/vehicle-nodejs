'use strict'

jest.mock('../../../src/infrastructure/db/transaccionInspeccionRepository')

const repository = require('../../../src/infrastructure/db/transaccionInspeccionRepository')
const service = require('../../../src/domain/inspeccion/transaccionCrearInspeccionService')

const ANIO = new Date().getFullYear()

const request = (vehiculo = { modelo: String(ANIO - 2), kilometraje: '20000' }) => ({
  infoRequest: { requestID: 'REQ-1' },
  solicitud: {
    inspeccion: {
      datosInspeccionAuto: {
        usuarioCreador: 'usuario',
        clienteInspeccion: { numeroDocumento: '1000000001', tipoDocumento: { codigo: '1' } },
        vehiculo
      }
    }
  }
})

beforeEach(() => {
  jest.clearAllMocks()
  repository.consultarPersonaAXIS.mockResolvedValue(321)
  repository.crearOrdenInspeccionAutos.mockResolvedValue({ poutIdInspeccion: 55, pSperson: 321 })
})

describe('transaccionCrearInspeccionService - parseIntStrict', () => {
  it('convierte enteros y rechaza valores no numericos', () => {
    expect(service.parseIntStrict('2020')).toBe(2020)
    expect(() => service.parseIntStrict('abc')).toThrow('Valor numerico invalido')
  })
})

describe('transaccionCrearInspeccionService - calcularKilometrajeAnio', () => {
  it('toma el kilometraje cuando el modelo es de anios anteriores', () => {
    expect(service.calcularKilometrajeAnio({ vehiculo: { modelo: ANIO - 2, kilometraje: '20000' } })).toBe(20000)
  })

  it('divide por la diferencia cuando el modelo es del anio actual', () => {
    expect(service.calcularKilometrajeAnio({ vehiculo: { modelo: ANIO, kilometraje: '100' } })).toBe(Infinity)
  })

  it('devuelve null sin kilometraje, con 0.0 o sin vehiculo', () => {
    expect(service.calcularKilometrajeAnio({ vehiculo: { modelo: ANIO } })).toBeNull()
    expect(service.calcularKilometrajeAnio({ vehiculo: { modelo: ANIO, kilometraje: '0.0' } })).toBeNull()
    expect(service.calcularKilometrajeAnio({ vehiculo: { modelo: '' } })).toBeNull()
  })
})

describe('transaccionCrearInspeccionService - crearInspeccionAutosProcedure', () => {
  it('envia los parametros con valores por defecto', async () => {
    await service.crearInspeccionAutosProcedure({ usuarioCreador: 'usr' }, null, 1)

    expect(repository.crearOrdenInspeccionAutos).toHaveBeenCalledWith(
      expect.objectContaining({ pIdUsuarioCreador: 'USR', pModelo: null, pValor: null, pTiposInspQueAplica: '0', pSperson: 1 })
    )
  })

  it('convierte modelo y valor a numero', async () => {
    await service.crearInspeccionAutosProcedure(
      { vehiculo: { modelo: '2020', valor: '1000', placa: { placa: 'XYZ000', tipoPlaca: { codigo: '1' } } }, tiposInspQueAplica: '2' },
      10,
      1
    )

    expect(repository.crearOrdenInspeccionAutos).toHaveBeenCalledWith(
      expect.objectContaining({ pModelo: 2020, pValor: 1000, pPlaca: 'XYZ000', pTipoPlaca: '1', pTiposInspQueAplica: '2' })
    )
  })

  it('devuelve null cuando falla el procedimiento', async () => {
    repository.crearOrdenInspeccionAutos.mockRejectedValue(new Error('ORA-06550'))

    expect(await service.crearInspeccionAutosProcedure({}, null, 1)).toBeNull()
  })
})

describe('transaccionCrearInspeccionService - procesarTransaccion', () => {
  it('devuelve null sin request', async () => {
    expect(await service.procesarTransaccion(null)).toBeNull()
  })

  it('crea la inspeccion cuando la persona existe', async () => {
    const rs = await service.procesarTransaccion(request())

    expect(rs.infoResponse.estado.codigoEstado).toBe('0')
    expect(rs.infoResponse.requestID).toBe('REQ-1')
    expect(rs.solicitud.inspeccion.idInspeccion).toBe('55')
    expect(rs.solicitud.inspeccion.datosInspeccionAuto.clienteInspeccion.codigoPersona).toBe('321')
  })

  it('informa error cuando el procedimiento no devuelve inspeccion', async () => {
    repository.crearOrdenInspeccionAutos.mockResolvedValue({ poutIdInspeccion: null })

    expect((await service.procesarTransaccion(request())).infoResponse.estado.codigoEstado).toBe('-70')
  })

  it('informa error cuando el procedimiento falla', async () => {
    repository.crearOrdenInspeccionAutos.mockRejectedValue(new Error('ORA-06550'))

    expect((await service.procesarTransaccion(request())).infoResponse.estado.codigoEstado).toBe('-70')
  })

  it('no crea la inspeccion cuando la persona no existe', async () => {
    repository.consultarPersonaAXIS.mockResolvedValue(null)

    const rs = await service.procesarTransaccion({ solicitud: {} })

    expect(rs.infoResponse).toEqual({ estado: {}, requestID: null })
    expect(repository.crearOrdenInspeccionAutos).not.toHaveBeenCalled()
  })

  it('no crea la inspeccion cuando falla la consulta de persona', async () => {
    repository.consultarPersonaAXIS.mockRejectedValue(new Error('timeout'))

    const rs = await service.procesarTransaccion({})

    expect(rs.infoResponse.estado).toEqual({})
  })
})
