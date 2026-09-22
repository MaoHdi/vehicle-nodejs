'use strict'

/**
 * Port de `InspeccionExtendidaDTO`.
 *
 * Permite atender los dos formatos de entrada que ya soportaba el legacy:
 *  - tradicional: `inspeccion/datosInspeccionAuto/vehiculo/placa`
 *  - directo:     `inspeccion/placa`
 */
class InspeccionExtendida {
  /**
   * @param {object|null} [inspeccion]
   */
  constructor (inspeccion = null) {
    this.inspeccion = inspeccion
    this.placaDirecta = null
    this.chasisDirecto = null
  }

  /** @returns {string|null} placa en cualquiera de los dos formatos */
  getPlaca () {
    if (this.placaDirecta && this.placaDirecta.trim() !== '') return this.placaDirecta
    const placa = this.inspeccion?.datosInspeccionAuto?.vehiculo?.placa?.placa
    return placa ?? null
  }

  /** @returns {string|null} chasis en cualquiera de los dos formatos */
  getChasis () {
    if (this.chasisDirecto && this.chasisDirecto.trim() !== '') return this.chasisDirecto
    const chasis = this.inspeccion?.datosInspeccionAuto?.vehiculo?.chasis
    return chasis ?? null
  }

  /** @returns {boolean} */
  tieneParametrosBusqueda () {
    const placa = this.getPlaca()
    const chasis = this.getChasis()
    return (
      (this.inspeccion && this.inspeccion.idInspeccion !== null && this.inspeccion.idInspeccion !== undefined) ||
      (!!placa && placa.trim() !== '') ||
      (!!chasis && chasis.trim() !== '')
    )
  }

  /** @returns {boolean} `true` si la placa/chasis venian directamente en `inspeccion` */
  esFormatoDirecto () {
    return (
      (!!this.placaDirecta && this.placaDirecta.trim() !== '') ||
      (!!this.chasisDirecto && this.chasisDirecto.trim() !== '')
    )
  }
}

module.exports = { InspeccionExtendida }
