'use strict'

const { OFFSET_CAMPO } = require('../../../src/domain/poliza/registroAlta')

/**
 * Datos de prueba ficticios para los builders de registros de alta.
 * Ningun valor corresponde a una persona real.
 */

/** Lee un campo logico de un registro posicional. */
const campo = (registro, posicion) => registro[posicion + OFFSET_CAMPO]

/** Devuelve todos los registros de un tipo dado. */
const porTipo = (registros, tipo) => registros.filter((r) => campo(r, 1) === tipo)

/** Objeto cuyo acceso a `propiedad` lanza, para forzar el catch de cada bloque. */
const explota = (propiedad) =>
  Object.defineProperty({}, propiedad, {
    enumerable: true,
    get () {
      throw new Error('falla simulada')
    }
  })

const contactos = () => [
  { tipoContacto: { codigo: '1' }, textoContacto: '6010000000' },
  { tipoContacto: { codigo: '5' }, textoContacto: '3000000000' },
  { tipoContacto: { codigo: '6' }, textoContacto: '3000000001' },
  { tipoContacto: { codigo: '3' }, textoContacto: 'prueba@example.com' },
  { tipoContacto: { codigo: '99' }, textoContacto: 'ignorado' },
  { textoContacto: 'sin tipo' }
]

const direcciones = () => [
  { tipoDireccion: { codigo: '1' }, textoDireccion: 'CL 0 # 0-0', ciudad: { codigo: '1' }, departamento: { codigo: '5' } },
  { tipoDireccion: { codigo: '2' }, textoDireccion: 'KR 0 # 0-1', ciudad: { codigo: '2' }, departamento: { codigo: '11' } }
]

const personaNatural = (extra = {}) => ({
  tipoDocumento: { codigo: '1' },
  numeroDocumento: '1000000001',
  tipoPersona: { codigo: '1' },
  personaNatural: {
    primerNombre: 'Nombre',
    segundoNombre: 'Prueba',
    primerApellido: 'Apellido',
    segundoApellido: 'Ficticio',
    genero: { codigo: '1' },
    fechaNacimiento: '1990-01-01 00:00:00',
    ocupacion: { codigo: '10' },
    estadoCivil: { codigo: '2' }
  },
  contacto: contactos(),
  direccion: direcciones(),
  ...extra
})

const personaJuridica = (extra = {}) => ({
  tipoDocumento: { codigo: '2' },
  numeroDocumento: '900000001',
  tipoPersona: { codigo: '2' },
  personaJuridica: { razonSocial: 'Empresa Ficticia SAS', fechaConstitucion: '2000-01-01' },
  contacto: [{ tipoContacto: { codigo: '3' }, textoContacto: 'empresa@example.com' }],
  direccion: direcciones().slice(0, 1),
  ...extra
})

const datosGestion = (extra = {}) => ({
  numeroPoliza: '100001',
  numeroRecibo: '200001',
  agente: { codigo: '1111' },
  fechaInicioVigencia: '2024-06-01 00:00:00',
  fechaFinVigencia: '2025-06-01',
  numeroDocumentoPromotor: '1000000009',
  tipoDocumentoPromotor: { codigo: '1' },
  gestionPago: { formaPago: { codigo: '1' }, medioPago: { codigoTexto: 'EF' } },
  datosPrima: { comision: '10' },
  ...extra
})

const beneficiarios = () => [
  {
    persona: personaNatural(),
    tipoBeneficiario: { codigoTexto: 'ONEROSO' },
    garantiaBeneficiario: { codigo: '100', porcentaje: '100' }
  },
  {
    persona: personaJuridica(),
    tipoBeneficiario: { codigoTexto: 'GRATUITO' },
    garantiaBeneficiario: { codigo: '200', porcentaje: '50' }
  }
]

const preguntas = () => [
  { pregunta: { codigo: '501' }, respuesta: [{ codigo: '1' }, { valor: 'texto libre' }] },
  { pregunta: { codigo: '502' }, respuesta: { valor: '42' } }
]

const garantias = () => [
  {
    codigoAmparo: { codigo: '100' },
    fechaInicioEfectoGarantia: '2024-06-01',
    fechaFinEfectoGarantia: '2025-06-01',
    capitalGarantia: '1000',
    valorPrima: '250',
    preguntaAmparo: [{ pregunta: { codigo: '601' }, respuesta: [{ codigo: 'S' }, { valor: '7' }] }],
    preguntaTablaAmparo: [{ pregunta: { codigo: '701' }, fila: '1', columna: '2', respuesta: { codigo: 'A' } }]
  },
  { codigoAmparo: { codigo: '200' }, capitalGarantia: '5000', valorPrima: '100' }
]

const deducibles = () => [
  {
    tipoDeducible: { codigo: '1' },
    fechaInicio: '2024-06-01',
    garantia: { codigo: '100' },
    tipoValor: { codigo: 'P' },
    valor: '10',
    tipoValorMaximo: { codigo: 'V' },
    valorMaximo: '1000',
    tipoValorMinimo: { codigo: 'V' },
    valorMinimo: '100',
    tipoValor2: { codigo: 'P' },
    valor2: '5'
  }
]

const clausulas = () => [
  {
    tipoClausula: { codigo: '1' },
    fechaInicio: '2024-06-01',
    fechaFin: '2025-06-01',
    codigoClausula: { codigo: '10' },
    textoClausulaEspecial: 'Texto de clausula ficticio'
  }
]

const preguntasTabla = () => [
  { pregunta: { codigo: '801' }, fila: '1', columna: '1', respuesta: { codigo: 'X' } },
  { pregunta: { codigo: '802' }, fila: '2', columna: '1', respuesta: { valor: '3' } }
]

module.exports = {
  campo,
  porTipo,
  explota,
  contactos,
  direcciones,
  personaNatural,
  personaJuridica,
  datosGestion,
  beneficiarios,
  preguntas,
  garantias,
  deducibles,
  clausulas,
  preguntasTabla
}
