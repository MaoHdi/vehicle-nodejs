'use strict'

jest.mock('../../../src/infrastructure/db/oracle', () => ({ query: jest.fn() }))

const oracle = require('../../../src/infrastructure/db/oracle')
const sql = require('../../../src/infrastructure/db/sql')
const repo = require('../../../src/infrastructure/db/polizaRepository')

beforeEach(() => jest.clearAllMocks())

describe('infrastructure/db/polizaRepository', () => {
  it('consultaVehiculoRestringido mapea las filas y envia null en lugar de undefined', async () => {
    const fecha = new Date('2026-02-01T00:00:00Z')
    oracle.query.mockResolvedValue([
      { SMATRICLRE: '1', CMATRIC: 'XYZ999', CCHASIS: 'CH-1', CCLALIS: '2', FINCLUS: fecha },
      {}
    ])

    const [vehiculo, vacio] = await repo.consultaVehiculoRestringido('XYZ999')

    expect(oracle.query).toHaveBeenCalledWith(sql.CONSULTA_VEHICULO_RESTRINGIDO, ['XYZ999', null, null, null])
    expect(vehiculo).toMatchObject({
      smatriclre: 1,
      cmatric: 'XYZ999',
      cchasis: 'CH-1',
      cclalis: 2,
      finclus: fecha,
      fexclus: null
    })
    expect(vacio).toMatchObject({ smatriclre: null, cmatric: null, finclus: null })
  })

  it('consultaVehiculoRestringido envia todos los criterios', async () => {
    oracle.query.mockResolvedValue([])
    await repo.consultaVehiculoRestringido('P', 'M', 'C', 'V')
    expect(oracle.query).toHaveBeenCalledWith(sql.CONSULTA_VEHICULO_RESTRINGIDO, ['P', 'M', 'C', 'V'])
  })

  it('consultaPersonaRestringida mapea las filas', async () => {
    oracle.query.mockResolvedValue([{ TIPODOCUMENTO: '1', NUMERODOCUMENTO: 1000000001, CLASELISTA: '3' }, {}])

    const [persona, vacia] = await repo.consultaPersonaRestringida('1', '1000000001')

    expect(oracle.query).toHaveBeenCalledWith(sql.CONSULTA_PERSONA_RESTRINGIDA, ['1', '1000000001'])
    expect(persona).toMatchObject({
      tipodocumento: 1,
      numerodocumento: '1000000001',
      claselista: 3,
      fechainclusion: null
    })
    expect(vacia.tipodocumento).toBeNull()
  })

  it('consultaPersonaRestringida envia null si faltan criterios', async () => {
    oracle.query.mockResolvedValue([])
    await repo.consultaPersonaRestringida()
    expect(oracle.query).toHaveBeenCalledWith(sql.CONSULTA_PERSONA_RESTRINGIDA, [null, null])
  })

  it('consultaPolizaIaxis mapea las filas como texto', async () => {
    oracle.query.mockResolvedValue([{ NPOLIZA: 900001, SSEGURO: 12, CRAMO: null }])

    const [poliza] = await repo.consultaPolizaIaxis('900001', '1')

    expect(oracle.query).toHaveBeenCalledWith(sql.CONSULTA_POLIZA_IAXIS, ['900001', '1'])
    expect(poliza).toMatchObject({ npoliza: '900001', sseguro: '12', cramo: null, cagente: null })
  })

  it('consultaPolizaProcesoIaxis devuelve los procesos', async () => {
    oracle.query.mockResolvedValue([{ PROCESO: 77 }])
    await expect(repo.consultaPolizaProcesoIaxis('900001')).resolves.toEqual([{ proceso: '77' }])
    expect(oracle.query).toHaveBeenCalledWith(sql.CONSULTA_POLIZA_PROCESO_IAXIS, ['900001'])
  })

  it('consultaReciboIaxis mapea las filas como numeros', async () => {
    oracle.query.mockResolvedValue([{ NRECIBO: '5', SSEGURO: '6', NMOVIMI: null }])
    await expect(repo.consultaReciboIaxis('5')).resolves.toEqual([{ nrecibo: 5, sseguro: 6, nmovimi: null }])
    expect(oracle.query).toHaveBeenCalledWith(sql.CONSULTA_RECIBO_IAXIS, ['5'])
  })
})
