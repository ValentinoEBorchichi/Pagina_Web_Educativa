const express = require('express');
const router = express.Router();
const serviciosController = require('../controllers/servicios.controller');
const { requireAuth } = require('../config/auth');

// Rutas protegidas
router.post('/comedor/asistencia', requireAuth(['admin', 'docente']), serviciosController.registrarAsistenciaComedor);

router.get('/transporte/rutas', requireAuth(['admin']), serviciosController.getRutasTransporte);
router.post('/transporte/rutas', requireAuth(['admin']), serviciosController.createRutaTransporte);
router.delete('/transporte/rutas/:id', requireAuth(['admin']), serviciosController.deleteRutaTransporte);
router.post('/transporte/asignar', requireAuth(['admin']), serviciosController.asignarAlumnoTransporte);

router.get('/instalaciones', requireAuth(['admin', 'docente']), serviciosController.getInstalaciones);
router.post('/instalaciones/reservar', requireAuth(['admin', 'docente']), serviciosController.reservarInstalacion);

router.post('/enfermeria/incidencia', requireAuth(['admin', 'docente']), serviciosController.registrarIncidenciaEnfermeria);

module.exports = router;
