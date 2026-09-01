const db = require('../config/database');
const { manejarErrorSQL } = require('../utils/dbErrors');

// Controlador de horarios: asistencia y calificaciones de materias
// (rol docente), listado de docentes y armado de horarios con validación
// de superposición. Se separó de academico.controller.js por la misma
// razón que alumnos.controller.js y actividades.controller.js.

// --- ASISTENCIA & CALIFICACIONES (Docente) ---
exports.registrarAsistencia = (req, res) => {
    const { alumno_id, fecha, estado } = req.body;
    if (!alumno_id || !estado) return res.status(400).json({ message: "Datos incompletos" });
    db.run("INSERT INTO asistencias (alumno_id, fecha, estado) VALUES (?, ?, ?)", [alumno_id, fecha, estado], function(err) {
        if (err) return manejarErrorSQL(res, err);
        res.status(201).json({ id: this.lastID });
    });
};

exports.cargarCalificacion = (req, res) => {
    const { alumno_id, materia_id, nota, trimestre } = req.body;
    if (!alumno_id) return res.status(400).json({ message: "Datos incompletos" });
    // La nota debe ser estrictamente un entero entre 1 y 10:
    // se rechazan vacíos, texto ("ocho"), alfanuméricos ("7a"), decimales (7.5) y negativos (-3).
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
    db.run("INSERT INTO calificaciones (alumno_id, materia_id, nota, trimestre) VALUES (?, ?, ?, ?)", [alumno_id, materia_id, notaNum, trimestre], function(err) {
        if (err) return manejarErrorSQL(res, err);
        res.status(201).json({ id: this.lastID });
    });
};


// --- DOCENTES ---
// La fuente de docentes es la tabla `personal` filtrada por tipo='Docente',
// que es la que gestiona el administrador (alta/baja de personal docente).
exports.getDocentes = (req, res) => {
    db.all(
        "SELECT id, nombre, apellido, dni FROM personal WHERE tipo = 'Docente' ORDER BY apellido, nombre",
        [],
        (err, rows) => {
            if (err) return manejarErrorSQL(res, err);
            res.json(rows);
        }
    );
};


// --- HORARIOS (Asignación Docente + Materia + Aula + Franja horaria) ---
// Lista los horarios con los nombres relacionados para mostrarlos legibles.
exports.getHorarios = (req, res) => {
    const query = `
        SELECT h.*,
               materias.nombre AS materia_nombre,
               niveles.nombre AS nivel_nombre,
               cursos.division AS division,
               (personal.nombre || ' ' || personal.apellido) AS docente_nombre,
               aulas.nombre AS aula_nombre
        FROM horarios h
        LEFT JOIN materias ON h.materia_id = materias.id
        LEFT JOIN cursos ON materias.curso_id = cursos.id
        LEFT JOIN niveles ON cursos.nivel_id = niveles.id
        LEFT JOIN personal ON h.docente_id = personal.id
        LEFT JOIN aulas ON h.aula_id = aulas.id
        ORDER BY h.dia_semana, h.hora_inicio
    `;
    db.all(query, [], (err, rows) => {
        if (err) return manejarErrorSQL(res, err);
        res.json(rows);
    });
};

// Crea un horario validando que no exista superposición de franja horaria
// para el MISMO docente o la MISMA aula en el mismo día de la semana.
exports.createHorario = (req, res) => {
    const materia_id = parseInt(req.body.materia_id);
    const docente_id = parseInt(req.body.docente_id);
    const aula_id = parseInt(req.body.aula_id);
    const dia_semana = parseInt(req.body.dia_semana);
    const hora_inicio = (req.body.hora_inicio || '').trim();
    const hora_fin = (req.body.hora_fin || '').trim();

    if (!materia_id || !docente_id || !aula_id || !dia_semana || !hora_inicio || !hora_fin) {
        return res.status(400).json({ message: "Todos los campos son obligatorios" });
    }
    const horaRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
    if (!horaRegex.test(hora_inicio) || !horaRegex.test(hora_fin)) {
        return res.status(400).json({ message: "Las horas deben tener formato HH:MM (24h)" });
    }
    if (hora_inicio >= hora_fin) {
        return res.status(400).json({ message: "La hora de inicio debe ser anterior a la hora de fin" });
    }

    // Dos franjas se solapan si: inicio_existente < fin_nuevo AND fin_existente > inicio_nuevo.
    const checkQuery = `
        SELECT (personal.nombre || ' ' || personal.apellido) AS docente_nombre,
               aulas.nombre AS aula_nombre,
               h.docente_id, h.aula_id, h.hora_inicio, h.hora_fin
        FROM horarios h
        LEFT JOIN personal ON h.docente_id = personal.id
        LEFT JOIN aulas ON h.aula_id = aulas.id
        WHERE h.dia_semana = ?
          AND (h.docente_id = ? OR h.aula_id = ?)
          AND h.hora_inicio < ?
          AND h.hora_fin > ?
        LIMIT 1
    `;
    db.get(checkQuery, [dia_semana, docente_id, aula_id, hora_fin, hora_inicio], (err, conflicto) => {
        if (err) return manejarErrorSQL(res, err);
        if (conflicto) {
            const motivo = conflicto.docente_id === docente_id
                ? `el docente ${conflicto.docente_nombre} ya tiene una clase`
                : `el aula ${conflicto.aula_nombre} ya está ocupada`;
            return res.status(400).json({
                message: `Superposición de horario: ${motivo} de ${conflicto.hora_inicio} a ${conflicto.hora_fin} ese día.`
            });
        }

        db.run(
            "INSERT INTO horarios (materia_id, docente_id, aula_id, dia_semana, hora_inicio, hora_fin) VALUES (?, ?, ?, ?, ?, ?)",
            [materia_id, docente_id, aula_id, dia_semana, hora_inicio, hora_fin],
            function(err) {
                if (err) return manejarErrorSQL(res, err);
                res.status(201).json({ id: this.lastID });
            }
        );
    });
};

exports.deleteHorario = (req, res) => {
    const { id } = req.params;
    db.run("DELETE FROM horarios WHERE id = ?", [id], function(err) {
        if (err) return manejarErrorSQL(res, err);
        if (this.changes === 0) return res.status(404).json({ message: "Horario no encontrado" });
        res.json({ message: "Horario eliminado correctamente" });
    });
};

