'use strict'

/**
 * Definicion ordenada de los tipos del contrato VehicleServices.
 *
 * El orden de cada `fields` replica el `propOrder` de las clases JAXB del legacy
 * (`com.libertycolombia.ia.*`), porque el XSD declara `xsd:sequence` y los clientes
 * SOAP validan el orden de los elementos.
 *
 * Entradas de `fields`:
 *  - `'nombre'`                        -> elemento simple
 *  - `{ n, t }`                        -> elemento complejo del tipo `t`
 *  - `{ n, t, list: true }`            -> elemento repetido
 *  - `{ n, t, list: true, xml: 'x' }`  -> elemento repetido cuyo nombre XML es `x`
 */

const types = {
  InfoRequest: { fields: ['requestID', 'fecha', 'aplicacionCliente', 'terminal', 'ip'] },

  Estado: { fields: ['codigoEstado', 'codigoEstadoServidor', 'descripcionEstado', 'severidad'] },

  InfoResponse: { fields: [{ n: 'estado', t: 'Estado' }, 'requestID'] },

  ElementoCodificado: { fields: ['codigo', 'nombre'] },

  ElementoCodificadoTexto: { fields: ['codigoTexto', 'nombre'] },

  Placa: { fields: ['placa', { n: 'tipoPlaca', t: 'ElementoCodificado' }] },

  Contacto: { fields: ['idContacto', { n: 'tipoContacto', t: 'ElementoCodificado' }, 'textoContacto'] },

  Direccion: {
    fields: [
      'idDireccion',
      { n: 'pais', t: 'ElementoCodificado' },
      { n: 'departamento', t: 'ElementoCodificado' },
      { n: 'ciudad', t: 'ElementoCodificado' },
      { n: 'tipoDireccion', t: 'ElementoCodificado' },
      'textoDireccion'
    ]
  },

  PersonaNatural: {
    fields: [
      'primerApellido',
      'primerNombre',
      'segundoApellido',
      'segundoNombre',
      { n: 'genero', t: 'ElementoCodificado' },
      'fechaNacimiento',
      { n: 'estadoCivil', t: 'ElementoCodificado' },
      { n: 'ocupacion', t: 'ElementoCodificado' }
    ]
  },

  PersonaInspeccion: {
    fields: [
      'codigoPersona',
      { n: 'tipoDocumento', t: 'ElementoCodificado' },
      'numeroDocumento',
      { n: 'tipoPersona', t: 'ElementoCodificado' },
      { n: 'personaNatural', t: 'PersonaNatural' },
      { n: 'direccion', t: 'Direccion', list: true },
      { n: 'contacto', t: 'Contacto', list: true }
    ]
  },

  Accesorio: {
    fields: [
      { n: 'tipo', t: 'ElementoCodificado' },
      'marca',
      'valor',
      { n: 'descripcion', t: 'ElementoCodificado' }
    ]
  },

  Siniestro: { fields: ['nombreCompania', 'placa', 'fechaOcurrenciaSiniestro', 'valorAsegurado', { n: 'garantias', list: true }] },

  // El campo `siniestros` se serializa como <otherSiniestros> y despues XmlUtil
  // aplica `updateValues` sobre el XML resultante (ver src/protocol/soapEnvelope.js).
  ConsultaSiniestros: {
    fields: ['mensaje', { n: 'siniestros', t: 'Siniestro', list: true, xml: 'otherSiniestros' }]
  },

  DatosVehiculoInspeccion: {
    fields: [
      { n: 'placa', t: 'Placa' },
      'codigoFasecolda',
      'motor',
      'chasis',
      'vin',
      'modelo',
      'valor',
      { n: 'color', t: 'ElementoCodificado' },
      { n: 'tipoPintura', t: 'ElementoCodificado' },
      { n: 'tipoCaja', t: 'ElementoCodificado' },
      { n: 'tipoCarroceria', t: 'ElementoCodificado' },
      { n: 'tipoServicio', t: 'ElementoCodificado' },
      { n: 'tipoVehiculo', t: 'ElementoCodificado' },
      'kilometraje',
      { n: 'accesorio', t: 'Accesorio', list: true },
      { n: 'consultaSiniestros', t: 'ConsultaSiniestros' }
    ]
  },

  DatosInspeccionAuto: {
    fields: [
      'usuarioCreador',
      'claveAgente',
      'fechaCreacion',
      'tiposInspQueAplica',
      { n: 'codigoProducto', t: 'ElementoCodificado' },
      { n: 'codigoCDA', t: 'ElementoCodificado' },
      { n: 'codigoMotivoInspeccion', t: 'ElementoCodificado' },
      { n: 'clienteInspeccion', t: 'PersonaInspeccion' },
      { n: 'vehiculo', t: 'DatosVehiculoInspeccion' }
    ]
  },

  Inspeccion: {
    fields: [
      'idInspeccion',
      'tipoSeleccionInspector',
      'estadoInspeccion',
      { n: 'datosInspeccionAuto', t: 'DatosInspeccionAuto' },
      'fechaFinInspeccion'
    ]
  },

  Solicitud: {
    fields: ['operacion', 'lineaNegocio', { n: 'inspeccion', t: 'Inspeccion' }, 'usuario', 'consultaSiniestros']
  },

  CrearConsultarInspMIILSRs: {
    fields: [{ n: 'infoResponse', t: 'InfoResponse' }, { n: 'solicitud', t: 'Solicitud' }]
  },

  CrearInspMIILSRs: {
    fields: [{ n: 'infoResponse', t: 'InfoResponse' }, { n: 'solicitud', t: 'Solicitud' }]
  },

  ResultadoPolizaAuto: { fields: ['codigoProcesoCargue'] },
  ResultadoPolizaHome: { fields: ['codigoProcesoCargue'] },
  ResultadoPolizaCumplimiento: { fields: ['codigoProcesoCargue'] },

  EmisionPoliza: {
    fields: [
      { n: 'codigoProducto', t: 'ElementoCodificado' },
      'numeroPoliza',
      { n: 'resultadoPolizaAuto', t: 'ResultadoPolizaAuto' },
      { n: 'resultadoPolizaHome', t: 'ResultadoPolizaHome' },
      { n: 'resultadoPolizaCumplimiento', t: 'ResultadoPolizaCumplimiento' }
    ]
  },

  CrearPolizaIAXISRs: {
    fields: [{ n: 'infoResponse', t: 'InfoResponse' }, { n: 'emisionPoliza', t: 'EmisionPoliza' }]
  }
}

/**
 * Elementos que en el XSD son `maxOccurs="unbounded"`. Se usan para normalizar el
 * parseo XML (fast-xml-parser entrega un objeto cuando solo hay una ocurrencia) y
 * tambien la entrada JSON, de forma que ambos protocolos producen la misma forma.
 */
const REPEATED_ELEMENTS = new Set([
  'accesorio',
  'archivo',
  'asegurado',
  'beneficiario',
  'clausula',
  'contacto',
  'datosPolizaHome',
  'deducible',
  'direccion',
  'dispositivoSeguridad',
  'garantia',
  'garantias',
  'otherSiniestros',
  'preguntaAmparo',
  'preguntaPoliza',
  'preguntaRiesgo',
  'preguntaTablaAmparo',
  'preguntaTablaPoliza',
  'preguntaTablaRiesgo',
  'respuesta',
  'siniestros'
])

module.exports = { types, REPEATED_ELEMENTS }
