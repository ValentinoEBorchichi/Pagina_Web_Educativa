const db = require('../config/database');

// Un nombre/apellido válido solo tiene letras, espacios y signos básicos (sin números ni símbolos).
const NOMBRE_REGEX = /^[\p{L}\s'’.-]+$/u;

// --- NIVELES ---
exports.getNiveles = (req, res) => {
    db.all("SELECT * FROM niveles", [], (err, rows) => {
        if (err) return res.status(500).json({ message: err.message });
        res.json(rows);
    });
};

exports.createNivel = (req, res) => {
    const nombre = (req.body.nombre || '').trim();
    if (!nombre) return res.status(400).json({ message: "El nombre del nivel es obligatorio" });
    if (!NOMBRE_REGEX.test(nombre)) return res.status(400).json({ message: "El nombre del nivel solo puede contener letras (sin números ni símbolos)" });
    db.run("INSERT INTO niveles (nombre) VALUES (?)", [nombre], function(err) {
        if (err) return res.status(500).json({ message: err.message });
        res.status(201).json({ id: this.lastID });
    });
};

exports.updateNivel = (req, res) => {
    const { id } = req.params;
    const nombre = (req.body.nombre || '').trim();
    if (!nombre) return res.status(400).json({ message: "El nombre del nivel es obligatorio" });
    if (!NOMBRE_REGEX.test(nombre)) return res.status(400).json({ message: "El nombre del nivel solo puede contener letras (sin números ni símbolos)" });
    db.run("UPDATE niveles SET nombre = ? WHERE id = ?", [nombre, id], function(err) {
        if (err) return res.status(500).json({ message: err.message });
        if (this.changes === 0) return res.status(404).json({ message: "Nivel no encontrado" });
        res.json({ message: "Nivel actualizado correctamente" });
    });
};

// Baja de nivel: se impide si tiene cursos asociados, para no dejar datos huérfanos.
exports.deleteNivel = (req, res) => {
    const { id } = req.params;
    db.get("SELECT COUNT(*) as total FROM cursos WHERE nivel_id = ?", [id], (err, row) => {
        if (err) return res.status(500).json({ message: err.message });
        if (row.total > 0) {
            return res.status(400).json({ message: "No se puede eliminar: el nivel tiene cursos/divisiones asociados" });
        }
        db.run("DELETE FROM niveles WHERE id = ?", [id], function(err) {
            if (err) return res.status(500).json({ message: err.message });
            if (this.changes === 0) return res.status(404).json({ message: "Nivel no encontrado" });
            res.json({ message: "Nivel eliminado correctamente" });
        });
    });
};

// --- AULAS ---
exports.getAulas = (req, res) => {
    db.all("SELECT * FROM aulas", [], (err, rows) => {
        if (err) return res.status(500).json({ message: err.message });
        res.json(rows);
    });
};

exports.createAula = (req, res) => {
    const { nombre, capacidad } = req.body;
    if (!nombre || capacidad === undefined || capacidad === null || capacidad === '') {
        return res.status(400).json({ message: "Campos obligatorios" });
    }
    const capacidadNum = Number(capacidad);
    if (!Number.isInteger(capacidadNum) || capacidadNum <= 0) {
        return res.status(400).json({ message: "La capacidad debe ser un número entero mayor a 0" });
    }
    db.run("INSERT INTO aulas (nombre, capacidad) VALUES (?, ?)", [nombre, capacidadNum], function(err) {
        if (err) return res.status(500).json({ message: err.message });
        res.status(201).json({ id: this.lastID });
    });
};

// --- CURSOS ---
exports.getCursos = (req, res) => {
    const query = `
        SELECT cursos.*, niveles.nombre as nivel_nombre 
        FROM cursos 
        JOIN niveles ON cursos.nivel_id = niveles.id
    `;
    db.all(query, [], (err, rows) => {
        if (err) return res.status(500).json({ message: err.message });
        res.json(rows);
    });
};

exports.createCurso = (req, res) => {
    const { nivel_id, division, cupo } = req.body;
    if (!nivel_id || !division || cupo === undefined || cupo === null || cupo === '') {
        return res.status(400).json({ message: "Campos obligatorios" });
    }
    const cupoNum = Number(cupo);
    if (!Number.isInteger(cupoNum) || cupoNum <= 0) {
        return res.status(400).json({ message: "El cupo debe ser un número entero mayor a 0" });
    }
    db.run("INSERT INTO cursos (nivel_id, division, cupo) VALUES (?, ?, ?)", [nivel_id, division, cupoNum], function(err) {
        if (err) return res.status(500).json({ message: err.message });
        res.status(201).json({ id: this.lastID });
    });
};

// --- ALUMNOS (Legajos) ---
exports.getAlumnos = (req, res) => {
    const query = `
        SELECT alumnos.*, cursos.division, niveles.nombre as nivel_nombre
        FROM alumnos 
        LEFT JOIN cursos ON alumnos.curso_id = cursos.id
        LEFT JOIN niveles ON cursos.nivel_id = niveles.id
    `;
    db.all(query, [], (err, rows) => {
        if (err) return res.status(500).json({ message: err.message });
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

    // Validar cupo si se asigna curso
    if (curso_id) {
        db.get("SELECT cupo, (SELECT COUNT(*) FROM alumnos WHERE curso_id = ?) as inscriptos FROM cursos WHERE id = ?", [curso_id, curso_id], (err, curso) => {
            if (err) return res.status(500).json({ message: err.message });
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
            if (err) return res.status(500).json({ message: err.message });
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
        if (err) return res.status(500).json({ message: err.message });
        if (this.changes === 0) return res.status(404).json({ message: "Alumno no encontrado" });
        res.json({ message: "Alumno actualizado correctamente" });
    });
};

// --- MATERIAS ---
// Devuelve las materias con el curso al que pertenecen (nivel y división).
// Se agregan campos extra por JOIN; los existentes (id, nombre, curso_id) se mantienen.
exports.getMaterias = (req, res) => {
    const query = `
        SELECT materias.*, niveles.nombre as nivel_nombre, cursos.division
        FROM materias
        LEFT JOIN cursos ON materias.curso_id = cursos.id
        LEFT JOIN niveles ON cursos.nivel_id = niveles.id
        ORDER BY niveles.nombre, cursos.division, materias.nombre
    `;
    db.all(query, [], (err, rows) => {
        if (err) return res.status(500).json({ message: err.message });
        res.json(rows);
    });
};

// Crea una materia asociada a un curso. Como el alumno pertenece a un curso,
// automáticamente "cursa" las materias de ese curso (modelo por curso, no por alumno).
exports.createMateria = (req, res) => {
    const nombre = (req.body.nombre || '').trim();
    const { curso_id } = req.body;
    if (!nombre || !curso_id) {
        return res.status(400).json({ message: "Nombre y curso son obligatorios" });
    }
    if (!NOMBRE_REGEX.test(nombre)) return res.status(400).json({ message: "El nombre de la materia solo puede contener letras (sin números ni símbolos)" });
    db.run("INSERT INTO materias (nombre, curso_id) VALUES (?, ?)", [nombre, curso_id], function(err) {
        if (err) return res.status(500).json({ message: err.message });
        res.status(201).json({ id: this.lastID });
    });
};

exports.updateMateria = (req, res) => {
    const { id } = req.params;
    const nombre = (req.body.nombre || '').trim();
    const { curso_id } = req.body;
    if (!nombre || !curso_id) {
        return res.status(400).json({ message: "Nombre y curso son obligatorios" });
    }
    if (!NOMBRE_REGEX.test(nombre)) return res.status(400).json({ message: "El nombre de la materia solo puede contener letras (sin números ni símbolos)" });
    db.run("UPDATE materias SET nombre = ?, curso_id = ? WHERE id = ?", [nombre, curso_id, id], function(err) {
        if (err) return res.status(500).json({ message: err.message });
        if (this.changes === 0) return res.status(404).json({ message: "Materia no encontrada" });
        res.json({ message: "Materia actualizada correctamente" });
    });
};

exports.deleteMateria = (req, res) => {
    const { id } = req.params;
    db.run("DELETE FROM materias WHERE id = ?", [id], function(err) {
        if (err) return res.status(500).json({ message: err.message });
        if (this.changes === 0) return res.status(404).json({ message: "Materia no encontrada" });
        res.json({ message: "Materia eliminada correctamente" });
    });
};

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
        if (err) return res.status(500).json({ message: err.message });
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
            if (err) return res.status(500).json({ message: err.message });
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
            if (err) return res.status(500).json({ message: err.message });
            if (this.changes === 0) return res.status(404).json({ message: "Actividad no encontrada" });
            res.json({ message: "Actividad actualizada correctamente" });
        }
    );
};

exports.deleteActividad = (req, res) => {
    const { id } = req.params;
    db.run("DELETE FROM actividades_extra WHERE id = ?", [id], function(err) {
        if (err) return res.status(500).json({ message: err.message });
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
        if (err) return res.status(500).json({ message: err.message });
        if (!actividad) return res.status(404).json({ message: "La actividad no existe" });

        db.get(
            "SELECT COUNT(*) as total FROM inscripciones_extra WHERE actividad_id = ?",
            [actividad_id],
            (err, row) => {
                if (err) return res.status(500).json({ message: err.message });
                if (row.total >= actividad.cupo_max) {
                    return res.status(400).json({ message: "No hay cupos disponibles en esta actividad" });
                }

                db.get(
                    "SELECT id FROM inscripciones_extra WHERE actividad_id = ? AND alumno_id = ?",
                    [actividad_id, alumno_id],
                    (err, existe) => {
                        if (err) return res.status(500).json({ message: err.message });
                        if (existe) return res.status(400).json({ message: "Ya estás inscripto en esta actividad" });

                        db.run(
                            "INSERT INTO inscripciones_extra (alumno_id, actividad_id) VALUES (?, ?)",
                            [alumno_id, actividad_id],
                            function(err) {
                                if (err) return res.status(500).json({ message: err.message });
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
        if (err) return res.status(500).json({ message: err.message });
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
            if (err) return res.status(500).json({ message: err.message });
            if (this.changes === 0) return res.status(404).json({ message: "No estabas inscripto en esta actividad" });
            res.json({ message: "Inscripción cancelada" });
        }
    );
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
        if (err) return res.status(500).json({ message: err.message });
        res.json(rows);
    });
};

// Resumen académico de un hijo (rol padre, solo lectura): promedio, asistencia
// y faltas reales calculados desde calificaciones y asistencias. Restringido a
// los alumnos cuyo tutor_id sea el padre logueado.
exports.getResumenHijo = (req, res) => {
    const alumno_id = parseInt(req.params.alumno_id);
    if (!alumno_id) return res.status(400).json({ message: "Alumno inválido" });

    db.get("SELECT id FROM alumnos WHERE id = ? AND tutor_id = ?", [alumno_id, req.user.id], (err, alumno) => {
        if (err) return res.status(500).json({ message: err.message });
        if (!alumno) return res.status(403).json({ message: "No tenés acceso a este alumno" });

        const resumen = { promedio: null, total_clases: 0, presentes: 0, faltas: 0, asistencia_pct: null, calificaciones: [] };

        db.serialize(() => {
            db.get("SELECT AVG(nota) AS prom FROM calificaciones WHERE alumno_id = ?", [alumno_id], (e, r) => {
                if (!e && r && r.prom != null) resumen.promedio = Math.round(r.prom * 100) / 100;
            });
            db.get(
                `SELECT COUNT(*) AS total,
                        SUM(CASE WHEN estado = 'Presente' THEN 1 ELSE 0 END) AS presentes,
                        SUM(CASE WHEN estado = 'Ausente' THEN 1 ELSE 0 END) AS faltas
                 FROM asistencias WHERE alumno_id = ?`,
                [alumno_id],
                (e, r) => {
                    if (!e && r) {
                        resumen.total_clases = r.total || 0;
                        resumen.presentes = r.presentes || 0;
                        resumen.faltas = r.faltas || 0;
                        resumen.asistencia_pct = r.total ? Math.round((r.presentes / r.total) * 100) : null;
                    }
                }
            );
            db.all(
                `SELECT materias.nombre AS materia_nombre, c.nota, c.trimestre
                 FROM calificaciones c
                 LEFT JOIN materias ON c.materia_id = materias.id
                 WHERE c.alumno_id = ?
                 ORDER BY materias.nombre, c.trimestre`,
                [alumno_id],
                (e, rows) => {
                    if (!e && rows) resumen.calificaciones = rows;
                    res.json(resumen);
                }
            );
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
        if (err) return res.status(500).json({ message: err.message });
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
            if (err) return res.status(500).json({ message: err.message });
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
            if (err) return res.status(500).json({ message: err.message });
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
        if (err) return res.status(500).json({ message: err.message });
        if (this.changes === 0) return res.status(404).json({ message: "Alumno no encontrado" });
        res.json({ message: "Alumno eliminado correctamente" });
    });
};

exports.deleteAula = (req, res) => {
    const { id } = req.params;
    db.run("DELETE FROM aulas WHERE id = ?", [id], function(err) {
        if (err) return res.status(500).json({ message: err.message });
        res.json({ message: "Aula eliminada" });
    });
};

exports.deleteCurso = (req, res) => {
    const { id } = req.params;
    db.run("DELETE FROM cursos WHERE id = ?", [id], function(err) {
        if (err) return res.status(500).json({ message: err.message });
        res.json({ message: "Curso eliminado" });
    });
};

// --- ASISTENCIA & CALIFICACIONES (Docente) ---
exports.registrarAsistencia = (req, res) => {
    const { alumno_id, fecha, estado } = req.body;
    if (!alumno_id || !estado) return res.status(400).json({ message: "Datos incompletos" });
    db.run("INSERT INTO asistencias (alumno_id, fecha, estado) VALUES (?, ?, ?)", [alumno_id, fecha, estado], function(err) {
        if (err) return res.status(500).json({ message: err.message });
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
        if (err) return res.status(500).json({ message: err.message });
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
            if (err) return res.status(500).json({ message: err.message });
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
        if (err) return res.status(500).json({ message: err.message });
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
        if (err) return res.status(500).json({ message: err.message });
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
                if (err) return res.status(500).json({ message: err.message });
                res.status(201).json({ id: this.lastID });
            }
        );
    });
};

exports.deleteHorario = (req, res) => {
    const { id } = req.params;
    db.run("DELETE FROM horarios WHERE id = ?", [id], function(err) {
        if (err) return res.status(500).json({ message: err.message });
        if (this.changes === 0) return res.status(404).json({ message: "Horario no encontrado" });
        res.json({ message: "Horario eliminado correctamente" });
    });
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
        if (err) return res.status(500).json({ message: err.message });
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
            if (err) return res.status(500).json({ message: err.message });
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
            if (err) return res.status(500).json({ message: err.message });
            res.status(201).json({ id: this.lastID });
        }
    );
};
