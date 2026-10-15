'use strict'

jest.mock('../../../src/infrastructure/db/oracle', () => ({
  query: jest.fn(),
  withConnection: jest.fn(),
  oracledb: { BIND_OUT: 3002, NUMBER: 2010, DB_TYPE_OBJECT: 2023 }
}))

const oracle = require('../../../src/infrastructure/db/oracle')
const sql = require('../../../src/infrastructure/db/sql')
const repo = require('../../../src/infrastructure/db/utilRepository')

let connection

beforeEach(() => {
  jest.clearAllMocks()
  connection = { execute: jest.fn() }
  oracle.withConnection.mockImplementation((fn) => fn(connection))
})

const personaNatural = () => ({
  tipoPersona: { codigo: '1' },
  tipoDocumento: { codigo: '36' },
  numeroDocumento: '1000000001',
  personaNatural: {
    genero: { codigo: '2' },
    fechaNacimiento: '1990-01-01',
    primerApellido: 'APELLIDO_UNO',
    segundoApellido: 'APELLIDO_DOS',
    primerNombre: 'NOMBRE_UNO',
    segundoNombre: 'NOMBRE_DOS',
    estadoCivil: { codigo: '1' },
    ocupacion: { codigo: '5' }
  }
})

describe('infrastructure/db/utilRepository', () => {
  describe('contextualizarProcedimientoAlmacenado', () => {
    it('inicializa el contexto con la empresa consultada', async () => {
      connection.execute.mockResolvedValueOnce({ rows: [{ EMPRESA: 24 }] }).mockResolvedValueOnce({})

      await repo.contextualizarProcedimientoAlmacenado(connection)

      expect(connection.execute).toHaveBeenNthCalledWith(1, sql.CONSULTAR_EMPRESA_CONTEXTO)
      expect(connection.execute.mock.calls[1][1]).toEqual({ empresa: 24, usuario: 'USER_BBDD' })
    })

    it('usa la empresa por defecto si la consulta no trae valor', async () => {
      connection.execute.mockResolvedValueOnce({ rows: [{ EMPRESA: null }] }).mockResolvedValueOnce({})
      await repo.contextualizarProcedimientoAlmacenado(connection)
      expect(connection.execute.mock.calls[1][1].empresa).toBe(12)

      connection.execute.mockClear()
      connection.execute.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({})
      await repo.contextualizarProcedimientoAlmacenado(connection)
      expect(connection.execute.mock.calls[1][1].empresa).toBe(12)

      connection.execute.mockClear()
      connection.execute.mockResolvedValueOnce({}).mockResolvedValueOnce({})
      await repo.contextualizarProcedimientoAlmacenado(connection)
      expect(connection.execute.mock.calls[1][1].empresa).toBe(12)
    })

    it('no propaga los errores de consulta ni de inicializacion', async () => {
      connection.execute.mockRejectedValueOnce(new Error('consulta')).mockRejectedValueOnce(new Error('contexto'))

      await expect(repo.contextualizarProcedimientoAlmacenado(connection)).resolves.toBeUndefined()
      expect(connection.execute.mock.calls[1][1].empresa).toBe(12)
    })
  })

  describe('consultarPersonaIAXIS', () => {
    it('devuelve el sperson como texto', async () => {
      oracle.query.mockResolvedValue([{ SPERSON: 77 }])

      await expect(repo.consultarPersonaIAXIS('36', ' 1000000001 ')).resolves.toBe('77')
      expect(oracle.query).toHaveBeenCalledWith(sql.CONSULTAR_PERSONA_IAXIS, [36, '1000000001'])
    })

    it('devuelve null si no existe o el valor es nulo', async () => {
      oracle.query.mockResolvedValueOnce([])
      await expect(repo.consultarPersonaIAXIS(1, '1')).resolves.toBeNull()

      oracle.query.mockResolvedValueOnce([{ SPERSON: null }])
      await expect(repo.consultarPersonaIAXIS(1, '1')).resolves.toBeNull()
    })

    it('devuelve null si la consulta falla', async () => {
      oracle.query.mockRejectedValue(new Error('sin conexion'))
      await expect(repo.consultarPersonaIAXIS(1, '1')).resolves.toBeNull()
    })
  })

  describe('consultarFasecoldaVersion', () => {
    it('mapea la version y usa 0 en los valores nulos', async () => {
      oracle.query.mockResolvedValue([{ NCILIND: '1600', NPLAZAS: '5', CVEHCAJ: null, VALORNUEVO: '80000000' }])

      const version = await repo.consultarFasecoldaVersion('01234567', '2024')

      expect(oracle.query).toHaveBeenCalledWith(sql.CONSULTAR_FASECOLDA_VERSION, [2024, '01234567'])
      expect(version).toEqual({
        cilindraje: 1600,
        ocupantes: 5,
        caja: 0,
        origen: 0,
        peso: 0,
        servicio: 0,
        tipoCombustible: 0,
        valorNuevo: 80000000
      })
    })

    it('devuelve null si no hay version o la consulta falla', async () => {
      oracle.query.mockResolvedValueOnce([])
      await expect(repo.consultarFasecoldaVersion('1', 2024)).resolves.toBeNull()

      oracle.query.mockRejectedValueOnce(new Error('sin conexion'))
      await expect(repo.consultarFasecoldaVersion('1', 2024)).resolves.toBeNull()
    })
  })

  describe('altaRapidaPersonaIAXIS', () => {
    it('rechaza tipos de persona no soportados', async () => {
      await expect(repo.altaRapidaPersonaIAXIS({ tipoPersona: { codigo: '9' } })).resolves.toBe(
        'ERROR - Tipo persona no valido para inspeccion en MIILS:9'
      )
      await expect(repo.altaRapidaPersonaIAXIS(undefined)).resolves.toBe(
        'ERROR - Tipo persona no valido para inspeccion en MIILS:'
      )
      expect(oracle.withConnection).not.toHaveBeenCalled()
    })

    it('crea la persona natural con sus datos', async () => {
      connection.execute
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({ outBinds: { p3: 4321 } })

      await expect(repo.altaRapidaPersonaIAXIS(personaNatural())).resolves.toBe('4321')

      const [sentencia, binds, opciones] = connection.execute.mock.calls[2]
      expect(sentencia).toContain(`BEGIN ${sql.SP_ALTA_PERSONA}(:p1, :p2`)
      expect(binds).toMatchObject({
        p6: 1,
        p7: 36,
        p8: '1000000001',
        p9: 2,
        p18: 'APELLIDO_UNO',
        p19: 'APELLIDO_DOS',
        p23: 1,
        p27: 'NOMBRE_UNO',
        p28: 'NOMBRE_DOS',
        p30: 5
      })
      expect(binds.p10).toBeInstanceOf(Date)
      expect(opciones).toEqual({ autoCommit: true })
    })

    it('crea la persona natural sin datos opcionales', async () => {
      connection.execute.mockResolvedValue({ outBinds: { p3: 1 } })

      await repo.altaRapidaPersonaIAXIS({ tipoPersona: { codigo: '1' }, tipoDocumento: { codigo: '36' } })

      const binds = connection.execute.mock.calls[2][1]
      expect(binds).toMatchObject({
        p8: null,
        p9: null,
        p18: null,
        p19: null,
        p23: null,
        p27: null,
        p28: null,
        p30: null
      })
    })

    it('no envia datos de persona natural para persona juridica', async () => {
      connection.execute.mockResolvedValue({ outBinds: { p3: 99 } })
      const juridica = { ...personaNatural(), tipoPersona: { codigo: '2' } }

      await expect(repo.altaRapidaPersonaIAXIS(juridica)).resolves.toBe('99')

      const binds = connection.execute.mock.calls[2][1]
      expect(binds).toMatchObject({
        p6: 2,
        p9: null,
        p10: null,
        p18: null,
        p19: null,
        p23: null,
        p27: null,
        p28: null,
        p30: null
      })
    })

    it('devuelve el texto de error del legacy si el procedimiento falla', async () => {
      oracle.withConnection.mockRejectedValue(new Error('procedimiento invalido'))

      await expect(repo.altaRapidaPersonaIAXIS(personaNatural())).resolves.toBe(
        'ERROR - General en UtilDAO.altaRapidaPersonaIAXIS'
      )
    })
  })
})
