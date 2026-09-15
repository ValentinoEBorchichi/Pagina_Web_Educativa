const express = require('express');
const router = express.Router();
const deportesController = require('../controllers/deportes.controller');
const { requireAuth } = require('../config/auth');

// Inscripción a deportes (RF-06 / RF-07). El docente no inscribe alumnos.
router.post('/inscribir', requireAuth(['admin', 'padre', 'alumno']), deportesController.inscribir);

module.exports = router;
