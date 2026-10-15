'use strict'

const index = require('../src/index')
const crearConsultaInspMils = require('../src/handlers/crearConsultaInspMils')
const crearPolizaIaxis = require('../src/handlers/crearPolizaIaxis')

describe('src/index', () => {
  it('reexporta los handlers de ambas lambdas', () => {
    expect(index.crearConsultaInspMils).toBe(crearConsultaInspMils.handler)
    expect(index.crearPolizaIaxis).toBe(crearPolizaIaxis.handler)
  })

  it('expone funciones invocables', () => {
    expect(typeof index.crearConsultaInspMils).toBe('function')
    expect(typeof index.crearPolizaIaxis).toBe('function')
  })
})
