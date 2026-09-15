const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { requireAuth } = require('../config/auth');

router.post('/registro', authController.registroFamiliar);
router.post('/login', authController.login);
router.get('/me', requireAuth(), authController.getMe);
router.get('/padres', requireAuth(), authController.getPadres);

// Gestión de usuarios y roles (solo admin)
router.get('/users', requireAuth(['admin']), authController.getUsers);
router.post('/users', requireAuth(['admin']), authController.createUser);
router.put('/users/:id/rol', requireAuth(['admin']), authController.updateUserRol);
router.delete('/users/:id', requireAuth(['admin']), authController.deleteUser);

module.exports = router;
