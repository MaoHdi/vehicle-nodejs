'use strict'

const oracle = require('./oracle')
const sql = require('./sql')
const logger = require('../../shared/logger')
const { toDate } = require('../../shared/dates')

const { oracledb } = oracle

/**
 * Port de `co.com.libertymutual.vehicleservices.callOut.db.dao.UtilDAO` y de
 * `GenericDAO.contextualizarProcedimientoAlmacenado`.
 */

/**
 * Inicializa el contexto de iAxis para la sesion (equivalente a
 * `GenericDAO.contextualizarProcedimientoAlmacenado`).
 * @param {import('oracledb').Connection} connection
 */
async function contextualizarProcedimientoAlmacenado (connection) {
  let codigoEmpresa = '12' // Colombia, valor por defecto del legacy
  try {
    const result = await connection.execute(sql.CONSULTAR_EMPRESA_CONTEXTO)
    if (result.rows && result.rows.length > 0) {
      const value = Object.values(result.rows[0])[0]
      if (value !== null && value !== undefined) codigoEmpresa = String(value)
    }
  } catch (error) {
    logger.error('No fue posible leer el codigo de empresa del contexto', { error: error.message })
  }

  try {
    await connection.execute(
      'select pac_contexto.f_inicializarctx(pac_parametros.f_parempresa_t(:empresa, :usuario)) from dual',
      { empresa: Number(codigoEmpresa), usuario: 'USER_BBDD' }
    )
  } catch (error) {
    logger.error('No fue posible inicializar el contexto iAxis', { error: error.message })
  }
}

/**
 * `UtilDAO.consultarPersonaIAXIS`.
 * @param {number|string} tipoDocumento
 * @param {string} numeroDocumento
 * @returns {Promise<string|null>} sperson o `null` si la persona no existe
 */
async function consultarPersonaIAXIS (tipoDocumento, numeroDocumento) {
  try {
    const rows = await oracle.query(sql.CONSULTAR_PERSONA_IAXIS, [
      Number(tipoDocumento),
      String(numeroDocumento).trim()
    ])
    const value = rows.length > 0 ? rows[0].SPERSON : null
    return value === null || value === undefined ? null : String(value)
  } catch (error) {
    logger.error('Error consultando persona en iAxis', { error: error.message })
    return null
  }
}

/**
 * `UtilDAO.consultarFASECOLDAVersion`.
 * @param {string} version codigo FASECOLDA
 * @param {number|string} modelo
 * @returns {Promise<object|null>} VehiculoVersionDTO o `null`
 */
async function consultarFasecoldaVersion (version, modelo) {
  try {
    const rows = await oracle.query(sql.CONSULTAR_FASECOLDA_VERSION, [Number(modelo), String(version)])
    if (rows.length === 0) return null
    const row = rows[0]
    const int = (value) => (value === null || value === undefined ? 0 : Number(value))
    return {
      cilindraje: int(row.NCILIND),
      ocupantes: int(row.NPLAZAS),
      caja: int(row.CVEHCAJ),
      origen: int(row.CORIGEN),
      peso: int(row.NTARA),
      servicio: int(row.CSERVICIO),
      tipoCombustible: int(row.CMOTOR),
      valorNuevo: int(row.VALORNUEVO)
    }
  } catch (error) {
    logger.error('Error consultando la version FASECOLDA', { error: error.message })
    return null
  }
}

/**
 * `UtilDAO.altaRapidaPersonaIAXIS`: crea la persona en iAxis via `P_UNQORK_ALTA_PERSONA`.
 *
 * El procedimiento recibe 31 parametros posicionales; se respetan exactamente las
 * posiciones y los valores por defecto del legacy.
 *
 * @param {object} persona PersonaInspeccion del request
 * @returns {Promise<string>} sperson creado, o texto de error (igual que el legacy)
 */
async function altaRapidaPersonaIAXIS (persona) {
  const tipoPersona = String(persona?.tipoPersona?.codigo ?? '')
  if (tipoPersona !== '1' && tipoPersona !== '2') {
    return `ERROR - Tipo persona no valido para inspeccion en MIILS:${tipoPersona}`
  }

  const natural = persona.personaNatural || {}
  const esNatural = tipoPersona === '1'

  const binds = {
    p1: null, // psseguro
    p2: null, // psperson
    p3: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }, // pspersonout
    p4: null, // pspereal
    p5: null, // pcagente
    p6: Number(tipoPersona), // ctipper
    p7: Number(persona?.tipoDocumento?.codigo), // ctipide
    p8: persona.numeroDocumento ?? null, // nnumide
    p9: esNatural && natural.genero?.codigo != null ? Number(natural.genero.codigo) : null, // csexper
    p10: esNatural ? toDate(natural.fechaNacimiento) : null, // fnacimi
    p11: null, // snip
    p12: 0, // cestper
    p13: null, // fjubila
    p14: null, // cmutualista
    p15: null, // fdefunc
    p16: null, // nordide
    p17: 8, // cidioma
    p18: esNatural ? natural.primerApellido ?? null : null, // tapelli1
    p19: esNatural ? natural.segundoApellido ?? null : null, // tapelli2
    p20: null, // tnombre
    p21: null, // tsiglas
    p22: null, // cprofes
    p23: esNatural && natural.estadoCivil?.codigo != null ? Number(natural.estadoCivil.codigo) : null, // pCESTCIV
    p24: 170, // cpais
    p25: 0, // pswpubli
    p26: null, // pduplicada
    p27: esNatural ? natural.primerNombre ?? null : null, // ptnombre1
    p28: esNatural ? natural.segundoNombre ?? null : null, // ptnombre2
    p29: null, // pswrut
    p30: esNatural && natural.ocupacion?.codigo != null ? Number(natural.ocupacion.codigo) : null, // pcocupacion
    p31: { dir: oracledb.BIND_OUT, type: oracledb.DB_TYPE_OBJECT, typeName: 'AXIS.T_IAX_MENSAJES' } // mensajes
  }

  const placeholders = Object.keys(binds)
    .map((key) => `:${key}`)
    .join(', ')

  try {
    return await oracle.withConnection(async (connection) => {
      await contextualizarProcedimientoAlmacenado(connection)
      const result = await connection.execute(`BEGIN ${sql.SP_ALTA_PERSONA}(${placeholders}); END;`, binds, {
        autoCommit: true
      })
      return String(result.outBinds.p3)
    })
  } catch (error) {
    logger.error('Error en el alta rapida de persona en iAxis', { error: error.message })
    return 'ERROR - General en UtilDAO.altaRapidaPersonaIAXIS'
  }
}

module.exports = {
  contextualizarProcedimientoAlmacenado,
  consultarPersonaIAXIS,
  consultarFasecoldaVersion,
  altaRapidaPersonaIAXIS
}
