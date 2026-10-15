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

describe('config/secrets - getDbCredentials', () => {
  const SECRETO = {
    username: 'USUARIO_PRUEBA',
    password: 'clave-prueba',
    connectString: 'db.ejemplo.test:1521/servicio'
  }
  let send
  let secrets

  beforeEach(() => {
    jest.resetModules()
    send = jest.fn()
    jest.doMock('@aws-sdk/client-secrets-manager', () => ({
      SecretsManagerClient: jest.fn(() => ({ send })),
      GetSecretValueCommand: jest.fn((input) => ({ input }))
    }))
    secrets = require('../../src/config/secrets')
  })

  afterEach(() => jest.dontMock('@aws-sdk/client-secrets-manager'))

  it('lee el secreto y lo cachea', async () => {
    send.mockResolvedValue({ SecretString: JSON.stringify(SECRETO) })

    await expect(secrets.getDbCredentials('secreto-prueba')).resolves.toEqual(SECRETO)
    await expect(secrets.getDbCredentials('secreto-prueba')).resolves.toEqual(SECRETO)
    expect(send).toHaveBeenCalledTimes(1)
    expect(send.mock.calls[0][0].input).toEqual({ SecretId: 'secreto-prueba' })
  })

  it('vuelve a consultar despues de resetCache', async () => {
    send.mockResolvedValue({ SecretString: JSON.stringify(SECRETO) })

    await secrets.getDbCredentials('secreto-prueba')
    secrets.resetCache()
    await secrets.getDbCredentials('secreto-prueba')
    expect(send).toHaveBeenCalledTimes(2)
  })

  it('acepta el secreto en formato binario', async () => {
    send.mockResolvedValue({ SecretBinary: Buffer.from(JSON.stringify(SECRETO)) })
    await expect(secrets.getDbCredentials('secreto-prueba')).resolves.toEqual(SECRETO)
  })

  it('falla si no se configura el nombre del secreto', async () => {
    await expect(secrets.getDbCredentials()).rejects.toThrow('IAXIS_SECRET_NAME no configurado')
    expect(send).not.toHaveBeenCalled()
  })

  it('falla si el secreto esta vacio', async () => {
    send.mockResolvedValue({})
    await expect(secrets.getDbCredentials('secreto-prueba')).rejects.toThrow('El secreto de base de datos esta vacio')
  })

  it('falla si el secreto no es JSON', async () => {
    send.mockResolvedValue({ SecretString: 'no-es-json' })
    await expect(secrets.getDbCredentials('secreto-prueba')).rejects.toThrow('no es un JSON valido')
  })

  it('falla si el secreto es null', async () => {
    send.mockResolvedValue({ SecretString: 'null' })
    await expect(secrets.getDbCredentials('secreto-prueba')).rejects.toThrow(
      'no contiene: username, password, connectString'
    )
  })
})
