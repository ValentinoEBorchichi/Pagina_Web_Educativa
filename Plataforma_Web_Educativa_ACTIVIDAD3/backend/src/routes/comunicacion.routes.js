const express = require('express');
const router = express.Router();
const comunicacionController = require('../controllers/comunicacion.controller');
const reportesController = require('../controllers/reportes.controller');
const { requireAuth } = require('../config/auth');

// Rutas protegidas
router.get('/notificaciones', requireAuth(['admin', 'docente', 'alumno', 'padre']), comunicacionController.getNotificaciones);
router.post('/notificaciones', requireAuth(['admin', 'docente']), comunicacionController.crearNotificacion);

router.get('/actividades-extra', comunicacionController.getActividadesExtra);
router.post('/actividades-extra/inscribir', requireAuth(['alumno', 'padre']), comunicacionController.inscribirActividad);

router.get('/reportes/stats', requireAuth(['admin']), reportesController.getEstadisticasGenerales);
router.get('/reportes/academico', requireAuth(['admin']), reportesController.getReporteAcademico);
router.get('/reportes/financiero', requireAuth(['admin']), reportesController.getReporteFinanciero);

module.exports = router;
