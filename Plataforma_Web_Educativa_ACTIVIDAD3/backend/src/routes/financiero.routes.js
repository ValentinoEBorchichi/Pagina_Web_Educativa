const express = require('express');
const router = express.Router();
const financieroController = require('../controllers/financiero.controller');
const authMiddleware = require('../middlewares/auth.middleware');

// Rutas protegidas
router.get('/personal', authMiddleware(['admin']), financieroController.getPersonal);
router.post('/personal', authMiddleware(['admin']), financieroController.createPersonal);
router.put('/personal/:id', authMiddleware(['admin']), financieroController.updatePersonal);
router.delete('/personal/:id', authMiddleware(['admin']), financieroController.deletePersonal);

router.get('/cuotas-config', authMiddleware(['admin']), financieroController.getCuotasConfig);
router.post('/cuotas-config', authMiddleware(['admin']), financieroController.createCuotaConfig);
router.delete('/cuotas-config/:id', authMiddleware(['admin']), financieroController.deleteCuotaConfig);

router.post('/pagos', authMiddleware(['admin']), financieroController.registrarPago);
router.get('/pagos', authMiddleware(['admin', 'padre']), financieroController.getPagos);
router.get('/comprobante/:pago_id', authMiddleware(['admin', 'padre']), financieroController.generarComprobante);
router.get('/saldo/:alumno_id', authMiddleware(['admin', 'padre']), financieroController.getSaldoAlumno);
router.get('/deudores', authMiddleware(['admin']), financieroController.getDeudores);

module.exports = router;
