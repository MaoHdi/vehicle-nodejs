'use strict'

const { redactObject, redactXml, redactPayload } = require('../../src/shared/redact')

describe('shared/redact', () => {
  it('enmascara el documento y los nombres conservando trazabilidad', () => {
    const result = redactObject({
      clienteInspeccion: {
        numeroDocumento: '1020304050',
        personaNatural: { primerNombre: 'Mariana', primerApellido: 'Restrepo' }
      }
    })

    expect(result.clienteInspeccion.numeroDocumento).toBe('********50')
    expect(result.clienteInspeccion.personaNatural.primerNombre).toBe('*****na')
    expect(result.clienteInspeccion.personaNatural.primerApellido).toBe('******po')
  })

  it('enmascara identificadores de vehiculo dejando los ultimos tres caracteres', () => {
    expect(redactObject({ placa: 'ABC123' }).placa).toBe('***123')
  })

  it('no altera los campos que no son datos personales', () => {
    expect(redactObject({ codigoEstado: '0', lineaNegocio: 'AUTOS' })).toEqual({
      codigoEstado: '0',
      lineaNegocio: 'AUTOS'
    })
  })

  it('enmascara etiquetas PII dentro de un payload XML', () => {
    const xml = '<solicitud><numeroDocumento>1020304050</numeroDocumento><placa>ABC123</placa></solicitud>'
    const result = redactXml(xml)

    expect(result).toContain('<numeroDocumento>********50</numeroDocumento>')
    expect(result).toContain('<placa>***123</placa>')
  })

  it('detecta automaticamente si el payload es XML o JSON', () => {
    expect(redactPayload('<placa>ABC123</placa>')).toBe('<placa>***123</placa>')
    expect(JSON.parse(redactPayload('{"placa":"ABC123"}'))).toEqual({ placa: '***123' })
  })
})
