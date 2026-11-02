const multer = require('multer');

const EXTENSIONES_PERMITIDAS = new Set(['jpg', 'jpeg', 'png', 'pdf']);
const TIPOS_MIME_PERMITIDOS = new Set([
    'image/jpeg',
    'image/png',
    'application/pdf'
]);

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, callback) => {
        const nombre = file.originalname || '';
        const extension = nombre.includes('.')
            ? nombre.split('.').pop().toLowerCase()
            : '';

        if (!EXTENSIONES_PERMITIDAS.has(extension) || !TIPOS_MIME_PERMITIDOS.has(file.mimetype)) {
            return callback(new Error('Solo se permiten archivos JPG, PNG o PDF'));
        }

        callback(null, true);
    }
});

function recibirComprobante(req, res, next) {
    upload.single('archivo')(req, res, (error) => {
        if (!error) return next();

        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).json({ message: 'El archivo no puede superar los 5 MB' });
        }

        return res.status(400).json({ message: error.message });
    });
}

module.exports = { recibirComprobante };
