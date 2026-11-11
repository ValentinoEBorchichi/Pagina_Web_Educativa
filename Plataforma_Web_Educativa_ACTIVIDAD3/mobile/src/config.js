// URL pública del backend en Render, inyectada en build time vía
// EXPO_PUBLIC_API_URL (ver mobile/.env.example). Sin esa variable, cae a una
// IP de LAN -solo sirve para desarrollo local con Expo Go en la misma WiFi
// que la PC donde corre el backend; esa IP puede cambiar si el router asigna
// otra dirección-.
export const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://10.13.25.198:3000';

const API_PATHS = new Set([
  '/api/auth/login',
  '/api/auth/me',
  '/api/auth/password',
  '/api/auth/recuperar-password',
  '/api/auth/restablecer-password',
  '/api/movil/mis-inscripciones',
  '/api/facturas',
  '/api/comprobantes',
  '/api/padres/mis-hijos',
  '/api/academico/mis-hijos/resumen',
]);
const ALUMNO_RECURSOS = new Set(['inscripciones', 'estado-cuenta']);

// Construye solo rutas locales de la API. No admite que parámetros de pantalla
// aporten un host, protocolo o segmento de ruta arbitrario.
export function apiUrl(path, alumnoId) {
  let ruta;
  if (API_PATHS.has(path)) {
    if (path === '/api/facturas') {
      const id = Number(alumnoId);
      if (!Number.isSafeInteger(id) || id <= 0) throw new Error('Alumno inválido');
      ruta = `${path}?alumno_id=${encodeURIComponent(String(id))}`;
    } else if (path === '/api/academico/mis-hijos/resumen') {
      const id = Number(alumnoId);
      if (!Number.isSafeInteger(id) || id <= 0) throw new Error('Alumno inválido');
      ruta = `/api/academico/mis-hijos/${encodeURIComponent(String(id))}/resumen`;
    } else {
      ruta = path;
    }
  } else if (ALUMNO_RECURSOS.has(path) && Number.isSafeInteger(Number(alumnoId)) && Number(alumnoId) > 0) {
    ruta = `/api/movil/alumnos/${encodeURIComponent(String(Number(alumnoId)))}/${path}`;
  } else {
    throw new Error('Ruta de API no permitida');
  }

  const base = new URL(API_URL);
  const destino = new URL(ruta, base);
  if (destino.origin !== base.origin || !destino.pathname.startsWith('/api/')) {
    throw new Error('Destino de API no permitido');
  }
  return destino.toString();
}

// El envío se desactiva si el endpoint documentado aún no está disponible.
export const SIMULAR_RECUPERACION = false;
