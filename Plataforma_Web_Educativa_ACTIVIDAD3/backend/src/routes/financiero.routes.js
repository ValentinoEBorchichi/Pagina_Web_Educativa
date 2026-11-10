const express = require('express');
const router = express.Router();
const financieroController = require('../controllers/financiero.controller');
const { requireAuth } = require('../config/auth');
const { recibirComprobante } = require('../middleware/uploadComprobante');

// Personal (legajo no docente, no es financiero pero vive en esta ruta por
// compatibilidad con el frontend ya existente).
router.get('/personal', requireAuth(['admin']), financieroController.getPersonal);
router.post('/personal', requireAuth(['admin']), financieroController.createPersonal);
router.put('/personal/:id', requireAuth(['admin']), financieroController.updatePersonal);
router.delete('/personal/:id', requireAuth(['admin']), financieroController.deletePersonal);

// Tarifas (tarifa_concepto) — reemplaza a la vieja "cuotas-config".
router.get('/tarifas', requireAuth(['admin', 'padre']), financieroController.getTarifas);
router.post('/tarifas', requireAuth(['admin']), financieroController.createTarifa);
router.delete('/tarifas/:id', requireAuth(['admin']), financieroController.deleteTarifa);

// Facturas — reemplaza a "pagos"/"deudores" (una factura con saldo > 0 es una deuda).
router.get('/facturas', requireAuth(['admin', 'padre', 'alumno']), financieroController.getFacturas);
router.get('/facturas/:id/detalle', requireAuth(['admin', 'padre', 'alumno']), financieroController.getFacturaDetalle);
router.get('/saldo/:alumno_id', requireAuth(['admin', 'padre']), financieroController.getSaldoAlumno);

// Comprobantes de transferencia: carga + bandeja de verificación del admin.
// El archivo se recibe como multipart/form-data en el campo "archivo".
router.post(
    '/comprobantes',
    requireAuth(['admin', 'padre', 'alumno']),
    recibirComprobante,
    financieroController.subirComprobante
);
router.get('/comprobantes', requireAuth(['admin', 'padre', 'alumno']), financieroController.getComprobantes);
router.get('/comprobantes/:id/archivo', requireAuth(['admin', 'padre', 'alumno']), financieroController.descargarComprobanteArchivo);
router.post('/comprobantes/:id/aprobar', requireAuth(['admin']), financieroController.aprobarComprobante);
router.post('/comprobantes/:id/rechazar', requireAuth(['admin']), financieroController.rechazarComprobante);

module.exports = router;
