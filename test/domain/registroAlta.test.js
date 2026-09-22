'use strict'

const { construirRegistrosAuto } = require('../../src/domain/poliza/builders/registroAltaAuto')
const { construirRegistrosHome } = require('../../src/domain/poliza/builders/registroAltaHome')
const { OFFSET_CAMPO, CAMPOS_POR_REGISTRO } = require('../../src/domain/poliza/registroAlta')

/** Lee un campo logico de un registro posicional. */
const campo = (registro, posicion) => registro[posicion + OFFSET_CAMPO]

/** Devuelve todos los registros de un tipo dado. */
const porTipo = (registros, tipo) => registros.filter((r) => campo(r, 1) === tipo)

const polizaAutoMinima = () => ({
  datosGestion: {
    numeroPoliza: '900123',
    numeroRecibo: '77001',
    agente: { codigo: '1234' },
    fechaInicioVigencia: '2024-06-01 00:00:00',
    gestionPago: { formaPago: { codigo: '1' }, medioPago: { codigoTexto: 'EF' } },
    datosPrima: { comision: '10' }
  },
  vehiculo: {
    identificacion: {
      codigoFasecolda: '01234567',
      modelo: '2022',
      placa: { placa: 'ABC123', tipoPlaca: { codigo: '1' } },
      motor: 'M-1',
      chasis: 'CH-1',
      vin: 'V-1'
    },
    otrosDatos: { valor: '50000000', nuevo: false, transportaCombustible: false }
  },
  conductor: {
    annyosExperiencia: '10',
    tieneSiniestros: false,
    persona: {
      tipoDocumento: { codigo: '1' },
      numeroDocumento: '1020304050',
      tipoPersona: { codigo: '1' },
      personaNatural: {
        primerNombre: 'Mariana',
        primerApellido: 'Restrepo',
        genero: { codigo: '2' },
        fechaNacimiento: '1990-05-20 00:00:00'
      },
      direccion: [{ tipoDireccion: { codigo: '1' }, textoDireccion: 'CL 1', ciudad: { codigo: '1' }, departamento: { codigo: '5' } }]
    }
  },
  tomador: {
    tipoDocumento: { codigo: '1' },
    numeroDocumento: '1020304050',
    tipoPersona: { codigo: '1' },
    personaNatural: { primerNombre: 'Mariana', primerApellido: 'Restrepo', genero: { codigo: '2' } },
    contacto: [{ tipoContacto: { codigo: '3' }, textoContacto: 'correo@example.com' }]
  },
  asegurado: [
    {
      tipoDocumento: { codigo: '1' },
      numeroDocumento: '1020304050',
      tipoPersona: { codigo: '1' },
      personaNatural: { primerNombre: 'Mariana', primerApellido: 'Restrepo', genero: { codigo: '2' } }
    }
  ],
  beneficiario: [],
  garantia: [{ codigoAmparo: { codigo: '100' }, capitalGarantia: '1000', valorPrima: '250' }],
  deducible: [],
  preguntaPoliza: [],
  preguntaRiesgo: []
})

describe('registros de alta - autos', () => {
  it('construye los registros sin errores para una poliza valida', () => {
    const collector = construirRegistrosAuto(polizaAutoMinima(), { codigo: '6031' }, null)
    expect(collector.errores).toBe('')
    expect(collector.registros.length).toBeGreaterThan(0)
    expect(collector.registros[0]).toHaveLength(CAMPOS_POR_REGISTRO)
  })

  it('arma el registro tipo 1 con los datos de la poliza', () => {
    const { registros } = construirRegistrosAuto(polizaAutoMinima(), { codigo: '6031' }, null)
    const [tipo1] = porTipo(registros, '1')

    expect(campo(tipo1, 2)).toBe('1234')
    expect(campo(tipo1, 3)).toBe('6031')
    expect(campo(tipo1, 4)).toBe('900123')
    expect(campo(tipo1, 7)).toBe('01/06/2024')
    expect(campo(tipo1, 18)).toBe('ABC123')
  })

  it('homologa el tipo de persona y el genero del tomador', () => {
    const { registros } = construirRegistrosAuto(polizaAutoMinima(), { codigo: '6031' }, null)
    const [tipo3] = porTipo(registros, '3')

    expect(campo(tipo3, 6)).toBe('N')
    expect(campo(tipo3, 11)).toBe('F')
    expect(campo(tipo3, 14)).toBe('170')
    // El contacto tipo 3 (correo) va en la posicion 18 del registro de tomador.
    expect(campo(tipo3, 18)).toBe('correo@example.com')
  })

  it('usa el valor a nuevo de FASECOLDA cuando esta disponible', () => {
    const version = { valorNuevo: 75000000, cilindraje: 1600, ocupantes: 5, caja: 1, origen: 2, peso: 1200, servicio: 1, tipoCombustible: 1 }
    const { registros } = construirRegistrosAuto(polizaAutoMinima(), { codigo: '6031' }, version)
    const [tipo5] = porTipo(registros, '5')

    expect(campo(tipo5, 11)).toBe('50000000')
    expect(campo(tipo5, 12)).toBe('75000000')
    expect(campo(tipo5, 15)).toBe('1600')
  })

  it('agrega las preguntas de negocio UNQORK (numero de recibo e inspeccion MIILS)', () => {
    const poliza = polizaAutoMinima()
    poliza.datosGestion.numeroInspeccionMIILS = '55667'
    const { registros } = construirRegistrosAuto(poliza, { codigo: '6031' }, null)
    const tipo8 = porTipo(registros, '8')

    expect(tipo8.find((r) => campo(r, 4) === '9889')).toBeDefined()
    expect(tipo8.find((r) => campo(r, 4) === '9889' && campo(r, 5) === '77001')).toBeDefined()
    expect(tipo8.find((r) => campo(r, 4) === '9888' && campo(r, 5) === '55667')).toBeDefined()
  })

  it('genera los dos registros de comision especial', () => {
    const { registros } = construirRegistrosAuto(polizaAutoMinima(), { codigo: '6031' }, null)
    const tipo12 = porTipo(registros, '12')

    expect(tipo12).toHaveLength(2)
    expect(campo(tipo12[0], 6)).toBe('1')
    expect(campo(tipo12[1], 6)).toBe('99')
  })

  it('reporta error cuando el tipo de persona del tomador no es valido', () => {
    const poliza = polizaAutoMinima()
    poliza.tomador.tipoPersona = { codigo: '9' }
    const collector = construirRegistrosAuto(poliza, { codigo: '6031' }, null)

    expect(collector.tieneErrores()).toBe(true)
  })

  it('rechaza un conductor de tipo juridico', () => {
    const poliza = polizaAutoMinima()
    poliza.conductor.persona.tipoPersona = { codigo: '2' }
    const collector = construirRegistrosAuto(poliza, { codigo: '6031' }, null)

    expect(collector.errores).toContain('no puede ser tipo Jurídico')
  })
})

describe('registros de alta - home', () => {
  const polizaHomeMinima = () => ({
    datosGestion: {
      numeroPoliza: '800111',
      numeroRecibo: '9001',
      agente: { codigo: '1234' },
      fechaInicioVigencia: '2024-06-01 00:00:00',
      gestionPago: { formaPago: { codigo: '1' }, medioPago: { codigoTexto: 'EF' } }
    },
    riesgoHome: { ubicacionRiesgo: { textoDeVia: 'CL 1 # 2-3', ciudad: '001', departamento: '05' } },
    tomador: {
      tipoDocumento: { codigo: '1' },
      numeroDocumento: '1020304050',
      tipoPersona: { codigo: '1' },
      personaNatural: { primerNombre: 'Mariana', primerApellido: 'Restrepo', genero: { codigo: '2' } }
    },
    asegurado: [],
    beneficiario: [],
    garantia: [{ codigoAmparo: { codigo: '200' }, capitalGarantia: '5000', valorPrima: '100' }],
    clausula: [],
    deducible: []
  })

  it('omite el tomador y la pregunta 9889 para los productos 10024, 10003 y 6071', () => {
    const { registros } = construirRegistrosHome(polizaHomeMinima(), { codigo: '10024' })

    expect(porTipo(registros, '3')).toHaveLength(0)
    expect(porTipo(registros, '8').filter((r) => campo(r, 4) === '9889')).toHaveLength(0)
    expect(porTipo(registros, '9').filter((r) => campo(r, 5) === '9975')).toHaveLength(0)
  })

  it('incluye el tomador y la prima informada para el producto 900758', () => {
    const { registros } = construirRegistrosHome(polizaHomeMinima(), { codigo: '900758' })

    expect(porTipo(registros, '3')).toHaveLength(1)
    expect(porTipo(registros, '9').filter((r) => campo(r, 5) === '9975')).toHaveLength(1)
  })

  it('arma el registro tipo 5 con la ubicacion del riesgo', () => {
    const { registros } = construirRegistrosHome(polizaHomeMinima(), { codigo: '900758' })
    const [tipo5] = porTipo(registros, '5')

    expect(campo(tipo5, 5)).toBe('CL 1 # 2-3')
    expect(campo(tipo5, 21)).toBe('001')
    expect(campo(tipo5, 22)).toBe('05')
  })
})
