const { Pool } = require('pg');
const SUPABASE_CA = require('./supabaseCa');
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

// La verificación del certificado TLS queda siempre activa
// (rejectUnauthorized no se toca, nunca en false): no hay ningún flag en el
// repo para desactivarla.
//
// El pooler de Supabase (Connection/Transaction pooler) a veces no manda la
// cadena completa, y Node tira "self-signed certificate in certificate
// chain" porque no puede completarla con sus CA raíz por defecto. Por eso se
// le pasa explícitamente la CA de Supabase (./supabaseCa.js, un certificado
// público descargado del dashboard: Project Settings -> Database -> SSL
// Configuration -> Download certificate), en vez de desactivar la validación.
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { ca: SUPABASE_CA },
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
