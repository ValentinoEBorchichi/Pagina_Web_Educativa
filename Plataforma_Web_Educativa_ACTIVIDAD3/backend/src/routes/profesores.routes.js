const express = require('express');
const router = express.Router();
const profesoresController = require('../controllers/profesores.controller');
const { requireAuth } = require('../config/auth');

// Registro docente (RF-05): alta del legajo y asignación a materias/cursos.
// Ambas operaciones son exclusivas del administrador.
router.post('/', requireAuth(['admin']), profesoresController.crear);
router.post('/asignar', requireAuth(['admin']), profesoresController.asignar);

module.exports = router;
