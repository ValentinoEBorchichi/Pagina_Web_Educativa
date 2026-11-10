# Desplegar en Render (un solo servicio) + Supabase

La base de datos y el storage de archivos ya no están en tu PC: viven en
**Supabase** (Postgres + Storage), y el backend se despliega en **Render**
para que sea accesible desde cualquier celular o computadora. El frontend
sigue serviéndose desde el mismo proceso Express que la API (igual que antes
con Railway): una sola URL pública, sin CORS.

```
Web / app móvil  →  Backend (Render)  →  Base de datos + Storage (Supabase)
```

## 0. Supabase (una sola vez)

1. En el proyecto de Supabase, abrí **SQL Editor** y corré, en este orden:
   1. `backend/supabase/schema.sql` (crea todas las tablas, el trigger de
      reglas de deportes y los 4 recorridos de transporte).
   2. `backend/supabase/seed.sql` (datos de prueba: usuarios demo, alumnos,
      cursos, una factura de ejemplo, etc. — ver el encabezado del archivo
      para las credenciales).
2. Creá dos buckets **privados** en **Storage → New bucket**: `comprobantes`
   y `facturas` (dejá "Public bucket" desactivado: el backend los sirve él
   mismo con control de acceso, nunca se exponen directamente).
3. Anotá, desde **Project Settings**:
   - **Database → Connection string → URI** (pooler de sesión, recomendado
     para un host como Render) → va en `DATABASE_URL`.
   - **API → Project URL** → va en `SUPABASE_URL`.
   - **API → service_role key** (⚠️ no la `anon`) → va en
     `SUPABASE_SERVICE_ROLE_KEY`.

   Ninguno de estos tres valores se comparte en el chat con el asistente: se
   pegan directamente en las variables de entorno de Render (paso 2 de abajo)
   y, si hace falta probar en la PC antes de desplegar, en `backend/.env`
   (nunca se sube al repo).

## 1. Crear el Web Service en Render

1. **New → Web Service**, conectá este repositorio de GitHub.
2. **Root Directory** = vacío (la raíz del repo, igual que en Railway).
3. **Build Command**: `npm run build`
4. **Start Command**: `npm start`
5. **Health Check Path**: `/api/health`
6. Plan: el free tier sirve para que la profesora evalúe; tiene disco
   efímero, pero ya no importa porque la base y los archivos están en
   Supabase, no en el disco del servicio.

## 2. Variables de entorno (en el servicio de Render)

- `JWT_SECRET` = un texto largo y aleatorio (ver el comentario en
  `backend/.env.example` para generarlo).
- `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` = los del paso 0.
- `SUPABASE_BUCKET_COMPROBANTES` = `comprobantes`
- `SUPABASE_BUCKET_FACTURAS` = `facturas`
- `EMAIL_USER` / `EMAIL_PASS` = cuenta de Gmail + contraseña de aplicación
  (para los correos de factura/recuperación de contraseña; opcional, si no
  se definen esos envíos simplemente no se hacen).
- ⚠️ NO definas `PORT`: Render lo inyecta automáticamente.

## 3. App móvil

En `mobile/.env.example` (copiar a `.env` o configurar el build de EAS) definí:

```
EXPO_PUBLIC_API_URL=https://tu-servicio.onrender.com
```

con la URL pública que Render te asigna al crear el servicio. Sin esta
variable, la app sigue usando una IP de LAN que solo funciona en desarrollo
local (ver `mobile/src/config.js`). Para un build con EAS (`eas build`), la
misma URL ya está como placeholder en `mobile/eas.json` (`env.EXPO_PUBLIC_API_URL`
de los perfiles `preview`/`production`) — reemplazá `https://tu-servicio.onrender.com`
por la URL real antes de buildear.

## 4. Redeploy

Cada push a la rama conectada vuelve a desplegar solo. Los cambios de
esquema (nuevas tablas/columnas) se aplican a mano en el SQL Editor de
Supabase — no hay una migración automática desde el backend.

## Usuarios de prueba (del seed.sql)

- admin / admin123
- padre / padre123
- docente / docente123 (y docente2 / docente123)
- alumno / alumno123

## Qué probar después de desplegar

Login (los 4 roles), cuotas/tarifas, historial académico, inscripción a
deportes/transporte, carga y verificación de comprobantes, y el envío de
correos (factura y recuperación de contraseña) si configuraste
`EMAIL_USER`/`EMAIL_PASS` — todo desde un celular o PC fuera de tu red local,
para confirmar que no depende de tu máquina.

## Desarrollo local (sin cambios de fondo)

- Backend: `cd backend && npm run dev` (puerto 3000), con `backend/.env`
  apuntando al mismo Supabase (o a otro proyecto de Supabase para pruebas).
- Frontend: `cd frontend && npm run dev` (Vite, apunta a `http://localhost:3000`).

`DEPLOY_RAILWAY.md` y `railway.json` quedan en el repo como referencia del
despliegue anterior (basado en SQLite local), pero ya no es el camino
recomendado: con Postgres en Supabase no hace falta un Volume para persistir
datos.
