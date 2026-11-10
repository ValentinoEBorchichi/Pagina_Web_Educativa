const crypto = require('crypto');
const { subirArchivo, eliminarArchivo, BUCKET_COMPROBANTES } = require('../config/supabaseStorage');

function calcularHash(archivo) {
    return crypto.createHash('sha256').update(archivo.buffer).digest('hex');
}

// Sube el comprobante a Supabase Storage (bucket privado) en vez de guardarlo
// en disco (en Render el disco es efímero). rutaArchivo es la clave del
// objeto dentro del bucket, no un path del filesystem.
async function guardarComprobante(archivo) {
    const hashArchivo = calcularHash(archivo);
    const rutaArchivo = crypto.randomUUID();

    await subirArchivo(BUCKET_COMPROBANTES, rutaArchivo, archivo.buffer, archivo.mimetype);

    return { nombreArchivo: archivo.originalname || 'comprobante', hashArchivo, rutaArchivo };
}

async function eliminarComprobante(rutaArchivo) {
    if (!rutaArchivo) return;
    await eliminarArchivo(BUCKET_COMPROBANTES, rutaArchivo);
}

module.exports = { calcularHash, guardarComprobante, eliminarComprobante };
