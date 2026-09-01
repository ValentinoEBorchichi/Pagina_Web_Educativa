// Validadores de texto reutilizados por los controladores de académico, auth,
// financiero y preinscripción. Antes esta misma expresión regular estaba
// copiada en cinco archivos distintos; centralizarla evita que una corrección
// futura (por ejemplo, admitir un nuevo signo en los nombres) deba repetirse
// en cada controlador.

// Un nombre/apellido válido solo tiene letras (con acentos/ñ), espacios y
// signos básicos de nombres (apóstrofo, punto, guion). No se aceptan números
// ni otros símbolos.
const NOMBRE_REGEX = /^[\p{L}\s'’.-]+$/u;

const esNombreValido = (texto) => NOMBRE_REGEX.test(String(texto || '').trim());

module.exports = { NOMBRE_REGEX, esNombreValido };
