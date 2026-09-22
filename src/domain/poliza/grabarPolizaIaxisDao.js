'use strict'

const oracle = require('../../infrastructure/db/oracle')
const sqlStatements = require('../../infrastructure/db/sql')
const utilRepository = require('../../infrastructure/db/utilRepository')
const logger = require('../../shared/logger')
const { asArray } = require('./registroAlta')
const { construirRegistrosAuto } = require('./builders/registroAltaAuto')
const { construirRegistrosHome } = require('./builders/registroAltaHome')
const { construirRegistrosEBonds } = require('./builders/registroAltaEBonds')

const { oracledb } = oracle

/**
 * Port de `GrabarPolizaIAXISDAO`.
 *
 * Arma el arreglo Oracle `ALTAPOLIZARECTYPETAB` y ejecuta el procedimiento de carga
 * correspondiente al tipo de poliza. Devuelve el numero de proceso de cargue como
 * texto o un mensaje `ERROR - ...`, igual que el legacy.
 */

/**
 * Convierte los registros posicionales en objetos `ALTAPOLIZARECTYPE`.
 *
 * Los nombres de los atributos se leen del diccionario de la base (el legacy usaba
 * `StructDescriptor`), de modo que el mapeo posicion -> atributo siempre coincide
 * con la definicion vigente del tipo.
 *
 * @param {import('oracledb').Connection} connection
 * @param {Array<Array>} registros
 * @param {number} [contadorInicial]
 * @returns {Promise<object>} instancia de `ALTAPOLIZARECTYPETAB`
 */
async function construirArregloOracle (connection, registros, contadorInicial = 1) {
  const RecordClass = await connection.getDbObjectClass(sqlStatements.TYPE_ALTAPOLIZARECTYPE)
  const TableClass = await connection.getDbObjectClass(sqlStatements.TYPE_ALTAPOLIZARECTYPETAB)
  const atributos = Object.keys(RecordClass.prototype.attributes)

  let contador = contadorInicial
  const estructuras = registros.map((campos) => {
    // Posicion 1 del registro: consecutivo dentro del lote (ver el legacy).
    const valores = [...campos]
    valores[1] = contador++

    const registro = {}
    atributos.forEach((atributo, indice) => {
      registro[atributo] = valores[indice] === undefined ? null : valores[indice]
    })
    return new RecordClass(registro)
  })

  return new TableClass(estructuras)
}

/**
 * Ejecuta el procedimiento de carga con el arreglo de registros.
 *
 * @param {import('oracledb').Connection} connection
 * @param {string} procedimiento nombre del procedimiento almacenado
 * @param {object} arreglo instancia de `ALTAPOLIZARECTYPETAB`
 * @param {string} operacion nombre del metodo para los mensajes de error
 * @returns {Promise<string>}
 */
async function ejecutarCarga (connection, procedimiento, arreglo, operacion) {
  try {
    const result = await connection.execute(
      `BEGIN ${procedimiento}(:registros, :pnproces, :pnerror); END;`,
      {
        registros: arreglo,
        pnproces: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
        pnerror: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
      },
      { autoCommit: true }
    )

    const proceso = result.outBinds.pnproces
    if (proceso > 0) return String(proceso)

    logger.error('El procedimiento de carga no devolvio numero de proceso', {
      procedimiento,
      pnerror: result.outBinds.pnerror
    })
    return `ERROR - ${operacion} -- pstmt.execute()--`
  } catch (error) {
    logger.error('Error ejecutando el procedimiento de carga', { procedimiento, error: error.message })
    return `ERROR - GrabarPolizaIAXISDAO.${operacion}: Ejecutando ${procedimiento}`
  }
}

/**
 * Port de `grabarPolizaIAXISAuto`.
 * @param {object} datosPolizaAuto
 * @param {object} producto
 * @returns {Promise<string>}
 */
async function grabarPolizaIAXISAuto (datosPolizaAuto, producto) {
  try {
    let version = null
    try {
      version = await utilRepository.consultarFasecoldaVersion(
        datosPolizaAuto?.vehiculo?.identificacion?.codigoFasecolda,
        datosPolizaAuto?.vehiculo?.identificacion?.modelo
      )
    } catch (error) {
      logger.error('Error consultando la version FASECOLDA', { error: error.message })
    }

    const collector = construirRegistrosAuto(datosPolizaAuto, producto, version)
    if (collector.tieneErrores()) {
      return (
        'ERROR - GrabarPolizaIAXISDAO.construirObjetoOraclePolizaAuto, se encontraron los siguientes errores: ' +
        collector.errores
      )
    }

    return await oracle.withConnection(async (connection) => {
      const arreglo = await construirArregloOracle(connection, collector.registros)
      return ejecutarCarga(connection, sqlStatements.SP_CARGA_UNQORK_AUTOS, arreglo, 'grabarPolizaIAXISAuto')
    })
  } catch (error) {
    logger.error('Error general en grabarPolizaIAXISAuto', { error: error.message })
    return 'ERROR - General en GrabarPolizaIAXISDAO.grabarPolizaIAXISAuto'
  }
}

/**
 * Port de `grabarPolizaIAXISHome`. Los registros de todas las viviendas se acumulan
 * en un unico arreglo, con un consecutivo continuo (`contadorRegHome` del legacy).
 *
 * @param {object[]} datosPolizaHomeList
 * @param {object} producto
 * @returns {Promise<string>}
 */
async function grabarPolizaIAXISHome (datosPolizaHomeList, producto) {
  try {
    const registros = []
    for (const datosPolizaHome of asArray(datosPolizaHomeList)) {
      const collector = construirRegistrosHome(datosPolizaHome, producto)
      if (collector.tieneErrores()) {
        return (
          'ERROR - GrabarPolizaIAXISDAO.construirObjetoOraclePolizaHome, se encontraron los siguientes errores: ' +
          collector.errores
        )
      }
      registros.push(...collector.registros)
    }

    return await oracle.withConnection(async (connection) => {
      const arreglo = await construirArregloOracle(connection, registros)
      return ejecutarCarga(connection, sqlStatements.SP_CARGA_EXPRESS, arreglo, 'grabarPolizaIAXISHome')
    })
  } catch (error) {
    logger.error('Error general en grabarPolizaIAXISHome', { error: error.message })
    return 'ERROR - General en GrabarPolizaIAXISDAO.grabarPolizaIAXISHome'
  }
}

/**
 * Port de `grabarPolizaIAXISEBonds`.
 * @param {object} datosPolizaCumplimiento
 * @param {object} producto
 * @returns {Promise<string>}
 */
async function grabarPolizaIAXISEBonds (datosPolizaCumplimiento, producto) {
  try {
    const collector = construirRegistrosEBonds(datosPolizaCumplimiento, producto)
    if (collector.tieneErrores()) {
      return (
        'ERROR - GrabarPolizaIAXISDAO.construirObjetoOraclePolizaEBonds, se encontraron los siguientes errores: ' +
        collector.errores
      )
    }

    return await oracle.withConnection(async (connection) => {
      const arreglo = await construirArregloOracle(connection, collector.registros)
      return ejecutarCarga(connection, sqlStatements.SP_CARGA_EXPRESS, arreglo, 'grabarPolizaIAXISEBonds')
    })
  } catch (error) {
    logger.error('Error general en grabarPolizaIAXISEBonds', { error: error.message })
    return 'ERROR - General en GrabarPolizaIAXISDAO.grabarPolizaIAXISEBonds'
  }
}

module.exports = {
  grabarPolizaIAXISAuto,
  grabarPolizaIAXISHome,
  grabarPolizaIAXISEBonds,
  construirArregloOracle
}
