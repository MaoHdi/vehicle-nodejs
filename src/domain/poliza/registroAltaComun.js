'use strict'

const { msg, resource, COMMON } = require('../../config/properties')
const { llenarCampo, asArray } = require('./registroAlta')

/**
 * Bloques de registro compartidos por los tres tipos de poliza (Auto, Home, EBonds).
 * Evitan triplicar la misma logica que el legacy repetia en cada
 * `construirObjetoOraclePoliza*`.
 */

/** Posiciones de contacto por tipo de registro. */
const CONTACTO_TOMADOR = { fijo: 16, movil: 17, mail: 18 }
const CONTACTO_ASEGURADO = { fijo: 17, movil: 18, mail: 19 }
const CONTACTO_CONDUCTOR = { fijo: 16, movil: 17, mail: 18 }
const CONTACTO_BENEFICIARIO = { fijo: 28, movil: 29, mail: 30 }

/** Posiciones de direccion (registros 3B / 4B / 5B / 6B). */
const DIRECCION_TOMADOR = { tipo: 4, texto: 6, ciudad: 22, departamento: 23 }
const DIRECCION_ESTANDAR = { tipo: 5, texto: 7, ciudad: 23, departamento: 24 }

/**
 * Port del bloque de contactos: telefono fijo, movil (codigos 5 y 6) y correo.
 * @param {Map<number, string>} datosRegistro
 * @param {Array} contactos
 * @param {{fijo: number, movil: number, mail: number}} posiciones
 */
function llenarContactos (datosRegistro, contactos, posiciones) {
  for (const contacto of asArray(contactos)) {
    const codigo = String(contacto?.tipoContacto?.codigo ?? '')
    if (codigo === resource('codigoTipoContactoTelefonoFijo')) {
      llenarCampo(datosRegistro, contacto, 'textoContacto', posiciones.fijo)
    } else if (
      codigo === resource('codigoTipoContactoTelefonoMovil5') ||
      codigo === resource('codigoTipoContactoTelefonoMovil6')
    ) {
      llenarCampo(datosRegistro, contacto, 'textoContacto', posiciones.movil)
    } else if (codigo === resource('codigoTipoContactoMail')) {
      llenarCampo(datosRegistro, contacto, 'textoContacto', posiciones.mail)
    }
  }
}

/**
 * Datos de persona natural o juridica sobre posiciones parametrizables.
 *
 * @param {Map<number, string>} datosRegistro
 * @param {object} origen objeto que contiene `personaNatural` / `personaJuridica`
 * @param {string} prefijo prefijo de la ruta (`''` o `'persona.'`)
 * @param {object} pos posiciones de cada campo
 * @param {number} posTipoPersona posicion donde ya se escribio el tipo de persona
 * @param {string} errorTipoPersona mensaje si el tipo de persona no es N ni J
 * @returns {string} cadena de error (vacia si todo fue correcto)
 */
function llenarPersona (datosRegistro, origen, prefijo, pos, posTipoPersona, errorTipoPersona) {
  const tipoPersona = datosRegistro.get(posTipoPersona)

  if (tipoPersona === COMMON.CARACTER_N) {
    llenarCampo(datosRegistro, origen, `${prefijo}personaNatural.primerApellido`, pos.primerApellido)
    llenarCampo(datosRegistro, origen, `${prefijo}personaNatural.segundoApellido`, pos.segundoApellido)
    llenarCampo(datosRegistro, origen, `${prefijo}personaNatural.primerNombre`, pos.primerNombre)
    llenarCampo(datosRegistro, origen, `${prefijo}personaNatural.segundoNombre`, pos.segundoNombre)
    llenarCampo(datosRegistro, origen, `${prefijo}personaNatural.genero.codigo`, pos.genero, {
      homologar: 'generoPersona'
    })
    llenarCampo(datosRegistro, origen, `${prefijo}personaNatural.fechaNacimiento`, pos.fechaNacimiento, { fecha: true })
    if (pos.pais !== undefined) datosRegistro.set(pos.pais, '170')
    llenarCampo(datosRegistro, origen, `${prefijo}personaNatural.ocupacion.codigo`, pos.ocupacion)
    llenarCampo(datosRegistro, origen, `${prefijo}personaNatural.estadoCivil.codigo`, pos.estadoCivil)
    return ''
  }

  if (tipoPersona === COMMON.CARACTER_J) {
    llenarCampo(datosRegistro, origen, `${prefijo}personaJuridica.razonSocial`, pos.primerApellido)
    llenarCampo(datosRegistro, origen, `${prefijo}personaJuridica.razonSocial`, pos.primerNombre)
    llenarCampo(datosRegistro, origen, `${prefijo}personaJuridica.fechaConstitucion`, pos.fechaNacimiento, {
      fecha: true
    })
    return ''
  }

  return msg(errorTipoPersona)
}

/** Posiciones de persona para el registro TIPO 3 (tomador). */
const POS_TOMADOR = {
  primerApellido: 7,
  segundoApellido: 8,
  primerNombre: 9,
  segundoNombre: 10,
  genero: 11,
  fechaNacimiento: 12,
  pais: 14,
  ocupacion: 19,
  estadoCivil: 20
}

/** Posiciones de persona para el registro TIPO 4 (asegurado). */
const POS_ASEGURADO = {
  primerApellido: 8,
  segundoApellido: 9,
  primerNombre: 10,
  segundoNombre: 11,
  genero: 12,
  fechaNacimiento: 13,
  pais: 14,
  ocupacion: 20,
  estadoCivil: 21
}

/** Posiciones de persona para el registro TIPO 6 (beneficiario). */
const POS_BENEFICIARIO = {
  primerApellido: 9,
  segundoApellido: 10,
  primerNombre: 11,
  segundoNombre: 12,
  genero: 13,
  fechaNacimiento: 14,
  ocupacion: 15,
  estadoCivil: 27
}

/** Posiciones de persona para el registro TIPO 5C (conductor). */
const POS_CONDUCTOR = {
  primerApellido: 8,
  segundoApellido: 9,
  primerNombre: 10,
  segundoNombre: 11,
  genero: 12,
  fechaNacimiento: 13,
  pais: 14,
  estadoCivil: 15,
  ocupacion: 19
}

/**
 * Respuesta de una pregunta: se informa `codigo` cuando existe y, si no, `valor`.
 * @param {Map<number, string>} datosRegistro
 * @param {object} respuesta
 * @param {number} posicion
 */
function llenarRespuesta (datosRegistro, respuesta, posicion) {
  if (respuesta?.codigo !== null && respuesta?.codigo !== undefined) {
    llenarCampo(datosRegistro, respuesta, 'codigo', posicion)
  } else {
    llenarCampo(datosRegistro, respuesta, 'valor', posicion)
  }
}

module.exports = {
  CONTACTO_TOMADOR,
  CONTACTO_ASEGURADO,
  CONTACTO_CONDUCTOR,
  CONTACTO_BENEFICIARIO,
  DIRECCION_TOMADOR,
  DIRECCION_ESTANDAR,
  POS_TOMADOR,
  POS_ASEGURADO,
  POS_BENEFICIARIO,
  POS_CONDUCTOR,
  llenarContactos,
  llenarPersona,
  llenarRespuesta
}
