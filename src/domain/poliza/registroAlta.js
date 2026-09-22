'use strict'

const { homologar } = require('../../config/properties')
const { formatDdMMyyyy, booleanToBinary } = require('../../shared/dates')
const logger = require('../../shared/logger')

/**
 * Infraestructura comun para construir los registros de alta de poliza
 * (`ALTAPOLIZARECTYPE`) que consume iAxis.
 *
 * Port de los helpers `llenarCampo` y `construirRegistro` de `GrabarPolizaIAXISDAO`.
 */

/** Tamano del registro `ALTAPOLIZARECTYPE` (ver `RegistroAltaDTO`). */
const CAMPOS_POR_REGISTRO = 79

/** Desplazamiento entre la posicion logica del campo y su indice en el registro. */
const OFFSET_CAMPO = 3

/**
 * Resuelve una ruta de propiedades sobre el objeto origen.
 * Equivale a la cadena de `getX()` que el legacy invocaba por reflexion: si algun
 * tramo no existe, el campo simplemente no se informa (la obligatoriedad la controla
 * el WSDL).
 *
 * @param {object} origen
 * @param {string} path por ejemplo `datosGestion.agente.codigo`
 * @returns {*} valor resuelto o `undefined`
 */
function resolve (origen, path) {
  let value = origen
  for (const step of path.split('.')) {
    if (value === null || value === undefined) return undefined
    value = value[step]
  }
  return value
}

/**
 * Port de `llenarCampo`.
 *
 * @param {Map<number, string>} datosRegistro
 * @param {object} origen
 * @param {string} path ruta de propiedades
 * @param {number} posicion posicion logica del campo
 * @param {{fecha?: boolean, bool?: boolean, homologar?: string}} [opciones]
 */
function llenarCampo (datosRegistro, origen, path, posicion, opciones = {}) {
  const value = resolve(origen, path)
  if (value === null || value === undefined) return

  if (opciones.fecha) {
    const fecha = formatDdMMyyyy(value)
    if (fecha !== null) datosRegistro.set(posicion, fecha)
    return
  }

  if (opciones.bool) {
    const binario = booleanToBinary(value)
    if (binario !== null) datosRegistro.set(posicion, binario)
    return
  }

  if (opciones.homologar) {
    const homologado = homologar(opciones.homologar, value)
    if (homologado === undefined) {
      // El legacy lanzaba MissingResourceException, que abortaba el registro.
      throw new Error(`Homologacion no encontrada: ${opciones.homologar}.${value}`)
    }
    datosRegistro.set(posicion, homologado)
    return
  }

  datosRegistro.set(posicion, String(value))
}

/**
 * Port de `construirRegistro`: convierte el mapa de campos en el arreglo posicional
 * que espera el tipo Oracle.
 *
 * @param {Map<number, string>} datosRegistro
 * @returns {Array<string|number|null>|null}
 */
function construirRegistro (datosRegistro) {
  if (!datosRegistro || datosRegistro.size === 0) return null
  const campos = new Array(CAMPOS_POR_REGISTRO).fill(null)
  for (const [posicion, valor] of datosRegistro.entries()) {
    campos[posicion + OFFSET_CAMPO] = valor
  }
  return campos
}

/**
 * Acumula los registros de alta y los errores de construccion, replicando la
 * variable `errores` del legacy (los errores se concatenan y abortan la carga).
 */
class RegistroAltaCollector {
  constructor () {
    this.registros = []
    this.errores = ''
  }

  /** @param {Map<number, string>} datosRegistro */
  add (datosRegistro) {
    const registro = construirRegistro(datosRegistro)
    if (registro) this.registros.push(registro)
  }

  /** @param {string} mensaje */
  addError (mensaje) {
    this.errores += mensaje
  }

  /**
   * Ejecuta un bloque replicando el `try/catch` por tipo de registro del legacy.
   * @param {() => void} fn
   * @param {string} mensajeError
   */
  intentar (fn, mensajeError) {
    try {
      fn()
    } catch (error) {
      this.addError(mensajeError)
      logger.error('Error construyendo registro de alta', { error: error.message })
    }
  }

  /** @returns {boolean} */
  tieneErrores () {
    return this.errores.trim().length > 0
  }
}

/** Nuevo mapa de campos con el tipo de registro ya informado. */
function nuevoRegistro (tipo) {
  const datosRegistro = new Map()
  datosRegistro.set(1, tipo)
  return datosRegistro
}

const asArray = (value) => (value === null || value === undefined ? [] : Array.isArray(value) ? value : [value])

module.exports = {
  CAMPOS_POR_REGISTRO,
  OFFSET_CAMPO,
  resolve,
  llenarCampo,
  construirRegistro,
  RegistroAltaCollector,
  nuevoRegistro,
  asArray
}
