# Contribuir al proyecto

## Política de cambios

- Los cambios funcionales deben enviarse mediante Pull Request.
- La rama `main` debe recibir únicamente cambios revisados.
- Antes de solicitar la revisión, deben pasar los tests, el lint y el build.
- El Pull Request debe explicar el problema, las pruebas realizadas y los riesgos.
- No se deben incluir contraseñas, tokens, archivos `.env` ni datos sensibles.

## Validaciones locales

```bash
npm test --prefix Plataforma_Web_Educativa_ACTIVIDAD3/backend
npm run lint --prefix Plataforma_Web_Educativa_ACTIVIDAD3/backend
npm run lint --prefix Plataforma_Web_Educativa_ACTIVIDAD3/frontend
npm run build --prefix Plataforma_Web_Educativa_ACTIVIDAD3/frontend
```

La protección técnica de la rama `main` se configura desde las reglas de repositorio de GitHub.
