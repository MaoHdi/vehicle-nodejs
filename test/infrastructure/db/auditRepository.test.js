'use strict'

jest.mock('../../../src/infrastructure/db/oracle', () => ({ update: jest.fn() }))

const oracle = require('../../../src/infrastructure/db/oracle')
const env = require('../../../src/config/env')
const sql = require('../../../src/infrastructure/db/sql')
const { insertAuditServiceWeb } = require('../../../src/infrastructure/db/auditRepository')

const original = { auditEnabled: env.auditEnabled, auditStoreRaw: env.auditStoreRaw }

beforeEach(() => {
  jest.clearAllMocks()
  oracle.update.mockResolvedValue(1)
  env.auditEnabled = true
  env.auditStoreRaw = false
})

afterAll(() => Object.assign(env, original))

describe('infrastructure/db/auditRepository', () => {
  it('no inserta cuando la auditoria esta deshabilitada', async () => {
    env.auditEnabled = false
    await insertAuditServiceWeb('req', 'res', 'UI04')
    expect(oracle.update).not.toHaveBeenCalled()
  })

  it('inserta request y response como texto con el codigo de interfaz', async () => {
    env.auditStoreRaw = true
    await insertAuditServiceWeb({ campo: 'valor' }, 'respuesta', 'UI05')

    expect(oracle.update).toHaveBeenCalledWith(sql.INSERT_AUDIT_SERVICES_WEB, ['UI05', '{"campo":"valor"}', 'respuesta'])
  })

  it('guarda null cuando el payload esta vacio', async () => {
    env.auditStoreRaw = true
    await insertAuditServiceWeb('', undefined, 'UI04')

    expect(oracle.update).toHaveBeenCalledWith(sql.INSERT_AUDIT_SERVICES_WEB, ['UI04', null, null])
  })

  it('enmascara el payload por defecto', async () => {
    await insertAuditServiceWeb({ numeroDocumento: '1234567890' }, 'ok', 'UI04')

    const [, [, request]] = oracle.update.mock.calls[0]
    expect(request).not.toContain('1234567890')
  })

  it('no propaga los errores de la base de datos', async () => {
    oracle.update.mockRejectedValueOnce(new Error('tabla no disponible'))
    await expect(insertAuditServiceWeb('req', 'res', 'UI04')).resolves.toBeUndefined()
  })

  it('trunca los payloads que superan el maximo configurado', async () => {
    process.env.AUDIT_MAX_PAYLOAD_CHARS = '5'
    try {
      await jest.isolateModulesAsync(async () => {
        const oracleAislado = require('../../../src/infrastructure/db/oracle')
        const envAislado = require('../../../src/config/env')
        envAislado.auditEnabled = true
        envAislado.auditStoreRaw = true
        oracleAislado.update.mockResolvedValue(1)
        const repo = require('../../../src/infrastructure/db/auditRepository')

        await repo.insertAuditServiceWeb('abcdefghij', 'xyz', 'UI04')
        expect(oracleAislado.update).toHaveBeenCalledWith(expect.any(String), ['UI04', 'abcde', 'xyz'])
      })
    } finally {
      delete process.env.AUDIT_MAX_PAYLOAD_CHARS
    }
  })
})
