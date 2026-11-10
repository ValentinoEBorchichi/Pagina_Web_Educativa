const bcrypt = require('bcryptjs');
const { getPool } = require('../config/db');
const { ROLES, firmarToken } = require('../config/auth');
const { NOMBRE_REGEX } = require('../utils/validators');
const { manejarErrorPg } = require('../utils/dbErrors');
const crypto = require('crypto');
const { enviarRecuperacionPassword } = require('../services/email.service');

const hashTokenRecuperacion = (token) => crypto.createHash('sha256').update(token).digest('hex');

// Autenticación y gestión de usuarios (RF-01) sobre la tabla unificada
// `usuarios` (Postgres/Supabase). Las respuestas mantienen la forma que ya
// consume el frontend: un único campo "nombre" (nombre completo) y "created_at".

// Largo máximo de usuarios.username (el registro familiar usa el correo).
const USERNAME_MAX = 50;

// Nombre completo para mostrar, armado desde las columnas nombre + apellido.
// CONCAT es NULL-safe en Postgres (igual que en SQL Server): un apellido NULL
// no rompe el armado del nombre completo.
const NOMBRE_COMPLETO = "LTRIM(CONCAT(nombre, ' ', apellido))";

// Política de complejidad de contraseña (solo para crear/registrar cuentas nuevas).
// No afecta el login de cuentas ya existentes. Devuelve '' si es válida o el mensaje.
const validarPassword = (pw) => {
    if (!pw || pw.length < 8) return 'La contraseña debe tener al menos 8 caracteres.';
    if (!/[A-Z]/.test(pw)) return 'La contraseña debe incluir al menos una mayúscula.';
    if (!/[0-9]/.test(pw)) return 'La contraseña debe incluir al menos un número.';
    if (!/[^A-Za-z0-9]/.test(pw)) return 'La contraseña debe incluir al menos un carácter especial (ej: ! @ # $).';
    return '';
};

// El frontend envía el nombre completo en un solo campo; usuarios lo guarda en
// nombre + apellido. Si no llega "apellido", se toma la última palabra.
const separarNombre = (nombreCompleto, apellido) => {
    const partes = nombreCompleto.split(' ');
    if (apellido) return { nombre: nombreCompleto, apellido };
    if (partes.length === 1) return { nombre: nombreCompleto, apellido: '' };
    return { nombre: partes.slice(0, -1).join(' '), apellido: partes[partes.length - 1] };
};

const limpiarTexto = (valor) => String(valor || '').trim().replace(/\s+/g, ' ');

async function insertarUsuario({ username, password, nombre, apellido, email, rol }) {
    const hash = await bcrypt.hash(password, 10);
    const pool = await getPool();
    const { rows } = await pool.query(
        `INSERT INTO usuarios (username, password_hash, nombre, apellido, email, rol)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [username, hash, nombre, apellido, email, rol]
    );
    return rows[0].id;
}

const esDuplicado = (err) => err.code === '23505';

// Registro de cuenta familiar (rol "padre").
// El usuario se registra con su correo y una contraseña. El correo se usa
// como nombre de usuario para iniciar sesión. Luego, desde su panel, podrá
// vincular el legajo de su hijo ya creado por la institución.
exports.registroFamiliar = async (req, res) => {
    const nombreCompleto = limpiarTexto(req.body.nombre);
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = req.body.password || '';

    // Validaciones básicas de entrada
    if (!nombreCompleto || !email || !password) {
        return res.status(400).json({ message: 'Todos los campos son obligatorios' });
    }
    if (!NOMBRE_REGEX.test(nombreCompleto)) {
        return res.status(400).json({ message: 'El nombre solo puede contener letras (sin números ni símbolos)' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ message: 'El correo electrónico no es válido' });
    }
    if (email.length > USERNAME_MAX) {
        return res.status(400).json({ message: `El correo no puede superar los ${USERNAME_MAX} caracteres` });
    }
    const pwError = validarPassword(password);
    if (pwError) {
        return res.status(400).json({ message: pwError });
    }

    try {
        // El rol siempre es "padre": no se toma del cliente.
        const userId = await insertarUsuario({
            ...separarNombre(nombreCompleto, limpiarTexto(req.body.apellido)),
            username: email, password, email, rol: 'padre'
        });
        res.status(201).json({ message: 'Cuenta creada con éxito', userId });
    } catch (err) {
        if (esDuplicado(err)) {
            return res.status(409).json({ message: 'Ya existe una cuenta con ese correo' });
        }
        manejarErrorPg(res, err);
    }
};

exports.login = async (req, res) => {
    const dni = String(req.body.dni || req.body.username || '').trim().toLowerCase();
    const { password } = req.body;

    if (!dni || !password) {
        return res.status(400).json({ message: 'DNI y contraseña requeridos' });
    }

    try {
        const pool = await getPool();
        const { rows } = await pool.query(
            `SELECT u.id, u.username, u.password_hash, ${NOMBRE_COMPLETO.replaceAll('nombre', 'u.nombre').replaceAll('apellido', 'u.apellido')} AS nombre, u.rol, u.activo,
                    CASE WHEN u.rol = 'padre' THEN u.id ELSE NULL END AS padre_id
             FROM usuarios u
             LEFT JOIN alumnos a ON a.usuario_id = u.id
             WHERE u.username = $1 OR a.dni = $1`,
            [dni]
        );
        const user = rows[0];

        if (!user || !(await bcrypt.compare(String(password), user.password_hash))) {
            return res.status(401).json({ message: 'Credenciales inválidas' });
        }
        if (!user.activo) {
            return res.status(403).json({ message: 'La cuenta está desactivada. Contactá a la institución.' });
        }

        res.json({
            token: firmarToken(user),
            user: {
                id: user.id,
                username: user.username,
                nombre: user.nombre,
                rol: user.rol
            }
        });
    } catch (err) {
        manejarErrorPg(res, err);
    }
};

exports.getMe = async (req, res) => {
    try {
        const pool = await getPool();
        const { rows } = await pool.query(
            `SELECT id, username, ${NOMBRE_COMPLETO} AS nombre, rol, fecha_creacion AS created_at
             FROM usuarios WHERE id = $1`,
            [req.user.id]
        );
        if (!rows[0]) return res.status(404).json({ message: 'Usuario no encontrado' });
        res.json(rows[0]);
    } catch (err) {
        manejarErrorPg(res, err);
    }
};

exports.cambiarPassword = async (req, res) => {
    const actual = String(req.body.password_actual || '');
    const nueva = String(req.body.password_nueva || '');
    if (!actual || !nueva) return res.status(400).json({ message: 'Ingresá la contraseña actual y la nueva' });
    const pwError = validarPassword(nueva);
    if (pwError) return res.status(400).json({ message: pwError });
    try {
        const pool = await getPool();
        const { rows } = await pool.query(
            'SELECT password_hash FROM usuarios WHERE id = $1 AND activo = TRUE',
            [req.user.id]
        );
        if (!rows[0] || !(await bcrypt.compare(actual, rows[0].password_hash))) {
            return res.status(400).json({ message: 'La contraseña actual no es correcta' });
        }
        const hash = await bcrypt.hash(nueva, 10);
        await pool.query('UPDATE usuarios SET password_hash = $1 WHERE id = $2', [hash, req.user.id]);
        return res.json({ message: 'Contraseña actualizada correctamente' });
    } catch (err) { return manejarErrorPg(res, err); }
};

exports.solicitarRecuperacion = async (req, res) => {
    const dni = String(req.body.dni || '').trim();
    if (!/^\d{7,8}$/.test(dni)) return res.status(400).json({ message: 'Ingresá un DNI válido de 7 u 8 dígitos' });
    try {
        const pool = await getPool();
        const { rows } = await pool.query(
            `SELECT u.id, u.nombre, u.email FROM alumnos a
             INNER JOIN usuarios u ON u.id = a.padre_id
             WHERE a.dni = $1 AND u.rol = 'padre' AND u.activo = TRUE AND u.email IS NOT NULL
             LIMIT 1`,
            [dni]
        );
        if (rows[0]) {
            const token = crypto.randomBytes(24).toString('hex');
            const user = rows[0];
            await pool.query('DELETE FROM password_reset_tokens WHERE usuario_id = $1', [user.id]);
            await pool.query(
                `INSERT INTO password_reset_tokens (usuario_id, token_hash, vence)
                 VALUES ($1, $2, now() + INTERVAL '15 minutes')`,
                [user.id, hashTokenRecuperacion(token)]
            );
            await enviarRecuperacionPassword(user.email, user.nombre, token);
        }
        return res.json({ message: 'Si encontramos una cuenta asociada, enviaremos un código al correo registrado.' });
    } catch (err) { return manejarErrorPg(res, err); }
};

exports.restablecerPassword = async (req, res) => {
    const token = String(req.body.token || '').trim();
    const nueva = String(req.body.password_nueva || '');
    if (!/^[a-f0-9]{48}$/.test(token)) return res.status(400).json({ message: 'El código de recuperación no es válido' });
    const pwError = validarPassword(nueva);
    if (pwError) return res.status(400).json({ message: pwError });
    try {
        const pool = await getPool();
        const { rows } = await pool.query(
            `SELECT usuario_id FROM password_reset_tokens
             WHERE token_hash = $1 AND usado = FALSE AND vence > now()
             LIMIT 1`,
            [hashTokenRecuperacion(token)]
        );
        if (!rows[0]) return res.status(400).json({ message: 'El código venció o ya fue utilizado. Solicitá uno nuevo.' });
        const hash = await bcrypt.hash(nueva, 10);

        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            await client.query('UPDATE usuarios SET password_hash = $1 WHERE id = $2', [hash, rows[0].usuario_id]);
            await client.query(
                "UPDATE password_reset_tokens SET usado = TRUE WHERE token_hash = $1 AND usado = FALSE",
                [hashTokenRecuperacion(token)]
            );
            await client.query('COMMIT');
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }

        return res.json({ message: 'Contraseña actualizada. Ya podés iniciar sesión.' });
    } catch (err) { return manejarErrorPg(res, err); }
};

exports.getPadres = async (req, res) => {
    try {
        const pool = await getPool();
        const { rows } = await pool.query(
            `SELECT id, ${NOMBRE_COMPLETO} AS nombre, username
             FROM usuarios WHERE rol = 'padre' AND activo = TRUE
             ORDER BY apellido, nombre`
        );
        res.json(rows);
    } catch (err) {
        manejarErrorPg(res, err);
    }
};

// --- GESTIÓN DE USUARIOS Y ROLES (solo admin) ---
exports.getUsers = async (req, res) => {
    try {
        const pool = await getPool();
        const { rows } = await pool.query(
            `SELECT id, username, ${NOMBRE_COMPLETO} AS nombre, rol, fecha_creacion AS created_at
             FROM usuarios ORDER BY rol, apellido, nombre`
        );
        res.json(rows);
    } catch (err) {
        manejarErrorPg(res, err);
    }
};

// Crea un usuario con el rol elegido por el administrador (lista desplegable en el front).
exports.createUser = async (req, res) => {
    const nombreCompleto = limpiarTexto(req.body.nombre);
    const username = String(req.body.username || '').trim().toLowerCase();
    const password = req.body.password || '';
    const rol = String(req.body.rol || '').trim();

    if (!nombreCompleto || !username || !password || !rol) {
        return res.status(400).json({ message: 'Todos los campos son obligatorios' });
    }
    if (!NOMBRE_REGEX.test(nombreCompleto)) {
        return res.status(400).json({ message: 'El nombre solo puede contener letras (sin números ni símbolos)' });
    }
    if (username.length > USERNAME_MAX) {
        return res.status(400).json({ message: `El usuario no puede superar los ${USERNAME_MAX} caracteres` });
    }
    if (!ROLES.includes(rol)) {
        return res.status(400).json({ message: 'Rol inválido' });
    }
    const pwError = validarPassword(password);
    if (pwError) {
        return res.status(400).json({ message: pwError });
    }

    try {
        const id = await insertarUsuario({
            ...separarNombre(nombreCompleto, limpiarTexto(req.body.apellido)),
            username, password, email: null, rol
        });
        res.status(201).json({ message: 'Usuario creado con éxito', id });
    } catch (err) {
        if (esDuplicado(err)) {
            return res.status(409).json({ message: 'Ya existe un usuario con ese nombre de usuario/correo' });
        }
        manejarErrorPg(res, err);
    }
};

// Cambia el rol de un usuario existente (restricción de accesos).
exports.updateUserRol = async (req, res) => {
    const id = Number(req.params.id);
    const rol = String(req.body.rol || '').trim();
    if (!Number.isInteger(id)) {
        return res.status(400).json({ message: 'Id de usuario inválido' });
    }
    if (!ROLES.includes(rol)) {
        return res.status(400).json({ message: 'Rol inválido' });
    }
    // Evita que el admin se quite a sí mismo el rol de admin y quede sin acceso.
    if (id === req.user.id && rol !== 'admin') {
        return res.status(400).json({ message: 'No podés cambiar tu propio rol de administrador' });
    }
    try {
        const pool = await getPool();
        const { rowCount } = await pool.query('UPDATE usuarios SET rol = $1 WHERE id = $2', [rol, id]);
        if (rowCount === 0) return res.status(404).json({ message: 'Usuario no encontrado' });
        res.json({ message: 'Rol actualizado correctamente' });
    } catch (err) {
        // Las FK (usuario_id, rol) impiden, p. ej., que un padre con hijos deje de ser padre.
        if (err.code === '23503') {
            return res.status(409).json({ message: 'No se puede cambiar el rol: el usuario tiene legajos asociados (hijos, legajo docente o de alumno)' });
        }
        manejarErrorPg(res, err);
    }
};

exports.deleteUser = async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
        return res.status(400).json({ message: 'Id de usuario inválido' });
    }
    if (id === req.user.id) {
        return res.status(400).json({ message: 'No podés eliminar tu propia cuenta' });
    }
    try {
        const pool = await getPool();
        const { rowCount } = await pool.query('DELETE FROM usuarios WHERE id = $1', [id]);
        if (rowCount === 0) return res.status(404).json({ message: 'Usuario no encontrado' });
        res.json({ message: 'Usuario eliminado correctamente' });
    } catch (err) {
        if (err.code === '23503') {
            return res.status(409).json({ message: 'No se puede eliminar: el usuario tiene legajos asociados (hijos, legajo docente o de alumno)' });
        }
        manejarErrorPg(res, err);
    }
};
