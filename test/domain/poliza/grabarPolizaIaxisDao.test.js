'use strict'

jest.mock('../../../src/infrastructure/db/oracle', () => ({
  oracledb: { BIND_OUT: 3003, NUMBER: 2010 },
  withConnection: jest.fn()
}))
jest.mock('../../../src/infrastructure/db/utilRepository')
jest.mock('../../../src/domain/poliza/builders/registroAltaAuto')
jest.mock('../../../src/domain/poliza/builders/registroAltaHome')
jest.mock('../../../src/domain/poliza/builders/registroAltaEBonds')

const oracle = require('../../../src/infrastructure/db/oracle')
const utilRepository = require('../../../src/infrastructure/db/utilRepository')
const { construirRegistrosAuto } = require('../../../src/domain/poliza/builders/registroAltaAuto')
const { construirRegistrosHome } = require('../../../src/domain/poliza/builders/registroAltaHome')
const { construirRegistrosEBonds } = require('../../../src/domain/poliza/builders/registroAltaEBonds')
const dao = require('../../../src/domain/poliza/grabarPolizaIaxisDao')

const collector = (registros, errores = '') => ({
  registros,
  errores,
  tieneErrores: () => errores !== ''
})

/** Conexion falsa: clases Oracle con tres atributos y un `execute` configurable. */
function fakeConnection (execute) {
  class RecordClass {
    constructor (valores) {
      Object.assign(this, valores)
    }
  }
  RecordClass.prototype.attributes = { TIPO: {}, CONSECUTIVO: {}, VALOR: {} }
  class TableClass {
    constructor (items) {
      this.items = items
    }
  }
  return {
    getDbObjectClass: jest.fn(async (name) => (name.endsWith('TAB') ? TableClass : RecordClass)),
    execute: jest.fn(execute)
  }
}

let connection

beforeEach(() => {
  jest.clearAllMocks()
  connection = fakeConnection(async () => ({ outBinds: { pnproces: 4455, pnerror: 0 } }))
  oracle.withConnection.mockImplementation((fn) => fn(connection))
  utilRepository.consultarFasecoldaVersion.mockResolvedValue('V1')
})

describe('grabarPolizaIaxisDao - construirArregloOracle', () => {
  it('mapea posiciones a atributos, numera el consecutivo y usa null en los faltantes', async () => {
    const tabla = await dao.construirArregloOracle(connection, [['1A', 'x', 'A'], ['2']], 5)

    expect(tabla.items).toHaveLength(2)
    expect(tabla.items[0]).toEqual({ TIPO: '1A', CONSECUTIVO: 5, VALOR: 'A' })
    expect(tabla.items[1]).toEqual({ TIPO: '2', CONSECUTIVO: 6, VALOR: null })
  })
})

describe('grabarPolizaIaxisDao - grabarPolizaIAXISAuto', () => {
  it('devuelve el numero de proceso cuando el procedimiento lo informa', async () => {
    construirRegistrosAuto.mockReturnValue(collector([['1']]))

    const resultado = await dao.grabarPolizaIAXISAuto({ vehiculo: { identificacion: { codigoFasecolda: '1', modelo: '2020' } } }, {})

    expect(resultado).toBe('4455')
    expect(construirRegistrosAuto).toHaveBeenCalledWith(expect.any(Object), {}, 'V1')
    expect(connection.execute.mock.calls[0][2]).toEqual({ autoCommit: true })
  })

  it('continua sin version cuando falla la consulta FASECOLDA', async () => {
    utilRepository.consultarFasecoldaVersion.mockRejectedValue(new Error('sin conexion'))
    construirRegistrosAuto.mockReturnValue(collector([['1']]))

    expect(await dao.grabarPolizaIAXISAuto(undefined, {})).toBe('4455')
    expect(construirRegistrosAuto).toHaveBeenCalledWith(undefined, {}, null)
  })

  it('devuelve los errores del armado de registros sin ir a la base', async () => {
    construirRegistrosAuto.mockReturnValue(collector([], 'campo invalido'))

    const resultado = await dao.grabarPolizaIAXISAuto({}, {})

    expect(resultado).toMatch(/^ERROR - GrabarPolizaIAXISDAO.construirObjetoOraclePolizaAuto.*campo invalido$/)
    expect(oracle.withConnection).not.toHaveBeenCalled()
  })

  it('informa error cuando el procedimiento no devuelve numero de proceso', async () => {
    connection.execute.mockResolvedValue({ outBinds: { pnproces: 0, pnerror: 99 } })
    construirRegistrosAuto.mockReturnValue(collector([['1']]))

    expect(await dao.grabarPolizaIAXISAuto({}, {})).toBe('ERROR - grabarPolizaIAXISAuto -- pstmt.execute()--')
  })

  it('informa error cuando el procedimiento lanza excepcion', async () => {
    connection.execute.mockRejectedValue(new Error('ORA-00001'))
    construirRegistrosAuto.mockReturnValue(collector([['1']]))

    expect(await dao.grabarPolizaIAXISAuto({}, {})).toMatch(/^ERROR - GrabarPolizaIAXISDAO.grabarPolizaIAXISAuto: Ejecutando/)
  })

  it('devuelve error general cuando falla la conexion', async () => {
    oracle.withConnection.mockRejectedValue(new Error('pool cerrado'))
    construirRegistrosAuto.mockReturnValue(collector([['1']]))

    expect(await dao.grabarPolizaIAXISAuto({}, {})).toBe('ERROR - General en GrabarPolizaIAXISDAO.grabarPolizaIAXISAuto')
  })
})

describe('grabarPolizaIaxisDao - grabarPolizaIAXISHome', () => {
  it('acumula los registros de todas las viviendas en un unico arreglo', async () => {
    construirRegistrosHome.mockReturnValueOnce(collector([['1'], ['2']])).mockReturnValueOnce(collector([['3']]))

    expect(await dao.grabarPolizaIAXISHome([{}, {}], {})).toBe('4455')
    expect(connection.execute.mock.calls[0][1].registros.items).toHaveLength(3)
  })

  it('devuelve los errores de la primera vivienda invalida', async () => {
    construirRegistrosHome.mockReturnValue(collector([], 'sin direccion'))

    expect(await dao.grabarPolizaIAXISHome([{}], {})).toMatch(/construirObjetoOraclePolizaHome.*sin direccion$/)
  })

  it('devuelve error general cuando falla la conexion', async () => {
    oracle.withConnection.mockRejectedValue(new Error('pool cerrado'))
    construirRegistrosHome.mockReturnValue(collector([['1']]))

    expect(await dao.grabarPolizaIAXISHome({}, {})).toBe('ERROR - General en GrabarPolizaIAXISDAO.grabarPolizaIAXISHome')
  })
})

describe('grabarPolizaIaxisDao - grabarPolizaIAXISEBonds', () => {
  it('devuelve el numero de proceso', async () => {
    construirRegistrosEBonds.mockReturnValue(collector([['1']]))

    expect(await dao.grabarPolizaIAXISEBonds({}, {})).toBe('4455')
  })

  it('devuelve los errores del armado de registros', async () => {
    construirRegistrosEBonds.mockReturnValue(collector([], 'sin riesgo'))

    expect(await dao.grabarPolizaIAXISEBonds({}, {})).toMatch(/construirObjetoOraclePolizaEBonds.*sin riesgo$/)
  })

  it('devuelve error general cuando falla la conexion', async () => {
    oracle.withConnection.mockRejectedValue(new Error('pool cerrado'))
    construirRegistrosEBonds.mockReturnValue(collector([['1']]))

    expect(await dao.grabarPolizaIAXISEBonds({}, {})).toBe('ERROR - General en GrabarPolizaIAXISDAO.grabarPolizaIAXISEBonds')
  })
})
