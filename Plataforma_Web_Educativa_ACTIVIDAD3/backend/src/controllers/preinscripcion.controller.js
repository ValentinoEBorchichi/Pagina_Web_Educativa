const { getPool } = require('../config/db');
const { NOMBRE_REGEX } = require('../utils/validators');

exports.create = async (req, res) => {
    const {
        alumno_nombre,
        alumno_dni,
        alumno_edad,
        nivel,
        turno,
        tutor_nombre,
        tutor_telefono,
        tutor_email,
        observaciones
    } = req.body;

    if (!alumno_nombre || !alumno_dni || !alumno_edad || !nivel || !turno || !tutor_nombre || !tutor_telefono || !tutor_email) {
        return res.status(400).json({ message: 'Todos los campos obligatorios deben ser completados' });
    }
    // Validaciones de formato y rango (no se aceptan negativos ni fuera de rango).
    if (!NOMBRE_REGEX.test(String(alumno_nombre).trim())) {
        return res.status(400).json({ message: 'El nombre del alumno solo puede contener letras (sin números ni símbolos)' });
    }
    if (!NOMBRE_REGEX.test(String(tutor_nombre).trim())) {
        return res.status(400).json({ message: 'El nombre del tutor solo puede contener letras (sin números ni símbolos)' });
    }
    if (!/^\d+$/.test(String(alumno_dni).trim())) {
        return res.status(400).json({ message: 'El DNI debe ser numérico (sin puntos ni letras)' });
    }
    const edadNum = Number(alumno_edad);
    if (!Number.isInteger(edadNum) || edadNum < 3 || edadNum > 18) {
        return res.status(400).json({ message: 'La edad del alumno debe estar entre 3 y 18 años' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(tutor_email).trim())) {
        return res.status(400).json({ message: 'El correo electrónico no tiene un formato válido' });
    }

    try {
        const pool = await getPool();
        const { rows } = await pool.query(
            `INSERT INTO preinscripciones
                (alumno_nombre, alumno_dni, alumno_edad, nivel, turno, tutor_nombre, tutor_telefono, tutor_email, observaciones)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
            [alumno_nombre, alumno_dni, alumno_edad, nivel, turno, tutor_nombre, tutor_telefono, tutor_email, observaciones]
        );
        res.status(201).json({ message: 'Preinscripción enviada con éxito', id: rows[0].id });
    } catch (err) {
        res.status(500).json({ message: 'Error al registrar la preinscripción', error: err.message });
    }
};

exports.getAll = async (req, res) => {
    try {
        const pool = await getPool();
        const { rows } = await pool.query('SELECT * FROM preinscripciones ORDER BY fecha DESC');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ message: 'Error al obtener las preinscripciones', error: err.message });
    }
};

exports.updateStatus = async (req, res) => {
    const { id } = req.params;
    const { estado } = req.body;

    try {
        const pool = await getPool();
        await pool.query('UPDATE preinscripciones SET estado = $1 WHERE id = $2', [estado, id]);
        res.json({ message: 'Estado actualizado correctamente' });
    } catch (err) {
        res.status(500).json({ message: 'Error al actualizar el estado' });
    }
};
