'use strict'

const {
  resolve,
  llenarCampo,
  construirRegistro,
  RegistroAltaCollector,
  nuevoRegistro,
  asArray,
  CAMPOS_POR_REGISTRO,
  OFFSET_CAMPO
} = require('../../../src/domain/poliza/registroAlta')

describe('registroAlta - helpers', () => {
  it('resuelve rutas y devuelve undefined cuando un tramo falta', () => {
    expect(resolve({ a: { b: { c: 1 } } }, 'a.b.c')).toBe(1)
    expect(resolve({ a: null }, 'a.b.c')).toBeUndefined()
    expect(resolve(undefined, 'a')).toBeUndefined()
  })

  it('llena campos de texto, fecha, booleano y homologados', () => {
    const r = new Map()
    const origen = { texto: 5, fecha: '2024-02-03', malaFecha: 'xx', bool: false, malBool: 'quizas', tipo: '1' }

    llenarCampo(r, origen, 'texto', 1)
    llenarCampo(r, origen, 'fecha', 2, { fecha: true })
    llenarCampo(r, origen, 'malaFecha', 3, { fecha: true })
    llenarCampo(r, origen, 'bool', 4, { bool: true })
    llenarCampo(r, origen, 'malBool', 5, { bool: true })
    llenarCampo(r, origen, 'tipo', 6, { homologar: 'tipoPersona' })
    llenarCampo(r, origen, 'noExiste', 7)

    expect(r.get(1)).toBe('5')
    expect(r.get(2)).toBe('03/02/2024')
    expect(r.has(3)).toBe(false)
    expect(r.get(4)).toBe('0')
    expect(r.has(5)).toBe(false)
    expect(r.get(6)).toBe('N')
    expect(r.has(7)).toBe(false)
  })

  it('lanza cuando la homologacion no existe', () => {
    expect(() => llenarCampo(new Map(), { tipo: '9' }, 'tipo', 1, { homologar: 'tipoPersona' })).toThrow(
      'Homologacion no encontrada: tipoPersona.9'
    )
  })

  it('construye el registro posicional y descarta mapas vacios', () => {
    expect(construirRegistro(null)).toBeNull()
    expect(construirRegistro(new Map())).toBeNull()

    const registro = construirRegistro(nuevoRegistro('7'))
    expect(registro).toHaveLength(CAMPOS_POR_REGISTRO)
    expect(registro[1 + OFFSET_CAMPO]).toBe('7')
  })

  it('acumula registros y errores', () => {
    const collector = new RegistroAltaCollector()
    collector.add(new Map())
    collector.add(nuevoRegistro('1'))
    collector.intentar(() => {
      throw new Error('falla simulada')
    }, 'error bloque. ')

    expect(collector.registros).toHaveLength(1)
    expect(collector.errores).toBe('error bloque. ')
    expect(collector.tieneErrores()).toBe(true)

    const limpio = new RegistroAltaCollector()
    limpio.addError('   ')
    expect(limpio.tieneErrores()).toBe(false)
  })

  it('normaliza valores a arreglo', () => {
    expect(asArray(null)).toEqual([])
    expect(asArray(undefined)).toEqual([])
    expect(asArray('x')).toEqual(['x'])
    expect(asArray([1, 2])).toEqual([1, 2])
  })
})
