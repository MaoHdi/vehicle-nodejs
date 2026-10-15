'use strict'

const env = require('../../../src/config/env')
const { EXTERNAL_SERVICES, execute } = require('../../../src/infrastructure/soap/soapClient')

const original = { urlMediationInspeccion: env.urlMediationInspeccion, urlAutoSisa: env.urlAutoSisa }
const fetchOriginal = global.fetch

beforeEach(() => {
  global.fetch = jest.fn()
  env.urlMediationInspeccion = 'https://soap.ejemplo.test/inspeccion'
  env.urlAutoSisa = ''
})

afterAll(() => {
  Object.assign(env, original)
  global.fetch = fetchOriginal
})

describe('infrastructure/soap/soapClient', () => {
  it('devuelve null sin invocar si la URL no esta configurada', async () => {
    await expect(execute('<xml/>', EXTERNAL_SERVICES.SINIESTROS_SISA)).resolves.toBeNull()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('invoca el servicio y devuelve el cuerpo de la respuesta', async () => {
    global.fetch.mockResolvedValue({ status: 200, text: () => Promise.resolve('<respuesta/>') })

    await expect(execute('<xml/>', EXTERNAL_SERVICES.MIILS_INSPECCIONES)).resolves.toBe('<respuesta/>')

    const [url, opciones] = global.fetch.mock.calls[0]
    expect(url).toBe('https://soap.ejemplo.test/inspeccion')
    expect(opciones).toMatchObject({
      method: 'POST',
      headers: { 'content-type': 'text/xml', SOAPAction: 'CrearInstanciaInspeccion' },
      body: '<xml/>'
    })
    expect(opciones.signal).toBeDefined()
  })

  it('devuelve null si la invocacion falla', async () => {
    global.fetch.mockRejectedValue(new Error('timeout'))
    await expect(execute('<xml/>', EXTERNAL_SERVICES.MIILS_INSPECCIONES)).resolves.toBeNull()
  })
})
