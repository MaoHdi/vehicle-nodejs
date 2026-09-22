'use strict'

/**
 * Carga la configuracion no sensible del ambiente desde `src/env/<stage>.env`.
 *
 * Mismo patron que el resto de los servicios serverless del equipo: `serverless.yml`
 * inyecta `LAMBDA_ENV` con el stage y el handler resuelve el archivo correspondiente
 * con dotenv. Las credenciales NO viajan por aqui: se leen de Secrets Manager
 * (ver src/config/secrets.js).
 *
 * Debe requerirse como primera linea de cada handler, antes de cualquier modulo que
 * lea `process.env`.
 */
const path = require('path')

const stage = process.env.LAMBDA_ENV

if (stage) {
  // `override: false` (por defecto) deja ganar a las variables que ya inyecto
  // serverless.yml sobre las del archivo.
  require('dotenv').config({ path: path.join(__dirname, '..', 'env', `${stage}.env`) })
}

module.exports = { stage }
