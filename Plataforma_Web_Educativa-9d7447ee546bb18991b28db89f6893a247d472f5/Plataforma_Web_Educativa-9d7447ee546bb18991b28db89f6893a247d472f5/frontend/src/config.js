// URL base del backend.
// - En desarrollo (vite dev) el frontend corre en otro puerto que el backend,
//   así que apunta a http://localhost:3000.
// - En producción se sirve TODO desde el mismo servicio (Express sirve el build),
//   así que usamos rutas relativas (mismo origen) -> API_URL = ''.
// - Si algún día separas servicios, define VITE_API_URL y tendrá prioridad.
export const API_URL =
    import.meta.env.VITE_API_URL ||
    (import.meta.env.PROD ? '' : 'http://localhost:3000');
