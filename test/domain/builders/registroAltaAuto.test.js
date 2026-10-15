'use strict'

const { construirRegistrosAuto } = require('../../../src/domain/poliza/builders/registroAltaAuto')
const f = require('./fixtures')

const { campo, porTipo } = f
const PRODUCTO = { codigo: '6031' }

const otrosDatosCompletos = () => ({
  valor: '50000000',
  color: { codigo: '7' },
  kilometraje: '1000',
  cilindraje: '1400',
  ocupantes: '4',
  tipoCombustible: { codigo: '2' },
  capacidadTonelaje: '1',
  tipoPintura: { codigo: '1' },
  tipoCaja: { codigo: '2' },
  tipoCampero: { codigo: '1' },
  tipoCarroceria: { codigo: '3' },
  tipoServicio: { codigo: '1' },
  tipoOrigen: { codigo: '1' },
  transportaCombustible: 'false',
  usoRemolque: true,
  tipoUsoVehiculo: { codigo: '1' },
  nuevo: 'no-booleano',
  peso: '900',
  pais: '170',
  companiaAnterior: '1',
  fechaFinCompaniaAnterior: 'fecha-invalida',
  accesorio: [{ descripcion: { codigo: '1' }, tipo: { codigo: '2' }, marca: 'Marca Ficticia', valor: '100000' }],
  dispositivoSeguridad: { tipo: { codigo: '1' }, propietario: { codigo: '2' }, fechaInicioContrato: '2024-01-01', numeroContrato: 'C-0' }
})

const polizaAuto = (extra = {}) => ({
  datosGestion: f.datosGestion(),
  vehiculo: {
    identificacion: {
      codigoFasecolda: '00000001',
      modelo: '2022',
      placa: { placa: 'AAA000', tipoPlaca: { codigo: '1' } },
      motor: 'M-0',
      chasis: 'CH-0',
      vin: 'V-0'
    },
    otrosDatos: otrosDatosCompletos()
  },
  conductor: {
    annyosExperiencia: '5',
    tieneSiniestros: true,
    persona: f.personaNatural()
  },
  tomador: f.personaJuridica(),
  asegurado: [f.personaNatural(), f.personaJuridica()],
  beneficiario: f.beneficiarios(),
  garantia: f.garantias(),
  preguntaPoliza: f.preguntas(),
  preguntaRiesgo: f.preguntas(),
  deducible: f.deducibles(),
  ...extra
})

const VERSION = { valorNuevo: 80000000, cilindraje: 1600, ocupantes: 5, caja: 1, origen: 2, peso: 1200, servicio: 3, tipoCombustible: 4 }

describe('registros de alta - autos (cobertura completa)', () => {
  it('construye todos los tipos de registro sin errores para una poliza completa', () => {
    const collector = construirRegistrosAuto(polizaAuto(), PRODUCTO, VERSION)

    expect(collector.errores).toBe('')
    for (const tipo of ['1', '2', '3', '3B', '4', '4B', '5', '5A', '5B', '5C', '5D', '6', '6B', '7', '8', '9', '12', '18']) {
      expect(porTipo(collector.registros, tipo).length).toBeGreaterThan(0)
    }
  })

  it('prioriza los datos informados del vehiculo sobre los de FASECOLDA', () => {
    const [tipo5] = porTipo(construirRegistrosAuto(polizaAuto(), PRODUCTO, VERSION).registros, '5')

    expect(campo(tipo5, 12)).toBe('80000000')
    expect(campo(tipo5, 15)).toBe('1400')
    expect(campo(tipo5, 16)).toBe('4')
    expect(campo(tipo5, 17)).toBe('2')
    expect(campo(tipo5, 20)).toBe('2')
    expect(campo(tipo5, 23)).toBe('1')
    expect(campo(tipo5, 24)).toBe('1')
    expect(campo(tipo5, 29)).toBe('900')
  })

  it('normaliza booleanos y descarta valores que no son booleanos ni fechas', () => {
    const [tipo5] = porTipo(construirRegistrosAuto(polizaAuto(), PRODUCTO, null).registros, '5')

    expect(campo(tipo5, 25)).toBe('0')
    expect(campo(tipo5, 26)).toBe('1')
    expect(campo(tipo5, 28)).toBeNull()
    expect(campo(tipo5, 32)).toBeNull()
  })

  it('completa con FASECOLDA lo que el vehiculo no informa', () => {
    const poliza = polizaAuto()
    poliza.vehiculo.otrosDatos = { valor: '40000000' }
    const [tipo5] = porTipo(construirRegistrosAuto(poliza, PRODUCTO, VERSION).registros, '5')

    expect(campo(tipo5, 15)).toBe('1600')
    expect(campo(tipo5, 16)).toBe('5')
    expect(campo(tipo5, 17)).toBe('4')
    expect(campo(tipo5, 20)).toBe('1')
    expect(campo(tipo5, 23)).toBe('3')
    expect(campo(tipo5, 24)).toBe('2')
    expect(campo(tipo5, 29)).toBe('1200')
  })

  it.each([
    ['sin version', null],
    ['valor a nuevo nulo', { valorNuevo: null }],
    ['valor a nuevo en cero', { valorNuevo: 0 }]
  ])('usa el valor informado como valor a nuevo (%s)', (_, version) => {
    const [tipo5] = porTipo(construirRegistrosAuto(polizaAuto(), PRODUCTO, version).registros, '5')

    expect(campo(tipo5, 12)).toBe('50000000')
  })

  it('arma accesorios, dispositivos y direcciones del conductor', () => {
    const { registros } = construirRegistrosAuto(polizaAuto(), PRODUCTO, null)

    expect(campo(porTipo(registros, '5A')[0], 6)).toBe('Marca Ficticia')
    const [tipo5D] = porTipo(registros, '5D')
    expect(campo(tipo5D, 6)).toBe('01/01/2024')
    expect(campo(tipo5D, 7)).toBe('C-0')

    const tipo5B = porTipo(registros, '5B')
    expect(tipo5B).toHaveLength(2)
    expect(campo(tipo5B[1], 4)).toBe('2')
  })

  it('arma el conductor natural con experiencia, siniestros y contactos', () => {
    const [tipo5C] = porTipo(construirRegistrosAuto(polizaAuto(), PRODUCTO, null).registros, '5C')

    expect(campo(tipo5C, 7)).toBe('N')
    expect(campo(tipo5C, 8)).toBe('Apellido')
    expect(campo(tipo5C, 20)).toBe('5')
    expect(campo(tipo5C, 21)).toBe('1')
    expect(campo(tipo5C, 18)).toBe('prueba@example.com')
  })

  it('reporta error cuando el conductor no informa tipo de persona', () => {
    const poliza = polizaAuto()
    delete poliza.conductor.persona.tipoPersona
    const collector = construirRegistrosAuto(poliza, PRODUCTO, null)

    expect(collector.tieneErrores()).toBe(true)
    expect(porTipo(collector.registros, '5C')).toHaveLength(1)
  })

  it('arma tomador juridico, asegurados, beneficiarios y preguntas', () => {
    const { registros } = construirRegistrosAuto(polizaAuto(), PRODUCTO, null)

    const [tipo3] = porTipo(registros, '3')
    expect(campo(tipo3, 6)).toBe('J')
    expect(campo(tipo3, 7)).toBe('Empresa Ficticia SAS')
    expect(porTipo(registros, '3B')).toHaveLength(1)

    expect(porTipo(registros, '4')).toHaveLength(2)
    expect(porTipo(registros, '4B')).toHaveLength(3)
    expect(porTipo(registros, '6')).toHaveLength(2)
    expect(porTipo(registros, '6B')).toHaveLength(3)

    const tipo9 = porTipo(registros, '9')
    expect(tipo9.filter((r) => campo(r, 5) === '601')).toHaveLength(2)
    expect(tipo9.filter((r) => campo(r, 5) === '9975')).toHaveLength(2)

    const [tipo18] = porTipo(registros, '18')
    expect(campo(tipo18, 12)).toBe('100')
  })

  it('reporta error cuando el tipo de persona de asegurado o beneficiario no es valido', () => {
    const poliza = polizaAuto()
    delete poliza.asegurado[0].tipoPersona
    poliza.beneficiario[0].persona.tipoPersona = { codigo: '9' }

    const collector = construirRegistrosAuto(poliza, PRODUCTO, null)

    expect(collector.tieneErrores()).toBe(true)
    expect(porTipo(collector.registros, '4')).toHaveLength(2)
    expect(porTipo(collector.registros, '6')).toHaveLength(0)
  })

  it('tolera una poliza vacia', () => {
    const collector = construirRegistrosAuto({}, PRODUCTO, null)

    expect(collector.tieneErrores()).toBe(true)
    expect(porTipo(collector.registros, '12')).toHaveLength(2)
    expect(porTipo(collector.registros, '5A')).toHaveLength(0)
  })

  it('aisla los fallos de cada bloque sin abortar los demas', () => {
    const poliza = polizaAuto()
    poliza.datosGestion = f.explota('agente')
    poliza.vehiculo = { identificacion: f.explota('codigoFasecolda'), otrosDatos: {
      accesorio: [f.explota('descripcion')],
      dispositivoSeguridad: [f.explota('tipo')]
    } }
    poliza.conductor = { persona: { ...f.personaNatural(), direccion: [f.explota('tipoDireccion')], tipoPersona: f.explota('codigo') } }
    poliza.beneficiario[0].persona.direccion = [f.explota('tipoDireccion')]
    poliza.garantia = [f.explota('codigoAmparo')]
    poliza.preguntaPoliza = [f.explota('respuesta')]
    poliza.deducible = [f.explota('tipoDeducible')]

    const collector = construirRegistrosAuto(poliza, PRODUCTO, null)

    expect(collector.tieneErrores()).toBe(true)
    for (const tipo of ['1', '5', '5A', '5B', '5C', '5D', '7', '18']) {
      expect(porTipo(collector.registros, tipo)).toHaveLength(0)
    }
    expect(porTipo(collector.registros, '6')).toHaveLength(2)
    expect(porTipo(collector.registros, '12')).toHaveLength(2)
  })
})
