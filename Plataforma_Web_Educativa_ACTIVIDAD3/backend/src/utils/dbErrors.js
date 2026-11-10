// Manejo de errores de base de datos reutilizado por todos los controladores.
// Con Postgres (antes: mssql + sqlite3) el código de error viaja en err.code:
// SQLSTATE de 5 caracteres. 23505 = unique_violation, 23503 =
// foreign_key_violation, 23514 = check_violation. 50006/50007/50008 son los
// que levanta (RAISE EXCEPTION ... USING ERRCODE) el trigger de
// Inscripciones_Deportes (ver supabase/schema.sql), mismos códigos que usaba
// el trigger de SQL Server, para no tener que tocar el código que los lee.
const CODIGOS_REGLAS = {
    50006: 'RF-06',
    50007: 'RF-07',
    50008: 'SIN_CUPO'
};

function manejarErrorPg(res, err) {
    if (CODIGOS_REGLAS[err.code]) {
        return res.status(409).json({ message: err.message, codigo: CODIGOS_REGLAS[err.code] });
    }
    if (err.code === '23505') {   // unique_violation
        return res.status(409).json({ message: 'Ya existe un registro con esos datos' });
    }
    if (err.code === '23503') {   // foreign_key_violation
        return res.status(409).json({ message: 'La operación afecta registros relacionados inexistentes o en uso' });
    }
    if (err.code === '23514') {   // check_violation
        return res.status(400).json({ message: 'Hay datos con valores fuera de lo permitido' });
    }
    // El detalle técnico queda en el log del servidor, no se expone al cliente.
    console.error('Error de base de datos:', err);
    return res.status(500).json({ message: 'Error interno del servidor' });
}

// Alias históricos (mssql/sqlite) para no tener que tocar el `catch` de cada
// controlador: todos terminan en el mismo pool de Postgres.
module.exports = { manejarErrorPg, manejarErrorSQL: manejarErrorPg, manejarErrorMssql: manejarErrorPg };
