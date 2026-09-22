'use strict'

const { msg } = require('../../../config/properties')
const { llenarCampo, nuevoRegistro, asArray, RegistroAltaCollector } = require('../registroAlta')
const { todayDdMMyyyy } = require('../../../shared/dates')
const comun = require('../registroAltaComun')

/**
 * Port de `GrabarPolizaIAXISDAO.construirObjetoOraclePolizaAuto`.
 *
 * Construye los registros de alta (tipos 1, 2, 3, 3B, 4, 4B, 5, 5A, 5B, 5C, 5D, 6,
 * 6B, 7, 8, 9, 12 y 18) para las polizas de autos (productos 6031, 6033, 6034, 6038
 * y 6039).
 *
 * @param {object} datosPolizaAuto
 * @param {object} producto `{ codigo }`
 * @param {object|null} version resultado de `consultarFasecoldaVersion`
 * @returns {RegistroAltaCollector}
 */
function construirRegistrosAuto (datosPolizaAuto, producto, version) {
  const collector = new RegistroAltaCollector()

  const secuenciaMovimiento = 1
  const secuenciaRiesgo = 1
  let secuenciaAsegurado = 1
  let secuenciaBeneficiario = 1

  // --- Registro tipo 1: poliza / certificado -------------------------------
  collector.intentar(() => {
    const r = nuevoRegistro('1')
    llenarCampo(r, datosPolizaAuto, 'datosGestion.agente.codigo', 2)
    llenarCampo(r, producto, 'codigo', 3)
    llenarCampo(r, datosPolizaAuto, 'datosGestion.numeroPoliza', 4)
    llenarCampo(r, datosPolizaAuto, 'datosGestion.gestionPago.formaPago.codigo', 6)
    llenarCampo(r, datosPolizaAuto, 'datosGestion.fechaInicioVigencia', 7, { fecha: true })
    llenarCampo(r, datosPolizaAuto, 'datosGestion.gestionPago.medioPago.codigoTexto', 9)
    llenarCampo(r, datosPolizaAuto, 'vehiculo.identificacion.placa.tipoPlaca.codigo', 17)
    llenarCampo(r, datosPolizaAuto, 'vehiculo.identificacion.placa.placa', 18)
    llenarCampo(r, datosPolizaAuto, 'datosGestion.numeroDocumentoPromotor', 24)
    llenarCampo(r, datosPolizaAuto, 'datosGestion.tipoDocumentoPromotor.codigo', 25)
    collector.add(r)
  }, msg('grabarpolizaiaxis.error.procesando_datosorigentipo1'))

  // --- Registro tipo 2: movimiento de poliza -------------------------------
  collector.intentar(() => {
    const r = nuevoRegistro('2')
    r.set(2, String(secuenciaMovimiento))
    r.set(3, '100')
    r.set(4, todayDdMMyyyy())
    llenarCampo(r, datosPolizaAuto, 'datosGestion.fechaInicioVigencia', 5, { fecha: true })
    collector.add(r)
  }, msg('grabarpolizaiaxis.error.procesando_datosorigentipo2'))

  // --- Registro tipo 3 y 3B: tomador y sus direcciones ---------------------
  collector.intentar(() => {
    const tomador = datosPolizaAuto.tomador
    const r = nuevoRegistro('3')
    r.set(2, String(secuenciaMovimiento))
    llenarCampo(r, tomador, 'tipoDocumento.codigo', 3)
    llenarCampo(r, tomador, 'numeroDocumento', 4)
    llenarCampo(r, tomador, 'tipoPersona.codigo', 6, { homologar: 'tipoPersona' })

    collector.addError(
      comun.llenarPersona(r, tomador, '', comun.POS_TOMADOR, 6, 'grabarpolizaiaxis.error.procesando_datosorigen')
    )
    comun.llenarContactos(r, tomador?.contacto, comun.CONTACTO_TOMADOR)
    collector.add(r)

    let secuenciaDireccion = 1
    for (const direccion of asArray(tomador?.direccion)) {
      const rd = nuevoRegistro('3B')
      rd.set(2, String(secuenciaMovimiento))
      rd.set(3, String(secuenciaDireccion))
      llenarCampo(rd, direccion, 'tipoDireccion.codigo', comun.DIRECCION_TOMADOR.tipo)
      llenarCampo(rd, direccion, 'textoDireccion', comun.DIRECCION_TOMADOR.texto)
      llenarCampo(rd, direccion, 'ciudad.codigo', comun.DIRECCION_TOMADOR.ciudad)
      llenarCampo(rd, direccion, 'departamento.codigo', comun.DIRECCION_TOMADOR.departamento)
      collector.add(rd)
      secuenciaDireccion++
    }
  }, msg('grabarpolizaiaxis.error.procesando_datosorigenasegurado3'))

  // --- Registros tipo 4 y 4B: asegurados y sus direcciones -----------------
  collector.intentar(() => {
    for (const asegurado of asArray(datosPolizaAuto.asegurado)) {
      const r = nuevoRegistro('4')
      r.set(2, String(secuenciaMovimiento))
      r.set(3, String(secuenciaAsegurado))
      llenarCampo(r, asegurado, 'tipoDocumento.codigo', 4)
      llenarCampo(r, asegurado, 'numeroDocumento', 5)
      llenarCampo(r, asegurado, 'tipoPersona.codigo', 7, { homologar: 'tipoPersona' })

      collector.addError(
        comun.llenarPersona(
          r,
          asegurado,
          '',
          comun.POS_ASEGURADO,
          7,
          'grabarpolizaiaxis.error.procesando_datosorigenatipo4'
        )
      )
      comun.llenarContactos(r, asegurado?.contacto, comun.CONTACTO_ASEGURADO)
      collector.add(r)

      let secuenciaDireccion = 1
      for (const direccion of asArray(asegurado?.direccion)) {
        const rd = nuevoRegistro('4B')
        rd.set(2, String(secuenciaMovimiento))
        rd.set(3, String(secuenciaAsegurado))
        rd.set(4, String(secuenciaDireccion))
        llenarCampo(rd, direccion, 'tipoDireccion.codigo', comun.DIRECCION_ESTANDAR.tipo)
        llenarCampo(rd, direccion, 'textoDireccion', comun.DIRECCION_ESTANDAR.texto)
        llenarCampo(rd, direccion, 'ciudad.codigo', comun.DIRECCION_ESTANDAR.ciudad)
        llenarCampo(rd, direccion, 'departamento.codigo', comun.DIRECCION_ESTANDAR.departamento)
        collector.add(rd)
        secuenciaDireccion++
      }
      secuenciaAsegurado++
    }
  }, msg('grabarpolizaiaxis.error.procesando_datosorigenatipo4B'))

  // --- Registro tipo 5: vehiculo -------------------------------------------
  collector.intentar(() => {
    const r = nuevoRegistro('5')
    r.set(2, String(secuenciaMovimiento))
    r.set(3, String(secuenciaRiesgo))
    llenarCampo(r, datosPolizaAuto, 'vehiculo.identificacion.codigoFasecolda', 4)
    llenarCampo(r, datosPolizaAuto, 'vehiculo.identificacion.modelo', 5)
    llenarCampo(r, datosPolizaAuto, 'vehiculo.identificacion.placa.tipoPlaca.codigo', 6)
    llenarCampo(r, datosPolizaAuto, 'vehiculo.identificacion.placa.placa', 7)
    llenarCampo(r, datosPolizaAuto, 'vehiculo.identificacion.motor', 8)
    llenarCampo(r, datosPolizaAuto, 'vehiculo.identificacion.chasis', 9)
    llenarCampo(r, datosPolizaAuto, 'vehiculo.identificacion.vin', 10)
    llenarCampo(r, datosPolizaAuto, 'vehiculo.otrosDatos.valor', 11)

    // Valor a nuevo: el de FASECOLDA cuando existe, si no el informado.
    if (version && version.valorNuevo !== null && version.valorNuevo > 0) {
      llenarCampo(r, version, 'valorNuevo', 12)
    } else {
      llenarCampo(r, datosPolizaAuto, 'vehiculo.otrosDatos.valor', 12)
    }

    llenarCampo(r, datosPolizaAuto, 'vehiculo.otrosDatos.color.codigo', 13)
    llenarCampo(r, datosPolizaAuto, 'vehiculo.otrosDatos.kilometraje', 14)

    llenarCampo(r, datosPolizaAuto, 'vehiculo.otrosDatos.cilindraje', 15)
    if (version && !r.has(15)) llenarCampo(r, version, 'cilindraje', 15)

    llenarCampo(r, datosPolizaAuto, 'vehiculo.otrosDatos.ocupantes', 16)
    if (version && !r.has(16)) llenarCampo(r, version, 'ocupantes', 16)

    llenarCampo(r, datosPolizaAuto, 'vehiculo.otrosDatos.tipoCombustible.codigo', 17)
    if (version && !r.has(17)) llenarCampo(r, version, 'tipoCombustible', 17)

    llenarCampo(r, datosPolizaAuto, 'vehiculo.otrosDatos.capacidadTonelaje', 18)
    llenarCampo(r, datosPolizaAuto, 'vehiculo.otrosDatos.tipoPintura.codigo', 19)

    llenarCampo(r, datosPolizaAuto, 'vehiculo.otrosDatos.tipoCaja.codigo', 20)
    if (version && !r.has(20)) llenarCampo(r, version, 'caja', 20)

    llenarCampo(r, datosPolizaAuto, 'vehiculo.otrosDatos.tipoCampero.codigo', 21)
    llenarCampo(r, datosPolizaAuto, 'vehiculo.otrosDatos.tipoCarroceria.codigo', 22)

    llenarCampo(r, datosPolizaAuto, 'vehiculo.otrosDatos.tipoServicio.codigo', 23)
    if (version && !r.has(23)) llenarCampo(r, version, 'servicio', 23)

    llenarCampo(r, datosPolizaAuto, 'vehiculo.otrosDatos.tipoOrigen.codigo', 24)
    if (version && !r.has(24)) llenarCampo(r, version, 'origen', 24)

    llenarCampo(r, datosPolizaAuto, 'vehiculo.otrosDatos.transportaCombustible', 25, { bool: true })
    llenarCampo(r, datosPolizaAuto, 'vehiculo.otrosDatos.usoRemolque', 26, { bool: true })
    llenarCampo(r, datosPolizaAuto, 'vehiculo.otrosDatos.tipoUsoVehiculo.codigo', 27)
    llenarCampo(r, datosPolizaAuto, 'vehiculo.otrosDatos.nuevo', 28, { bool: true })

    llenarCampo(r, datosPolizaAuto, 'vehiculo.otrosDatos.peso', 29)
    if (version && !r.has(29)) llenarCampo(r, version, 'peso', 29)

    llenarCampo(r, datosPolizaAuto, 'vehiculo.otrosDatos.pais', 30)
    llenarCampo(r, datosPolizaAuto, 'vehiculo.otrosDatos.companiaAnterior', 31)
    llenarCampo(r, datosPolizaAuto, 'vehiculo.otrosDatos.fechaFinCompaniaAnterior', 32, { fecha: true })
    collector.add(r)
  }, msg('grabarpolizaiaxis.error.tipo5_vehiculo'))

  // --- Registro tipo 5A: accesorios ----------------------------------------
  collector.intentar(() => {
    for (const accesorio of asArray(datosPolizaAuto?.vehiculo?.otrosDatos?.accesorio)) {
      const r = nuevoRegistro('5A')
      r.set(2, String(secuenciaMovimiento))
      r.set(3, String(secuenciaRiesgo))
      llenarCampo(r, accesorio, 'descripcion.codigo', 4)
      llenarCampo(r, accesorio, 'tipo.codigo', 5)
      llenarCampo(r, accesorio, 'marca', 6)
      llenarCampo(r, accesorio, 'valor', 7)
      collector.add(r)
    }
  }, msg('grabarpolizaiaxis.error.tipo5a_accesorios'))

  // --- Registro tipo 5C: conductor -----------------------------------------
  collector.intentar(() => {
    const r = nuevoRegistro('5C')
    r.set(2, String(secuenciaMovimiento))
    r.set(3, String(secuenciaRiesgo))
    llenarCampo(r, datosPolizaAuto, 'conductor.persona.tipoDocumento.codigo', 4)
    llenarCampo(r, datosPolizaAuto, 'conductor.persona.numeroDocumento', 5)
    llenarCampo(r, datosPolizaAuto, 'conductor.persona.tipoPersona.codigo', 7, { homologar: 'tipoPersona' })

    const tipoPersona = r.get(7)
    if (tipoPersona === 'N') {
      const conductor = datosPolizaAuto.conductor
      comun.llenarPersona(r, conductor, 'persona.', comun.POS_CONDUCTOR, 7, '')
      llenarCampo(r, conductor, 'annyosExperiencia', 20)
      llenarCampo(r, conductor, 'tieneSiniestros', 21, { bool: true })
      comun.llenarContactos(r, conductor?.persona?.contacto, comun.CONTACTO_CONDUCTOR)
    } else if (tipoPersona === 'J') {
      collector.addError(msg('grabarpolizaiaxis.error.tipo5c_conductorjuridico'))
    } else {
      collector.addError(msg('grabarpolizaiaxis.error.tipo5c_conductortipopersona'))
    }
    collector.add(r)
  }, msg('grabarpolizaiaxis.error.tipo5c_conductor'))

  // --- Registro tipo 5B: direcciones del conductor -------------------------
  collector.intentar(() => {
    let secuenciaDireccion = 1
    for (const direccion of asArray(datosPolizaAuto?.conductor?.persona?.direccion)) {
      const r = nuevoRegistro('5B')
      r.set(2, String(secuenciaMovimiento))
      r.set(3, String(secuenciaRiesgo))
      r.set(4, String(secuenciaDireccion))
      llenarCampo(r, direccion, 'tipoDireccion.codigo', comun.DIRECCION_ESTANDAR.tipo)
      llenarCampo(r, direccion, 'textoDireccion', comun.DIRECCION_ESTANDAR.texto)
      llenarCampo(r, direccion, 'ciudad.codigo', comun.DIRECCION_ESTANDAR.ciudad)
      llenarCampo(r, direccion, 'departamento.codigo', comun.DIRECCION_ESTANDAR.departamento)
      collector.add(r)
      secuenciaDireccion++
    }
  }, msg('grabarpolizaiaxis.error.tipo5b_direccionconductor'))

  // --- Registro tipo 5D: dispositivos de seguridad -------------------------
  collector.intentar(() => {
    for (const dispositivo of asArray(datosPolizaAuto?.vehiculo?.otrosDatos?.dispositivoSeguridad)) {
      const r = nuevoRegistro('5D')
      r.set(2, String(secuenciaMovimiento))
      r.set(3, String(secuenciaRiesgo))
      llenarCampo(r, dispositivo, 'tipo.codigo', 4)
      llenarCampo(r, dispositivo, 'propietario.codigo', 5)
      llenarCampo(r, dispositivo, 'fechaInicioContrato', 6, { fecha: true })
      llenarCampo(r, dispositivo, 'numeroContrato', 7)
      collector.add(r)
    }
  }, msg('grabarpolizaiaxis.error.tipo5d_dispositivos'))

  // --- Registros tipo 6 y 6B: beneficiarios --------------------------------
  collector.intentar(() => {
    for (const beneficiario of asArray(datosPolizaAuto.beneficiario)) {
      const r = nuevoRegistro('6')
      r.set(2, String(secuenciaMovimiento))
      r.set(3, String(secuenciaRiesgo))
      r.set(4, String(secuenciaBeneficiario))
      llenarCampo(r, beneficiario, 'persona.tipoDocumento.codigo', 5)
      llenarCampo(r, beneficiario, 'persona.numeroDocumento', 6)
      llenarCampo(r, beneficiario, 'persona.tipoPersona.codigo', 8, { homologar: 'tipoPersona' })

      collector.addError(
        comun.llenarPersona(
          r,
          beneficiario,
          'persona.',
          comun.POS_BENEFICIARIO,
          8,
          'grabarpolizaiaxis.error.procesando_datosorigenatipo6'
        )
      )

      llenarCampo(r, beneficiario, 'tipoBeneficiario.codigoTexto', 16)
      llenarCampo(r, beneficiario, 'garantiaBeneficiario.codigo', 17)
      comun.llenarContactos(r, beneficiario?.persona?.contacto, comun.CONTACTO_BENEFICIARIO)
      collector.add(r)

      collector.intentar(() => {
        let secuenciaDireccion = 1
        for (const direccion of asArray(beneficiario?.persona?.direccion)) {
          const rd = nuevoRegistro('6B')
          rd.set(2, String(secuenciaMovimiento))
          rd.set(3, String(secuenciaRiesgo))
          rd.set(4, String(secuenciaDireccion))
          llenarCampo(rd, direccion, 'tipoDireccion.codigo', comun.DIRECCION_ESTANDAR.tipo)
          llenarCampo(rd, direccion, 'textoDireccion', comun.DIRECCION_ESTANDAR.texto)
          llenarCampo(rd, direccion, 'ciudad.codigo', comun.DIRECCION_ESTANDAR.ciudad)
          llenarCampo(rd, direccion, 'departamento.codigo', comun.DIRECCION_ESTANDAR.departamento)
          collector.add(rd)
          secuenciaDireccion++
        }
      }, msg('grabarpolizaiaxis.error.procesando_datosorigenatipo6B'))

      secuenciaBeneficiario++
    }
  }, msg('grabarpolizaiaxis.error.procesando_datospersonabene6'))

  // --- Registro tipo 7: garantias ------------------------------------------
  collector.intentar(() => {
    for (const amparo of asArray(datosPolizaAuto.garantia)) {
      const r = nuevoRegistro('7')
      llenarCampo(r, amparo, 'codigoAmparo.codigo', 2)
      r.set(3, String(secuenciaMovimiento))
      r.set(4, String(secuenciaRiesgo))
      llenarCampo(r, amparo, 'fechaInicioEfectoGarantia', 5, { fecha: true })
      llenarCampo(r, amparo, 'fechaFinEfectoGarantia', 6, { fecha: true })
      llenarCampo(r, amparo, 'capitalGarantia', 7)
      collector.add(r)
    }
  }, msg('grabarpolizaiaxis.error.procesando_datosorigenatipo7'))

  // --- Registro tipo 8: preguntas a nivel de poliza y riesgo ---------------
  collector.intentar(() => {
    const agregarPreguntas = (preguntas) => {
      for (const pregunta of asArray(preguntas)) {
        for (const respuesta of asArray(pregunta.respuesta)) {
          const r = nuevoRegistro('8')
          r.set(2, String(secuenciaMovimiento))
          r.set(3, String(secuenciaRiesgo))
          llenarCampo(r, pregunta, 'pregunta.codigo', 4)
          comun.llenarRespuesta(r, respuesta, 5)
          collector.add(r)
        }
      }
    }
    agregarPreguntas(datosPolizaAuto.preguntaPoliza)
    agregarPreguntas(datosPolizaAuto.preguntaRiesgo)

    // Preguntas agregadas por la logica de negocio UNQORK.
    const recibo = nuevoRegistro('8')
    recibo.set(2, String(secuenciaMovimiento))
    recibo.set(3, String(secuenciaRiesgo))
    recibo.set(4, '9889') // numero de recibo
    llenarCampo(recibo, datosPolizaAuto, 'datosGestion.numeroRecibo', 5)
    collector.add(recibo)

    if (datosPolizaAuto?.datosGestion?.numeroInspeccionMIILS !== null &&
        datosPolizaAuto?.datosGestion?.numeroInspeccionMIILS !== undefined) {
      const inspeccion = nuevoRegistro('8')
      inspeccion.set(2, String(secuenciaMovimiento))
      inspeccion.set(3, String(secuenciaRiesgo))
      inspeccion.set(4, '9888') // numero de inspeccion MIILS
      llenarCampo(inspeccion, datosPolizaAuto, 'datosGestion.numeroInspeccionMIILS', 5)
      collector.add(inspeccion)
    }
  }, msg('grabarpolizaiaxis.error.procesando_datosorigenatipo8'))

  // --- Registro tipo 9: preguntas a nivel de garantia ----------------------
  collector.intentar(() => {
    for (const amparo of asArray(datosPolizaAuto.garantia)) {
      for (const pregunta of asArray(amparo.preguntaAmparo)) {
        for (const respuesta of asArray(pregunta.respuesta)) {
          const r = nuevoRegistro('9')
          r.set(2, String(secuenciaMovimiento))
          r.set(3, String(secuenciaRiesgo))
          llenarCampo(r, amparo, 'codigoAmparo.codigo', 4)
          llenarCampo(r, pregunta, 'pregunta.codigo', 5)
          comun.llenarRespuesta(r, respuesta, 6)
          collector.add(r)
        }
      }
    }

    // 9975: valor de prima informado por UNQORK, uno por garantia.
    for (const amparo of asArray(datosPolizaAuto.garantia)) {
      const r = nuevoRegistro('9')
      r.set(2, String(secuenciaMovimiento))
      r.set(3, String(secuenciaRiesgo))
      r.set(4, String(amparo?.codigoAmparo?.codigo))
      r.set(5, '9975')
      llenarCampo(r, amparo, 'valorPrima', 6)
      collector.add(r)
    }
  }, msg('grabarpolizaiaxis.error.procesando_datosorigenatipo9'))

  // --- Registro tipo 12: comision especial (siempre dos registros) ---------
  collector.intentar(() => {
    const r1 = nuevoRegistro('12')
    r1.set(2, String(secuenciaMovimiento))
    r1.set(3, '1')
    llenarCampo(r1, datosPolizaAuto, 'datosGestion.datosPrima.comision', 4)
    r1.set(5, '1')
    r1.set(6, '1')
    collector.add(r1)

    const r2 = nuevoRegistro('12')
    r2.set(2, String(secuenciaMovimiento))
    r2.set(3, '2')
    llenarCampo(r2, datosPolizaAuto, 'datosGestion.datosPrima.comision', 4)
    r2.set(5, '2')
    r2.set(6, '99')
    collector.add(r2)
  }, msg('grabarpolizaiaxis.error.tipo12_comision'))

  // --- Registro tipo 18: franquicias y bonificaciones ----------------------
  collector.intentar(() => {
    for (const deducible of asArray(datosPolizaAuto.deducible)) {
      const r = nuevoRegistro('18')
      r.set(2, String(secuenciaMovimiento))
      r.set(3, String(secuenciaRiesgo))
      llenarCampo(r, deducible, 'tipoDeducible.codigo', 4)
      llenarCampo(r, deducible, 'fechaInicio', 5, { fecha: true })
      llenarCampo(r, deducible, 'garantia.codigo', 6)
      llenarCampo(r, deducible, 'tipoValor.codigo', 7)
      llenarCampo(r, deducible, 'valor', 8)
      llenarCampo(r, deducible, 'tipoValorMaximo.codigo', 9)
      llenarCampo(r, deducible, 'valorMaximo', 10)
      llenarCampo(r, deducible, 'tipoValorMinimo.codigo', 11)
      llenarCampo(r, deducible, 'valorMinimo', 12)
      collector.add(r)
    }
  }, msg('grabarpolizaiaxis.error.procesando_datosorigenatipo18'))

  return collector
}

module.exports = { construirRegistrosAuto }
