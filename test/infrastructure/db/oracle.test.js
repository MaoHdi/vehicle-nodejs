'use strict'

jest.mock('oracledb', () => ({
  OUT_FORMAT_OBJECT: 4002,
  CLOB: 2017,
  NCLOB: 2019,
  createPool: jest.fn()
}))
jest.mock('../../../src/config/secrets', () => ({ getDbCredentials: jest.fn() }))

const oracledb = require('oracledb')
const { getDbCredentials } = require('../../../src/config/secrets')
const oracle = require('../../../src/infrastructure/db/oracle')

const CREDENCIALES = {
  username: 'USUARIO_PRUEBA',
  password: 'clave-prueba',
  connectString: 'db.ejemplo.test:1521/servicio'
}

let connection
let pool

beforeEach(async () => {
  await oracle.close()
  jest.clearAllMocks()
  connection = { execute: jest.fn(), close: jest.fn().mockResolvedValue(undefined) }
  pool = { getConnection: jest.fn().mockResolvedValue(connection), close: jest.fn().mockResolvedValue(undefined) }
  oracledb.createPool.mockResolvedValue(pool)
  getDbCredentials.mockResolvedValue(CREDENCIALES)
})

describe('infrastructure/db/oracle', () => {
  it('configura el formato de salida al cargar el modulo', () => {
    expect(oracledb.outFormat).toBe(oracledb.OUT_FORMAT_OBJECT)
    expect(oracledb.fetchAsString).toEqual([oracledb.CLOB, oracledb.NCLOB])
  })

  describe('getPool', () => {
    it('crea el pool con las credenciales del secreto y lo reutiliza', async () => {
      const primero = await oracle.getPool()
      const segundo = await oracle.getPool()

      expect(primero).toBe(pool)
      expect(segundo).toBe(pool)
      expect(oracledb.createPool).toHaveBeenCalledTimes(1)
      expect(oracledb.createPool).toHaveBeenCalledWith(
        expect.objectContaining({
          user: CREDENCIALES.username,
          password: CREDENCIALES.password,
          connectString: CREDENCIALES.connectString
        })
      )
    })

    it('permite reintentar si la creacion del pool falla', async () => {
      getDbCredentials.mockRejectedValueOnce(new Error('sin acceso'))

      await expect(oracle.getPool()).rejects.toThrow('sin acceso')
      await expect(oracle.getPool()).resolves.toBe(pool)
      expect(getDbCredentials).toHaveBeenCalledTimes(2)
    })
  })

  describe('withConnection', () => {
    it('ejecuta la funcion, fija el callTimeout y devuelve la conexion', async () => {
      const resultado = await oracle.withConnection(async (conn) => {
        expect(conn.callTimeout).toEqual(expect.any(Number))
        return 'ok'
      })

      expect(resultado).toBe('ok')
      expect(connection.close).toHaveBeenCalledTimes(1)
    })

    it('devuelve la conexion aunque la funcion falle', async () => {
      await expect(
        oracle.withConnection(async () => {
          throw new Error('fallo de negocio')
        })
      ).rejects.toThrow('fallo de negocio')
      expect(connection.close).toHaveBeenCalledTimes(1)
    })

    it('no propaga el error al cerrar la conexion', async () => {
      connection.close.mockRejectedValueOnce(new Error('cierre fallido'))
      await expect(oracle.withConnection(async () => 'ok')).resolves.toBe('ok')
    })
  })

  describe('toOracleBinds', () => {
    it('traduce los placeholders posicionales', () => {
      expect(oracle.toOracleBinds('select ? from t where a = ? and b = ?')).toBe(
        'select :b1 from t where a = :b2 and b = :b3'
      )
    })
  })

  describe('query', () => {
    it('traduce binds posicionales y devuelve las filas', async () => {
      connection.execute.mockResolvedValue({ rows: [{ A: 1 }] })

      const rows = await oracle.query('select * from t where a = ?', ['x'])

      expect(rows).toEqual([{ A: 1 }])
      expect(connection.execute).toHaveBeenCalledWith('select * from t where a = :b1', ['x'])
    })

    it('respeta los binds con nombre y usa binds vacios por defecto', async () => {
      connection.execute.mockResolvedValue({})

      await expect(oracle.query('select * from t where a = :a', { a: 1 })).resolves.toEqual([])
      expect(connection.execute).toHaveBeenCalledWith('select * from t where a = :a', { a: 1 })

      await oracle.query('select 1 from dual')
      expect(connection.execute).toHaveBeenLastCalledWith('select 1 from dual', [])
    })
  })

  describe('update', () => {
    it('confirma la transaccion y devuelve las filas afectadas', async () => {
      connection.execute.mockResolvedValue({ rowsAffected: 2 })

      await expect(oracle.update('update t set a = ?', [1])).resolves.toBe(2)
      expect(connection.execute).toHaveBeenCalledWith('update t set a = :b1', [1], { autoCommit: true })
    })

    it('devuelve 0 si no hay filas afectadas y acepta binds con nombre', async () => {
      connection.execute.mockResolvedValue({})

      await expect(oracle.update('delete from t where a = :a', { a: 1 })).resolves.toBe(0)
      await expect(oracle.update('delete from t')).resolves.toBe(0)
    })
  })

  describe('close', () => {
    it('no hace nada si no hay pool', async () => {
      await oracle.close()
      expect(pool.close).not.toHaveBeenCalled()
    })

    it('cierra el pool existente', async () => {
      await oracle.getPool()
      await oracle.close()
      expect(pool.close).toHaveBeenCalledWith(0)
    })

    it('no propaga el error al cerrar el pool', async () => {
      pool.close.mockRejectedValueOnce(new Error('cierre fallido'))
      await oracle.getPool()
      await expect(oracle.close()).resolves.toBeUndefined()
    })
  })
})
