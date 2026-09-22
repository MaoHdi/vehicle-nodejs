# co-hdi-vehicle-service-mediation-lambda

Lambdas Node.js 22 que reemplazan las operaciones del servicio Java `VehicleServices`
(repositorio `vehicle-legacy`). Se publican como **REST/JSON** y mantienen
**compatibilidad SOAP** para los consumidores que todavia no migran.

| Lambda | Handler | Operacion legacy | Interfaz auditoria |
|---|---|---|---|
| `crearConsultaInspMils` | `src/handlers/crearConsultaInspMils.handler` | `crearConsultarInspMIILS` (y su alias `crearInspMIILS`) | `UI04` |
| `crearPolizaIaxis` | `src/handlers/crearPolizaIaxis.handler` | `crearPolizaIAXIS` | `UI05` |

El despliegue es con **Serverless Framework** desde este mismo repositorio
(`serverless.yml`), siguiendo el patron del resto de los servicios del equipo.

## Como se atienden los dos protocolos

Cada lambda negocia el protocolo por peticion (`src/protocol/negotiation.js`):

- `POST` con `Content-Type: *xml*`, con encabezado `SOAPAction`, o con un cuerpo que
  empieza por `<` → se procesa y se responde **SOAP 1.1**.
- `POST` con JSON → se procesa y se responde **REST/JSON**.
- `GET ...?wsdl` o `GET ....wsdl` → devuelve el WSDL, igual que el controlador Spring.

Ambos caminos convergen en el mismo **modelo canonico**: el JSON REST es la proyeccion
1:1 del cuerpo SOAP, con los mismos nombres de campo del XSD. El nucleo de negocio no
sabe en que protocolo llego la peticion.

```
evento API GW ─▶ negotiation ─▶ soapEnvelope | JSON ─▶ modelo canonico
                                                            │
                                                        domain/*
                                                            │
                     SOAP  ◀── soapEnvelope.wrap ───────────┴──▶ JSON
```

### Ejemplo REST

```bash
curl -X POST "$API/vehicle-services/inspecciones" \
  -H 'Content-Type: application/json' \
  -d '{"infoRequest":{"requestID":"REQ-1"},
       "solicitud":{"operacion":"CONSULTAR","lineaNegocio":"AUTOS",
                    "inspeccion":{"idInspeccion":"778899"}}}'
```

### Ejemplo SOAP (sin cambios para el consumidor legacy)

```bash
curl -X POST "$API/vehicle-services/inspecciones" \
  -H 'Content-Type: text/xml;charset=UTF-8' -H 'SOAPAction: ""' \
  --data-binary @peticion.xml
```

## Estructura

```
serverless.yml     Definicion del servicio: functions, API, IAM, VPC y tags
environments/      Valores por stage (region, subredes, SG, nombre del secreto)
src/
  env/             Configuracion NO sensible por stage, cargada con dotenv
  handlers/        Entradas Lambda (una por operacion)
  protocol/        Negociacion REST/SOAP, sobre SOAP, esquema y serializacion XML
  domain/
    inspeccion/    Port de GestionInspeccionMIILSService y sus colaboradores
    poliza/        Port de CrearPolizaIaxisService, su callout y GrabarPolizaIAXISDAO
  infrastructure/
    db/            Oracle iAxis (repositorios y procedimientos almacenados)
    soap/          Consumos SOAP salientes (mediador MIILS, SISA)
  config/          Carga de entorno, propiedades y Secrets Manager
  shared/          Logger, enmascaramiento de PII y utilidades de fecha
resources/         WSDL, mensajes y homologaciones portados del legacy
test/              Pruebas Jest (protocolo, dominio y handlers)
docs/MIGRACION.md  Mapa Java → Node, decisiones y diferencias de comportamiento
```

## Configuracion

Dos origenes, igual que en el resto de los servicios serverless del equipo:

| Origen | Contenido |
|---|---|
| `environments/<stage>.yml` | Lo que depende de la cuenta: `region`, `subnet_c`, `subnet_d`, `securityGroupID`, `iaxis_secret_name`, `memory_size`. Lo consume `serverless.yml` |
| `src/env/<stage>.env` | Configuracion NO sensible: URLs de los servicios SOAP, timeouts, nivel de log, auditoria. Se carga con dotenv desde el handler |
| AWS Secrets Manager | Credenciales de Oracle iAxis. `IAXIS_SECRET_NAME` llega por `serverless.yml`; el contenido nunca se escribe en logs |

Variables de comportamiento (en `src/env/<stage>.env`):

| Variable | Descripcion |
|---|---|
| `URL_MEDIATION_INSPECCION`, `URL_AUTO_SISA`, `SOAP_TIMEOUT` | Servicios SOAP externos |
| `LOG_LEVEL`, `LOG_PAYLOADS` | Nivel de log; `LOG_PAYLOADS=full` se ignora en `prod` |
| `AUDIT_ENABLED`, `AUDIT_STORE_RAW` | Auditoria en `axis.audit_services_web` |
| `RESPONSE_PROTOCOL` | `auto` (por defecto), `rest` o `soap` |
| `SOAP_LEGACY_ENVELOPE_NS` | `true` reproduce el sobre no estandar del legacy |
| `LEGACY_BUG_COMPAT` | `true` reproduce los defectos del legacy en polizas de cumplimiento |

## Despliegue

Por Jenkins (`Jenkinsfile` → `shared-pipelines/serverless/JenkinsfileCI` y `JenkinsfileCD`).
Manualmente:

```bash
npm install
npx serverless deploy --stage dev
```

Requisitos previos por ambiente:

1. Completar `environments/<stage>.yml` (subredes, security group, VPC).
2. Completar las URLs en `src/env/<stage>.env`.
3. Crear el secreto `co-hdi-vehicle-services-iaxis-secret-<stage>` con
   `{"username","password","connectString"}`.
4. El bucket `co-s3-vehicle-service-mediation-deployment-<stage>` debe existir
   (Serverless no crea buckets de despliegue propios).

## Proteccion de datos personales

Los payloads transportan documentos, nombres, fechas de nacimiento, direcciones,
telefonos, correos y datos del vehiculo. Por eso:

- `src/shared/redact.js` enmascara esos campos antes de escribirlos en CloudWatch y en
  la tabla de auditoria (minimizacion de datos, GDPR/SOC2).
- El log de payloads completos solo es posible fuera de produccion.
- Las credenciales se resuelven en Secrets Manager; `src/env/*.env` no lleva secretos.
- Los logs de ejecucion del API no incluyen el cuerpo de la peticion
  (`fullExecutionData: false`).

## Pruebas

```bash
npm test              # 66 pruebas con cobertura
```
