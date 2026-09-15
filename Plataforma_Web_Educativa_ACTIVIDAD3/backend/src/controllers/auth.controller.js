const bcrypt = require('bcryptjs');
const { sql, getPool } = require('../config/db');
const { ROLES, firmarToken } = require('../config/auth');
const { NOMBRE_REGEX } = require('../utils/validators');
const { manejarErrorMssql } = require('../utils/dbErrors');

// Autenticación y gestión de usuarios (RF-01) sobre SQL Server (tabla Usuarios).
// Las respuestas mantienen la forma que ya consume el frontend: un único campo
// "nombre" (nombre completo) y "created_at".

// Largo máximo de Usuarios.username (el registro familiar usa el correo).
const USERNAME_MAX = 50;

// Nombre completo para mostrar, armado desde las columnas nombre + apellido.
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

// El frontend envía el nombre completo en un solo campo; Usuarios lo guarda en
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
    const { recordset } = await pool.request()
        .input('username', sql.VarChar(USERNAME_MAX), username)
        .input('hash', sql.VarChar(100), hash)
        .input('nombre', sql.NVarChar(100), nombre)
        .input('apellido', sql.NVarChar(100), apellido)
        .input('email', sql.VarChar(150), email)
        .input('rol', sql.VarChar(20), rol)
        .query(`INSERT INTO Usuarios (username, password_hash, nombre, apellido, email, rol)
                OUTPUT INSERTED.id
                VALUES (@username, @hash, @nombre, @apellido, @email, @rol)`);
    return recordset[0].id;
}

const esDuplicado = (err) => err.number === 2627 || err.number === 2601;

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
        manejarErrorMssql(res, err);
    }
};

exports.login = async (req, res) => {
    const username = String(req.body.username || '').trim().toLowerCase();
    const { password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: 'Usuario y contraseña requeridos' });
    }

    try {
        const pool = await getPool();
        const { recordset } = await pool.request()
            .input('username', sql.VarChar(USERNAME_MAX), username)
            .query(`SELECT id, username, password_hash, ${NOMBRE_COMPLETO} AS nombre, rol, activo
                    FROM Usuarios WHERE username = @username`);
        const user = recordset[0];

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
        manejarErrorMssql(res, err);
    }
};

exports.getMe = async (req, res) => {
    try {
        const pool = await getPool();
        const { recordset } = await pool.request()
            .input('id', sql.Int, req.user.id)
            .query(`SELECT id, username, ${NOMBRE_COMPLETO} AS nombre, rol, fecha_creacion AS created_at
                    FROM Usuarios WHERE id = @id`);
        if (!recordset[0]) return res.status(404).json({ message: 'Usuario no encontrado' });
        res.json(recordset[0]);
    } catch (err) {
        manejarErrorMssql(res, err);
    }
};

exports.getPadres = async (req, res) => {
    try {
        const pool = await getPool();
        const { recordset } = await pool.request()
            .query(`SELECT id, ${NOMBRE_COMPLETO} AS nombre, username
                    FROM Usuarios WHERE rol = 'padre' AND activo = 1
                    ORDER BY apellido, nombre`);
        res.json(recordset);
    } catch (err) {
        manejarErrorMssql(res, err);
    }
};

// --- GESTIÓN DE USUARIOS Y ROLES (solo admin) ---
exports.getUsers = async (req, res) => {
    try {
        const pool = await getPool();
        const { recordset } = await pool.request()
            .query(`SELECT id, username, ${NOMBRE_COMPLETO} AS nombre, rol, fecha_creacion AS created_at
                    FROM Usuarios ORDER BY rol, apellido, nombre`);
        res.json(recordset);
    } catch (err) {
        manejarErrorMssql(res, err);
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
        manejarErrorMssql(res, err);
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
        const { rowsAffected } = await pool.request()
            .input('id', sql.Int, id)
            .input('rol', sql.VarChar(20), rol)
            .query('UPDATE Usuarios SET rol = @rol WHERE id = @id');
        if (rowsAffected[0] === 0) return res.status(404).json({ message: 'Usuario no encontrado' });
        res.json({ message: 'Rol actualizado correctamente' });
    } catch (err) {
        // Las FK (usuario_id, rol) impiden, p. ej., que un padre con hijos deje de ser padre.
        if (err.number === 547) {
            return res.status(409).json({ message: 'No se puede cambiar el rol: el usuario tiene legajos asociados (hijos, legajo docente o de alumno)' });
        }
        manejarErrorMssql(res, err);
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
        const { rowsAffected } = await pool.request()
            .input('id', sql.Int, id)
            .query('DELETE FROM Usuarios WHERE id = @id');
        if (rowsAffected[0] === 0) return res.status(404).json({ message: 'Usuario no encontrado' });
        res.json({ message: 'Usuario eliminado correctamente' });
    } catch (err) {
        if (err.number === 547) {
            return res.status(409).json({ message: 'No se puede eliminar: el usuario tiene legajos asociados (hijos, legajo docente o de alumno)' });
        }
        manejarErrorMssql(res, err);
    }
};
