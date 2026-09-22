'use strict'

const oracle = require('./oracle')
const sql = require('./sql')

/**
 * Port de `GestionInspeccionMIILSRepository`.
 * Los nombres de los campos del resultado replican a `ConsultarInspeccionMIILSDTO`.
 */

const str = (value) => (value === null || value === undefined ? null : String(value))

/**
 * @param {object} row
 * @returns {object} DTO de inspeccion MIILS
 */
function toInspeccionDto (row) {
  return {
    idInspeccion: str(row.IDINSPECCION),
    lineaNegocio: str(row.LINEANEGOCIO),
    estadoInspeccion: str(row.ESTADOINSPECCION),
    usuarioCreador: str(row.USUARIOCREADOR),
    fechaCreacion: row.FECHA_CREACION ?? null,
    codigoProducto: str(row.CODIGOPRODUCTO),
    claveAgente: str(row.CLAVEAGENTE),
    codigoCDA: str(row.CODIGOCDA),
    motivoInspeccion: str(row.MOTIVOINSPECCION),
    tipoSelInspector: str(row.TIPOSELINSPECTOR),
    tipoPlaca: str(row.TIPOPLACA),
    placa: str(row.PLACA),
    codigoFasecolda: str(row.CODIGOFASECOLDA),
    chasis: str(row.CHASIS),
    motor: str(row.MOTOR),
    vin: str(row.VIN),
    modelo: str(row.MODELO),
    codigoColor: row.CODIGOCOLOR === null || row.CODIGOCOLOR === undefined ? 0 : Number(row.CODIGOCOLOR),
    kilometrajeVehiculo: str(row.KILOMETRAJEVEHICULO),
    codigoTipoPintura: str(row.CODIGOTIPOPINTURA),
    codigoTipoCaja: str(row.CODIGOTIPOCAJA),
    codigoTipoCarroceria: str(row.CODIGOTIPOCARROCERIA),
    codigoTipoServicio: str(row.CODIGOTIPOSERVICIO),
    codigoTipoVehiculo: str(row.CODIGOTIPOVEHICULO),
    valorVehiculo: str(row.VALORVEHICULO),
    codigoPersona: str(row.CODIGOPERSONA),
    numeroDocumento: str(row.NUMERODOCUMENTO),
    tipoDocumento: str(row.TIPODOCUMENTO),
    fechaNacimiento: row.FECHANACIMIENTO ?? null,
    tipoPersona: str(row.TIPOPERSONA),
    primerApellido: str(row.PRIMERAPELLIDO),
    segundoApellido: str(row.SEGUNDOAPELLIDO),
    primerNombre: str(row.PRIMERNOMBRE),
    segundoNombre: str(row.SEGUNDONOMBRE),
    codigoOcupacion: str(row.CODIGOOCUPACION),
    codigoEstadoCivil: str(row.CODIGOESTADOCIVIL),
    codigoGenero: str(row.CODIGOGENERO),
    fechaFinInspeccion: row.FECHAFININSPECCION ?? null
  }
}

/**
 * @param {string} idInspeccion
 * @returns {Promise<object[]>}
 */
async function consultarInspeccionMIILS (idInspeccion) {
  const rows = await oracle.query(sql.CONSULTAR_INSPECCION_MIILS, [idInspeccion])
  return rows.map(toInspeccionDto)
}

/**
 * @param {string} placa
 * @returns {Promise<object[]>}
 */
async function consultarInspeccionPorPlaca (placa) {
  const rows = await oracle.query(sql.CONSULTAR_INSPECCION_POR_PLACA, [placa])
  return rows.map(toInspeccionDto)
}

/**
 * @param {string} chasis
 * @returns {Promise<object[]>}
 */
async function consultarInspeccionPorChasis (chasis) {
  const rows = await oracle.query(sql.CONSULTAR_INSPECCION_POR_CHASIS, [chasis])
  return rows.map(toInspeccionDto)
}

/**
 * @param {string} placa
 * @param {string} chasis
 * @returns {Promise<object[]>}
 */
async function consultarInspeccionPorPlacaYChasis (placa, chasis) {
  const rows = await oracle.query(sql.CONSULTAR_INSPECCION_POR_PLACA_Y_CHASIS, [placa, chasis])
  return rows.map(toInspeccionDto)
}

/**
 * Inspecciones vigentes en MIILS para una placa (`CONSULTA_X_PLACA_MIILS`).
 * @param {string} placa
 * @returns {Promise<Array<{idInspeccion: string}>>}
 */
async function consultaPolizaProcesoIaxis (placa) {
  const rows = await oracle.query(sql.CONSULTA_X_PLACA_MIILS, [placa])
  return rows.map((row) => ({ idInspeccion: str(row.ID_INSPECCION) }))
}

/**
 * @param {string|number} sperson
 * @returns {Promise<object[]>}
 */
async function consultaContactosCliente (sperson) {
  const rows = await oracle.query(sql.CONSULTAR_CONTACTOS_CLIENTE, [sperson])
  return rows.map((row) => ({
    idContacto: str(row.IDCONTACTO),
    codigoTipoContacto: str(row.CODIGOTIPOCONTACTO),
    nombreTipoContacto: str(row.NOMBRETIPOCONTACTO),
    textoContacto: str(row.TEXTOCONTACTO)
  }))
}

/**
 * @param {string|number} sperson
 * @returns {Promise<object[]>}
 */
async function consultaDireccionesCliente (sperson) {
  const rows = await oracle.query(sql.CONSULTAR_DIRECCIONES_CLIENTE, [sperson])
  return rows.map((row) => ({
    idDireccion: str(row.IDDIRECCION),
    codigoTipoDireccion: str(row.CODIGOTIPODIRECCION),
    nombreTipoDireccion: str(row.NOMBRETIPODIRECCION),
    textoDireccion: str(row.TEXTODIRECCION),
    codigoDepartamento: str(row.CODIGODEPARTAMENTO),
    nombreDepartamento: str(row.NOMBREDEPARTAMENTO),
    codigoPais: str(row.CODIGOPAIS),
    nombrePais: str(row.NOMBREPAIS),
    codigoCiudad: str(row.CODIGOCIUDAD),
    nombreCiudad: str(row.NOMBRECIUDAD)
  }))
}

/**
 * @param {string|number} idInspeccion
 * @returns {Promise<object[]>}
 */
async function consultarAccesoriosVehiculos (idInspeccion) {
  const rows = await oracle.query(sql.CONSULTAR_ACCESORIOS_VEHICULOS, { idInspeccion })
  return rows.map((row) => ({
    idInspeccion: str(row.ID_INSPECCION),
    idAccesorio: str(row.ID_ACCESORIO),
    marca: str(row.MARCA),
    referencia: str(row.REFERENCIA),
    valor: row.VALOR === null || row.VALOR === undefined ? null : Number(row.VALOR),
    cantidad: row.CANTIDAD === null || row.CANTIDAD === undefined ? null : Number(row.CANTIDAD),
    observacion: str(row.OBSERVACION),
    original: str(row.ORIGINAL),
    asegurable: str(row.ASEGURABLE)
  }))
}

module.exports = {
  consultarInspeccionMIILS,
  consultarInspeccionPorPlaca,
  consultarInspeccionPorChasis,
  consultarInspeccionPorPlacaYChasis,
  consultaPolizaProcesoIaxis,
  consultaContactosCliente,
  consultaDireccionesCliente,
  consultarAccesoriosVehiculos
}
