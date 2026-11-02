const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');

const BASE_PATH = path.resolve(__dirname, '../../uploads/comprobantes');
const BASE_PREFIX = `${BASE_PATH}${path.sep}`;

function calcularHash(archivo) {
    return crypto.createHash('sha256').update(archivo.buffer).digest('hex');
}

async function guardarComprobante(archivo) {
    const nombreArchivo = path.basename(archivo.originalname || 'comprobante');
    const hashArchivo = calcularHash(archivo);
    const nombreFisico = crypto.randomUUID();
    const rutaArchivo = path.normalize(path.join(BASE_PATH, nombreFisico));

    if (!rutaArchivo.startsWith(BASE_PREFIX)) {
        throw new Error('Ruta de archivo no permitida');
    }

    await fs.mkdir(BASE_PATH, { recursive: true });
    await fs.writeFile(rutaArchivo, archivo.buffer, { flag: 'wx' });

    return { nombreArchivo, hashArchivo, rutaArchivo };
}

async function eliminarComprobante(rutaArchivo) {
    if (!rutaArchivo) return;

    const rutaNormalizada = path.normalize(rutaArchivo);
    if (!rutaNormalizada.startsWith(BASE_PREFIX)) return;

    await fs.unlink(rutaNormalizada).catch(() => undefined);
}

module.exports = { calcularHash, guardarComprobante, eliminarComprobante };
