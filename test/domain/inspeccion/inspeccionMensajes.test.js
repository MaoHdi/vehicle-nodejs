'use strict'

const mensajes = require('../../../src/domain/inspeccion/inspeccionMessages')
const { InspeccionExtendida } = require('../../../src/domain/inspeccion/inspeccionExtendida')

describe('inspeccionMessages', () => {
  it.each(Object.keys(mensajes))('%s arma un estado con codigo y severidad', (nombre) => {
    const rs = { infoResponse: { requestID: 'REQ-1' } }

    mensajes[nombre](rs, { solicitud: { operacion: 'CREAR', lineaNegocio: 'AUTOS' }, infoRequest: { requestID: 'REQ-1' } }, 10)

    expect(rs.infoResponse.estado).toEqual(
      expect.objectContaining({ codigoEstado: expect.any(String), severidad: expect.any(String) })
    )
  })

  it.each(Object.keys(mensajes))('%s tolera una respuesta sin infoResponse', (nombre) => {
    const rs = {}

    mensajes[nombre](rs, {})

    expect(rs.infoResponse.estado).toBeDefined()
  })
})

describe('InspeccionExtendida', () => {
  it('prioriza la placa y el chasis directos', () => {
    const ext = new InspeccionExtendida({ datosInspeccionAuto: { vehiculo: { placa: { placa: 'AAA000' }, chasis: 'C1' } } })
    ext.placaDirecta = 'XYZ000'
    ext.chasisDirecto = 'C2'

    expect(ext.getPlaca()).toBe('XYZ000')
    expect(ext.getChasis()).toBe('C2')
    expect(ext.esFormatoDirecto()).toBe(true)
    expect(ext.tieneParametrosBusqueda()).toBe(true)
  })

  it('usa el formato tradicional cuando los directos estan vacios', () => {
    const ext = new InspeccionExtendida({ datosInspeccionAuto: { vehiculo: { placa: { placa: 'AAA000' }, chasis: 'C1' } } })
    ext.placaDirecta = ' '
    ext.chasisDirecto = ' '

    expect(ext.getPlaca()).toBe('AAA000')
    expect(ext.getChasis()).toBe('C1')
    expect(ext.esFormatoDirecto()).toBe(false)
  })

  it('busca por idInspeccion o por chasis', () => {
    expect(new InspeccionExtendida({ idInspeccion: 0 }).tieneParametrosBusqueda()).toBe(true)

    const soloChasis = new InspeccionExtendida()
    soloChasis.chasisDirecto = 'C3'
    expect(soloChasis.tieneParametrosBusqueda()).toBe(true)
    expect(soloChasis.esFormatoDirecto()).toBe(true)
  })

  it('no tiene parametros sin inspeccion', () => {
    const ext = new InspeccionExtendida()

    expect(ext.getPlaca()).toBeNull()
    expect(ext.getChasis()).toBeNull()
    expect(ext.tieneParametrosBusqueda()).toBe(false)
  })
})
