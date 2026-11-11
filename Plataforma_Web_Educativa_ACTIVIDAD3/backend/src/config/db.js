const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
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
// chain" porque no puede completarla con sus CA raíz por defecto. La forma
// correcta de resolverlo es indicarle a Node la CA de Supabase (es un
// certificado público, no un secreto):
//   1) Dashboard de Supabase -> Project Settings -> Database ->
//      SSL Configuration -> Download certificate.
//   2) Guardarlo como backend/supabase/supabase-ca.crt (se puede commitear).
// Si ese archivo no está, se sigue validando con las CA por defecto de Node
// (puede fallar contra el pooler hasta que se agregue el certificado, pero
// nunca se baja la guardia aceptando cualquier certificado).
const CA_PATH = path.join(__dirname, '../../supabase/supabase-ca.crt');
const ssl = fs.existsSync(CA_PATH)
    ? { ca: fs.readFileSync(CA_PATH, 'utf8') }
    : true;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl,
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
