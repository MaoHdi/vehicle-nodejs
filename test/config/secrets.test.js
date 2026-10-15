'use strict'

const { parseCredentials, secretNameForStage } = require('../../src/config/secrets')

describe('config/secrets - secreto co-hdi-vehicle-services-iaxis-secret-<stage>', () => {
  describe('secretNameForStage', () => {
    it('arma el nombre del secreto por stage', () => {
      expect(secretNameForStage('dev')).toBe('co-hdi-vehicle-services-iaxis-secret-dev')
      expect(secretNameForStage('prod')).toBe('co-hdi-vehicle-services-iaxis-secret-prod')
    })
  })

  describe('parseCredentials', () => {
    it('lee username, password y connectString', () => {
      expect(
        parseCredentials({
          username: 'USUARIO',
          password: 'clave',
          connectString: ' host-iaxis:5961/servicio '
        })
      ).toEqual({
        username: 'USUARIO',
        password: 'clave',
        connectString: 'host-iaxis:5961/servicio'
      })
    })

    it('falla indicando las llaves faltantes sin exponer valores', () => {
      expect(() => parseCredentials({ username: 'USUARIO', password: 'clave-secreta' })).toThrow(
        'El secreto de base de datos no contiene: connectString'
      )
      expect(() => parseCredentials({ username: 'USUARIO', password: 'clave-secreta' })).not.toThrow(/clave-secreta/)
    })

    it('rechaza el formato anterior del servicio Java', () => {
      expect(() =>
        parseCredentials({
          'SPRING.DATASOURCE.USERNAME': 'USUARIO',
          'SPRING.DATASOURCE.PASSWORD': 'clave',
          'SPRING.DATASOURCE.URL': 'jdbc:oracle:thin:@host:5961/servicio'
        })
      ).toThrow('username, password, connectString')
    })
  })
})
