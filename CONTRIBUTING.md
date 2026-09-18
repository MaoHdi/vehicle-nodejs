# 🛠️ Guía de Contribución

¡Gracias por tu interés en contribuir a este proyecto! 🚀  
Usamos el modelo de trabajo **GitFlow**, así que por favor sigue estas pautas para mantener un flujo limpio y colaborativo.

---

## 📌 Requisitos previos

- Tener una cuenta en GitHub.
- Clonar el repositorio usando SSH o HTTPS.
- Instalar Git en tu máquina local.
- Crear una rama desde `develop` para tus cambios.

---

## 🌱 Flujo de trabajo GitFlow

1. **Rama base**: Todo parte desde `develop`. No hagas cambios directamente en `master` ni en `develop`.

2. **Tipos de ramas**:
   - `feature/nombre-del-feature`: para nuevas funcionalidades.
   - `bugfix/nombre-del-fix`: para correcciones de errores.
   - `hotfix/nombre-del-hotfix`: para correcciones urgentes en producción.
   - `release/nombre-de-la-release`: para preparar una versión estable.

3. **Pasos para contribuir**:

   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feature/nombre-del-feature

4. **En el Pull Request**:

    - Describe brevemente qué hiciste.
    - Asocia el PR con un issue si aplica. 
    - Espera revisión y aprobación antes de hacer merge.

## ✅ Buenas prácticas

- Usa nombres de ramas descriptivos siguiendo el modelo GitFlow.  
  **Ejemplos**:  
  - `feature/login-form`  
  - `bugfix/typo-in-footer`  
  - `release/v1.2.0`

- Escribe mensajes de commit claros y concisos usando convenciones como:

  - `feat:` para nuevas funcionalidades  
  - `fix:` para correcciones  
  - `docs:` para cambios en documentación  
  - `refactor:` para mejoras internas sin cambiar funcionalidad  
  - `test:` para agregar o modificar pruebas

- No subas archivos innecesarios o temporales. Usa `.gitignore` para excluir:
  - `node_modules/`
  - `.serverless/`
  - `.env`
  - `*.log`
  - Otros archivos generados automáticamente

- Agrega pruebas unitarias si tu cambio lo requiere.

- Documenta cualquier cambio relevante en el código, configuración o dependencias.

- Si tu cambio afecta el comportamiento del sistema, actualiza el `README.md` o el `CHANGELOG.md`.

- Revisa tu código antes de abrir un Pull Request. Usa linters o formateadores si están disponibles.

- Sé respetuoso en los comentarios y revisiones. El objetivo es mejorar el código, no criticar a la persona.
