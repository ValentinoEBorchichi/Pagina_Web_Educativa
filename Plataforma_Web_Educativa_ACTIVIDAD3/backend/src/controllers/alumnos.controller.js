const db = require('../config/database');
const { NOMBRE_REGEX } = require('../utils/validators');
const { manejarErrorSQL } = require('../utils/dbErrors');

// Controlador de alumnos: legajos (alta/edición), resumen académico para
// el rol padre y vinculación de hijos a la cuenta del padre. Se separó de
// academico.controller.js, que antes mezclaba esto con niveles, cursos,
// materias, actividades y horarios en un solo archivo.

// --- ALUMNOS (Legajos) ---
exports.getAlumnos = (req, res) => {
    const query = `
        SELECT alumnos.*, cursos.division, niveles.nombre as nivel_nombre
        FROM alumnos 
        LEFT JOIN cursos ON alumnos.curso_id = cursos.id
        LEFT JOIN niveles ON cursos.nivel_id = niveles.id
    `;
    db.all(query, [], (err, rows) => {
        if (err) return manejarErrorSQL(res, err);
        res.json(rows);
    });
};

exports.createAlumno = (req, res) => {
    const { nombre, apellido, dni, fecha_nacimiento, curso_id, tutor_id } = req.body;
    if (!nombre || !apellido || !dni || !fecha_nacimiento) {
        return res.status(400).json({ message: "Nombre, Apellido, DNI y Fecha de Nacimiento son obligatorios" });
    }
    if (!NOMBRE_REGEX.test(String(nombre).trim()) || !NOMBRE_REGEX.test(String(apellido).trim())) {
        return res.status(400).json({ message: "Nombre y apellido solo pueden contener letras (sin números ni símbolos)" });
    }
    if (!/^\d+$/.test(String(dni).trim())) {
        return res.status(400).json({ message: "El DNI debe ser numérico (sin puntos ni letras)" });
    }

    if (curso_id) {
        db.get("SELECT cupo, (SELECT COUNT(*) FROM alumnos WHERE curso_id = ?) as inscriptos FROM cursos WHERE id = ?", [curso_id, curso_id], (err, curso) => {
            if (err) return manejarErrorSQL(res, err);
            if (!curso) return res.status(404).json({ message: "Curso no encontrado" });
            if (curso.inscriptos >= curso.cupo) return res.status(400).json({ message: "No hay vacantes disponibles en este curso" });

            saveAlumno();
        });
    } else {
        saveAlumno();
    }

    function saveAlumno() {
        const query = "INSERT INTO alumnos (nombre, apellido, dni, fecha_nacimiento, curso_id, tutor_id) VALUES (?, ?, ?, ?, ?, ?)";
        db.run(query, [nombre, apellido, dni, fecha_nacimiento, curso_id || null, tutor_id || null], function(err) {
            if (err) return manejarErrorSQL(res, err);
            res.status(201).json({ id: this.lastID });
        });
    }
};

exports.updateAlumno = (req, res) => {
    const { id } = req.params;
    const { nombre, apellido, dni, fecha_nacimiento, curso_id, tutor_id } = req.body;

    if (!nombre || !apellido || !dni || !fecha_nacimiento) {
        return res.status(400).json({ message: "Nombre, Apellido, DNI y Fecha de Nacimiento son obligatorios" });
    }
    if (!NOMBRE_REGEX.test(String(nombre).trim()) || !NOMBRE_REGEX.test(String(apellido).trim())) {
        return res.status(400).json({ message: "Nombre y apellido solo pueden contener letras (sin números ni símbolos)" });
    }
    if (!/^\d+$/.test(String(dni).trim())) {
        return res.status(400).json({ message: "El DNI debe ser numérico (sin puntos ni letras)" });
    }

    const query = `
        UPDATE alumnos
        SET nombre = ?, apellido = ?, dni = ?, fecha_nacimiento = ?, curso_id = ?, tutor_id = ?
        WHERE id = ?
    `;
    db.run(query, [nombre, apellido, dni, fecha_nacimiento, curso_id || null, tutor_id || null, id], function(err) {
        if (err) return manejarErrorSQL(res, err);
        if (this.changes === 0) return res.status(404).json({ message: "Alumno no encontrado" });
        res.json({ message: "Alumno actualizado correctamente" });
    });
};


// --- MIS HIJOS (para rol padre) ---
exports.getMisHijos = (req, res) => {
    const query = `
        SELECT alumnos.*, cursos.division, niveles.nombre as nivel_nombre
        FROM alumnos
        LEFT JOIN cursos ON alumnos.curso_id = cursos.id
        LEFT JOIN niveles ON cursos.nivel_id = niveles.id
        WHERE alumnos.tutor_id = ?
    `;
    db.all(query, [req.user.id], (err, rows) => {
        if (err) return manejarErrorSQL(res, err);
        res.json(rows);
    });
};

// Cada una de estas tres funciones resuelve una sola pregunta sobre el alumno
// (promedio, asistencia o listado de notas). getResumenHijo antes hacía las
// cuatro cosas —verificar acceso, calcular promedio, calcular asistencia y
// listar calificaciones— en un único callback anidado; separarlas permite
// leer y probar cada cálculo de forma independiente.
function calcularPromedio(alumno_id, callback) {
    db.get("SELECT AVG(nota) AS prom FROM calificaciones WHERE alumno_id = ?", [alumno_id], (err, row) => {
        const promedio = (!err && row && row.prom != null) ? Math.round(row.prom * 100) / 100 : null;
        callback(promedio);
    });
}

function calcularAsistencia(alumno_id, callback) {
    const query = `
        SELECT COUNT(*) AS total,
               SUM(CASE WHEN estado = 'Presente' THEN 1 ELSE 0 END) AS presentes,
               SUM(CASE WHEN estado = 'Ausente' THEN 1 ELSE 0 END) AS faltas
        FROM asistencias WHERE alumno_id = ?
    `;
    db.get(query, [alumno_id], (err, row) => {
        if (err || !row) return callback({ total_clases: 0, presentes: 0, faltas: 0, asistencia_pct: null });
        callback({
            total_clases: row.total || 0,
            presentes: row.presentes || 0,
            faltas: row.faltas || 0,
            asistencia_pct: row.total ? Math.round((row.presentes / row.total) * 100) : null
        });
    });
}

function obtenerCalificacionesAlumno(alumno_id, callback) {
    const query = `
        SELECT materias.nombre AS materia_nombre, c.nota, c.trimestre
        FROM calificaciones c
        LEFT JOIN materias ON c.materia_id = materias.id
        WHERE c.alumno_id = ?
        ORDER BY materias.nombre, c.trimestre
    `;
    db.all(query, [alumno_id], (err, rows) => callback(!err && rows ? rows : []));
}

// Resumen académico de un hijo (rol padre, solo lectura): promedio, asistencia
// y faltas reales calculados desde calificaciones y asistencias. Restringido a
// los alumnos cuyo tutor_id sea el padre logueado.
exports.getResumenHijo = (req, res) => {
    const alumno_id = parseInt(req.params.alumno_id);
    if (!alumno_id) return res.status(400).json({ message: "Alumno inválido" });

    db.get("SELECT id FROM alumnos WHERE id = ? AND tutor_id = ?", [alumno_id, req.user.id], (err, alumno) => {
        if (err) return manejarErrorSQL(res, err);
        if (!alumno) return res.status(403).json({ message: "No tenés acceso a este alumno" });

        calcularPromedio(alumno_id, (promedio) => {
            calcularAsistencia(alumno_id, (asistencia) => {
                obtenerCalificacionesAlumno(alumno_id, (calificaciones) => {
                    res.json({ promedio, ...asistencia, calificaciones });
                });
            });
        });
    });
};


// --- VINCULACIÓN DE HIJOS (para rol padre) ---

// Lista los alumnos que todavía no tienen un tutor asignado,
// para que el padre pueda elegir cuál vincular a su cuenta.
exports.getAlumnosDisponibles = (req, res) => {
    const query = `
        SELECT id, nombre, apellido, dni
        FROM alumnos
        WHERE tutor_id IS NULL
        ORDER BY apellido, nombre
    `;
    db.all(query, [], (err, rows) => {
        if (err) return manejarErrorSQL(res, err);
        res.json(rows);
    });
};

// Vincula un alumno disponible a la cuenta del padre que hace la solicitud.
exports.vincularHijo = (req, res) => {
    const alumno_id = parseInt(req.body.alumno_id);
    if (!alumno_id) return res.status(400).json({ message: "Debe seleccionar un alumno" });

    // Solo permite vincular si el alumno aún no tiene tutor.
    db.run(
        "UPDATE alumnos SET tutor_id = ? WHERE id = ? AND tutor_id IS NULL",
        [req.user.id, alumno_id],
        function(err) {
            if (err) return manejarErrorSQL(res, err);
            if (this.changes === 0) {
                return res.status(400).json({ message: "El alumno no existe o ya tiene un tutor asignado" });
            }
            res.json({ message: "Alumno vinculado correctamente" });
        }
    );
};

// Desvincula un hijo de la cuenta del padre (solo si le pertenece).
exports.desvincularHijo = (req, res) => {
    const { id } = req.params;
    db.run(
        "UPDATE alumnos SET tutor_id = NULL WHERE id = ? AND tutor_id = ?",
        [id, req.user.id],
        function(err) {
            if (err) return manejarErrorSQL(res, err);
            if (this.changes === 0) {
                return res.status(404).json({ message: "No se encontró el alumno vinculado a su cuenta" });
            }
            res.json({ message: "Alumno desvinculado correctamente" });
        }
    );
};


exports.deleteAlumno = (req, res) => {
    const { id } = req.params;
    db.run("DELETE FROM alumnos WHERE id = ?", [id], function(err) {
        if (err) return manejarErrorSQL(res, err);
        if (this.changes === 0) return res.status(404).json({ message: "Alumno no encontrado" });
        res.json({ message: "Alumno eliminado correctamente" });
    });
};

