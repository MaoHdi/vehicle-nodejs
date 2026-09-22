'use strict'

/**
 * Sentencias SQL portadas literalmente desde el legacy:
 *  - co.com.libertymutual.vehicleservices.sql.CrearPolizaIaxisSQL
 *  - co.com.libertymutual.vehicleservices.sql.GestionInspeccionMIILSSQL
 *  - co.com.libertymutual.vehicleservices.sql.TransaccionCrearInspeccionSQL
 *
 * Todas usan binds; no se construye SQL por concatenacion.
 */

/** Proyeccion comun de la consulta de inspecciones MIILS. */
const SELECT_INSPECCION_MIILS =
  'SELECT I.ID_INSPECCION IDINSPECCION, I.LINEA_NEGOCIO LINEANEGOCIO, ' +
  "I.ESTADO || (SELECT CASE WHEN CIA.CALIFICACION_FINAL = 1 THEN ' - ASEGURABLE' " +
  "WHEN CIA.CALIFICACION_FINAL = 2 THEN ' - RECHAZADA' ELSE '' END " +
  'FROM AXIS.MIILS_AUT_CALIFICA_INSPECCION CIA WHERE CIA.ID_INSPECCION = I.ID_INSPECCION) ESTADOINSPECCION, ' +
  'I.ID_USUARIO_CREADOR USUARIOCREADOR, I.FECHA_CREACION FECHA_CREACION, I.CODIGO_PRODUCTO CODIGOPRODUCTO, ' +
  'IA.ID_AGENTE CLAVEAGENTE, IA.ID_CDA CODIGOCDA, IA.MOTIVO_INSPECCION MOTIVOINSPECCION, ' +
  'IA.TIPO_SEL_INSPECTOR TIPOSELINSPECTOR, RI.TIPO_PLACA TIPOPLACA, RI.PLACA PLACA, ' +
  'RI.VERSION CODIGOFASECOLDA, RI.CHASIS CHASIS, RI.MOTOR MOTOR, RI.SERIE VIN, RI.ANYO MODELO, ' +
  'RI.COLOR CODIGOCOLOR, RI.KILOMETRAJE KILOMETRAJEVEHICULO, RI.TIPO_PINTURA CODIGOTIPOPINTURA, ' +
  'RI.TIPO_CAJA CODIGOTIPOCAJA, RI.TIPO_CARROCERIA CODIGOTIPOCARROCERIA, RI.TIPO_SERVICIO CODIGOTIPOSERVICIO, ' +
  'RI.TIPO_VEHICULO CODIGOTIPOVEHICULO, RI.VALOR_CLIENTE VALORVEHICULO, P.SPERSON CODIGOPERSONA, ' +
  'P.NNUMIDE NUMERODOCUMENTO, P.CTIPIDE TIPODOCUMENTO, P.FNACIMI FECHANACIMIENTO, P.CTIPPER TIPOPERSONA, ' +
  'DP.TAPELLI1 PRIMERAPELLIDO, DP.TAPELLI2 SEGUNDOAPELLIDO, DP.TNOMBRE1 PRIMERNOMBRE, DP.TNOMBRE2 SEGUNDONOMBRE, ' +
  'DP.COCUPACION CODIGOOCUPACION, DP.CESTCIV CODIGOESTADOCIVIL, P.CSEXPER CODIGOGENERO, ' +
  '(SELECT CIA.FECHA_FIN_INSPECCION FROM MIILS_AUT_CALIFICA_INSPECCION CIA WHERE CIA.ID_INSPECCION = I.ID_INSPECCION) FECHAFININSPECCION ' +
  'FROM MIILS_INSPECCION I INNER JOIN MIILS_AUT_INSPECCION IA ON (I.ID_INSPECCION=IA.ID_INSPECCION) ' +
  'INNER JOIN MIILS_AUT_RIESGO RI ON (I.ID_INSPECCION=RI.ID_INSPECCION) ' +
  'INNER JOIN PER_PERSONAS P ON (I.ID_CLIENTE=P.SPERSON) ' +
  'INNER JOIN PER_DETPER DP ON (P.SPERSON=DP.SPERSON)'

module.exports = {
  // --- CrearPolizaIaxisSQL -------------------------------------------------
  CONSULTA_X_PLACA_MIILS:
    'select i.id_inspeccion, i.linea_negocio, i.estado from miils_inspeccion i ' +
    'inner join miils_aut_inspeccion ia on (i.id_inspeccion=ia.id_inspeccion) ' +
    'where i.id_inspeccion in ( select id_inspeccion from miils_aut_riesgo where placa = ?) ' +
    "and i.estado not in ('CANCELADA','FINALIZADA') AND (i.fecha_creacion + 31) > sysdate " +
    'AND ia.motivo_inspeccion > 6 AND ia.motivo_inspeccion <> 16 order by i.id_inspeccion desc',

  CONSULTA_VEHICULO_RESTRINGIDO:
    'SELECT SMATRICLRE, CMATRIC, CODMOTOR, CCHASIS, NBASTID, CCLALIS, CTIPLIS, ' +
    "TO_DATE(FINCLUS, 'DD/MM/YYYY') AS FINCLUS, TO_DATE(FEXCLUS, 'DD/MM/YYYY') AS FEXCLUS, CINCLUS, CEXCLUS " +
    'FROM AXIS.LRE_AUTOS WHERE FEXCLUS IS NULL AND ((((CMATRIC = ?) OR (CODMOTOR = ?)) OR (CCHASIS = ?)) OR (NBASTID = ?))',

  CONSULTA_PERSONA_RESTRINGIDA:
    'select ctipide tipodocumento, nnumide numerodocumento, CCLALIS claselista, ctiplis tipolista, ' +
    "TO_DATE(FINCLUS, 'DD/MM/YYYY') fechainclusion, TO_DATE(FEXCLUS, 'DD/MM/YYYY') fechaexclusion, " +
    'CINCLUS motivoinclusion, CEXCLUS motivoexclusion from lre_personas ' +
    'where (FEXCLUS is null OR (FEXCLUS > (select sysdate from dual))) and ctipide = ? and nnumide = ?',

  CONSULTA_POLIZA_IAXIS:
    'SELECT S.NPOLIZA, S.NCERTIF, S.NSUPLEM, ms.nmovimi, S.SSEGURO, S.CMODALI, S.CCOLECT, S.CTIPSEG, ' +
    'S.CASEGUR, S.CAGENTE, S.CRAMO FROM SEGUROS S INNER JOIN MOVSEGURO MS ON (S.SSEGURO=MS.SSEGURO) ' +
    'WHERE S.NPOLIZA = ? and ms.nmovimi = ?',

  CONSULTA_POLIZA_PROCESO_IAXIS: 'SELECT proceso FROM MIG_SEGUROS where npoliza = ?',

  CONSULTA_RECIBO_IAXIS: 'SELECT NRECIBO, SSEGURO, NMOVIMI FROM RECIBOS where nrecibo = ?',

  // --- GestionInspeccionMIILSSQL ------------------------------------------
  CONSULTAR_INSPECCION_MIILS: `${SELECT_INSPECCION_MIILS} where i.id_inspeccion = ?`,

  CONSULTAR_INSPECCION_POR_PLACA:
    `SELECT * FROM (${SELECT_INSPECCION_MIILS} WHERE UPPER(RI.PLACA) = UPPER(?) ORDER BY I.ID_INSPECCION DESC) WHERE ROWNUM = 1`,

  CONSULTAR_INSPECCION_POR_CHASIS:
    `SELECT * FROM (${SELECT_INSPECCION_MIILS} WHERE UPPER(RI.CHASIS) = UPPER(?) ORDER BY I.ID_INSPECCION DESC) WHERE ROWNUM = 1`,

  CONSULTAR_INSPECCION_POR_PLACA_Y_CHASIS:
    `SELECT * FROM (${SELECT_INSPECCION_MIILS} WHERE UPPER(RI.PLACA) = UPPER(?) AND UPPER(RI.CHASIS) = UPPER(?) ` +
    'ORDER BY I.ID_INSPECCION DESC) WHERE ROWNUM = 1',

  CONSULTAR_CONTACTOS_CLIENTE:
    'select pc.cmodcon idContacto, pc.ctipcon codigoTipoContacto, ' +
    '(select dv.tatribu from detvalores dv where dv.cvalor=15 and dv.cidioma=8 and dv.catribu = pc.ctipcon) as nombreTipoContacto, ' +
    'pc.tvalcon textoContacto from per_contactos pc where pc.ctipcon in (1,3,6) and pc.sperson=?',

  CONSULTAR_DIRECCIONES_CLIENTE:
    'select pd.cdomici idDireccion, pd.ctipdir codigoTipoDireccion, ' +
    '(select dv.tatribu from detvalores dv where dv.cvalor=191 and dv.cidioma=8 and dv.catribu = pd.ctipdir) as nombreTipoDireccion, ' +
    'pd.tdomici textoDireccion, pd.cprovin codigoDepartamento, ' +
    '(select prv.tprovin from provincias prv inner join paises ps on (prv.cpais=ps.cpais) where prv.cprovin = pd.cprovin) nombreDepartamento, ' +
    '(select prv.cpais from provincias prv inner join paises ps on (prv.cpais=ps.cpais) where prv.cprovin = pd.cprovin) codigoPais, ' +
    '(select ps.tpais from provincias prv inner join paises ps on (prv.cpais=ps.cpais) where prv.cprovin = pd.cprovin) nombrePais, ' +
    'pd.cpoblac codigoCiudad, ' +
    '(select p.tpoblac from poblaciones p where p.cprovin = pd.cprovin and p.cpoblac = pd.cpoblac) nombreCiudad ' +
    'from per_direcciones pd where pd.sperson =?',

  CONSULTAR_ACCESORIOS_VEHICULOS:
    'SELECT ID_INSPECCION, ID_ACCESORIO, MARCA, REFERENCIA, VALOR, CANTIDAD, OBSERVACION, ' +
    "CASE WHEN ORIGINAL = 'SI' THEN 3 ELSE 4 END ORIGINAL, ASEGURABLE FROM MIILS_AUT_ACC WHERE (ID_INSPECCION = :idInspeccion)",

  INSERT_AUDIT_SERVICES_WEB:
    'INSERT INTO axis.audit_services_web (ID_TX, CINTERF, FINIINTERF, REQUESTJSON, RESPONSEJSON, FFININTERF, TIMESTAMPPROCESPETICION) ' +
    'VALUES (AUDIT_SERVICES_WEB_SEQ.NEXTVAL, ?, SYSDATE, ?, ?, SYSDATE, SYSDATE)',

  // --- TransaccionCrearInspeccionSQL --------------------------------------
  CONSULTAR_PERSONA: 'SELECT max(sperson) sperson FROM PER_PERSONAS where nnumide = :nnumide and ctipide = :ctipide',
  SP_CREA_INSPECCION: 'P_MIILS_CREA_INSPECCION_EXT',

  // --- UtilDAO -------------------------------------------------------------
  CONSULTAR_PERSONA_IAXIS: 'SELECT MAX(SPERSON) SPERSON FROM PER_PERSONAS WHERE CTIPIDE=? AND NNUMIDE=?',

  CONSULTAR_FASECOLDA_VERSION:
    'SELECT V.CVERSION, NCILIND, NPLAZAS, CVEHCAJ, CORIGEN, NTARA, CMOTOR, CSERVICIO, ' +
    '(SELECT VA.VCOMERCIAL FROM AUT_VERSIONES_ANYO VA WHERE V.CVERSION=VA.CVERSION AND ANYO = ?) VALORNUEVO ' +
    'FROM AUT_VERSIONES v where v.cversion = ?',

  CONSULTAR_EMPRESA_CONTEXTO: 'SELECT VALOR_PARAMETRO FROM MIILS_PARAMETROS WHERE ID_TABLA = 53 AND ID_PARAMETRO=1',

  // --- Procedimientos de carga de poliza -----------------------------------
  SP_CARGA_UNQORK_AUTOS: 'PAC_CARGA_UNQORK_AUTOS.P_CARGA_UNQORK_AUTOS',
  SP_CARGA_EXPRESS: 'pac_servicios_express.p_carga_express',
  SP_ALTA_PERSONA: 'P_UNQORK_ALTA_PERSONA',

  TYPE_ALTAPOLIZARECTYPE: 'ALTAPOLIZARECTYPE',
  TYPE_ALTAPOLIZARECTYPETAB: 'ALTAPOLIZARECTYPETAB'
}
