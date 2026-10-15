'use strict'

const { construirRegistrosEBonds } = require('../../../src/domain/poliza/builders/registroAltaEBonds')
const { CAMPOS_POR_REGISTRO } = require('../../../src/domain/poliza/registroAlta')
const f = require('./fixtures')

const { campo, porTipo } = f
const PRODUCTO = { codigo: '10004' }

const polizaCumplimiento = () => ({
  datosGestion: f.datosGestion(),
  tomador: f.personaNatural(),
  asegurado: [f.personaNatural(), f.personaJuridica()],
  riesgoCumplimiento: { descripcionRiesgo: { naturalezaRiesgo: 'CONTRATO' } },
  beneficiario: f.beneficiarios(),
  garantia: f.garantias(),
  preguntaPoliza: f.preguntas(),
  preguntaRiesgo: f.preguntas().slice(0, 1),
  preguntaTablaRiesgo: f.preguntasTabla(),
  clausula: f.clausulas(),
  deducible: f.deducibles()
})

describe('registros de alta - cumplimiento (EBonds)', () => {
  it('construye todos los tipos de registro sin errores para una poliza completa', () => {
    const collector = construirRegistrosEBonds(polizaCumplimiento(), PRODUCTO)

    expect(collector.errores).toBe('')
    expect(collector.tieneErrores()).toBe(false)
    for (const tipo of ['1', '2', '3', '3B', '4', '4B', '5', '6', '6B', '7', '8', '9', '10', '17', '18']) {
      expect(porTipo(collector.registros, tipo).length).toBeGreaterThan(0)
    }
    collector.registros.forEach((r) => expect(r).toHaveLength(CAMPOS_POR_REGISTRO))
  })

  it('arma el registro tipo 1 con la fecha fin de vigencia exclusiva de cumplimiento', () => {
    const [tipo1] = porTipo(construirRegistrosEBonds(polizaCumplimiento(), PRODUCTO).registros, '1')

    expect(campo(tipo1, 2)).toBe('1111')
    expect(campo(tipo1, 3)).toBe('10004')
    expect(campo(tipo1, 4)).toBe('100001')
    expect(campo(tipo1, 7)).toBe('01/06/2024')
    expect(campo(tipo1, 8)).toBe('01/06/2025')
    expect(campo(tipo1, 9)).toBe('EF')
    expect(campo(tipo1, 25)).toBe('1')
  })

  it('arma el tomador con persona natural, contactos y direcciones', () => {
    const { registros } = construirRegistrosEBonds(polizaCumplimiento(), PRODUCTO)
    const [tipo3] = porTipo(registros, '3')

    expect(campo(tipo3, 6)).toBe('N')
    expect(campo(tipo3, 7)).toBe('Apellido')
    expect(campo(tipo3, 11)).toBe('M')
    expect(campo(tipo3, 12)).toBe('01/01/1990')
    expect(campo(tipo3, 16)).toBe('6010000000')
    expect(campo(tipo3, 17)).toBe('3000000001')
    expect(campo(tipo3, 18)).toBe('prueba@example.com')

    const tipo3B = porTipo(registros, '3B')
    expect(tipo3B).toHaveLength(2)
    expect(campo(tipo3B[1], 3)).toBe('2')
    expect(campo(tipo3B[1], 6)).toBe('KR 0 # 0-1')
  })

  it('numera asegurados y sus direcciones y soporta persona juridica', () => {
    const { registros } = construirRegistrosEBonds(polizaCumplimiento(), PRODUCTO)
    const tipo4 = porTipo(registros, '4')

    expect(tipo4).toHaveLength(2)
    expect(campo(tipo4[1], 3)).toBe('2')
    expect(campo(tipo4[1], 7)).toBe('J')
    expect(campo(tipo4[1], 8)).toBe('Empresa Ficticia SAS')
    expect(campo(tipo4[1], 13)).toBe('01/01/2000')
    expect(porTipo(registros, '4B')).toHaveLength(3)
  })

  it('arma riesgo, beneficiarios, garantias y preguntas', () => {
    const { registros } = construirRegistrosEBonds(polizaCumplimiento(), PRODUCTO)

    expect(campo(porTipo(registros, '5')[0], 4)).toBe('CONTRATO')

    const tipo6 = porTipo(registros, '6')
    expect(tipo6).toHaveLength(2)
    expect(campo(tipo6[0], 16)).toBe('ONEROSO')
    expect(campo(tipo6[0], 30)).toBe('prueba@example.com')
    expect(campo(tipo6[1], 4)).toBe('2')
    expect(porTipo(registros, '6B')).toHaveLength(3)

    const tipo7 = porTipo(registros, '7')
    expect(campo(tipo7[0], 5)).toBe('01/06/2024')
    expect(campo(tipo7[0], 7)).toBe('1000')

    const tipo8 = porTipo(registros, '8')
    expect(tipo8.find((r) => campo(r, 4) === '501' && campo(r, 5) === '1')).toBeDefined()
    expect(tipo8.find((r) => campo(r, 4) === '501' && campo(r, 5) === 'texto libre')).toBeDefined()
    expect(tipo8.find((r) => campo(r, 4) === '9889' && campo(r, 5) === '200001')).toBeDefined()

    const tipo9 = porTipo(registros, '9')
    expect(tipo9.filter((r) => campo(r, 5) === '601')).toHaveLength(2)
    expect(tipo9.filter((r) => campo(r, 5) === '9975')).toHaveLength(2)
  })

  it('ubica el codigo de pregunta tabla en la posicion 5 y numera clausulas despues de ellas', () => {
    const { registros } = construirRegistrosEBonds(polizaCumplimiento(), PRODUCTO)
    const tipo10 = porTipo(registros, '10')

    expect(campo(tipo10[0], 5)).toBe('801')
    expect(campo(tipo10[0], 8)).toBe('X')
    expect(campo(tipo10[1], 8)).toBe('3')

    const [tipo17] = porTipo(registros, '17')
    expect(campo(tipo17, 4)).toBe('3')
    expect(campo(tipo17, 9)).toBe('Texto de clausula ficticio')

    const [tipo18] = porTipo(registros, '18')
    expect(campo(tipo18, 12)).toBe('100')
    expect(campo(tipo18, 13)).toBeNull()
  })

  it('genera solo los registros base cuando la poliza no trae colecciones', () => {
    const { registros, errores } = construirRegistrosEBonds({ datosGestion: { numeroPoliza: '1' } }, PRODUCTO)

    expect(errores).not.toBe('')
    expect(porTipo(registros, '1')).toHaveLength(1)
    expect(porTipo(registros, '4')).toHaveLength(0)
    expect(porTipo(registros, '6')).toHaveLength(0)
    expect(porTipo(registros, '7')).toHaveLength(0)
  })

  it('reporta error cuando el tipo de persona no se puede homologar', () => {
    const poliza = polizaCumplimiento()
    poliza.tomador.tipoPersona = { codigo: '9' }
    poliza.asegurado[0].tipoPersona = { codigo: '9' }
    poliza.beneficiario[0].persona.tipoPersona = { codigo: '9' }

    const collector = construirRegistrosEBonds(poliza, PRODUCTO)

    expect(collector.tieneErrores()).toBe(true)
    expect(porTipo(collector.registros, '3')).toHaveLength(0)
  })

  it('reporta error de persona cuando no llega el tipo de persona', () => {
    const poliza = polizaCumplimiento()
    delete poliza.tomador.tipoPersona
    delete poliza.asegurado[0].tipoPersona
    delete poliza.beneficiario[0].persona.tipoPersona

    const collector = construirRegistrosEBonds(poliza, PRODUCTO)

    expect(collector.tieneErrores()).toBe(true)
    expect(porTipo(collector.registros, '3')).toHaveLength(1)
  })

  it('aisla los fallos de cada bloque sin abortar los demas', () => {
    const poliza = polizaCumplimiento()
    poliza.datosGestion = f.explota('agente')
    poliza.riesgoCumplimiento = f.explota('descripcionRiesgo')
    poliza.beneficiario[0].persona.direccion = [f.explota('tipoDireccion')]
    poliza.garantia = [f.explota('codigoAmparo')]
    poliza.preguntaPoliza = [f.explota('respuesta')]
    poliza.preguntaTablaRiesgo = [f.explota('pregunta')]
    poliza.clausula = [f.explota('tipoClausula')]
    poliza.deducible = [f.explota('tipoDeducible')]

    const collector = construirRegistrosEBonds(poliza, PRODUCTO)

    expect(collector.tieneErrores()).toBe(true)
    expect(porTipo(collector.registros, '1')).toHaveLength(0)
    expect(porTipo(collector.registros, '3')).toHaveLength(1)
    expect(porTipo(collector.registros, '6')).toHaveLength(2)
  })
})
