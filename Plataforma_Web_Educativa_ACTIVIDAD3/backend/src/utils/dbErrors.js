// Manejo de errores de base de datos reutilizado por todos los controladores.
// Antes, cada callback de sqlite3 repetía la misma línea
// "if (err) return res.status(500).json({ message: err.message })"
// (75 veces en 6 archivos distintos). Centralizarla evita reescribir el mismo
// texto en cada consulta y deja un único lugar para, por ejemplo, loguear el
// error o cambiar el formato de respuesta en el futuro.
function manejarErrorSQL(res, err) {
    return res.status(500).json({ message: err.message });
}

module.exports = { manejarErrorSQL };
