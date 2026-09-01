const jwt = require('jsonwebtoken');
require('dotenv').config();

const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(403).json({ message: 'Token no proporcionado' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).json({ message: 'Token inválido o expirado' });
        }
        req.user = decoded;
        next();
    });
};

const checkRol = (roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.rol)) {
            return res.status(403).json({ message: 'Acceso denegado: permisos insuficientes' });
        }
        next();
    };
};

// Middleware principal que combina verificación de token y chequeo de rol
const authMiddleware = (roles) => [verifyToken, checkRol(roles)];

// Exportaciones
authMiddleware.verifyToken = verifyToken;
authMiddleware.checkRol = checkRol;

module.exports = authMiddleware;
