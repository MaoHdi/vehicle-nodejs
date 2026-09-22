'use strict'

const logger = require('../../shared/logger')
const { msg, COMMON } = require('../../config/properties')
const { formatFechaInspeccion, toDate } = require('../../shared/dates')
const { InspeccionExtendida } = require('./inspeccionExtendida')
const messages = require('./inspeccionMessages')
const transaccionCrearInspeccionService = require('./transaccionCrearInspeccionService')
const consultarSiniestrosService = require('./consultarSiniestrosService')
const inspeccionRepository = require('../../infrastructure/db/inspeccionRepository')
const polizaRepository = require('../../infrastructure/db/polizaRepository')
const utilRepository = require('../../infrastructure/db/utilRepository')
const mediatorConverter = require('../../infrastructure/soap/mediatorInspeccionConverter')
const { EXTERNAL_SERVICES, execute: soapExecute } = require('../../infrastructure/soap/soapClient')

/**
 * Port de `co.com.libertymutual.vehicleservices.service.GestionInspeccionMIILSService`.
 *
 * Diferencias respecto del legacy:
 *  - la deteccion de "formato directo" se hace sobre el modelo ya deserializado en
 *    lugar de buscar etiquetas en el texto XML; asi la misma logica sirve para el
 *    canal REST y para el SOAP;
 *  - el estado de la invocacion (`operation`, `consultaSiniestros`) vive en un
 *    contexto local y no en campos de instancia compartidos.
 *
 * Todas las reglas de negocio, codigos de estado y textos se conservan.
 */

// ---------------------------------------------------------------------------
// Utilidades equivalentes a los helpers privados del servicio Java
// ---------------------------------------------------------------------------

const hasText = (value) => value !== null && value !== undefined && String(value).trim() !== ''
const defaultIfNull = (value, fallback = COMMON.NULL_TEXT) => (value !== null && value !== undefined ? value : fallback)

/** Port de `elementoCodificado(String codigo)`. */
function elementoCodificado (codigo) {
  const elemento = { codigo: COMMON.NULL_TEXT }
  if (codigo !== null && codigo !== undefined && String(codigo) !== '0') elemento.codigo = String(codigo)
  return elemento
}

/** Port de `elementoCodificado(String codigo, String nombre)`. */
function elementoCodificadoConNombre (codigo, nombre) {
  const elemento = { codigo: COMMON.NULL_TEXT, nombre: COMMON.NULL_TEXT }
  if (codigo !== null && codigo !== undefined) elemento.codigo = String(codigo)
  if (nombre !== null && nombre !== undefined) elemento.nombre = String(nombre)
  return elemento
}

/** Port de `elementoCodificadoNumerico(long codigo)`. */
const elementoCodificadoNumerico = (codigo) => ({ codigo })

const pad2 = (n) => (n < 10 ? `0${n}` : `${n}`)

/**
 * Representacion `xsd:dateTime` equivalente a la que produce
 * `DatatypeFactory.newXMLGregorianCalendar(GregorianCalendar)`.
 * @param {Date|string|null} value
 * @returns {string|null}
 */
function toXmlGregorian (value) {
  const date = toDate(value)
  if (!date) return null
  const offsetMinutes = -date.getTimezoneOffset()
  const sign = offsetMinutes >= 0 ? '+' : '-'
  const abs = Math.abs(offsetMinutes)
  return (
    `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}` +
    `T${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}` +
    `${sign}${pad2(Math.floor(abs / 60))}:${pad2(abs % 60)}`
  )
}

// ---------------------------------------------------------------------------
// Deteccion de formato y construccion del request
// ---------------------------------------------------------------------------

/**
 * Formato directo: la placa/chasis viajan como texto dentro de `inspeccion`,
 * sin `datosInspeccionAuto/vehiculo`.
 * @param {object} inspeccion
 * @returns {boolean}
 */
function esFormatoDirecto (inspeccion) {
  if (!inspeccion || inspeccion.datosInspeccionAuto) return false
  return typeof inspeccion.placa === 'string' || typeof inspeccion.chasis === 'string'
}

/**
 * Port de `procesarInspeccionConFormatoFlexible`.
 * @param {object} rq
 * @returns {InspeccionExtendida}
 */
function construirInspeccionExtendida (rq) {
  const inspeccion = rq?.solicitud?.inspeccion || {}

  if (esFormatoDirecto(inspeccion)) {
    logger.info('Formato de inspeccion detectado: DIRECTO')
    const base = {}
    if (hasText(inspeccion.idInspeccion)) {
      const id = String(inspeccion.idInspeccion).trim()
      if (!Number.isNaN(Number(id))) base.idInspeccion = id
      else logger.warn('ID de inspeccion invalido en formato directo')
    }
    const extendida = new InspeccionExtendida(base)
    if (hasText(inspeccion.placa)) extendida.placaDirecta = String(inspeccion.placa).trim()
    if (hasText(inspeccion.chasis)) extendida.chasisDirecto = String(inspeccion.chasis).trim()
    return extendida
  }

  logger.info('Formato de inspeccion detectado: TRADICIONAL')
  return new InspeccionExtendida(inspeccion)
}

/**
 * Port de `convertirFormatoDirectoATradicional`.
 * @param {InspeccionExtendida} extendida
 * @param {object} rqOriginal
 * @returns {object} request canonico equivalente al tradicional
 */
function convertirFormatoDirectoATradicional (extendida, rqOriginal) {
  let requestId = rqOriginal?.infoRequest?.requestID
  if (!hasText(requestId)) {
    requestId = `DIRECT_FORMAT_${Date.now()}`
    logger.info('No se encontro requestID en la solicitud original, se genera uno nuevo')
  }

  const vehiculo = {}
  if (extendida.getPlaca() !== null) vehiculo.placa = { placa: extendida.getPlaca() }
  if (extendida.getChasis() !== null) vehiculo.chasis = extendida.getChasis()

  const inspeccion = { datosInspeccionAuto: { vehiculo } }
  if (extendida.inspeccion?.idInspeccion !== undefined && extendida.inspeccion?.idInspeccion !== null) {
    inspeccion.idInspeccion = extendida.inspeccion.idInspeccion
  }

  return {
    infoRequest: { requestID: requestId },
    solicitud: {
      operacion: COMMON.TYPE_CONSULTAR,
      lineaNegocio: msg('lineanegocio_autos'),
      consultaSiniestros: rqOriginal?.solicitud?.consultaSiniestros,
      usuario: rqOriginal?.solicitud?.usuario,
      inspeccion
    }
  }
}

// ---------------------------------------------------------------------------
// Consultas de apoyo
// ---------------------------------------------------------------------------

/** Port de `consultarInspeccionMIILS`. */
async function consultarInspeccionMIILS (idInspeccion) {
  const filas = await inspeccionRepository.consultarInspeccionMIILS(String(idInspeccion))
  for (const fila of filas) {
    if (hasText(fila.idInspeccion)) return fila
  }
  return {}
}

/** Port de `consultarVehiculoRestringido`. */
async function consultarVehiculoRestringido (datosVehiculo) {
  const restringidos = await polizaRepository.consultaVehiculoRestringido(
    datosVehiculo?.placa?.placa ?? null,
    datosVehiculo?.motor ?? null,
    datosVehiculo?.chasis ?? null,
    datosVehiculo?.vin ?? null
  )
  return restringidos.some((vehiculo) => hasText(vehiculo.smatriclre))
}

/** Port de `consultarConductorRestringido`. */
async function consultarConductorRestringido (datosInsAuto) {
  const persona = datosInsAuto?.clienteInspeccion
  if (!persona) {
    logger.warn('DatosInspeccionAuto o ClienteInspeccion es null en consultarConductorRestringido')
    return null
  }
  if (persona.tipoDocumento?.codigo === undefined || persona.tipoDocumento?.codigo === null || !persona.numeroDocumento) {
    logger.warn('TipoDocumento, codigo o numeroDocumento es null en consultarConductorRestringido')
    return null
  }

  const restringidas = await polizaRepository.consultaPersonaRestringida(
    String(persona.tipoDocumento.codigo),
    persona.numeroDocumento
  )
  if (restringidas.length === 0) {
    logger.info('No se encontro conductor restringido')
    return null
  }
  return restringidas[0].numerodocumento
}

/** Port de `consultaXPlacaMIILS`. */
async function consultaXPlacaMIILS (placa) {
  const inspecciones = await inspeccionRepository.consultaPolizaProcesoIaxis(placa)
  if (inspecciones.length === 0) {
    logger.info('No se encontro IdInspeccion vigente para la placa')
    return null
  }
  return inspecciones[0].idInspeccion
}

/** Port de `consultarVehiculoRestringidoFlexible`. */
function datosVehiculoDesdeExtendida (extendida) {
  const datosVehiculo = {}
  if (extendida.getPlaca() !== null) datosVehiculo.placa = { placa: extendida.getPlaca() }

  const originales = extendida.inspeccion?.datosInspeccionAuto?.vehiculo
  if (originales) {
    datosVehiculo.motor = originales.motor
    datosVehiculo.chasis = extendida.getChasis() !== null ? extendida.getChasis() : originales.chasis
    datosVehiculo.vin = originales.vin
  } else {
    datosVehiculo.chasis = extendida.getChasis()
  }
  return datosVehiculo
}

// ---------------------------------------------------------------------------
// Construccion de la respuesta
// ---------------------------------------------------------------------------

/** Port de `personaNatural`. */
function personaNatural (inspeccionMIILS) {
  return {
    primerApellido: inspeccionMIILS.primerApellido,
    primerNombre: inspeccionMIILS.primerNombre,
    segundoApellido: inspeccionMIILS.segundoApellido,
    segundoNombre: inspeccionMIILS.segundoNombre,
    genero: elementoCodificado(inspeccionMIILS.codigoGenero),
    fechaNacimiento: toXmlGregorian(inspeccionMIILS.fechaNacimiento),
    estadoCivil: elementoCodificado(inspeccionMIILS.codigoEstadoCivil),
    ocupacion: elementoCodificado(inspeccionMIILS.codigoOcupacion)
  }
}

/** Port de `contactoCliente`. */
async function contactoCliente (codigoPersona, personaInsp, datosInsAuto) {
  if (codigoPersona === null || codigoPersona === undefined) return
  const contactos = await inspeccionRepository.consultaContactosCliente(codigoPersona)
  if (contactos.length === 0) return

  for (const contacto of contactos) {
    personaInsp.contacto.push({
      idContacto: contacto.idContacto,
      tipoContacto: elementoCodificadoConNombre(contacto.codigoTipoContacto, contacto.nombreTipoContacto),
      textoContacto: contacto.textoContacto
    })
  }
  datosInsAuto.clienteInspeccion = personaInsp
}

/** Port de `direccionCliente`. */
async function direccionCliente (personaInsp) {
  if (!personaInsp) return
  const direcciones = await inspeccionRepository.consultaDireccionesCliente(personaInsp.codigoPersona)
  if (direcciones.length === 0) return

  for (const direccion of direcciones) {
    personaInsp.direccion.push({
      idDireccion: direccion.idDireccion,
      pais: elementoCodificadoConNombre(direccion.codigoPais, direccion.nombrePais),
      departamento: elementoCodificadoConNombre(direccion.codigoDepartamento, direccion.nombreDepartamento),
      ciudad: elementoCodificadoConNombre(direccion.codigoCiudad, direccion.nombreCiudad),
      tipoDireccion: elementoCodificadoConNombre(direccion.codigoTipoDireccion, direccion.nombreTipoDireccion),
      textoDireccion: direccion.textoDireccion
    })
  }
  logger.info('Direcciones del cliente agregadas', { total: personaInsp.direccion.length })
}

/** Port de `datosVehiculo` + helpers `crearPlaca`, `setDatosBasicosVehiculo`, etc. */
async function datosVehiculo (inspeccionMIILS, datosInsAuto, context) {
  const accesorios = await inspeccionRepository.consultarAccesoriosVehiculos(inspeccionMIILS.idInspeccion)

  const vehiculo = {
    placa: {
      placa: inspeccionMIILS.placa,
      tipoPlaca: elementoCodificado(inspeccionMIILS.tipoPlaca)
    }
  }

  // Port de `inicializarConsultaSiniestros`
  if (vehiculo.placa.placa && context.consultaSiniestros === true && context.operation === COMMON.TYPE_CONSULTAR) {
    vehiculo.consultaSiniestros = await consultarSiniestrosService.procesar(vehiculo.placa.placa)
  } else {
    logger.info(COMMON.FASECOLDA_DEFAULT)
  }

  vehiculo.codigoFasecolda = defaultIfNull(inspeccionMIILS.codigoFasecolda)
  vehiculo.chasis = defaultIfNull(inspeccionMIILS.chasis)
  vehiculo.motor = defaultIfNull(inspeccionMIILS.motor)
  vehiculo.vin = defaultIfNull(inspeccionMIILS.vin)
  vehiculo.modelo = defaultIfNull(inspeccionMIILS.modelo)

  if (inspeccionMIILS.valorVehiculo !== null && inspeccionMIILS.valorVehiculo !== undefined) {
    vehiculo.valor = inspeccionMIILS.valorVehiculo
  }

  if (accesorios.length > 0) {
    vehiculo.accesorio = accesorios.map((accesorio) => ({
      tipo: { codigo: accesorio.original },
      marca: defaultIfNull(accesorio.marca, ''),
      valor: accesorio.valor === null ? null : Math.trunc(accesorio.valor),
      descripcion: { codigo: accesorio.idAccesorio }
    }))
    vehiculo.color = {}
  }

  vehiculo.tipoPintura = elementoCodificado(inspeccionMIILS.codigoTipoPintura)
  vehiculo.tipoCaja = elementoCodificado(inspeccionMIILS.codigoTipoCaja)
  vehiculo.tipoCarroceria = elementoCodificado(inspeccionMIILS.codigoTipoCarroceria)
  vehiculo.tipoServicio = elementoCodificado(inspeccionMIILS.codigoTipoServicio)
  vehiculo.tipoVehiculo = elementoCodificado(inspeccionMIILS.codigoTipoVehiculo)
  vehiculo.color = elementoCodificadoNumerico(inspeccionMIILS.codigoColor)

  datosInsAuto.vehiculo = vehiculo

  context.consultaSiniestros = null
  context.operation = null
}

/** Port de `armarRespuesta` (flujo CREAR). */
async function armarRespuesta (rs, rq, inspeccionMIILS, context) {
  messages.responseInfoSuccesfull(rs, rq)

  const ins = {
    tipoSeleccionInspector: inspeccionMIILS.tipoSelInspector,
    estadoInspeccion: inspeccionMIILS.estadoInspeccion
  }
  if (inspeccionMIILS.idInspeccion !== null && inspeccionMIILS.idInspeccion !== undefined) {
    ins.idInspeccion = inspeccionMIILS.idInspeccion
  }

  const datosInsAuto = rq.solicitud.inspeccion.datosInspeccionAuto
  datosInsAuto.usuarioCreador = inspeccionMIILS.usuarioCreador
  if (inspeccionMIILS.claveAgente !== null && inspeccionMIILS.claveAgente !== undefined) {
    datosInsAuto.claveAgente = inspeccionMIILS.claveAgente
  }
  datosInsAuto.fechaCreacion = inspeccionMIILS.fechaCreacion
    ? formatFechaInspeccion(inspeccionMIILS.fechaCreacion)
    : COMMON.NULL_TEXT
  datosInsAuto.codigoProducto = elementoCodificado(inspeccionMIILS.codigoProducto)
  datosInsAuto.codigoCDA = elementoCodificado(inspeccionMIILS.codigoCDA)
  datosInsAuto.codigoMotivoInspeccion = elementoCodificado(inspeccionMIILS.motivoInspeccion)

  const sol = rs.solicitud || {}
  const datosInspecAuto = sol.inspeccion?.datosInspeccionAuto || {}

  const personaInsp = datosInsAuto.clienteInspeccion || {}
  personaInsp.direccion = []
  personaInsp.contacto = []
  personaInsp.codigoPersona = inspeccionMIILS.codigoPersona
  personaInsp.tipoPersona = elementoCodificado(inspeccionMIILS.tipoPersona)
  personaInsp.personaNatural = personaNatural(inspeccionMIILS)
  datosInsAuto.clienteInspeccion = personaInsp

  await contactoCliente(personaInsp.codigoPersona, personaInsp, datosInsAuto)
  await direccionCliente(personaInsp)

  // El legacy asigna aqui el kilometraje sobre el vehiculo del request y despues
  // `datosVehiculo()` reemplaza el objeto vehiculo completo, por lo que el valor no
  // llega a la respuesta de CREAR. Se conserva el comportamiento.
  if (datosInspecAuto.vehiculo) {
    datosInspecAuto.vehiculo.kilometraje = defaultIfNull(inspeccionMIILS.kilometrajeVehiculo)
  }

  await datosVehiculo(inspeccionMIILS, datosInsAuto, context)

  ins.datosInspeccionAuto = datosInspecAuto
  ins.fechaFinInspeccion = inspeccionMIILS.fechaFinInspeccion
    ? formatFechaInspeccion(inspeccionMIILS.fechaFinInspeccion)
    : COMMON.NULL_TEXT

  sol.inspeccion = ins
  rs.solicitud = sol
}

/** Port de `armarRespuestaConsulta` (flujo CONSULTAR). */
async function armarRespuestaConsulta (rs, rq, inspeccionMIILS, context) {
  messages.responseInfoSuccesfull(rs, rq)
  logger.info('Construyendo respuesta de consulta de inspeccion')

  const ins = {
    tipoSeleccionInspector: inspeccionMIILS.tipoSelInspector,
    estadoInspeccion: inspeccionMIILS.estadoInspeccion
  }
  if (inspeccionMIILS.idInspeccion !== null && inspeccionMIILS.idInspeccion !== undefined) {
    ins.idInspeccion = inspeccionMIILS.idInspeccion
  }

  if (!rq.solicitud.inspeccion) rq.solicitud.inspeccion = {}
  let datosInsAuto = rq.solicitud.inspeccion.datosInspeccionAuto
  if (!datosInsAuto) {
    logger.warn('DatosInspeccionAuto es null - creando estructura basica')
    datosInsAuto = { vehiculo: {} }
    rq.solicitud.inspeccion.datosInspeccionAuto = datosInsAuto
  }

  datosInsAuto.usuarioCreador = inspeccionMIILS.usuarioCreador
  datosInsAuto.claveAgente = defaultIfNull(inspeccionMIILS.claveAgente)
  datosInsAuto.fechaCreacion = inspeccionMIILS.fechaCreacion
    ? formatFechaInspeccion(inspeccionMIILS.fechaCreacion)
    : COMMON.NULL_TEXT
  datosInsAuto.codigoProducto = elementoCodificado(inspeccionMIILS.codigoProducto)
  datosInsAuto.codigoCDA = elementoCodificado(inspeccionMIILS.codigoCDA)
  datosInsAuto.codigoMotivoInspeccion = elementoCodificado(inspeccionMIILS.motivoInspeccion)

  const sol = rs.solicitud || {}

  let personaInsp = datosInsAuto.clienteInspeccion
  if (!personaInsp) {
    logger.info('ClienteInspeccion es null - creando estructura basica de PersonaInspeccion')
    personaInsp = { direccion: [], contacto: [] }
    datosInsAuto.clienteInspeccion = personaInsp
  }
  personaInsp.direccion = personaInsp.direccion || []
  personaInsp.contacto = personaInsp.contacto || []

  if (inspeccionMIILS.codigoPersona !== null && inspeccionMIILS.codigoPersona !== undefined) {
    personaInsp.codigoPersona = inspeccionMIILS.codigoPersona
  }
  personaInsp.tipoPersona = elementoCodificado(inspeccionMIILS.tipoPersona)
  personaInsp.personaNatural = personaNatural(inspeccionMIILS)

  await contactoCliente(personaInsp.codigoPersona, personaInsp, datosInsAuto)
  await direccionCliente(personaInsp)

  await datosVehiculo(inspeccionMIILS, datosInsAuto, context)

  if (datosInsAuto.vehiculo) {
    datosInsAuto.vehiculo.kilometraje = defaultIfNull(inspeccionMIILS.kilometrajeVehiculo)
  }

  ins.datosInspeccionAuto = datosInsAuto
  ins.fechaFinInspeccion = inspeccionMIILS.fechaFinInspeccion
    ? formatFechaInspeccion(inspeccionMIILS.fechaFinInspeccion)
    : COMMON.NULL_TEXT

  sol.inspeccion = ins
  sol.operacion = rq.solicitud.operacion
  sol.lineaNegocio = rq.solicitud.lineaNegocio
  rs.solicitud = sol
}

// ---------------------------------------------------------------------------
// Operaciones
// ---------------------------------------------------------------------------

/** Port de `validarParametrosBusquedaFlexible`. */
function validarParametrosBusquedaFlexible (extendida, rs) {
  const tieneIdInspeccion = extendida.inspeccion?.idInspeccion !== null && extendida.inspeccion?.idInspeccion !== undefined
  const chasis = extendida.getChasis()
  const placa = extendida.getPlaca()
  const tieneChasis = hasText(chasis)
  const tienePlaca = hasText(placa)

  if (!tieneIdInspeccion && !tieneChasis && !tienePlaca) {
    logger.error('No se proporcionaron parametros validos para la busqueda (idInspeccion, chasis o placa)')
    messages.datosInvalidos(rs)
    return
  }
  if (tienePlaca && (placa.length < 5 || placa.length > 7)) {
    logger.error('Formato de placa invalido. Debe tener entre 5 y 7 caracteres')
    messages.datosInvalidos(rs)
    return
  }
  if (tieneChasis && (chasis.length < 10 || chasis.length > 20)) {
    logger.error('Formato de chasis invalido. Debe tener entre 10 y 20 caracteres')
    messages.datosInvalidos(rs)
  }
}

/** Port de `realizarBusquedaFlexible`. */
async function realizarBusquedaFlexible (extendida) {
  if (extendida.inspeccion?.idInspeccion !== null && extendida.inspeccion?.idInspeccion !== undefined) {
    return consultarInspeccionMIILS(extendida.inspeccion.idInspeccion)
  }

  const chasis = extendida.getChasis()
  if (hasText(chasis)) {
    const porChasis = await inspeccionRepository.consultarInspeccionPorChasis(chasis)
    return porChasis.length > 0 ? porChasis[0] : null
  }

  const placa = extendida.getPlaca()
  if (hasText(placa)) {
    const porPlaca = await inspeccionRepository.consultarInspeccionPorPlaca(placa)
    return porPlaca.length > 0 ? porPlaca[0] : null
  }

  return null
}

/** Port de `procesarValidacionesYRespuesta`. */
async function procesarValidacionesYRespuesta (rs, rq, inspeccionMIILS, context) {
  const idInspeccion = inspeccionMIILS.idInspeccion

  if (!hasText(idInspeccion)) {
    if (rs.infoResponse) rs.infoResponse.requestID = rq.infoRequest?.requestID ?? null
    messages.noEncontradaConsulta(rs)
    return
  }

  const datosVehiculoInspe = {
    placa: { placa: inspeccionMIILS.placa },
    chasis: inspeccionMIILS.chasis,
    motor: inspeccionMIILS.motor,
    vin: inspeccionMIILS.vin
  }

  if (await consultarVehiculoRestringido(datosVehiculoInspe)) {
    messages.vehiculoRestringido(rs)
    return
  }

  const datosInspecAuto = {
    clienteInspeccion: {
      tipoDocumento: { codigo: inspeccionMIILS.tipoDocumento },
      numeroDocumento: inspeccionMIILS.numeroDocumento
    }
  }
  rs.solicitud = { ...(rs.solicitud || {}), inspeccion: { datosInspeccionAuto: datosInspecAuto } }

  const numeroDocumento = await consultarConductorRestringido(datosInspecAuto)
  if (!hasText(numeroDocumento)) {
    await armarRespuestaConsulta(rs, rq, inspeccionMIILS, context)
  } else {
    messages.conductorRestringido(rs)
  }
}

/** Port de `construirRespuestaConsultaFlexible`. */
async function construirRespuestaConsultaFlexible (rs, rq, extendida, inspeccionMIILS, context) {
  const idInspeccion = inspeccionMIILS.idInspeccion
  if (!hasText(idInspeccion)) {
    messages.sinIdInspeccion(rs)
    return
  }

  const insp = { fechaFinInspeccion: COMMON.NULL_TEXT }
  insp.idInspeccion =
    extendida.inspeccion?.idInspeccion !== null && extendida.inspeccion?.idInspeccion !== undefined
      ? extendida.inspeccion.idInspeccion
      : idInspeccion

  rs.solicitud = {
    ...(rs.solicitud || {}),
    lineaNegocio: rq.solicitud.lineaNegocio,
    operacion: rq.solicitud.operacion,
    inspeccion: insp
  }

  await procesarValidacionesYRespuesta(rs, rq, inspeccionMIILS, context)
}

/** Port de `operacionConsultaInspeccion`. */
async function operacionConsultaInspeccion (rs, rq, context) {
  logger.info('Iniciando operacion CONSULTA de inspeccion')
  try {
    const extendida = construirInspeccionExtendida(rq)
    validarParametrosBusquedaFlexible(extendida, rs)

    const inspeccionMIILS = await realizarBusquedaFlexible(extendida)
    if (!inspeccionMIILS) {
      logger.warn('No se encontro inspeccion con los parametros proporcionados')
      messages.noEncontradaConsulta(rs)
      return
    }

    await construirRespuestaConsultaFlexible(rs, rq, extendida, inspeccionMIILS, context)
  } catch (error) {
    logger.error('Error procesando consulta de inspeccion', { error: error.message, stack: error.stack })
    messages.catchError(rs)
  }
}

/** Port de `consultarInspeccionFlexible`. */
async function consultarInspeccionFlexible (rs, rq, extendida, res, context) {
  const inspec = res.solicitud?.inspeccion
  if (!inspec || inspec.idInspeccion === null || inspec.idInspeccion === undefined) return

  const inspeccionMIILS = await consultarInspeccionMIILS(inspec.idInspeccion)

  if (hasText(inspeccionMIILS.idInspeccion)) {
    const xmlRqInspeccion = mediatorConverter.transformToXml(
      rq.infoRequest,
      extendida.inspeccion?.datosInspeccionAuto,
      inspeccionMIILS.idInspeccion
    )
    await soapExecute(xmlRqInspeccion, EXTERNAL_SERVICES.MIILS_INSPECCIONES)

    inspeccionMIILS.codigoPersona = String(inspec.datosInspeccionAuto?.clienteInspeccion?.codigoPersona)
    await armarRespuesta(rs, rq, inspeccionMIILS, context)
  } else {
    messages.noEncontrada(rs)
  }
}

/** Port de `operacionCrearInspeccion`. */
async function operacionCrearInspeccion (rs, rq, context) {
  logger.info('Iniciando operacion CREAR inspeccion')
  try {
    const extendida = construirInspeccionExtendida(rq)
    const placaValue = extendida.getPlaca()

    if (!hasText(placaValue)) {
      messages.datosInvalidos(rs)
      return rs
    }

    if (await consultarVehiculoRestringido(datosVehiculoDesdeExtendida(extendida))) {
      messages.vehiculoRestringido(rs)
      return rs
    }

    const datosInsAuto = extendida.inspeccion?.datosInspeccionAuto
    const numeroDocumento = datosInsAuto?.clienteInspeccion ? await consultarConductorRestringido(datosInsAuto) : null
    if (hasText(numeroDocumento)) {
      messages.personaRestringIAXIS(rs)
      return rs
    }

    const idInspeccionVigente = await consultaXPlacaMIILS(placaValue)
    if (idInspeccionVigente !== null && idInspeccionVigente !== undefined) {
      messages.placaVigenteMIILS(rs, rq, idInspeccionVigente)
      return rs
    }

    const res = await transaccionCrearInspeccionService.procesarTransaccion(rq)
    // El legacy reemplaza la respuesta acumulada por la de la transaccion (`setRs`).
    const respuesta = res || rs

    if (
      res?.solicitud?.inspeccion?.idInspeccion !== null &&
      res?.solicitud?.inspeccion?.idInspeccion !== undefined
    ) {
      await consultarInspeccionFlexible(respuesta, rq, extendida, res, context)
    } else {
      messages.inspeccionNoCreada(respuesta)
    }
    return respuesta
  } catch (error) {
    logger.error('Error en operacion crear inspeccion', { error: error.message, stack: error.stack })
    messages.catchError(rs)
    return rs
  }
}

/**
 * Port de `GestionInspeccionMIILSCallout.preRouting` /
 * `CrearInspeccionMIILSCallout.preRouting`: asegura que la persona exista en iAxis
 * antes de crear la inspeccion.
 *
 * @param {object} rq
 * @param {boolean} validarOperacionCrear `true` para crearConsultarInspMIILS
 */
async function preRouting (rq, validarOperacionCrear) {
  try {
    const solicitud = rq?.solicitud
    if (!solicitud) return
    if (validarOperacionCrear && solicitud.operacion !== 'CREAR') return
    if (solicitud.lineaNegocio !== 'AUTOS') return

    const cliente = solicitud.inspeccion?.datosInspeccionAuto?.clienteInspeccion
    if (!cliente) return

    const tipoDocumento = Number.parseInt(String(cliente.tipoDocumento?.codigo), 10)
    const sperson = await utilRepository.consultarPersonaIAXIS(tipoDocumento, cliente.numeroDocumento)
    if (sperson === null) {
      await utilRepository.altaRapidaPersonaIAXIS(cliente)
    }
  } catch (error) {
    logger.error('Error en preRouting de inspeccion', { error: error.message })
  }
}

/**
 * Punto de entrada del servicio. Port de `procesar`.
 *
 * @param {object} request modelo canonico (`infoRequest` + `solicitud`)
 * @param {{operation?: string}} [options] `operation` es el nombre del elemento
 *        recibido (`crearConsultarInspMIILSRq` o `crearInspMIILSRq`)
 * @returns {Promise<object>} modelo canonico de respuesta
 */
async function procesar (request, options = {}) {
  let rs = {}
  const context = { operation: null, consultaSiniestros: null }

  try {
    let rq = request

    if (options.operation === 'crearInspMIILSRq') {
      logger.info('Tipo de mensaje detectado: crearInspMIILSRq')
      await preRouting(rq, false)
      const solicitud = { ...(rq.solicitud || {}), operacion: msg('operacion_crear') }
      rq = { infoRequest: rq.infoRequest, solicitud }
      context.operation = solicitud.operacion
      context.consultaSiniestros = solicitud.consultaSiniestros === true || solicitud.consultaSiniestros === 'true'
    } else {
      logger.info('Tipo de mensaje detectado: crearConsultarInspMIILSRq')
      await preRouting(rq, true)
    }

    if (context.consultaSiniestros === null) {
      const flag = rq.solicitud?.consultaSiniestros
      context.consultaSiniestros = flag === true || flag === 'true'
    }

    const extendida = construirInspeccionExtendida(rq)
    if (extendida.esFormatoDirecto()) {
      rq = convertirFormatoDirectoATradicional(extendida, rq)
      context.operation = rq.solicitud.operacion
    }

    rs.infoResponse = { requestID: rq.infoRequest?.requestID ?? null }
    messages.responseInfoOK(rs, rq)

    const sol = rq.solicitud || {}
    if (context.operation === null) context.operation = sol.operacion

    if (sol.lineaNegocio === msg('lineanegocio_autos')) {
      const operacionOriginal = sol.operacion
      const operacionNormalizada = operacionOriginal === 'C' ? msg('operacion_consultar') : operacionOriginal
      if (operacionOriginal === 'C') {
        logger.info('Normalizacion de operacion aplicada: C -> CONSULTAR')
      }

      if (operacionNormalizada === msg('operacion_crear')) {
        rs = (await operacionCrearInspeccion(rs, rq, context)) || rs
      } else if (operacionNormalizada === msg('operacion_consultar')) {
        await operacionConsultaInspeccion(rs, rq, context)
      } else {
        logger.error('Operacion no reconocida', { operacionNormalizada })
        messages.operacionNoSoportada(rs)
      }
    } else {
      messages.lineaNegNoSoportada(rs)
    }
  } catch (error) {
    logger.error('Error no controlado en gestionInspeccionMIILS', { error: error.message, stack: error.stack })
    messages.catchError(rs)
  }

  return rs
}

module.exports = {
  procesar,
  preRouting,
  construirInspeccionExtendida,
  convertirFormatoDirectoATradicional,
  esFormatoDirecto,
  elementoCodificado,
  elementoCodificadoConNombre,
  toXmlGregorian,
  validarParametrosBusquedaFlexible,
  realizarBusquedaFlexible,
  consultarVehiculoRestringido,
  consultarConductorRestringido,
  consultaXPlacaMIILS
}
