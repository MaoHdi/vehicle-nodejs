'use strict'

jest.mock('../../../src/infrastructure/soap/soapClient', () => ({
  EXTERNAL_SERVICES: { SINIESTROS_SISA: { urlKey: 'urlAutoSisa' } },
  execute: jest.fn()
}))

const { execute } = require('../../../src/infrastructure/soap/soapClient')
const { COMMON } = require('../../../src/config/properties')
const { procesar, buildRequest, mapSiniestro, REQUEST_ID_SISA } = require('../../../src/domain/inspeccion/consultarSiniestrosService')

const respuestaSisa = (siniestrosXml) =>
  '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"><soapenv:Body>' +
  '<ns:consultarSiniestrosHistoricosSisaV201306Response xmlns:ns="http://Indemnizacion/ClaimsAutos">' +
  `<consultarSiniestrosHistoricosSisaRs>${siniestrosXml}</consultarSiniestrosHistoricosSisaRs>` +
  '</ns:consultarSiniestrosHistoricosSisaV201306Response></soapenv:Body></soapenv:Envelope>'

beforeEach(() => {
  jest.clearAllMocks()
})

describe('consultarSiniestrosService - buildRequest', () => {
  it('arma el sobre SOAP con la placa escapada', () => {
    const xml = buildRequest('AB<1')

    expect(xml).toContain(`<requestID>${REQUEST_ID_SISA}</requestID>`)
    expect(xml).toContain('<placa>AB&lt;1</placa>')
    expect(xml).toContain('<tipoPlaca>1</tipoPlaca>')
  })

  it('omite la placa cuando no se informa', () => {
    expect(buildRequest(undefined)).toContain('<placa><tipoPlaca>1</tipoPlaca></placa>')
  })
})

describe('consultarSiniestrosService - mapSiniestro', () => {
  it('agrega OTROS cuando solo hay una garantia', () => {
    expect(mapSiniestro({ placa: 'XYZ000', garantias: { nombreGarantia: 'RC' } })).toEqual({
      nombreCompania: null,
      placa: 'XYZ000',
      fechaOcurrenciaSiniestro: null,
      valorAsegurado: null,
      garantias: ['RC', COMMON.GARANTIAS_OTROS]
    })
  })

  it('conserva varias garantias e ignora las vacias', () => {
    const siniestro = mapSiniestro({
      nombreCompania: 'CIA',
      Garantias: [{ nombreGarantia: 'RC' }, { nombreGarantia: 'PT' }, null, {}]
    })

    expect(siniestro.garantias).toEqual(['RC', 'PT'])
  })

  it('devuelve garantias vacias cuando no hay', () => {
    expect(mapSiniestro({}).garantias).toEqual([])
  })
})

describe('consultarSiniestrosService - procesar', () => {
  it('devuelve los siniestros de la placa', async () => {
    execute.mockResolvedValue(
      respuestaSisa(
        '<siniestros><placa>XYZ000</placa><garantias><nombreGarantia>RC</nombreGarantia></garantias></siniestros>' +
          '<siniestros><placa>XYZ000</placa></siniestros>'
      )
    )

    const consulta = await procesar('XYZ000')

    expect(consulta.mensaje).toBe(COMMON.FASECOLDA_OK)
    expect(consulta.siniestros).toHaveLength(2)
    expect(consulta.siniestros[0].garantias).toEqual(['RC', 'OTROS'])
  })

  it('normaliza un unico siniestro', async () => {
    execute.mockResolvedValue(respuestaSisa('<siniestros><placa>XYZ000</placa></siniestros>'))

    expect((await procesar('XYZ000')).siniestros).toHaveLength(1)
  })

  it('devuelve la lista vacia cuando no hay registros', async () => {
    execute.mockResolvedValue(respuestaSisa(''))

    expect(await procesar('XYZ000')).toEqual({ mensaje: null, siniestros: [] })
  })

  it('acepta una respuesta sin sobre SOAP', async () => {
    execute.mockResolvedValue('<consultarSiniestrosHistoricosSisaRs><siniestros><placa>X</placa></siniestros></consultarSiniestrosHistoricosSisaRs>')

    expect((await procesar('X')).mensaje).toBe(COMMON.FASECOLDA_OK)
  })

  it('devuelve el mensaje de error de FASECOLDA cuando la respuesta es vacia', async () => {
    execute.mockResolvedValue('')

    expect(await procesar('XYZ000')).toEqual({ mensaje: COMMON.FASECOLDA_ERROR, siniestros: [] })
  })

  it('devuelve el mensaje de error de FASECOLDA cuando falla el servicio', async () => {
    execute.mockRejectedValue(new Error('timeout'))

    expect((await procesar('XYZ000')).mensaje).toBe(COMMON.FASECOLDA_ERROR)
  })
})
