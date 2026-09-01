const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../config/database');
require('dotenv').config();

// Un nombre válido solo tiene letras (con acentos/ñ), espacios y signos básicos
// de nombres (apóstrofo, punto, guion). No se aceptan números ni otros símbolos.
const NOMBRE_REGEX = /^[\p{L}\s'’.-]+$/u;

// Política de complejidad de contraseña (solo para crear/registrar cuentas nuevas).
// No afecta el login de cuentas ya existentes. Devuelve '' si es válida o el mensaje.
const validarPassword = (pw) => {
    if (!pw || pw.length < 8) return 'La contraseña debe tener al menos 8 caracteres.';
    if (!/[A-Z]/.test(pw)) return 'La contraseña debe incluir al menos una mayúscula.';
    if (!/[0-9]/.test(pw)) return 'La contraseña debe incluir al menos un número.';
    if (!/[^A-Za-z0-9]/.test(pw)) return 'La contraseña debe incluir al menos un carácter especial (ej: ! @ # $).';
    return '';
};

// Registro de cuenta familiar (rol "padre").
// El usuario se registra con su correo y una contraseña. El correo se usa
// como nombre de usuario para iniciar sesión. Luego, desde su panel, podrá
// vincular el legajo de su hijo ya creado por la institución.
exports.registroFamiliar = async (req, res) => {
    const nombre = (req.body.nombre || '').trim().replace(/\s+/g, ' ');
    const email = (req.body.email || '').trim().toLowerCase();
    const password = req.body.password || '';

    // Validaciones básicas de entrada
    if (!nombre || !email || !password) {
        return res.status(400).json({ message: 'Todos los campos son obligatorios' });
    }
    if (!NOMBRE_REGEX.test(nombre)) {
        return res.status(400).json({ message: 'El nombre solo puede contener letras (sin números ni símbolos)' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ message: 'El correo electrónico no es válido' });
    }
    const pwError = validarPassword(password);
    if (pwError) {
        return res.status(400).json({ message: pwError });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // El rol siempre es "padre": no se toma del cliente.
    const query = `INSERT INTO users (username, password, nombre, rol) VALUES (?, ?, ?, 'padre')`;
    db.run(query, [email, hashedPassword, nombre], function(err) {
        if (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
                return res.status(400).json({ message: 'Ya existe una cuenta con ese correo' });
            }
            return res.status(500).json({ message: 'Error al registrar usuario', error: err.message });
        }
        res.status(201).json({ message: 'Cuenta creada con éxito', userId: this.lastID });
    });
};

exports.login = (req, res) => {
    const username = (req.body.username || '').trim().toLowerCase();
    const { password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: 'Usuario y contraseña requeridos' });
    }

    const query = `SELECT * FROM users WHERE username = ?`;
    db.get(query, [username], async (err, user) => {
        if (err) {
            return res.status(500).json({ message: 'Error en el servidor', error: err.message });
        }
        if (!user) {
            return res.status(401).json({ message: 'Credenciales inválidas' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Credenciales inválidas' });
        }

        const token = jwt.sign(
            { id: user.id, username: user.username, rol: user.rol },
            process.env.JWT_SECRET,
            { expiresIn: '30m' }
        );

        res.json({
            token,
            user: {
                id: user.id,
                username: user.username,
                nombre: user.nombre,
                rol: user.rol
            }
        });
    });
};

exports.getMe = (req, res) => {
    const query = `SELECT id, username, nombre, rol, created_at FROM users WHERE id = ?`;
    db.get(query, [req.user.id], (err, user) => {
        if (err) {
            return res.status(500).json({ message: 'Error al obtener datos del usuario' });
        }
        res.json(user);
    });
};

exports.getPadres = (req, res) => {
    db.all(`SELECT id, nombre, username FROM users WHERE rol = 'padre' ORDER BY nombre`, [], (err, rows) => {
        if (err) return res.status(500).json({ message: err.message });
        res.json(rows);
    });
};

// --- GESTIÓN DE USUARIOS Y ROLES (solo admin) ---
const ROLES_VALIDOS = ['admin', 'docente', 'alumno', 'padre'];

exports.getUsers = (req, res) => {
    db.all(`SELECT id, username, nombre, rol, created_at FROM users ORDER BY rol, nombre`, [], (err, rows) => {
        if (err) return res.status(500).json({ message: err.message });
        res.json(rows);
    });
};

// Crea un usuario con el rol elegido por el administrador (lista desplegable en el front).
exports.createUser = async (req, res) => {
    const nombre = (req.body.nombre || '').trim().replace(/\s+/g, ' ');
    const username = (req.body.username || '').trim().toLowerCase();
    const password = req.body.password || '';
    const rol = (req.body.rol || '').trim();

    if (!nombre || !username || !password || !rol) {
        return res.status(400).json({ message: 'Todos los campos son obligatorios' });
    }
    if (!NOMBRE_REGEX.test(nombre)) {
        return res.status(400).json({ message: 'El nombre solo puede contener letras (sin números ni símbolos)' });
    }
    if (!ROLES_VALIDOS.includes(rol)) {
        return res.status(400).json({ message: 'Rol inválido' });
    }
    const pwError = validarPassword(password);
    if (pwError) {
        return res.status(400).json({ message: pwError });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    db.run(
        `INSERT INTO users (username, password, nombre, rol) VALUES (?, ?, ?, ?)`,
        [username, hashedPassword, nombre, rol],
        function(err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(400).json({ message: 'Ya existe un usuario con ese nombre de usuario/correo' });
                }
                return res.status(500).json({ message: 'Error al crear usuario', error: err.message });
            }
            res.status(201).json({ message: 'Usuario creado con éxito', id: this.lastID });
        }
    );
};

// Cambia el rol de un usuario existente (restricción de accesos).
exports.updateUserRol = (req, res) => {
    const { id } = req.params;
    const rol = (req.body.rol || '').trim();
    if (!ROLES_VALIDOS.includes(rol)) {
        return res.status(400).json({ message: 'Rol inválido' });
    }
    // Evita que el admin se quite a sí mismo el rol de admin y quede sin acceso.
    if (parseInt(id) === req.user.id && rol !== 'admin') {
        return res.status(400).json({ message: 'No podés cambiar tu propio rol de administrador' });
    }
    db.run(`UPDATE users SET rol = ? WHERE id = ?`, [rol, id], function(err) {
        if (err) return res.status(500).json({ message: err.message });
        if (this.changes === 0) return res.status(404).json({ message: 'Usuario no encontrado' });
        res.json({ message: 'Rol actualizado correctamente' });
    });
};

exports.deleteUser = (req, res) => {
    const { id } = req.params;
    if (parseInt(id) === req.user.id) {
        return res.status(400).json({ message: 'No podés eliminar tu propia cuenta' });
    }
    db.run(`DELETE FROM users WHERE id = ?`, [id], function(err) {
        if (err) return res.status(500).json({ message: err.message });
        if (this.changes === 0) return res.status(404).json({ message: 'Usuario no encontrado' });
        res.json({ message: 'Usuario eliminado correctamente' });
    });
};
