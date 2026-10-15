'use strict'

jest.mock('../../../src/domain/poliza/grabarPolizaIaxisDao')

const dao = require('../../../src/domain/poliza/grabarPolizaIaxisDao')
const { postRouting } = require('../../../src/domain/poliza/crearPolizaIaxisCallout')

const respuestaOk = () => ({ infoResponse: { estado: { codigoEstado: '0' } } })
const request = (codigo, extra = {}) => ({ poliza: { producto: { codigo }, ...extra } })

beforeEach(() => {
  jest.clearAllMocks()
})

describe('crearPolizaIaxisCallout - postRouting', () => {
  it('responde error cuando el request no trae poliza', async () => {
    const rs = respuestaOk()

    expect(await postRouting({}, rs)).toBe(true)
    expect(rs.infoResponse.estado.codigoEstado).toBe('3')
  })

  it('no graba cuando el estado previo no es exitoso', async () => {
    const rs = { infoResponse: { estado: { codigoEstado: '2' } } }

    await postRouting(request('6031'), rs)

    expect(dao.grabarPolizaIAXISAuto).not.toHaveBeenCalled()
    expect(rs.infoResponse.estado.codigoEstado).toBe('2')
  })

  it('graba una poliza de autos y completa la emision', async () => {
    dao.grabarPolizaIAXISAuto.mockResolvedValue('4455')
    const rs = respuestaOk()

    await postRouting(request('6031', { datosPolizaAuto: { datosGestion: { numeroPoliza: '900001' } } }), rs)

    expect(rs.emisionPoliza).toEqual({
      codigoProducto: { codigo: '6031' },
      numeroPoliza: '900001',
      resultadoPolizaAuto: { codigoProcesoCargue: '4455' }
    })
    expect(rs.infoResponse.estado.codigoEstado).toBe('0')
  })

  it('informa error de conversion cuando autos no devuelve un numero', async () => {
    dao.grabarPolizaIAXISAuto.mockResolvedValue('ERROR - fallo')
    const rs = respuestaOk()

    await postRouting(request('6033'), rs)

    expect(rs.infoResponse.estado.codigoEstado).toBe('3')
    expect(rs.infoResponse.estado.descripcionEstado).toContain('ERROR - fallo')
  })

  it('graba una poliza home', async () => {
    dao.grabarPolizaIAXISHome.mockResolvedValue('77')
    const rs = respuestaOk()

    await postRouting(request('900758'), rs)

    expect(rs.emisionPoliza.resultadoPolizaHome).toEqual({ codigoProcesoCargue: '77' })
  })

  it('informa error de conversion en home', async () => {
    dao.grabarPolizaIAXISHome.mockResolvedValue(null)
    const rs = respuestaOk()

    await postRouting(request('10024'), rs)

    expect(rs.infoResponse.estado.codigoEstado).toBe('3')
  })

  it('graba una poliza de cumplimiento en resultadoPolizaCumplimiento', async () => {
    dao.grabarPolizaIAXISEBonds.mockResolvedValue('88')
    const rs = respuestaOk()
    rs.emisionPoliza = { numeroPoliza: '1' }

    await postRouting(request('10004'), rs)

    expect(rs.emisionPoliza).toEqual({ numeroPoliza: '1', resultadoPolizaCumplimiento: { codigoProcesoCargue: '88' } })
  })

  it('informa error de conversion en cumplimiento', async () => {
    dao.grabarPolizaIAXISEBonds.mockResolvedValue('ERROR')
    const rs = respuestaOk()

    await postRouting(request('10005'), rs)

    expect(rs.infoResponse.estado.codigoEstado).toBe('3')
  })

  it('no hace nada con un producto no soportado', async () => {
    const rs = respuestaOk()

    await postRouting({ poliza: {} }, rs)

    expect(rs.emisionPoliza).toBeUndefined()
    expect(rs.infoResponse.estado.codigoEstado).toBe('0')
  })

  it('informa error de producto cuando el DAO lanza excepcion', async () => {
    dao.grabarPolizaIAXISAuto.mockRejectedValue(new Error('inesperado'))
    const rs = respuestaOk()

    await postRouting(request('6031'), rs)

    expect(rs.infoResponse.estado.codigoEstado).toBe('2')
  })

  it('tolera una respuesta sin estado', async () => {
    const rs = { infoResponse: {} }

    expect(await postRouting(request('6031'), rs)).toBe(true)
  })
})

describe('crearPolizaIaxisCallout - LEGACY_BUG_COMPAT', () => {
  it('reproduce el error del legacy en cumplimiento', async () => {
    process.env.LEGACY_BUG_COMPAT = 'true'
    try {
      await jest.isolateModulesAsync(async () => {
        const daoLegacy = require('../../../src/domain/poliza/grabarPolizaIaxisDao')
        const callout = require('../../../src/domain/poliza/crearPolizaIaxisCallout')
        daoLegacy.grabarPolizaIAXISEBonds.mockResolvedValue('88')
        const rs = respuestaOk()

        await callout.postRouting(request('10004'), rs)

        expect(rs.emisionPoliza.resultadoPolizaCumplimiento).toEqual({})
        expect(rs.infoResponse.estado.codigoEstado).toBe('3')
      })
    } finally {
      delete process.env.LEGACY_BUG_COMPAT
    }
  })
})
