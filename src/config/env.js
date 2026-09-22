'use strict'

/**
 * Configuracion por ambiente.
 *
 * Los valores no sensibles llegan de `src/env/<stage>.env` (dotenv, ver
 * `src/config/loadEnv.js`) y los que dependen de la cuenta desde `serverless.yml`
 * a partir de `environments/<stage>.yml`.
 *
 * Ningun secreto se lee de aqui: las credenciales de Oracle viven en AWS Secrets
 * Manager y se resuelven por nombre a traves de `IAXIS_SECRET_NAME`.
 */
const env = {
  appEnv: process.env.APP_ENV || process.env.LAMBDA_ENV || 'dev',

  // Oracle iAxis
  iaxisSecretName: process.env.IAXIS_SECRET_NAME,
  dbConnectString: process.env.DB_CONNECT_STRING,
  dbPoolMin: Number(process.env.DB_POOL_MIN || 0),
  dbPoolMax: Number(process.env.DB_POOL_MAX || 4),
  dbPoolTimeout: Number(process.env.DB_POOL_TIMEOUT || 60),
  dbCallTimeoutMs: Number(process.env.DB_CALL_TIMEOUT_MS || 30000),

  // Servicios SOAP externos (equivalen a SoapExternalClientEnum del legacy)
  soapTimeoutMs: Number(process.env.SOAP_TIMEOUT || 10000),
  urlMediationInspeccion: process.env.URL_MEDIATION_INSPECCION,
  urlAutoSisa: process.env.URL_AUTO_SISA,

  // Auditoria: por defecto se persiste el payload enmascarado (minimizacion GDPR).
  auditEnabled: process.env.AUDIT_ENABLED !== 'false',
  auditStoreRaw: process.env.AUDIT_STORE_RAW === 'true',

  // Protocolo
  // `soap`   -> siempre responde SOAP
  // `rest`   -> siempre responde JSON
  // `auto`   -> responde en el mismo protocolo en el que llego la peticion (default)
  responseProtocol: process.env.RESPONSE_PROTOCOL || 'auto',
  // En REST se traduce el codigoEstado del negocio a un HTTP status. SOAP siempre 200.
  restHttpStatusMapping: process.env.REST_HTTP_STATUS_MAPPING !== 'false'
}

module.exports = env
