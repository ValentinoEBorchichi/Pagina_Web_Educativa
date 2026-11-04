// En Expo Go sobre un celular físico, usar la IPv4 de la PC conectada a la misma WiFi.
// Esta IP puede cambiar si el router asigna otra dirección.
export const API_URL = 'http://192.168.1.9:3000';

const API_PATHS = new Set([
  '/api/auth/login',
  '/api/auth/password',
  '/api/auth/recuperar-password',
  '/api/auth/restablecer-password',
  '/api/movil/mis-inscripciones',
  '/api/facturas',
  '/api/comprobantes',
  '/api/padres/mis-hijos',
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
