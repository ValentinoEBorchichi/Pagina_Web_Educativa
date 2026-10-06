// En el emulador de Android "localhost" es el propio emulador: 10.0.2.2 apunta a la PC.
// En un celular físico usar la IP local de la PC (p. ej. http://192.168.0.10:3000).
export const API_URL = 'http://10.0.2.2:3000';

// true mientras POST /api/auth/recuperar-password no esté implementado en el backend
// (contrato en backend/docs/openapi-movil.yaml).
export const SIMULAR_RECUPERACION = true;
