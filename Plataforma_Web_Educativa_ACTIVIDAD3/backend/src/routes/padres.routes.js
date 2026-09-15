const express = require('express');
const router = express.Router();
const padresController = require('../controllers/padres.controller');
const { requireAuth } = require('../config/auth');

// Vista de padres (RF-02): cada padre consulta únicamente a sus propios hijos.
router.get('/mis-hijos', requireAuth(['padre']), padresController.misHijos);

module.exports = router;
