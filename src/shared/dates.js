'use strict'

/**
 * Port de com.lsc.services.utils.FormatUtils y de
 * co.com.libertymutual.vehicleservices.util.UtilFormatDate.
 *
 * Se conserva el comportamiento exacto del legacy, incluidas sus particularidades
 * (ver `formatFechaInspeccion`).
 */

const TIME_ZONE = '-05:00'

const pad2 = (n) => (n < 10 ? `0${n}` : `${n}`)

/**
 * Convierte a `Date` los valores que llegan desde XML/JSON/Oracle.
 * @param {Date|string|number|null|undefined} value
 * @returns {Date|null}
 */
function toDate (value) {
  if (value === null || value === undefined || value === '') return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  if (typeof value === 'number') return new Date(value)

  const str = String(value).trim()
  // `yyyy-MM-dd HH:mm:ss` (formato con el que Oracle entrega las fechas al legacy)
  const sql = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(str)
  if (sql) {
    return new Date(Number(sql[1]), Number(sql[2]) - 1, Number(sql[3]), Number(sql[4]), Number(sql[5]), Number(sql[6]))
  }
  // `yyyy-MM-dd`
  const plain = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str)
  if (plain) return new Date(Number(plain[1]), Number(plain[2]) - 1, Number(plain[3]))
  // `dd/MM/yyyy`
  const dmy = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(str)
  if (dmy) return new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]))

  const parsed = new Date(str)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

/**
 * FormatUtils.formatearFecha_ddMMyyyy -> `dd/MM/yyyy`.
 * Es el formato que iAxis exige en los registros de alta (INT_CARGA_GENERICO).
 * @param {Date|string|null} value
 * @returns {string|null} `null` cuando no hay fecha (igual que el legacy con XMLGregorianCalendar)
 */
function formatDdMMyyyy (value) {
  const date = toDate(value)
  if (!date) return null
  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()}`
}

/** Fecha actual en `dd/MM/yyyy` (registro tipo 2 - movimiento de poliza). */
function todayDdMMyyyy () {
  return formatDdMMyyyy(new Date())
}

/**
 * FormatUtils.boolean2BinaryStr.
 * @param {boolean|null|undefined} value
 * @returns {string|null}
 */
function booleanToBinary (value) {
  if (value === null || value === undefined) return null
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'true' || normalized === '1') return '1'
    if (normalized === 'false' || normalized === '0') return '0'
    return null
  }
  return value ? '1' : '0'
}

/**
 * UtilFormatDate.formatDate: `yyyy-MM-dd HH:mm:ss` -> `yyyy-MM-dd'T'hh:mm:ss.000-05:00`.
 *
 * ATENCION: el patron de salida del legacy usa `hh` (reloj de 12 horas, 01-12) y no
 * `HH`. Se replica tal cual para no alterar el contrato de respuesta que consumen
 * los clientes actuales de crearConsultarInspMIILS.
 *
 * @param {Date|string|null} value
 * @returns {string|null}
 */
function formatFechaInspeccion (value) {
  const date = toDate(value)
  if (!date) return null
  const hour12 = date.getHours() % 12 === 0 ? 12 : date.getHours() % 12
  return (
    `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}` +
    `T${pad2(hour12)}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}.000${TIME_ZONE}`
  )
}

/**
 * Fecha en formato `xsd:dateTime` para los mensajes SOAP salientes.
 * @param {Date} [date]
 * @returns {string}
 */
function toXmlDateTime (date = new Date()) {
  return date.toISOString().replace(/\.\d{3}Z$/, '.000Z')
}

module.exports = {
  TIME_ZONE,
  toDate,
  formatDdMMyyyy,
  todayDdMMyyyy,
  booleanToBinary,
  formatFechaInspeccion,
  toXmlDateTime
}
