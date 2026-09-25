'use strict'

const { jdbcUrlToConnectString, normalizeCredentials } = require('../../src/config/secrets')

describe('config/secrets - reutilizacion del secreto del servicio Java', () => {
  describe('jdbcUrlToConnectString', () => {
    it('convierte la forma con nombre de servicio', () => {
      expect(jdbcUrlToConnectString('jdbc:oracle:thin:@coldbcore-iaxisn01.hdicolombia.com.co:5961/preprod')).toBe(
        'coldbcore-iaxisn01.hdicolombia.com.co:5961/preprod'
      )
    })

    it('convierte la forma con doble barra', () => {
      expect(jdbcUrlToConnectString('jdbc:oracle:thin:@//10.142.137.50:5961/preprod')).toBe('10.142.137.50:5961/preprod')
    })

    it('convierte la forma con SID a un descriptor', () => {
      expect(jdbcUrlToConnectString('jdbc:oracle:thin:@10.142.137.50:1521:AXIS')).toBe(
        '(DESCRIPTION=(ADDRESS=(PROTOCOL=TCP)(HOST=10.142.137.50)(PORT=1521))(CONNECT_DATA=(SID=AXIS)))'
      )
    })

    it('deja intacto un descriptor TNS completo', () => {
      const tns = '(DESCRIPTION=(ADDRESS=(PROTOCOL=TCP)(HOST=h)(PORT=1521))(CONNECT_DATA=(SERVICE_NAME=s)))'
      expect(jdbcUrlToConnectString(`jdbc:oracle:thin:@${tns}`)).toBe(tns)
    })

    it('acepta una cadena que ya viene en formato EZConnect', () => {
      expect(jdbcUrlToConnectString('host:1521/servicio')).toBe('host:1521/servicio')
    })
  })

  describe('normalizeCredentials', () => {
    it('lee el secreto con el formato del servicio Java', () => {
      const credentials = normalizeCredentials({
        'SPRING.DATASOURCE.USERNAME': 'AXIS',
        'SPRING.DATASOURCE.PASSWORD': 'clave',
        'SPRING.DATASOURCE.URL': 'jdbc:oracle:thin:@host-iaxis:5961/preprod'
      })

      expect(credentials).toEqual({
        username: 'AXIS',
        password: 'clave',
        connectString: 'host-iaxis:5961/preprod',
        format: 'java'
      })
    })

    it('lee el secreto con el formato simple', () => {
      const credentials = normalizeCredentials({
        username: 'AXIS',
        password: 'clave',
        connectString: 'host-iaxis:5961/preprod'
      })

      expect(credentials.format).toBe('simple')
      expect(credentials.connectString).toBe('host-iaxis:5961/preprod')
    })

    it('prioriza el formato Java cuando el secreto trae ambas convenciones', () => {
      const credentials = normalizeCredentials({
        'SPRING.DATASOURCE.USERNAME': 'AXIS',
        'SPRING.DATASOURCE.PASSWORD': 'clave',
        'SPRING.DATASOURCE.URL': 'jdbc:oracle:thin:@host-java:5961/preprod',
        username: 'OTRO',
        password: 'otra',
        connectString: 'host-simple:1521/otro'
      })

      expect(credentials.username).toBe('AXIS')
      expect(credentials.connectString).toBe('host-java:5961/preprod')
    })
  })
})
