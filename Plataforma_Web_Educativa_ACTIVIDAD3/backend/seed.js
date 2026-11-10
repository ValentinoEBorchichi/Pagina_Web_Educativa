// Obsoleto: sembraba la base SQLite al arrancar (SEED_ON_BOOT) o a mano
// (`node seed.js`). Los datos de prueba ahora viven en
// backend/supabase/seed.sql: correrlo en el SQL Editor de Supabase, después
// de backend/supabase/schema.sql.
console.log('seed.js ya no hace nada: los datos de prueba viven en backend/supabase/seed.sql');
module.exports = async function seed() {};
