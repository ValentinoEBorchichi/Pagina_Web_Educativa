const { Pool } = require('pg');
require('dotenv').config();

// Conexión a PostgreSQL (Supabase) con el driver "pg". Pool único compartido
// por toda la app (se abre en el primer getPool() y se reutiliza).
//
// Uso en un controlador (siempre con parámetros, nunca concatenando strings):
//   const { getPool } = require('../config/db');
//   const pool = await getPool();
//   const { rows } = await pool.query('SELECT * FROM alumnos WHERE id = $1', [req.params.id]);
//
// Para transacciones (reemplaza a sql.Transaction / BEGIN-COMMIT de texto):
//   const client = await pool.connect();
//   try {
//       await client.query('BEGIN');
//       ...
//       await client.query('COMMIT');
//   } catch (err) {
//       await client.query('ROLLBACK');
//       throw err;
//   } finally {
//       client.release();
//   }

if (!process.env.DATABASE_URL) {
    throw new Error('Falta DATABASE_URL en backend/.env (connection string de Supabase/Postgres)');
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    // Supabase exige TLS; su certificado no está en la cadena de confianza
    // por defecto de Node, así que no se valida (igual que trustServerCertificate
    // se usaba en desarrollo con SQL Server).
    ssl: { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000
});

pool.on('error', (err) => console.error('Error en el pool de Postgres:', err.message));

async function getPool() {
    return pool;
}

async function closePool() {
    await pool.end();
}

module.exports = { getPool, closePool, pool };
