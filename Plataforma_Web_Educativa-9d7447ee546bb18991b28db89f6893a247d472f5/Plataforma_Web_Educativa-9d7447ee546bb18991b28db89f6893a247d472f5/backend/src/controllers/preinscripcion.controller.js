const db = require('../config/database');

exports.create = (req, res) => {
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
    // Un nombre válido solo tiene letras, espacios y signos básicos (sin números ni símbolos).
    const NOMBRE_REGEX = /^[\p{L}\s'’.-]+$/u;
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

    const query = `INSERT INTO preinscripciones 
        (alumno_nombre, alumno_dni, alumno_edad, nivel, turno, tutor_nombre, tutor_telefono, tutor_email, observaciones) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    
    db.run(query, [alumno_nombre, alumno_dni, alumno_edad, nivel, turno, tutor_nombre, tutor_telefono, tutor_email, observaciones], function(err) {
        if (err) {
            return res.status(500).json({ message: 'Error al registrar la preinscripción', error: err.message });
        }
        res.status(201).json({ message: 'Preinscripción enviada con éxito', id: this.lastID });
    });
};

exports.getAll = (req, res) => {
    const query = `SELECT * FROM preinscripciones ORDER BY fecha DESC`;
    db.all(query, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ message: 'Error al obtener las preinscripciones', error: err.message });
        }
        res.json(rows);
    });
};

exports.updateStatus = (req, res) => {
    const { id } = req.params;
    const { estado } = req.body;

    const query = `UPDATE preinscripciones SET estado = ? WHERE id = ?`;
    db.run(query, [estado, id], function(err) {
        if (err) {
            return res.status(500).json({ message: 'Error al actualizar el estado' });
        }
        res.json({ message: 'Estado actualizado correctamente' });
    });
};
