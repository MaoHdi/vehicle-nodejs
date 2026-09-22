'use strict'

const { msg } = require('../../../config/properties')
const { llenarCampo, nuevoRegistro, asArray, RegistroAltaCollector } = require('../registroAlta')
const { todayDdMMyyyy } = require('../../../shared/dates')
const comun = require('../registroAltaComun')

/**
 * Port de `GrabarPolizaIAXISDAO.construirObjetoOraclePolizaHome`.
 *
 * Productos Home: 900758, 10024, 800020, 6071 y 10003.
 */

/** Productos que no llevan tomador (tipo 3) ni las preguntas 9889/9975. */
const PRODUCTOS_SIN_TOMADOR = new Set(['10024', '10003', '6071'])

/**
 * @param {object} datosPolizaHome
 * @param {object} producto `{ codigo }`
 * @returns {RegistroAltaCollector}
 */
function construirRegistrosHome (datosPolizaHome, producto) {
  const collector = new RegistroAltaCollector()

  const secuenciaMovimiento = 1
  const secuenciaRiesgo = 1
  let secuenciaAsegurado = 1
  let secuenciaBeneficiario = 1
  let secuenciaClausula = 1

  const codigoProducto = String(producto?.codigo ?? '')
  const productoSinTomador = PRODUCTOS_SIN_TOMADOR.has(codigoProducto)

  // --- Registro tipo 1 ------------------------------------------------------
  collector.intentar(() => {
    const r = nuevoRegistro('1')
    llenarCampo(r, datosPolizaHome, 'datosGestion.agente.codigo', 2)
    llenarCampo(r, producto, 'codigo', 3)
    llenarCampo(r, datosPolizaHome, 'datosGestion.numeroPoliza', 4)
    llenarCampo(r, datosPolizaHome, 'datosGestion.gestionPago.formaPago.codigo', 6)
    llenarCampo(r, datosPolizaHome, 'datosGestion.fechaInicioVigencia', 7, { fecha: true })
    llenarCampo(r, datosPolizaHome, 'datosGestion.gestionPago.medioPago.codigoTexto', 9)
    llenarCampo(r, datosPolizaHome, 'datosGestion.numeroDocumentoPromotor', 24)
    llenarCampo(r, datosPolizaHome, 'datosGestion.tipoDocumentoPromotor.codigo', 25)
    collector.add(r)
  }, msg('grabarpolizaiaxis.error.procesando_datosorigentipo1'))

  // --- Registro tipo 2 ------------------------------------------------------
  collector.intentar(() => {
    const r = nuevoRegistro('2')
    r.set(2, String(secuenciaMovimiento))
    r.set(3, '100')
    r.set(4, todayDdMMyyyy())
    llenarCampo(r, datosPolizaHome, 'datosGestion.fechaInicioVigencia', 5, { fecha: true })
    collector.add(r)
  }, msg('grabarpolizaiaxis.error.procesando_datosorigentipo2'))

  // --- Registros tipo 3 y 3B: tomador --------------------------------------
  collector.intentar(() => {
    if (productoSinTomador) return

    const tomador = datosPolizaHome.tomador
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
    for (const asegurado of asArray(datosPolizaHome.asegurado)) {
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

  // --- Registro tipo 5: riesgo hogar ---------------------------------------
  collector.intentar(() => {
    const r = nuevoRegistro('5')
    r.set(2, String(secuenciaMovimiento))
    r.set(3, String(secuenciaRiesgo))
    const base = 'riesgoHome.ubicacionRiesgo.'
    const campos = [
      ['tipoDeVia', 4],
      ['textoDeVia', 5],
      ['literalPredio', 6],
      ['bisPredio', 7],
      ['orientacionPredio', 8],
      ['numViaAdyacente', 9],
      ['literalPredio2', 10],
      ['orientacionPredio2', 11],
      ['consecutivoPlaca', 12],
      ['orientacionPredio3', 13],
      ['detallePredio1', 14],
      ['numeroPredio1', 15],
      ['detallePredio2', 16],
      ['numeroPredio2', 17],
      ['detallePredio3', 18],
      ['numeroPredio3', 19],
      ['codigoPostal', 20],
      ['ciudad', 21],
      ['departamento', 22]
    ]
    for (const [campo, posicion] of campos) llenarCampo(r, datosPolizaHome, base + campo, posicion)
    collector.add(r)
  }, msg('grabarpolizaiaxis.error.tipo5_riesgohogar'))

  // --- Registros tipo 6 y 6B: beneficiarios --------------------------------
  collector.intentar(() => {
    for (const beneficiario of asArray(datosPolizaHome.beneficiario)) {
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
      // Exclusivo de Home: porcentaje del beneficiario.
      llenarCampo(r, beneficiario, 'garantiaBeneficiario.porcentaje', 31)
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

  // --- Registros tipo 7 y 19: garantias y preguntas tipo tabla de amparo ---
  collector.intentar(() => {
    for (const amparo of asArray(datosPolizaHome.garantia)) {
      const r = nuevoRegistro('7')
      llenarCampo(r, amparo, 'codigoAmparo.codigo', 2)
      r.set(3, String(secuenciaMovimiento))
      r.set(4, String(secuenciaRiesgo))
      llenarCampo(r, amparo, 'fechaInicioEfectoGarantia', 5, { fecha: true })
      llenarCampo(r, amparo, 'fechaFinEfectoGarantia', 6, { fecha: true })
      llenarCampo(r, amparo, 'capitalGarantia', 7)
      collector.add(r)

      if (amparo.preguntaTablaAmparo) {
        collector.intentar(() => {
          for (const pregunta of asArray(amparo.preguntaTablaAmparo)) {
            const rp = nuevoRegistro('19')
            rp.set(2, '1')
            rp.set(3, '1')
            llenarCampo(rp, amparo, 'codigoAmparo.codigo', 4)
            llenarCampo(rp, pregunta, 'pregunta.codigo', 5)
            llenarCampo(rp, pregunta, 'fila', 6)
            llenarCampo(rp, pregunta, 'columna', 7)
            comun.llenarRespuesta(rp, pregunta.respuesta, 8)
            collector.add(rp)
          }
        }, msg('grabarpolizaiaxis.error.tipo19_preguntastablaamparo'))
      }
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
    agregarPreguntas(datosPolizaHome.preguntaPoliza)
    agregarPreguntas(datosPolizaHome.preguntaRiesgo)

    if (!productoSinTomador) {
      const recibo = nuevoRegistro('8')
      recibo.set(2, String(secuenciaMovimiento))
      recibo.set(3, String(secuenciaRiesgo))
      recibo.set(4, '9889')
      llenarCampo(recibo, datosPolizaHome, 'datosGestion.numeroRecibo', 5)
      collector.add(recibo)
    }

    if (datosPolizaHome?.datosGestion?.numeroInspeccionMIILS !== null &&
        datosPolizaHome?.datosGestion?.numeroInspeccionMIILS !== undefined) {
      const inspeccion = nuevoRegistro('8')
      inspeccion.set(2, String(secuenciaMovimiento))
      inspeccion.set(3, String(secuenciaRiesgo))
      inspeccion.set(4, '9888')
      llenarCampo(inspeccion, datosPolizaHome, 'datosGestion.numeroInspeccionMIILS', 5)
      collector.add(inspeccion)
    }
  }, msg('grabarpolizaiaxis.error.procesando_datosorigenatipo8'))

  // --- Registro tipo 9 ------------------------------------------------------
  collector.intentar(() => {
    for (const amparo of asArray(datosPolizaHome.garantia)) {
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

    for (const amparo of asArray(datosPolizaHome.garantia)) {
      if (productoSinTomador) continue
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
  collector.intentar(() => {
    for (const pregunta of asArray(datosPolizaHome.preguntaTablaRiesgo)) {
      const r = nuevoRegistro('10')
      r.set(2, String(secuenciaMovimiento))
      r.set(3, String(secuenciaRiesgo))
      llenarCampo(r, pregunta, 'pregunta.codigo', 4)
      llenarCampo(r, pregunta, 'fila', 5)
      llenarCampo(r, pregunta, 'columna', 6)
      comun.llenarRespuesta(r, pregunta.respuesta, 7)
      collector.add(r)
      secuenciaClausula++
    }
  }, msg('grabarpolizaiaxis.error.tipo10_preguntastabla'))

  // --- Registro tipo 17: clausulas especiales ------------------------------
  collector.intentar(() => {
    for (const clausula of asArray(datosPolizaHome.clausula)) {
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
    for (const deducible of asArray(datosPolizaHome.deducible)) {
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
      // Exclusivo de Home.
      llenarCampo(r, deducible, 'tipoValor2.codigo', 13)
      llenarCampo(r, deducible, 'valor2', 14)
      collector.add(r)
    }
  }, msg('grabarpolizaiaxis.error.procesando_datosorigenatipo18'))

  return collector
}

module.exports = { construirRegistrosHome, PRODUCTOS_SIN_TOMADOR }
