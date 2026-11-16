const express = require('express');
const router = express.Router();
const transporteController = require('../controllers/transporte.controller');
const { requireAuth } = require('../config/auth');

// Catálogo de recorridos (para selectores, p. ej. el alta de tarifas).
router.get('/', requireAuth(['admin', 'docente', 'padre', 'alumno']), transporteController.listar);

// Inscripción al transporte escolar (RF-09). El docente no inscribe alumnos.
router.post('/inscribir', requireAuth(['admin', 'padre', 'alumno']), transporteController.inscribir);

// Baja del transporte (?alumno_id= para padre/admin; el alumno solo la suya).
router.delete('/desinscribir', requireAuth(['admin', 'padre', 'alumno']), transporteController.desinscribir);

module.exports = router;
