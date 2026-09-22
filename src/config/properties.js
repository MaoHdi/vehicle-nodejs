'use strict'

const messages = require('../../resources/messages.json')
const homologaciones = require('../../resources/homologaciones.json')

/**
 * Port de las clases `*Propiedades` de Spring (@Value sobre messages.properties)
 * y del ResourceBundle `resources`.
 */

/**
 * Devuelve el mensaje asociado a la llave.
 * @param {string} key
 * @returns {string}
 */
function msg (key) {
  const value = messages[key]
  if (value === undefined) throw new Error(`Mensaje no configurado: ${key}`)
  return value
}

/**
 * Equivalente a java.text.MessageFormat.format con placeholders {0}, {1}...
 * @param {string} key
 * @param {...*} args
 * @returns {string}
 */
function format (key, ...args) {
  return msg(key).replace(/\{(\d+)\}/g, (match, index) => {
    const value = args[Number(index)]
    return value === undefined || value === null ? match : String(value)
  })
}

/**
 * Homologacion por prefijo, equivalente a `constantes.getString(prefijo + valor)`
 * del legacy (`tipoPersona.`, `generoPersona.`).
 * @param {string} prefix por ejemplo `tipoPersona.`
 * @param {*} value
 * @returns {string|undefined}
 */
function homologar (prefix, value) {
  const group = homologaciones[prefix.replace(/\.$/, '')]
  if (!group) return undefined
  return group[String(value)]
}

/** Valor simple del bundle `resources`. */
function resource (key) {
  return homologaciones[key]
}

/** Constantes equivalentes a co.com.libertymutual.vehicleservices.constants.CommonConst. */
const COMMON = {
  ERROR: 'ERROR',
  GARANTIAS_OTROS: 'OTROS',
  FASECOLDA_ERROR: 'En este momento la consulta FASECOLDA no responde',
  FASECOLDA_OK: 'Consulta realizada con exito',
  FASECOLDA_DEFAULT: 'No aplica consulta siniestros',
  POLIZA_IAXIS: 'UI05',
  INSP_MILLS: 'UI04',
  TYPE_CONSULTAR: 'CONSULTAR',
  CARACTER_N: 'N',
  CARACTER_J: 'J',
  NULL_TEXT: 'null'
}

/** Namespace del contrato SOAP publicado por VehicleServices. */
const NAMESPACE_LIBERTY = 'http://www.libertycolombia.com/ia/'

module.exports = { msg, format, homologar, resource, messages, homologaciones, COMMON, NAMESPACE_LIBERTY }
