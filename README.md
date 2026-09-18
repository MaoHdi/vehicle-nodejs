# co-hdi-vehicle-service-mediation-lambda

# ⚡ Proyecto Lambda Code Node 22.x

Este repositorio contiene un proyecto base desarrollado con **Node 22.x**, ideal para construir y desplegar funciones en AWS Lambda de forma sencilla y escalable.

---

## 📁 Estructura del proyecto

- `src/`: contiene el código fuente de las funciones Lambda.
- `test/`: carpeta para pruebas unitarias o de integración.
- `Jenkinsfile`: Pipeline configuración principal CI/CD.
- `config.jenkins.json`: configuración variables para el Jenkinsfile.
- `package.json`: define dependencias, scripts y metadatos del proyecto.
- `README.md`: documentación del proyecto.

---

## 📂 src/

Contiene el código fuente de las funciones Lambda.

- `index.js`:  
  Archivo principal donde se define la lógica de las funciones. Puedes dividirlo en múltiples archivos o carpetas según crezca el proyecto.

---

## 📂 test/

Carpeta destinada a pruebas unitarias o de integración.  
Aquí puedes usar frameworks como **Jest**, **Mocha**, o **Vitest** para validar el comportamiento de tus funciones.

---