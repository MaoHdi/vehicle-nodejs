'use strict'

jest.mock('../../../src/infrastructure/db/oracle', () => ({ query: jest.fn() }))

const oracle = require('../../../src/infrastructure/db/oracle')
const sql = require('../../../src/infrastructure/db/sql')
const repo = require('../../../src/infrastructure/db/inspeccionRepository')

const filaInspeccion = () => ({
  IDINSPECCION: 101,
  LINEANEGOCIO: 'AUTOS',
  ESTADOINSPECCION: 'P',
  PLACA: 'XYZ999',
  CODIGOCOLOR: '7',
  FECHA_CREACION: new Date('2026-01-01T00:00:00Z'),
  FECHANACIMIENTO: null,
  NUMERODOCUMENTO: 1000000001,
  PRIMERNOMBRE: 'NOMBRE_PRUEBA'
})

beforeEach(() => jest.clearAllMocks())

describe('infrastructure/db/inspeccionRepository', () => {
  it('consultarInspeccionMIILS mapea las filas al DTO', async () => {
    oracle.query.mockResolvedValue([filaInspeccion()])

    const [dto] = await repo.consultarInspeccionMIILS('101')

    expect(oracle.query).toHaveBeenCalledWith(sql.CONSULTAR_INSPECCION_MIILS, ['101'])
    expect(dto).toMatchObject({
      idInspeccion: '101',
      lineaNegocio: 'AUTOS',
      placa: 'XYZ999',
      codigoColor: 7,
      numeroDocumento: '1000000001',
      fechaCreacion: new Date('2026-01-01T00:00:00Z'),
      fechaNacimiento: null,
      chasis: null,
      fechaFinInspeccion: null
    })
  })

  it('usa 0 como color por defecto', async () => {
    oracle.query.mockResolvedValue([{}])
    const [dto] = await repo.consultarInspeccionMIILS('1')
    expect(dto.codigoColor).toBe(0)
    expect(dto.idInspeccion).toBeNull()
    expect(dto.fechaCreacion).toBeNull()
  })

  it.each([
    ['consultarInspeccionPorPlaca', ['XYZ999'], 'CONSULTAR_INSPECCION_POR_PLACA'],
    ['consultarInspeccionPorChasis', ['CHASIS-1'], 'CONSULTAR_INSPECCION_POR_CHASIS'],
    ['consultarInspeccionPorPlacaYChasis', ['XYZ999', 'CHASIS-1'], 'CONSULTAR_INSPECCION_POR_PLACA_Y_CHASIS']
  ])('%s consulta con la sentencia correcta', async (metodo, args, sentencia) => {
    oracle.query.mockResolvedValue([filaInspeccion()])

    const rows = await repo[metodo](...args)

    expect(oracle.query).toHaveBeenCalledWith(sql[sentencia], args)
    expect(rows[0].placa).toBe('XYZ999')
  })

  it('consultaPolizaProcesoIaxis devuelve los ids de inspeccion', async () => {
    oracle.query.mockResolvedValue([{ ID_INSPECCION: 55 }, { ID_INSPECCION: null }])

    await expect(repo.consultaPolizaProcesoIaxis('XYZ999')).resolves.toEqual([
      { idInspeccion: '55' },
      { idInspeccion: null }
    ])
    expect(oracle.query).toHaveBeenCalledWith(sql.CONSULTA_X_PLACA_MIILS, ['XYZ999'])
  })

  it('consultaContactosCliente mapea los contactos', async () => {
    oracle.query.mockResolvedValue([
      { IDCONTACTO: 1, CODIGOTIPOCONTACTO: 3, NOMBRETIPOCONTACTO: 'CORREO', TEXTOCONTACTO: 'contacto@ejemplo.test' }
    ])

    await expect(repo.consultaContactosCliente(9)).resolves.toEqual([
      { idContacto: '1', codigoTipoContacto: '3', nombreTipoContacto: 'CORREO', textoContacto: 'contacto@ejemplo.test' }
    ])
    expect(oracle.query).toHaveBeenCalledWith(sql.CONSULTAR_CONTACTOS_CLIENTE, [9])
  })

  it('consultaDireccionesCliente mapea las direcciones', async () => {
    oracle.query.mockResolvedValue([{ IDDIRECCION: 2, TEXTODIRECCION: 'CALLE FICTICIA 1', CODIGOPAIS: 170 }])

    const [direccion] = await repo.consultaDireccionesCliente(9)

    expect(direccion).toMatchObject({
      idDireccion: '2',
      textoDireccion: 'CALLE FICTICIA 1',
      codigoPais: '170',
      nombreCiudad: null
    })
    expect(oracle.query).toHaveBeenCalledWith(sql.CONSULTAR_DIRECCIONES_CLIENTE, [9])
  })

  it('consultarAccesoriosVehiculos convierte valores numericos y nulos', async () => {
    oracle.query.mockResolvedValue([
      { ID_INSPECCION: 101, ID_ACCESORIO: 1, MARCA: 'MARCA', VALOR: '1500', CANTIDAD: '2', ORIGINAL: 'S' },
      { ID_INSPECCION: 101, ID_ACCESORIO: 2, VALOR: null }
    ])

    const [conValores, sinValores] = await repo.consultarAccesoriosVehiculos(101)

    expect(oracle.query).toHaveBeenCalledWith(sql.CONSULTAR_ACCESORIOS_VEHICULOS, { idInspeccion: 101 })
    expect(conValores).toMatchObject({ idInspeccion: '101', valor: 1500, cantidad: 2, original: 'S' })
    expect(sinValores).toMatchObject({ valor: null, cantidad: null, marca: null })
  })
})
