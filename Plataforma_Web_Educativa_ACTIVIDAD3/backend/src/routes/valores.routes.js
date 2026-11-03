const express = require('express');
const router = express.Router();
const valoresController = require('../controllers/valores.controller');
const { requireAuth } = require('../config/auth');

// La aplicación usa el rol interno "admin" para representar al Administrador.
router.get('/', requireAuth(['admin']), valoresController.obtenerValoresVigentes);
router.post('/', requireAuth(['admin']), valoresController.guardarValores);

module.exports = router;
