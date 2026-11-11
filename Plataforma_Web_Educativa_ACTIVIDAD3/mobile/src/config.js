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
  '/api/academico/alumnos-disponibles',
  '/api/academico/vincular-hijo',
  '/api/academico/desvincular-hijo',
  '/api/comunicacion/notificaciones',
  '/api/deportes',
  '/api/deportes/inscribir',
  '/api/deportes/desinscribir',
  '/api/transporte',
  '/api/transporte/inscribir',
  '/api/transporte/desinscribir',
  '/api/financiero/planes-pago',
  '/api/financiero/facturas/elegir-plan',
  '/api/financiero/facturas/cuotas',
  '/api/financiero/facturas/pdf',
]);
const ALUMNO_RECURSOS = new Set(['inscripciones', 'estado-cuenta']);

// Devuelve el alumno_id de `params`, admitiendo tanto la forma vieja
// (apiUrl(path, alumnoId)) como un objeto de parámetros con nombre.
function idDe(params) {
  const valor = params && typeof params === 'object' ? params.alumnoId : params;
  const id = Number(valor);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

// Construye solo rutas locales de la API. No admite que parámetros de pantalla
// aporten un host, protocolo o segmento de ruta arbitrario.
export function apiUrl(path, params) {
  let ruta;
  if (API_PATHS.has(path)) {
    if (path === '/api/facturas' || path === '/api/academico/mis-hijos/resumen') {
      const id = idDe(params);
      if (!id) throw new Error('Alumno inválido');
      ruta = path === '/api/facturas'
        ? `${path}?alumno_id=${encodeURIComponent(String(id))}`
        : `/api/academico/mis-hijos/${encodeURIComponent(String(id))}/resumen`;
    } else if (path === '/api/deportes/desinscribir') {
      const deporteId = Number(params?.deporteId);
      if (!Number.isSafeInteger(deporteId) || deporteId <= 0) throw new Error('Deporte inválido');
      const id = idDe(params);
      ruta = `/api/deportes/desinscribir/${encodeURIComponent(String(deporteId))}`
        + (id ? `?alumno_id=${encodeURIComponent(String(id))}` : '');
    } else if (path === '/api/transporte/desinscribir') {
      const id = idDe(params);
      ruta = '/api/transporte/desinscribir' + (id ? `?alumno_id=${encodeURIComponent(String(id))}` : '');
    } else if (path === '/api/academico/desvincular-hijo') {
      const alumnoId = Number(params?.alumnoId);
      if (!Number.isSafeInteger(alumnoId) || alumnoId <= 0) throw new Error('Alumno inválido');
      ruta = `/api/academico/desvincular-hijo/${encodeURIComponent(String(alumnoId))}`;
    } else if (path === '/api/financiero/facturas/elegir-plan' || path === '/api/financiero/facturas/cuotas' || path === '/api/financiero/facturas/pdf') {
      const facturaId = Number(params?.facturaId);
      if (!Number.isSafeInteger(facturaId) || facturaId <= 0) throw new Error('Factura inválida');
      const segmento = path === '/api/financiero/facturas/elegir-plan' ? 'elegir-plan' : path === '/api/financiero/facturas/cuotas' ? 'cuotas' : 'pdf';
      ruta = `/api/financiero/facturas/${encodeURIComponent(String(facturaId))}/${segmento}`;
    } else {
      ruta = path;
    }
  } else if (ALUMNO_RECURSOS.has(path) && idDe(params)) {
    ruta = `/api/movil/alumnos/${encodeURIComponent(String(idDe(params)))}/${path}`;
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
