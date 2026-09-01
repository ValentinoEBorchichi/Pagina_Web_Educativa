const express = require('express');
const router = express.Router();
const preinscripcionController = require('../controllers/preinscripcion.controller');
const { verifyToken, checkRol } = require('../middlewares/auth.middleware');

// Ruta pública para enviar preinscripción
router.post('/', preinscripcionController.create);

// Rutas protegidas para administración
router.get('/', verifyToken, checkRol(['admin']), preinscripcionController.getAll);
router.patch('/:id/status', verifyToken, checkRol(['admin']), preinscripcionController.updateStatus);

module.exports = router;
