'use strict'

const { msg } = require('../../../config/properties')
const { llenarCampo, nuevoRegistro, asArray, RegistroAltaCollector } = require('../registroAlta')
const { todayDdMMyyyy } = require('../../../shared/dates')
const comun = require('../registroAltaComun')

/**
 * Port de `GrabarPolizaIAXISDAO.construirObjetoOraclePolizaEBonds`.
 *
 * Productos de cumplimiento (EBonds): 10004 y 10005.
 *
 * @param {object} datosPolizaCumplimiento
 * @param {object} producto `{ codigo }`
 * @returns {RegistroAltaCollector}
 */
function construirRegistrosEBonds (datosPolizaCumplimiento, producto) {
  const collector = new RegistroAltaCollector()

  const secuenciaMovimiento = 1
  const secuenciaRiesgo = 1
  let secuenciaAsegurado = 1
  let secuenciaBeneficiario = 1
  let secuenciaClausula = 1

  // --- Registro tipo 1 ------------------------------------------------------
  collector.intentar(() => {
    const r = nuevoRegistro('1')
    llenarCampo(r, datosPolizaCumplimiento, 'datosGestion.agente.codigo', 2)
    llenarCampo(r, producto, 'codigo', 3)
    llenarCampo(r, datosPolizaCumplimiento, 'datosGestion.numeroPoliza', 4)
    llenarCampo(r, datosPolizaCumplimiento, 'datosGestion.gestionPago.formaPago.codigo', 6)
    llenarCampo(r, datosPolizaCumplimiento, 'datosGestion.fechaInicioVigencia', 7, { fecha: true })
    // Exclusivo de cumplimiento: fecha fin de vigencia.
    llenarCampo(r, datosPolizaCumplimiento, 'datosGestion.fechaFinVigencia', 8, { fecha: true })
    llenarCampo(r, datosPolizaCumplimiento, 'datosGestion.gestionPago.medioPago.codigoTexto', 9)
    llenarCampo(r, datosPolizaCumplimiento, 'datosGestion.numeroDocumentoPromotor', 24)
    llenarCampo(r, datosPolizaCumplimiento, 'datosGestion.tipoDocumentoPromotor.codigo', 25)
    collector.add(r)
  }, msg('grabarpolizaiaxis.error.procesando_datosorigentipo1'))

  // --- Registro tipo 2 ------------------------------------------------------
  collector.intentar(() => {
    const r = nuevoRegistro('2')
    r.set(2, String(secuenciaMovimiento))
    r.set(3, '100')
    r.set(4, todayDdMMyyyy())
    llenarCampo(r, datosPolizaCumplimiento, 'datosGestion.fechaInicioVigencia', 5, { fecha: true })
    collector.add(r)
  }, msg('grabarpolizaiaxis.error.procesando_datosorigentipo2'))

  // --- Registros tipo 3 y 3B: tomador --------------------------------------
  collector.intentar(() => {
    const tomador = datosPolizaCumplimiento.tomador
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

  // --- Registros tipo 4 y 4B: asegurados -----------------------------------
  collector.intentar(() => {
    for (const asegurado of asArray(datosPolizaCumplimiento.asegurado)) {
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

  // --- Registro tipo 5: riesgo de cumplimiento -----------------------------
  collector.intentar(() => {
    const r = nuevoRegistro('5')
    r.set(2, String(secuenciaMovimiento))
    r.set(3, String(secuenciaRiesgo))
    llenarCampo(r, datosPolizaCumplimiento, 'riesgoCumplimiento.descripcionRiesgo.naturalezaRiesgo', 4)
    collector.add(r)
  }, msg('grabarpolizaiaxis.error.tipo5_riesgocumplimiento'))

  // --- Registros tipo 6 y 6B: beneficiarios --------------------------------
  collector.intentar(() => {
    for (const beneficiario of asArray(datosPolizaCumplimiento.beneficiario)) {
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
    for (const amparo of asArray(datosPolizaCumplimiento.garantia)) {
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

  // --- Registro tipo 8 ------------------------------------------------------
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
    agregarPreguntas(datosPolizaCumplimiento.preguntaPoliza)
    agregarPreguntas(datosPolizaCumplimiento.preguntaRiesgo)

    const recibo = nuevoRegistro('8')
    recibo.set(2, String(secuenciaMovimiento))
    recibo.set(3, String(secuenciaRiesgo))
    recibo.set(4, '9889')
    llenarCampo(recibo, datosPolizaCumplimiento, 'datosGestion.numeroRecibo', 5)
    collector.add(recibo)
  }, msg('grabarpolizaiaxis.error.procesando_datosorigenatipo8'))

  // --- Registro tipo 9 ------------------------------------------------------
  collector.intentar(() => {
    for (const amparo of asArray(datosPolizaCumplimiento.garantia)) {
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

    for (const amparo of asArray(datosPolizaCumplimiento.garantia)) {
      const r = nuevoRegistro('9')
      r.set(2, String(secuenciaMovimiento))
      r.set(3, String(secuenciaRiesgo))
      r.set(4, String(amparo?.codigoAmparo?.codigo))
      r.set(5, '9975')
      llenarCampo(r, amparo, 'valorPrima', 6)
      collector.add(r)
    }
  }, msg('grabarpolizaiaxis.error.procesando_datosorigenatipo9'))

  // --- Registro tipo 10: preguntas de riesgo tipo tabla --------------------
  // Nota: en cumplimiento el codigo de pregunta va en la posicion 5 (en Home va en
  // la 4). Se conserva la numeracion del legacy.
  collector.intentar(() => {
    for (const pregunta of asArray(datosPolizaCumplimiento.preguntaTablaRiesgo)) {
      const r = nuevoRegistro('10')
      r.set(2, String(secuenciaMovimiento))
      r.set(3, String(secuenciaRiesgo))
      llenarCampo(r, pregunta, 'pregunta.codigo', 5)
      llenarCampo(r, pregunta, 'fila', 6)
      llenarCampo(r, pregunta, 'columna', 7)
      comun.llenarRespuesta(r, pregunta.respuesta, 8)
      collector.add(r)
      secuenciaClausula++
    }
  }, msg('grabarpolizaiaxis.error.tipo10_preguntastabla'))

  // --- Registro tipo 17: clausulas especiales ------------------------------
  collector.intentar(() => {
    for (const clausula of asArray(datosPolizaCumplimiento.clausula)) {
      const r = nuevoRegistro('17')
      r.set(2, String(secuenciaMovimiento))
      r.set(3, String(secuenciaRiesgo))
      r.set(4, String(secuenciaClausula))
      llenarCampo(r, clausula, 'tipoClausula.codigo', 5)
      llenarCampo(r, clausula, 'fechaInicio', 6, { fecha: true })
      llenarCampo(r, clausula, 'fechaFin', 7, { fecha: true })
      llenarCampo(r, clausula, 'codigoClausula.codigo', 8)
      llenarCampo(r, clausula, 'textoClausulaEspecial', 9)
      collector.add(r)
      secuenciaClausula++
    }
  }, msg('grabarpolizaiaxis.error.tipo17_clausulas'))

  // --- Registro tipo 18: franquicias y bonificaciones ----------------------
  collector.intentar(() => {
    for (const deducible of asArray(datosPolizaCumplimiento.deducible)) {
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

module.exports = { construirRegistrosEBonds }
