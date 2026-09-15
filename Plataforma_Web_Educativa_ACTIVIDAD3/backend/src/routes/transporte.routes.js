const express = require('express');
const router = express.Router();
const transporteController = require('../controllers/transporte.controller');
const { requireAuth } = require('../config/auth');

// Inscripción al transporte escolar (RF-09). El docente no inscribe alumnos.
router.post('/inscribir', requireAuth(['admin', 'padre', 'alumno']), transporteController.inscribir);

module.exports = router;
