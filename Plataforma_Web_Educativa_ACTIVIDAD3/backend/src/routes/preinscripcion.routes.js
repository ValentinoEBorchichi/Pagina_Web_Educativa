const express = require('express');
const router = express.Router();
const preinscripcionController = require('../controllers/preinscripcion.controller');
const { requireAuth } = require('../config/auth');

// Ruta pública para enviar preinscripción
router.post('/', preinscripcionController.create);

// Rutas protegidas para administración
router.get('/', requireAuth(['admin']), preinscripcionController.getAll);
router.patch('/:id/status', requireAuth(['admin']), preinscripcionController.updateStatus);

module.exports = router;
