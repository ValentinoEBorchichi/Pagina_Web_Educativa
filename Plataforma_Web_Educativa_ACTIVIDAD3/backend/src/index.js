// Carga las variables de backend antes de importar la aplicación y las conexiones.
require('dotenv').config();

const app = require('./app');
const { getPool } = require('./config/db');
const { iniciarFacturacionProgramada } = require('./jobs/facturacion.job');
const { iniciarRecordatoriosProgramados } = require('./jobs/recordatorios.job');

const PORT = process.env.PORT || 3000;

// La base (Postgres en Supabase) y sus datos de prueba se cargan una sola vez
// con backend/supabase/schema.sql y seed.sql desde el SQL Editor de Supabase;
// ya no hay disco local ni siembra al arrancar (ver DEPLOY_RENDER.md).

// Abre el pool de Postgres al arrancar para detectar enseguida un .env/DATABASE_URL mal configurado.
getPool().catch((err) => console.error('No se pudo conectar a la base de datos:', err.message));

const tareaFacturacion = iniciarFacturacionProgramada();
const tareaRecordatorios = iniciarRecordatoriosProgramados();

const server = app.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
});

function apagar() {
    tareaFacturacion.stop();
    tareaRecordatorios.stop();
    server.close(() => process.exit(0));
}

process.once('SIGTERM', apagar);
process.once('SIGINT', apagar);
