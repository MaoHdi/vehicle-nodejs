'use strict'

const dates = require('../../src/shared/dates')

describe('shared/dates', () => {
  describe('formatDdMMyyyy', () => {
    it('formatea una fecha al patron dd/MM/yyyy que exige iAxis', () => {
      expect(dates.formatDdMMyyyy(new Date(2024, 0, 5))).toBe('05/01/2024')
    })

    it('acepta el formato de fecha que entrega Oracle', () => {
      expect(dates.formatDdMMyyyy('2024-11-30 10:15:00')).toBe('30/11/2024')
    })

    it('devuelve null cuando no hay fecha, igual que el legacy', () => {
      expect(dates.formatDdMMyyyy(null)).toBeNull()
      expect(dates.formatDdMMyyyy(undefined)).toBeNull()
    })
  })

  describe('booleanToBinary', () => {
    it('convierte booleanos a 1/0', () => {
      expect(dates.booleanToBinary(true)).toBe('1')
      expect(dates.booleanToBinary(false)).toBe('0')
    })

    it('acepta los booleanos que llegan como texto desde XML', () => {
      expect(dates.booleanToBinary('true')).toBe('1')
      expect(dates.booleanToBinary('false')).toBe('0')
    })

    it('devuelve null cuando no hay dato', () => {
      expect(dates.booleanToBinary(null)).toBeNull()
    })
  })

  describe('formatFechaInspeccion', () => {
    it('replica el patron del legacy, que usa reloj de 12 horas', () => {
      // 13:45 -> "01:45" por el patron `hh` de SimpleDateFormat.
      expect(dates.formatFechaInspeccion('2024-03-15 13:45:20')).toBe('2024-03-15T01:45:20.000-05:00')
    })

    it('representa la medianoche como 12', () => {
      expect(dates.formatFechaInspeccion('2024-03-15 00:30:00')).toBe('2024-03-15T12:30:00.000-05:00')
    })

    it('devuelve null si no hay fecha', () => {
      expect(dates.formatFechaInspeccion(null)).toBeNull()
    })
  })
})
