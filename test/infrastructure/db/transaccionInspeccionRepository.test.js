'use strict'

jest.mock('../../../src/infrastructure/db/oracle', () => ({
  query: jest.fn(),
  withConnection: jest.fn(),
  oracledb: { BIND_INOUT: 3003, BIND_OUT: 3002, NUMBER: 2010 }
}))

const oracle = require('../../../src/infrastructure/db/oracle')
const sql = require('../../../src/infrastructure/db/sql')
const repo = require('../../../src/infrastructure/db/transaccionInspeccionRepository')

let connection

beforeEach(() => {
  jest.clearAllMocks()
  connection = { execute: jest.fn() }
  oracle.withConnection.mockImplementation((fn) => fn(connection))
})

describe('infrastructure/db/transaccionInspeccionRepository', () => {
  describe('consultarPersonaAXIS', () => {
    it('devuelve el sperson como numero', async () => {
      oracle.query.mockResolvedValue([{ SPERSON: '321' }])

      await expect(repo.consultarPersonaAXIS('1000000001', '36')).resolves.toBe(321)
      expect(oracle.query).toHaveBeenCalledWith(sql.CONSULTAR_PERSONA, { nnumide: '1000000001', ctipide: '36' })
    })

    it('devuelve null si no hay filas o el valor es nulo', async () => {
      oracle.query.mockResolvedValueOnce([])
      await expect(repo.consultarPersonaAXIS('1', '1')).resolves.toBeNull()

      oracle.query.mockResolvedValueOnce([{ SPERSON: null }])
      await expect(repo.consultarPersonaAXIS('1', '1')).resolves.toBeNull()
    })
  })

  describe('crearOrdenInspeccionAutos', () => {
    it('invoca el procedimiento y devuelve los parametros de salida', async () => {
      connection.execute.mockResolvedValue({ outBinds: { POUT_ID_INSPECCION: 888, P_SPERSON: 321 } })

      const resultado = await repo.crearOrdenInspeccionAutos({ pPlaca: 'XYZ999', pSperson: 321 })

      expect(resultado).toEqual({ poutIdInspeccion: 888, pSperson: 321 })
      const [sentencia, binds, opciones] = connection.execute.mock.calls[0]
      expect(sentencia).toContain(`BEGIN AXIS.${sql.SP_CREA_INSPECCION}(`)
      expect(sentencia).toContain('P_PLACA => :P_PLACA')
      expect(binds.P_PLACA).toBe('XYZ999')
      expect(binds.P_CHASIS).toBeNull()
      expect(binds.P_SPERSON).toEqual({ dir: 3003, type: 2010, val: 321 })
      expect(opciones).toEqual({ autoCommit: true })
    })

    it('envia todos los parametros informados', async () => {
      connection.execute.mockResolvedValue({ outBinds: {} })
      const params = {
        pIdUsuarioCreador: 'U',
        pCodigoProducto: 'P',
        pIdIntermediario: 'I',
        pMotivoInspeccion: 'M',
        pTipoPlaca: 'TP',
        pPlaca: 'XYZ999',
        pFasecolda: 'F',
        pChasis: 'C',
        pMotor: 'MO',
        pNumeroSerie: 'S',
        pModelo: '2024',
        pColor: '1',
        pKilometraje: '10',
        pKilometrajeAnio: '5',
        pTipoPintura: '1',
        pTipoCaja: '1',
        pTipoCarroceria: '1',
        pTipoServicio: '1',
        pTipoVehiculo: '1',
        pValor: '100',
        pTiposInspQueAplica: 'A'
      }

      await repo.crearOrdenInspeccionAutos(params)

      const binds = connection.execute.mock.calls[0][1]
      const informados = Object.entries(binds).filter(([key]) => !['P_SPERSON', 'POUT_ID_INSPECCION'].includes(key))
      expect(informados.every(([, value]) => value !== null)).toBe(true)
    })

    it('devuelve null si el procedimiento no entrega salidas', async () => {
      connection.execute.mockResolvedValue({})

      await expect(repo.crearOrdenInspeccionAutos({})).resolves.toEqual({ poutIdInspeccion: null, pSperson: null })
      expect(connection.execute.mock.calls[0][1].P_SPERSON.val).toBeNull()
    })
  })
})
