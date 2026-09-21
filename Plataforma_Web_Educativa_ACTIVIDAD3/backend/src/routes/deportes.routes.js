const express = require('express');
const router = express.Router();
const deportesController = require('../controllers/deportes.controller');
const { requireAuth } = require('../config/auth');

// Listado de deportes activos y deportes del alumno logueado.
router.get('/', requireAuth(['admin', 'padre', 'alumno', 'docente']), deportesController.listar);
router.get('/mis-inscripciones', requireAuth(['alumno']), deportesController.misInscripciones);

// Inscripción a deportes (RF-06 / RF-07). El docente no inscribe alumnos.
router.post('/inscribir', requireAuth(['admin', 'padre', 'alumno']), deportesController.inscribir);

module.exports = router;
