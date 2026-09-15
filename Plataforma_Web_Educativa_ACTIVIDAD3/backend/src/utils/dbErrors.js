// Manejo de errores de base de datos reutilizado por todos los controladores.
// Antes, cada callback de sqlite3 repetía la misma línea
// "if (err) return res.status(500).json({ message: err.message })"
// (75 veces en 6 archivos distintos). Centralizarla evita reescribir el mismo
// texto en cada consulta y deja un único lugar para, por ejemplo, loguear el
// error o cambiar el formato de respuesta en el futuro.
function manejarErrorSQL(res, err) {
    return res.status(500).json({ message: err.message });
}

// --- SQL Server (driver mssql): err.number trae el código de error del motor ---

// Reglas de negocio lanzadas por el trigger de Inscripciones_Deportes
// (ver database_schema.sql). Su mensaje ya está pensado para el usuario.
const CODIGOS_REGLAS = {
    50006: 'RF-06',
    50007: 'RF-07',
    50008: 'SIN_CUPO'
};

function manejarErrorMssql(res, err) {
    if (CODIGOS_REGLAS[err.number]) {
        return res.status(409).json({ message: err.message, codigo: CODIGOS_REGLAS[err.number] });
    }
    if (err.number === 2627 || err.number === 2601) {   // UNIQUE / índice único
        return res.status(409).json({ message: 'Ya existe un registro con esos datos' });
    }
    if (err.number === 547) {                            // FOREIGN KEY o CHECK
        return /CHECK/.test(err.message)
            ? res.status(400).json({ message: 'Hay datos con valores fuera de lo permitido' })
            : res.status(409).json({ message: 'La operación afecta registros relacionados inexistentes o en uso' });
    }
    // El detalle técnico queda en el log del servidor, no se expone al cliente.
    console.error('Error de SQL Server:', err);
    return res.status(500).json({ message: 'Error interno del servidor' });
}

module.exports = { manejarErrorSQL, manejarErrorMssql };
