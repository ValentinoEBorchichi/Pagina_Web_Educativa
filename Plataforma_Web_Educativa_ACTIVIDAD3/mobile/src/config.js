// En Expo Go sobre un celular físico, usar la IPv4 de la PC conectada a la misma WiFi.
// Esta IP puede cambiar si el router asigna otra dirección.
export const API_URL = 'http://192.168.1.78:3000';

// true mientras POST /api/auth/recuperar-password no esté implementado en el backend
// (contrato en backend/docs/openapi-movil.yaml).
export const SIMULAR_RECUPERACION = true;
