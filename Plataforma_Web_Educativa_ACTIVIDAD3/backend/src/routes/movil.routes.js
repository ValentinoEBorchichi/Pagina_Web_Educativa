const express = require('express');
const router = express.Router();
const controller = require('../controllers/movil.controller');
const { requireAuth } = require('../config/auth');

router.get('/mis-inscripciones', requireAuth(['padre']), controller.getMisInscripciones);
router.get('/alumnos/:alumnoId/inscripciones', requireAuth(['admin', 'padre']), controller.getInscripcionesAlumno);
router.get('/alumnos/:alumnoId/estado-cuenta', requireAuth(['admin', 'padre']), controller.getEstadoCuentaAlumno);
router.get('/reportes-financieros', requireAuth(['admin']), controller.getReportesFinancieros);

module.exports = router;
