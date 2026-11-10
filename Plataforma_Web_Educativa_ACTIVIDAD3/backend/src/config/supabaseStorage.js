const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Cliente de Supabase Storage, solo para uso del backend: usa la service_role
// key (acceso total a los buckets, nunca se expone al frontend/mobile).
// Reemplaza el guardado en disco de backend/uploads (efímero en Render).

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Faltan SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY en backend/.env');
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
});

const BUCKET_COMPROBANTES = process.env.SUPABASE_BUCKET_COMPROBANTES || 'comprobantes';
const BUCKET_FACTURAS = process.env.SUPABASE_BUCKET_FACTURAS || 'facturas';

async function subirArchivo(bucket, ruta, buffer, contentType) {
    const { error } = await supabase.storage.from(bucket).upload(ruta, buffer, {
        contentType,
        upsert: false
    });
    if (error) throw error;
    return ruta;
}

async function descargarArchivo(bucket, ruta) {
    const { data, error } = await supabase.storage.from(bucket).download(ruta);
    if (error) throw error;
    return Buffer.from(await data.arrayBuffer());
}

async function eliminarArchivo(bucket, ruta) {
    const { error } = await supabase.storage.from(bucket).remove([ruta]);
    if (error) console.error(`No se pudo borrar ${bucket}/${ruta}:`, error.message);
}

module.exports = {
    supabase,
    BUCKET_COMPROBANTES,
    BUCKET_FACTURAS,
    subirArchivo,
    descargarArchivo,
    eliminarArchivo
};
