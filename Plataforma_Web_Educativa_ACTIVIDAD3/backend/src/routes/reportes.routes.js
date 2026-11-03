const express = require('express');
const router = express.Router();
const reportesController = require('../controllers/reportesFinancieros.controller');
const { requireAuth } = require('../config/auth');

// En este proyecto el rol interno "admin" representa al Administrador.
const soloAdministrador = requireAuth(['admin']);

router.get('/ingresos', soloAdministrador, reportesController.obtenerIngresos);
router.get('/pagos-completos', soloAdministrador, reportesController.obtenerPagosCompletos);
router.get('/pagos-incompletos', soloAdministrador, reportesController.obtenerPagosIncompletos);
router.get('/deportes', soloAdministrador, reportesController.obtenerPagosDeportes);
router.get('/transporte', soloAdministrador, reportesController.obtenerPagosTransporte);

module.exports = router;
