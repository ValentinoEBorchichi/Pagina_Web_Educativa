const jwt = require('jsonwebtoken');
require('dotenv').config();

// Autenticación y control de acceso por roles (RF-01).
// El login firma un JWT con { id, username, rol } del usuario de SQL Server
// (tabla Usuarios); cada ruta protegida lo verifica y chequea el rol.
//
// Uso en una ruta:
//   const { requireAuth } = require('../config/auth');
//   router.post('/inscribir', requireAuth(['admin', 'padre', 'alumno']), controller.inscribir);
//   router.get('/me', requireAuth(), controller.getMe);   // cualquier usuario logueado

const ROLES = Object.freeze(['admin', 'docente', 'alumno', 'padre']);

// Igual al cierre de sesión por inactividad del frontend (30 minutos).
const TOKEN_EXPIRA_EN = '30m';

if (!process.env.JWT_SECRET) {
    throw new Error('Falta JWT_SECRET en backend/.env');
}

function firmarToken(usuario) {
    return jwt.sign(
        { id: usuario.id, username: usuario.username, rol: usuario.rol },
        process.env.JWT_SECRET,
        { expiresIn: TOKEN_EXPIRA_EN }
    );
}

// Exige el header "Authorization: Bearer <token>" y deja el payload en req.user.
function verificarToken(req, res, next) {
    const [tipo, token] = (req.headers.authorization || '').split(' ');
    if (tipo !== 'Bearer' || !token) {
        return res.status(401).json({ message: 'Token no proporcionado' });
    }
    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
        next();
    } catch (err) {
        return res.status(401).json({ message: 'Token inválido o expirado' });
    }
}

function autorizarRoles(roles) {
    // Un rol mal escrito en una ruta dejaría a todos afuera sin aviso:
    // se detecta al arrancar el servidor.
    const desconocidos = roles.filter((rol) => !ROLES.includes(rol));
    if (desconocidos.length) {
        throw new Error(`Roles desconocidos en la ruta: ${desconocidos.join(', ')}`);
    }
    return (req, res, next) => {
        if (!roles.includes(req.user.rol)) {
            return res.status(403).json({ message: 'Acceso denegado: permisos insuficientes' });
        }
        next();
    };
}

// Verifica el token y, si se indican roles, que el usuario tenga alguno de ellos.
function requireAuth(roles = []) {
    return roles.length ? [verificarToken, autorizarRoles(roles)] : [verificarToken];
}

module.exports = { ROLES, firmarToken, verificarToken, autorizarRoles, requireAuth };
