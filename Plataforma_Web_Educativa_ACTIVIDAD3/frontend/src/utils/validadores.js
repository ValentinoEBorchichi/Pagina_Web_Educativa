// Validador de nombres compartido por las pantallas de administración y por
// el formulario público de preinscripción. Antes esta misma expresión
// regular estaba duplicada en varios archivos del frontend (y en varios
// controladores del backend); ahora vive en un único lugar de cada lado.
export const NOMBRE_REGEX = /^[\p{L}\s'’.-]+$/u;

export const esNombreValido = (texto) => NOMBRE_REGEX.test(String(texto || '').trim());
