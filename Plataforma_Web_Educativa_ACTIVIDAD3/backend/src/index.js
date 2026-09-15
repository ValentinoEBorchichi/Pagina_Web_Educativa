const app = require('./app');
const db = require('./config/database');
const { getPool } = require('./config/db');

const PORT = process.env.PORT || 3000;

// Siembra opcional al arrancar (idempotente: usa INSERT OR IGNORE / chequeos).
// Útil en plataformas con disco efímero (p.ej. plan gratuito de Render), donde
// la base SQLite se reinicia en cada deploy: así siempre quedan los datos demo.
// Se activa con SEED_ON_BOOT=true en las variables de entorno.
if (process.env.SEED_ON_BOOT === 'true') {
    const seed = require('../seed');
    // Pequeño delay para que database.js termine de crear las tablas.
    setTimeout(() => {
        seed().catch((err) => console.error('Error en seed inicial:', err));
    }, 1000);
}

// Abre el pool de SQL Server al arrancar para detectar enseguida un .env mal
// configurado (los módulos en SQLite siguen funcionando aunque falle).
getPool().catch((err) => console.error('No se pudo conectar a SQL Server:', err.message));

app.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
});
