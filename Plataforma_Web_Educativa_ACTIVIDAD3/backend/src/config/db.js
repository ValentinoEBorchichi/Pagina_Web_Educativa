const sql = require('mssql');
require('dotenv').config();

// Conexión a Microsoft SQL Server (driver "mssql").
// Se usa un único pool compartido por toda la app: se crea en el primer
// getPool() y se reutiliza en cada consulta (no abrir/cerrar por request).
//
// Uso en un controlador (siempre con parámetros, nunca concatenando strings):
//   const { sql, getPool } = require('../config/db');
//   const pool = await getPool();
//   const { recordset } = await pool.request()
//       .input('id', sql.Int, req.params.id)
//       .query('SELECT * FROM Alumnos WHERE id = @id');

const config = {
    server: process.env.DB_SERVER || 'localhost',
    database: process.env.DB_NAME || 'EducarParaTransformar',
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    },
    options: {
        // SQL Server local (certificado autofirmado): DB_TRUST_SERVER_CERTIFICATE=true.
        // Producción / Azure: dejarlo en false para validar el certificado.
        encrypt: process.env.DB_ENCRYPT !== 'false',
        trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true'
    }
};

// Instancia con nombre (p. ej. SQLEXPRESS) o puerto fijo: son excluyentes.
if (process.env.DB_INSTANCE) {
    config.options.instanceName = process.env.DB_INSTANCE;
} else {
    config.port = parseInt(process.env.DB_PORT, 10) || 1433;
}

let poolPromise = null;

function getPool() {
    if (!poolPromise) {
        if (!config.user || !config.password) {
            return Promise.reject(new Error('Faltan DB_USER y/o DB_PASSWORD en backend/.env'));
        }
        poolPromise = new sql.ConnectionPool(config)
            .connect()
            .then((pool) => {
                console.log(`Conectado a SQL Server (${config.server} / ${config.database}).`);
                pool.on('error', (err) => console.error('Error en el pool de SQL Server:', err.message));
                return pool;
            })
            .catch((err) => {
                // Permite reintentar la conexión en la próxima llamada.
                poolPromise = null;
                throw err;
            });
    }
    return poolPromise;
}

// Cierre ordenado (scripts, tests o apagado del servidor).
async function closePool() {
    if (!poolPromise) return;
    const pool = await poolPromise.catch(() => null);
    poolPromise = null;
    if (pool) await pool.close();
}

module.exports = { sql, getPool, closePool };
