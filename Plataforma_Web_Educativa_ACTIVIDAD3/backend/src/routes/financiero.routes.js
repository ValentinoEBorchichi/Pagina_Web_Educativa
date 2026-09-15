const express = require('express');
const router = express.Router();
const financieroController = require('../controllers/financiero.controller');
const { requireAuth } = require('../config/auth');

// Rutas protegidas
router.get('/personal', requireAuth(['admin']), financieroController.getPersonal);
router.post('/personal', requireAuth(['admin']), financieroController.createPersonal);
router.put('/personal/:id', requireAuth(['admin']), financieroController.updatePersonal);
router.delete('/personal/:id', requireAuth(['admin']), financieroController.deletePersonal);

router.get('/cuotas-config', requireAuth(['admin']), financieroController.getCuotasConfig);
router.post('/cuotas-config', requireAuth(['admin']), financieroController.createCuotaConfig);
router.delete('/cuotas-config/:id', requireAuth(['admin']), financieroController.deleteCuotaConfig);

router.post('/pagos', requireAuth(['admin']), financieroController.registrarPago);
router.get('/pagos', requireAuth(['admin', 'padre']), financieroController.getPagos);
router.get('/comprobante/:pago_id', requireAuth(['admin', 'padre']), financieroController.generarComprobante);
router.get('/saldo/:alumno_id', requireAuth(['admin', 'padre']), financieroController.getSaldoAlumno);
router.get('/deudores', requireAuth(['admin']), financieroController.getDeudores);

module.exports = router;
