const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const { requireAuth } = require('../config/auth');

router.post('/tarifas', requireAuth(['admin']), adminController.crearTarifa);

module.exports = router;
