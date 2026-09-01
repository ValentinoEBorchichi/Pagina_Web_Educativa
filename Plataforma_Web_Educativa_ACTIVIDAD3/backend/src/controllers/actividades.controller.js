const db = require('../config/database');
const { NOMBRE_REGEX } = require('../utils/validators');
const { manejarErrorSQL } = require('../utils/dbErrors');

// Controlador de actividades extracurriculares: alta/edición, inscripción
// de alumnos y carga de asistencia/calificación por parte de los
// profesores a cargo. Se separó de academico.controller.js por la misma
// razón que alumnos.controller.js y horarios.controller.js.

// --- ACTIVIDADES EXTRACURRICULARES ---
// Lista las actividades con la cantidad de inscriptos (para mostrar cupo disponible).
exports.getActividades = (req, res) => {
    const query = `
        SELECT actividades_extra.*,
               (SELECT COUNT(*) FROM inscripciones_extra WHERE actividad_id = actividades_extra.id) as inscriptos
        FROM actividades_extra
        ORDER BY tipo, nombre
    `;
    db.all(query, [], (err, rows) => {
        if (err) return manejarErrorSQL(res, err);
        res.json(rows);
    });
};

exports.createActividad = (req, res) => {
    const nombre = (req.body.nombre || '').trim();
    const { tipo, horario, cupo_max } = req.body;
    if (!nombre || !tipo || cupo_max === undefined || cupo_max === null || cupo_max === '') {
        return res.status(400).json({ message: "Nombre, tipo y cupo son obligatorios" });
    }
    if (!NOMBRE_REGEX.test(nombre)) return res.status(400).json({ message: "El nombre de la actividad solo puede contener letras (sin números ni símbolos)" });
    const cupoNum = Number(cupo_max);
    if (!Number.isInteger(cupoNum) || cupoNum <= 0) {
        return res.status(400).json({ message: "El cupo debe ser un número entero mayor a 0" });
    }
    db.run(
        "INSERT INTO actividades_extra (nombre, tipo, horario, cupo_max) VALUES (?, ?, ?, ?)",
        [nombre, tipo, horario || null, cupoNum],
        function(err) {
            if (err) return manejarErrorSQL(res, err);
            res.status(201).json({ id: this.lastID });
        }
    );
};

exports.updateActividad = (req, res) => {
    const { id } = req.params;
    const nombre = (req.body.nombre || '').trim();
    const { tipo, horario, cupo_max } = req.body;
    if (!nombre || !tipo || cupo_max === undefined || cupo_max === null || cupo_max === '') {
        return res.status(400).json({ message: "Nombre, tipo y cupo son obligatorios" });
    }
    if (!NOMBRE_REGEX.test(nombre)) return res.status(400).json({ message: "El nombre de la actividad solo puede contener letras (sin números ni símbolos)" });
    const cupoNum = Number(cupo_max);
    if (!Number.isInteger(cupoNum) || cupoNum <= 0) {
        return res.status(400).json({ message: "El cupo debe ser un número entero mayor a 0" });
    }
    db.run(
        "UPDATE actividades_extra SET nombre = ?, tipo = ?, horario = ?, cupo_max = ? WHERE id = ?",
        [nombre, tipo, horario || null, cupoNum, id],
        function(err) {
            if (err) return manejarErrorSQL(res, err);
            if (this.changes === 0) return res.status(404).json({ message: "Actividad no encontrada" });
            res.json({ message: "Actividad actualizada correctamente" });
        }
    );
};

exports.deleteActividad = (req, res) => {
    const { id } = req.params;
    db.run("DELETE FROM actividades_extra WHERE id = ?", [id], function(err) {
        if (err) return manejarErrorSQL(res, err);
        if (this.changes === 0) return res.status(404).json({ message: "Actividad no encontrada" });
        res.json({ message: "Actividad eliminada correctamente" });
    });
};

// El alumno se inscribe a una actividad. Valida cupo y que no se inscriba dos veces.
// La inscripción se guarda contra el usuario logueado (req.user.id).
exports.inscribirActividad = (req, res) => {
    const actividad_id = parseInt(req.body.actividad_id);
    const alumno_id = req.user.id;
    if (!actividad_id) return res.status(400).json({ message: "Actividad inválida" });

    db.get("SELECT cupo_max FROM actividades_extra WHERE id = ?", [actividad_id], (err, actividad) => {
        if (err) return manejarErrorSQL(res, err);
        if (!actividad) return res.status(404).json({ message: "La actividad no existe" });

        db.get(
            "SELECT COUNT(*) as total FROM inscripciones_extra WHERE actividad_id = ?",
            [actividad_id],
            (err, row) => {
                if (err) return manejarErrorSQL(res, err);
                if (row.total >= actividad.cupo_max) {
                    return res.status(400).json({ message: "No hay cupos disponibles en esta actividad" });
                }

                db.get(
                    "SELECT id FROM inscripciones_extra WHERE actividad_id = ? AND alumno_id = ?",
                    [actividad_id, alumno_id],
                    (err, existe) => {
                        if (err) return manejarErrorSQL(res, err);
                        if (existe) return res.status(400).json({ message: "Ya estás inscripto en esta actividad" });

                        db.run(
                            "INSERT INTO inscripciones_extra (alumno_id, actividad_id) VALUES (?, ?)",
                            [alumno_id, actividad_id],
                            function(err) {
                                if (err) return manejarErrorSQL(res, err);
                                res.status(201).json({ message: "Inscripción realizada con éxito", id: this.lastID });
                            }
                        );
                    }
                );
            }
        );
    });
};

// Lista las actividades en las que está inscripto el alumno logueado.
exports.getMisInscripciones = (req, res) => {
    const query = `
        SELECT inscripciones_extra.id as inscripcion_id, actividades_extra.*
        FROM inscripciones_extra
        JOIN actividades_extra ON inscripciones_extra.actividad_id = actividades_extra.id
        WHERE inscripciones_extra.alumno_id = ?
        ORDER BY actividades_extra.tipo, actividades_extra.nombre
    `;
    db.all(query, [req.user.id], (err, rows) => {
        if (err) return manejarErrorSQL(res, err);
        res.json(rows);
    });
};

// El alumno cancela su inscripción a una actividad.
exports.desinscribirActividad = (req, res) => {
    const { actividad_id } = req.params;
    db.run(
        "DELETE FROM inscripciones_extra WHERE actividad_id = ? AND alumno_id = ?",
        [actividad_id, req.user.id],
        function(err) {
            if (err) return manejarErrorSQL(res, err);
            if (this.changes === 0) return res.status(404).json({ message: "No estabas inscripto en esta actividad" });
            res.json({ message: "Inscripción cancelada" });
        }
    );
};


// --- ASISTENCIA Y NOTAS DE ACTIVIDADES EXTRACURRICULARES (profesores) ---
// Las inscripciones (inscripciones_extra.alumno_id) referencian al usuario alumno
// que se inscribió, por eso se obtiene el nombre desde la tabla users.
exports.getInscriptosActividad = (req, res) => {
    const { actividad_id } = req.params;
    const query = `
        SELECT ie.alumno_id, users.nombre AS alumno_nombre, ie.fecha_inscripcion,
               (SELECT nota FROM actividad_calificaciones
                 WHERE actividad_id = ie.actividad_id AND alumno_id = ie.alumno_id
                 ORDER BY id DESC LIMIT 1) AS ultima_nota
        FROM inscripciones_extra ie
        JOIN users ON ie.alumno_id = users.id
        WHERE ie.actividad_id = ?
        ORDER BY users.nombre
    `;
    db.all(query, [actividad_id], (err, rows) => {
        if (err) return manejarErrorSQL(res, err);
        res.json(rows);
    });
};

exports.registrarAsistenciaActividad = (req, res) => {
    const { actividad_id, alumno_id, fecha, estado } = req.body;
    if (!actividad_id || !alumno_id || !estado) {
        return res.status(400).json({ message: "Datos incompletos" });
    }
    if (!['Presente', 'Ausente', 'Tarde'].includes(estado)) {
        return res.status(400).json({ message: "Estado inválido" });
    }
    db.run(
        "INSERT INTO actividad_asistencias (actividad_id, alumno_id, fecha, estado) VALUES (?, ?, ?, ?)",
        [actividad_id, alumno_id, fecha || null, estado],
        function(err) {
            if (err) return manejarErrorSQL(res, err);
            res.status(201).json({ id: this.lastID });
        }
    );
};

exports.cargarCalificacionActividad = (req, res) => {
    const { actividad_id, alumno_id, nota } = req.body;
    if (!actividad_id || !alumno_id) {
        return res.status(400).json({ message: "Datos incompletos" });
    }
    // Misma validación estricta que las calificaciones de materias: entero 1 a 10.
    if (nota === undefined || nota === null || String(nota).trim() === '') {
        return res.status(400).json({ message: "La nota es obligatoria" });
    }
    if (!/^\d+$/.test(String(nota).trim())) {
        return res.status(400).json({ message: "La nota debe ser un número entero (sin decimales, texto ni símbolos)" });
    }
    const notaNum = Number(nota);
    if (notaNum < 1 || notaNum > 10) {
        return res.status(400).json({ message: "La nota debe estar en el rango de 1 a 10" });
    }
    db.run(
        "INSERT INTO actividad_calificaciones (actividad_id, alumno_id, nota) VALUES (?, ?, ?)",
        [actividad_id, alumno_id, notaNum],
        function(err) {
            if (err) return manejarErrorSQL(res, err);
            res.status(201).json({ id: this.lastID });
        }
    );
};
