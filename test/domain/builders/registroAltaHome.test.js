'use strict'

const { construirRegistrosHome, PRODUCTOS_SIN_TOMADOR } = require('../../../src/domain/poliza/builders/registroAltaHome')
const f = require('./fixtures')

const { campo, porTipo } = f

const ubicacionCompleta = () => ({
  tipoDeVia: 'CL',
  textoDeVia: '0',
  literalPredio: 'A',
  bisPredio: 'BIS',
  orientacionPredio: 'SUR',
  numViaAdyacente: '1',
  literalPredio2: 'B',
  orientacionPredio2: 'ESTE',
  consecutivoPlaca: '2',
  orientacionPredio3: 'NORTE',
  detallePredio1: 'AP',
  numeroPredio1: '101',
  detallePredio2: 'TO',
  numeroPredio2: '1',
  detallePredio3: 'IN',
  numeroPredio3: '3',
  codigoPostal: '000000',
  ciudad: '001',
  departamento: '05'
})

const polizaHome = (extra = {}) => ({
  datosGestion: f.datosGestion({ numeroInspeccionMIILS: '300001' }),
  riesgoHome: { ubicacionRiesgo: ubicacionCompleta() },
  tomador: f.personaNatural(),
  asegurado: [f.personaNatural(), f.personaJuridica()],
  beneficiario: f.beneficiarios(),
  garantia: f.garantias(),
  preguntaPoliza: f.preguntas(),
  preguntaRiesgo: f.preguntas(),
  preguntaTablaRiesgo: f.preguntasTabla(),
  clausula: f.clausulas(),
  deducible: f.deducibles(),
  ...extra
})

describe('registros de alta - home (cobertura completa)', () => {
  it('construye todos los tipos de registro sin errores para el producto 900758', () => {
    const collector = construirRegistrosHome(polizaHome(), { codigo: '900758' })

    expect(collector.errores).toBe('')
    for (const tipo of ['1', '2', '3', '3B', '4', '4B', '5', '6', '6B', '7', '8', '9', '10', '17', '18', '19']) {
      expect(porTipo(collector.registros, tipo).length).toBeGreaterThan(0)
    }
  })

  it('expone los productos que no llevan tomador', () => {
    expect([...PRODUCTOS_SIN_TOMADOR].sort()).toEqual(['10003', '10024', '6071'])
  })

  it('llena las 19 posiciones de la ubicacion del riesgo', () => {
    const [tipo5] = porTipo(construirRegistrosHome(polizaHome(), { codigo: '800020' }).registros, '5')

    expect(campo(tipo5, 4)).toBe('CL')
    expect(campo(tipo5, 7)).toBe('BIS')
    expect(campo(tipo5, 13)).toBe('NORTE')
    expect(campo(tipo5, 19)).toBe('3')
    expect(campo(tipo5, 20)).toBe('000000')
  })

  it('incluye porcentaje del beneficiario y valores secundarios del deducible', () => {
    const { registros } = construirRegistrosHome(polizaHome(), { codigo: '900758' })
    const tipo6 = porTipo(registros, '6')

    expect(campo(tipo6[0], 31)).toBe('100')
    expect(campo(tipo6[1], 31)).toBe('50')
    expect(campo(tipo6[1], 9)).toBe('Empresa Ficticia SAS')
    expect(porTipo(registros, '6B')).toHaveLength(3)

    const [tipo18] = porTipo(registros, '18')
    expect(campo(tipo18, 13)).toBe('P')
    expect(campo(tipo18, 14)).toBe('5')
  })

  it('genera el registro 19 solo para amparos con preguntas tipo tabla', () => {
    const { registros } = construirRegistrosHome(polizaHome(), { codigo: '900758' })
    const tipo19 = porTipo(registros, '19')

    expect(tipo19).toHaveLength(1)
    expect(campo(tipo19[0], 4)).toBe('100')
    expect(campo(tipo19[0], 5)).toBe('701')
    expect(campo(tipo19[0], 8)).toBe('A')
  })

  it('agrega preguntas de poliza, recibo e inspeccion MIILS', () => {
    const tipo8 = porTipo(construirRegistrosHome(polizaHome(), { codigo: '900758' }).registros, '8')

    expect(tipo8.filter((r) => campo(r, 4) === '501')).toHaveLength(4)
    expect(tipo8.find((r) => campo(r, 4) === '9889' && campo(r, 5) === '200001')).toBeDefined()
    expect(tipo8.find((r) => campo(r, 4) === '9888' && campo(r, 5) === '300001')).toBeDefined()
  })

  it('omite la inspeccion MIILS cuando no viene informada', () => {
    const poliza = polizaHome({ datosGestion: f.datosGestion() })
    const tipo8 = porTipo(construirRegistrosHome(poliza, { codigo: '900758' }).registros, '8')

    expect(tipo8.find((r) => campo(r, 4) === '9888')).toBeUndefined()
  })

  it('ubica la pregunta tabla de riesgo en la posicion 4 y numera clausulas', () => {
    const { registros } = construirRegistrosHome(polizaHome(), { codigo: '900758' })
    const tipo10 = porTipo(registros, '10')

    expect(campo(tipo10[0], 4)).toBe('801')
    expect(campo(tipo10[0], 7)).toBe('X')
    expect(campo(tipo10[1], 7)).toBe('3')
    expect(campo(porTipo(registros, '17')[0], 4)).toBe('3')
  })

  it.each(['10024', '10003', '6071'])('no genera tomador ni 9889/9975 para el producto %s', (codigo) => {
    const { registros } = construirRegistrosHome(polizaHome(), { codigo })

    expect(porTipo(registros, '3')).toHaveLength(0)
    expect(porTipo(registros, '3B')).toHaveLength(0)
    expect(porTipo(registros, '8').filter((r) => campo(r, 4) === '9889')).toHaveLength(0)
    expect(porTipo(registros, '9').filter((r) => campo(r, 5) === '9975')).toHaveLength(0)
    expect(porTipo(registros, '9').filter((r) => campo(r, 5) === '601')).toHaveLength(2)
  })

  it('tolera un producto sin codigo y una poliza sin colecciones', () => {
    const { registros } = construirRegistrosHome({}, undefined)

    expect(porTipo(registros, '1')).toHaveLength(1)
    expect(porTipo(registros, '3')).toHaveLength(1)
    expect(porTipo(registros, '4')).toHaveLength(0)
  })

  it('reporta error cuando el tipo de persona no se puede homologar o no llega', () => {
    const poliza = polizaHome()
    poliza.tomador.tipoPersona = { codigo: '9' }
    delete poliza.asegurado[0].tipoPersona
    poliza.beneficiario[0].persona.tipoPersona = { codigo: '9' }

    const collector = construirRegistrosHome(poliza, { codigo: '900758' })

    expect(collector.tieneErrores()).toBe(true)
    expect(porTipo(collector.registros, '3')).toHaveLength(0)
    expect(porTipo(collector.registros, '6')).toHaveLength(0)
  })

  it('aisla los fallos de cada bloque sin abortar los demas', () => {
    const poliza = polizaHome()
    poliza.datosGestion = f.explota('agente')
    poliza.riesgoHome = f.explota('ubicacionRiesgo')
    poliza.beneficiario[0].persona.direccion = [f.explota('tipoDireccion')]
    poliza.garantia = [{ codigoAmparo: { codigo: '100' }, preguntaTablaAmparo: [f.explota('pregunta')] }, f.explota('codigoAmparo')]
    poliza.preguntaPoliza = [f.explota('respuesta')]
    poliza.preguntaTablaRiesgo = [f.explota('pregunta')]
    poliza.clausula = [f.explota('tipoClausula')]
    poliza.deducible = [f.explota('tipoDeducible')]

    const collector = construirRegistrosHome(poliza, { codigo: '900758' })

    expect(collector.tieneErrores()).toBe(true)
    expect(porTipo(collector.registros, '1')).toHaveLength(0)
    expect(porTipo(collector.registros, '5')).toHaveLength(0)
    expect(porTipo(collector.registros, '6')).toHaveLength(2)
    expect(porTipo(collector.registros, '7')).toHaveLength(1)
    expect(porTipo(collector.registros, '19')).toHaveLength(0)
  })
})
