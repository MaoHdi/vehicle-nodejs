'use strict'

const { XMLParser } = require('fast-xml-parser')
const { types, REPEATED_ELEMENTS } = require('./schema')

/**
 * Parseo y serializacion XML del contrato VehicleServices.
 *
 * Reemplaza a `co.com.libertymutual.vehicleservices.util.XmlUtil` (JAXB + SAAJ).
 * Todos los valores se manejan como texto, igual que en el legacy: las reglas de
 * negocio comparan cadenas ("0", "CREAR", "AUTOS", ...) y convertir tipos aqui
 * cambiaria el comportamiento.
 */

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true,
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
  isArray: (name) => REPEATED_ELEMENTS.has(name)
})

/**
 * Parsea un documento XML a objeto plano.
 * @param {string} xml
 * @returns {object}
 */
function parseXml (xml) {
  return parser.parse(xml)
}

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }

/**
 * Escapa el contenido de texto de un elemento XML.
 * @param {*} value
 * @returns {string}
 */
function escapeXml (value) {
  return String(value).replace(/[&<>"']/g, (c) => ESCAPES[c])
}

/**
 * Serializa un valor del modelo canonico usando la definicion ordenada de `schema.js`.
 *
 * Reglas heredadas del marshaller JAXB del legacy:
 *  - los campos `null`/`undefined` no se emiten;
 *  - las listas vacias no emiten elemento;
 *  - los booleanos se emiten como `true`/`false`;
 *  - el literal `'null'` (string) SI se emite, porque el legacy lo usa como valor.
 *
 * @param {string} elementName nombre del elemento XML
 * @param {string|null} typeName tipo declarado en `schema.types`, o `null` si es simple
 * @param {*} value
 * @param {string} [prefix] prefijo a aplicar al elemento raiz (por ejemplo `tns:`)
 * @returns {string}
 */
function serialize (elementName, typeName, value, prefix = '') {
  if (value === null || value === undefined) return ''

  const type = typeName ? types[typeName] : null
  const tag = `${prefix}${elementName}`

  if (!type) {
    if (typeof value === 'object') return ''
    return `<${tag}>${escapeXml(value)}</${tag}>`
  }

  let inner = ''
  for (const field of type.fields) {
    const spec = typeof field === 'string' ? { n: field } : field
    const raw = value[spec.n]
    if (raw === null || raw === undefined) continue

    const xmlName = spec.xml || spec.n
    if (spec.list) {
      const items = Array.isArray(raw) ? raw : [raw]
      for (const item of items) inner += serialize(xmlName, spec.t || null, item)
    } else {
      inner += serialize(xmlName, spec.t || null, raw)
    }
  }

  return `<${tag}>${inner}</${tag}>`
}

/**
 * Normaliza la forma de un objeto para que la entrada JSON (REST) y la XML (SOAP)
 * produzcan exactamente la misma estructura: los elementos `maxOccurs="unbounded"`
 * siempre quedan como arreglo.
 * @param {*} input
 * @returns {*}
 */
function normalizeRepeated (input) {
  if (input === null || input === undefined) return input
  if (Array.isArray(input)) return input.map(normalizeRepeated)
  if (typeof input !== 'object') return input

  const out = {}
  for (const [key, value] of Object.entries(input)) {
    const normalized = normalizeRepeated(value)
    out[key] = REPEATED_ELEMENTS.has(key) && !Array.isArray(normalized) ? [normalized] : normalized
  }
  return out
}

module.exports = { parseXml, serialize, escapeXml, normalizeRepeated }
