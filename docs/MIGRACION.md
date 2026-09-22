# Migracion `vehicle-legacy` (Java/Spring) → `vehicle-nodejs` (Lambda)

Alcance: las operaciones **`crearConsultarInspMIILS`** (incluido su alias
`crearInspMIILS`) y **`crearPolizaIAXIS`**. Las demas operaciones del servicio Java
(`adjuntarDocumentosPoliza`) siguen en el legacy.

## 1. Mapa de componentes

| Java (`co.com.libertymutual.vehicleservices`) | Node |
|---|---|
| `controller.VehicleServiceController` + `service.base.SoapActionService` | `src/protocol/httpAdapter.js` + `src/protocol/negotiation.js` |
| `util.XmlUtil` (JAXB + SAAJ) | `src/protocol/soapEnvelope.js`, `src/protocol/xml.js`, `src/protocol/schema.js` |
| `service.GestionInspeccionMIILSService` | `src/domain/inspeccion/gestionInspeccionMiilsService.js` |
| `bussines.msg.impl.GestionInspeccionMIILSMsgImpl` | `src/domain/inspeccion/inspeccionMessages.js` |
| `service.TransaccionCrearInspeccionService` | `src/domain/inspeccion/transaccionCrearInspeccionService.js` |
| `service.ConsultarSiniestrosPlaca` | `src/domain/inspeccion/consultarSiniestrosService.js` |
| `dto.InspeccionExtendidaDTO` | `src/domain/inspeccion/inspeccionExtendida.js` |
| `converter.MediatorInspeccionConverter` | `src/infrastructure/soap/mediatorInspeccionConverter.js` |
| `callOut.GestionInspeccionMIILSCallout` / `CrearInspeccionMIILSCallout` | `preRouting()` en `gestionInspeccionMiilsService.js` |
| `service.CrearPolizaIaxisService` | `src/domain/poliza/crearPolizaIaxisService.js` |
| `callOut.CrearPolizaIAXISCallout` | `src/domain/poliza/crearPolizaIaxisCallout.js` |
| `callOut.db.dao.GrabarPolizaIAXISDAO` | `src/domain/poliza/grabarPolizaIaxisDao.js` + `registroAlta*.js` + `builders/` |
| `callOut.db.dao.UtilDAO` / `GenericDAO` | `src/infrastructure/db/utilRepository.js` |
| `repository.*` (JdbcTemplate) | `src/infrastructure/db/*Repository.js` (node-oracledb) |
| `sql.*` | `src/infrastructure/db/sql.js` (sentencias portadas literalmente) |
| `props.*Propiedades` + `messages.properties` | `src/config/properties.js` + `resources/messages.json` |
| `resources.properties` (homologaciones) | `resources/homologaciones.json` |
| `proxy.SOAPClient` + `enums.SoapExternalClientEnum` | `src/infrastructure/soap/soapClient.js` |
| `service.InsertarLogAuditService` | `src/infrastructure/db/auditRepository.js` |
| `util.UtilFormatDate` + `com.lsc.services.utils.FormatUtils` | `src/shared/dates.js` |

Los 2455 renglones de `GrabarPolizaIAXISDAO` se dividen en:

- `registroAlta.js` — `llenarCampo` / `construirRegistro` y el acumulador de errores;
- `registroAltaComun.js` — bloques compartidos (persona, contactos, direcciones);
- `builders/registroAltaAuto|Home|EBonds.js` — un archivo por tipo de poliza;
- `grabarPolizaIaxisDao.js` — armado del tipo Oracle e invocacion del procedimiento.

## 2. Detalles tecnicos de la traduccion

**Reflexion → rutas de propiedades.** `llenarCampo(..., "getDatosGestion.getAgente.getCodigo", ...)`
pasa a `llenarCampo(..., 'datosGestion.agente.codigo', ...)`. Se mantiene la semantica
original: si algun tramo no existe, el campo no se informa y no se genera error.

**Tipo Oracle.** El legacy usaba `StructDescriptor`/`ARRAY` de `oracle.jdbc`. En Node se
usa `connection.getDbObjectClass('ALTAPOLIZARECTYPE')` y se leen los nombres de atributo
del diccionario de la base, de modo que el mapeo posicion → atributo siempre coincide con
la definicion vigente del tipo. El registro conserva sus 79 campos y el desplazamiento
`posicion + 3`.

**Procedimientos almacenados.** `P_MIILS_CREA_INSPECCION_EXT` (con `P_SPERSON` como
`IN OUT`), `PAC_CARGA_UNQORK_AUTOS.P_CARGA_UNQORK_AUTOS`,
`pac_servicios_express.p_carga_express`, `P_UNQORK_ALTA_PERSONA` y
`pac_contexto.f_inicializarctx` se invocan con los mismos parametros y posiciones.

**Formato directo vs. tradicional.** El legacy decidia buscando etiquetas en el texto XML
(`<inspeccion>` con `<placa>` y sin `<datosInspeccionAuto>`). Aqui la deteccion es
estructural sobre el modelo ya deserializado, lo que da el mismo resultado en SOAP y hace
que el formato directo tambien funcione en REST.

**Estado de invocacion.** Los campos de instancia `operation` e `isConsultaSiniestros`
del servicio Spring (compartidos entre peticiones) se reemplazan por un contexto local
por invocacion.

**Auditoria.** En Spring la insercion era `@Async`; en Lambda no hay trabajo en segundo
plano despues de responder, por lo que la escritura se espera. Un fallo de auditoria
nunca interrumpe la operacion de negocio.

## 3. Particularidades del legacy que se conservan a proposito

Estan marcadas con comentarios en el codigo y cubiertas por pruebas:

1. `UtilFormatDate` usa el patron `hh` (reloj de 12 horas): las `13:45` se serializan como
   `T01:45`. Cambiarlo alteraria el contrato que ya consumen los clientes.
2. `datosInvalidos()` responde con el texto de "linea de negocio no soportada" y
   `operacionNoSoportada()` con el de "datos invalidos".
3. En el flujo **CREAR**, el kilometraje se asigna antes de que `datosVehiculo()`
   reemplace el objeto vehiculo, por lo que no viaja en la respuesta. En **CONSULTAR** si
   viaja, porque alli se asigna despues.
4. `validarParametrosBusquedaFlexible` marca el error en la respuesta pero no detiene el
   flujo; si la busqueda encuentra algo, la respuesta OK sobreescribe ese error.
5. Una busqueda por `idInspeccion` sin resultados devuelve `-110` (`sinIdInspeccion`), no
   `-25`, porque la consulta retorna un DTO vacio y no nulo.
6. `XmlUtil.updayeValues` (renombrar `otherSiniestros` y aplanar la lista de siniestros)
   se replica en `applyLegacyTagFixes`.

## 4. Diferencias de comportamiento (decisiones que conviene revisar)

| # | Legacy | Ahora | Motivo |
|---|---|---|---|
| 1 | Sobre SOAP con `xmlns:env="env:ENVELOPE"` | Namespace SOAP 1.1 estandar | El sobre original es invalido. `SOAP_LEGACY_ENVELOPE_NS=true` lo reproduce |
| 2 | Cumplimiento (10004/10005): `consultarPoliza` hacia `get(0)` sobre la lista vacia de `datosPolizaHome` → excepcion y respuesta de error generica | Se toma `datosPolizaCumplimiento.datosGestion` | El producto nunca completaba. `LEGACY_BUG_COMPAT=true` restaura el fallo |
| 3 | Cumplimiento: el callout asignaba el codigo de proceso sobre un campo nulo → `NullPointerException` y error aunque la poliza si se cargara | Se informa en `resultadoPolizaCumplimiento` | Igual que el anterior; mismo flag |
| 4 | Request y response completos en CloudWatch y en `audit_services_web` | Payloads enmascarados por defecto | Minimizacion de datos (GDPR) y reduccion del alcance de datos sensibles (SOC2). `AUDIT_STORE_RAW=true` vuelve al original |
| 5 | Un unico endpoint SOAP para todas las operaciones, con enrutamiento por el contenido del cuerpo | Un endpoint por operacion | Son dos lambdas y API Gateway no enruta por cuerpo. **Requiere que el consumidor legacy apunte a la URL de su operacion.** Si esa URL no puede cambiar, hace falta un enrutador delante (ver seccion 5) |
| 6 | Mensajes de `grabarpolizaiaxis.*` con el acento corrompido (`�`) | Texto correcto en UTF-8 | Solo afecta la presentacion del mensaje de error |

Los puntos 2, 3 y 6 corrigen defectos; los puntos 1, 4 y 5 son decisiones de
arquitectura. Todos son reversibles.

## 5. Consumidor SOAP con URL fija

Si el caso de uso legacy no puede cambiar la URL, hay dos alternativas, ninguna de las
cuales altera estas dos lambdas:

- **Enrutador delgado**: una tercera lambda en la ruta legacy que lea el nombre de la
  operacion del `Body` e invoque la lambda correspondiente.
- **Regla en el balanceador**: si el consumidor envia `SOAPAction`, un ALB puede enrutar
  por ese encabezado hacia el target de cada lambda.

Queda pendiente la decision del equipo; mientras tanto, cada operacion responde un
`SOAP Fault env:Client` explicito si recibe la operacion equivocada.

## 6. Infraestructura

El despliegue sigue el patron de los demas servicios del equipo (referencia:
`co-dynamic-rating`): **Serverless Framework**, con `serverless.yml` en este mismo
repositorio porque el paquete incluye `src/**` y `node_modules`.

| Elemento | Donde |
|---|---|
| Servicio, funciones, API, IAM, VPC y `stackTags` | `serverless.yml` |
| Valores de cuenta por stage (`region`, `subnet_c`, `subnet_d`, `securityGroupID`, `iaxis_secret_name`, `memory_size`) | `environments/<stage>.yml` |
| Configuracion no sensible por stage (URLs SOAP, timeouts, log, auditoria) | `src/env/<stage>.env`, cargada con dotenv desde el handler |
| Credenciales de iAxis | AWS Secrets Manager, por nombre (`IAXIS_SECRET_NAME`) |
| Pipeline | `Jenkinsfile` → `shared-pipelines/serverless/JenkinsfileCI` y `JenkinsfileCD` |

Se conservan del patron de referencia: `variablesResolutionMode`, `custom.default_stage`
y `custom.active`, `deploymentBucket` con SSE AES256, los `stackTags` corporativos
(`lm_troux_uid`, `lm_app`, `lm_sbu`, `intl_country`, `intl_region`), los
`Custom::ResourceLookup` para VPC y subredes privadas, el security group con las
etiquetas `hdi_*`, y la forma de `package.patterns`.

Dos desviaciones menores respecto de la referencia, ambas deliberadas:

- `lm_app_env` y las etiquetas `hdi_app_env` usan `${self:provider.stage}` y no
  `${self:custom.default_stage}`, que etiquetaria todos los ambientes como `prod`.
- `src/env/*.env` no lleva credenciales. En el servicio de referencia esos archivos
  incluyen `CLIENT_SECRET` en texto plano; aqui las credenciales solo viven en Secrets
  Manager.

`vehicle-node-infra` queda sin uso para este servicio: su `cloudformation/infra.yml`
volvio a su estado original.

## 7. Pendientes de configuracion

Antes del primer despliegue de cada ambiente:

1. `environments/<stage>.yml`: `vpc`, `subnet_c`, `subnet_d`, `securityGroupID`.
2. `src/env/<stage>.env`: `URL_MEDIATION_INSPECCION` y `URL_AUTO_SISA`.
3. Secreto `co-hdi-vehicle-services-iaxis-secret-<stage>` en Secrets Manager.
4. Bucket `co-s3-vehicle-service-mediation-deployment-<stage>`.
