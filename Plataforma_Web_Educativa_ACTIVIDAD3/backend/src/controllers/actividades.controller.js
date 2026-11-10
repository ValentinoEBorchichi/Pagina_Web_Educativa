const { getPool } = require('../config/db');
const { NOMBRE_REGEX } = require('../utils/validators');
const { manejarErrorSQL } = require('../utils/dbErrors');

// Controlador de actividades extracurriculares: alta/edición, inscripción
// de alumnos y carga de asistencia/calificación por parte de los
// profesores a cargo. Se separó de academico.controller.js por la misma
// razón que alumnos.controller.js y horarios.controller.js.

// inscripciones_extra.alumno_id referencia a alumnos(id) (esquema unificado
// de Postgres), no al usuario logueado directamente: hay que resolver el
// legajo del alumno a partir de su cuenta (alumnos.usuario_id = req.user.id).
async function resolverAlumnoId(pool, usuarioId) {
    const { rows } = await pool.query('SELECT id FROM alumnos WHERE usuario_id = $1', [usuarioId]);
    return rows[0] ? rows[0].id : null;
}

// --- ACTIVIDADES EXTRACURRICULARES ---
// Lista las actividades con la cantidad de inscriptos (para mostrar cupo disponible).
exports.getActividades = async (req, res) => {
    try {
        const pool = await getPool();
        const { rows } = await pool.query(`
            SELECT actividades_extra.*,
                   (SELECT COUNT(*) FROM inscripciones_extra WHERE actividad_id = actividades_extra.id) as inscriptos
            FROM actividades_extra
            ORDER BY tipo, nombre
        `);
        res.json(rows);
    } catch (err) { manejarErrorSQL(res, err); }
};

exports.createActividad = async (req, res) => {
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
    try {
        const pool = await getPool();
        const { rows } = await pool.query(
            "INSERT INTO actividades_extra (nombre, tipo, horario, cupo_max) VALUES ($1, $2, $3, $4) RETURNING id",
            [nombre, tipo, horario || null, cupoNum]
        );
        res.status(201).json({ id: rows[0].id });
    } catch (err) { manejarErrorSQL(res, err); }
};

exports.updateActividad = async (req, res) => {
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
    try {
        const pool = await getPool();
        const { rowCount } = await pool.query(
            "UPDATE actividades_extra SET nombre = $1, tipo = $2, horario = $3, cupo_max = $4 WHERE id = $5",
            [nombre, tipo, horario || null, cupoNum, id]
        );
        if (rowCount === 0) return res.status(404).json({ message: "Actividad no encontrada" });
        res.json({ message: "Actividad actualizada correctamente" });
    } catch (err) { manejarErrorSQL(res, err); }
};

exports.deleteActividad = async (req, res) => {
    const { id } = req.params;
    try {
        const pool = await getPool();
        const { rowCount } = await pool.query("DELETE FROM actividades_extra WHERE id = $1", [id]);
        if (rowCount === 0) return res.status(404).json({ message: "Actividad no encontrada" });
        res.json({ message: "Actividad eliminada correctamente" });
    } catch (err) { manejarErrorSQL(res, err); }
};

// El alumno se inscribe a una actividad. Valida cupo y que no se inscriba dos veces.
// La inscripción se guarda contra el legajo de alumno vinculado al usuario logueado.
exports.inscribirActividad = async (req, res) => {
    const actividad_id = parseInt(req.body.actividad_id);
    if (!actividad_id) return res.status(400).json({ message: "Actividad inválida" });

    try {
        const pool = await getPool();
        const alumno_id = await resolverAlumnoId(pool, req.user.id);
        if (!alumno_id) return res.status(403).json({ message: "Tu cuenta no está vinculada a un legajo de alumno" });

        const { rows: actividadRows } = await pool.query("SELECT cupo_max FROM actividades_extra WHERE id = $1", [actividad_id]);
        const actividad = actividadRows[0];
        if (!actividad) return res.status(404).json({ message: "La actividad no existe" });

        const { rows: totalRows } = await pool.query(
            "SELECT COUNT(*) as total FROM inscripciones_extra WHERE actividad_id = $1",
            [actividad_id]
        );
        if (Number(totalRows[0].total) >= actividad.cupo_max) {
            return res.status(400).json({ message: "No hay cupos disponibles en esta actividad" });
        }

        const { rows: existeRows } = await pool.query(
            "SELECT id FROM inscripciones_extra WHERE actividad_id = $1 AND alumno_id = $2",
            [actividad_id, alumno_id]
        );
        if (existeRows[0]) return res.status(400).json({ message: "Ya estás inscripto en esta actividad" });

        const { rows } = await pool.query(
            "INSERT INTO inscripciones_extra (alumno_id, actividad_id) VALUES ($1, $2) RETURNING id",
            [alumno_id, actividad_id]
        );
        res.status(201).json({ message: "Inscripción realizada con éxito", id: rows[0].id });
    } catch (err) { manejarErrorSQL(res, err); }
};

// Lista las actividades en las que está inscripto el alumno logueado.
exports.getMisInscripciones = async (req, res) => {
    try {
        const pool = await getPool();
        const alumno_id = await resolverAlumnoId(pool, req.user.id);
        if (!alumno_id) return res.json([]);

        const { rows } = await pool.query(`
            SELECT inscripciones_extra.id as inscripcion_id, actividades_extra.*
            FROM inscripciones_extra
            JOIN actividades_extra ON inscripciones_extra.actividad_id = actividades_extra.id
            WHERE inscripciones_extra.alumno_id = $1
            ORDER BY actividades_extra.tipo, actividades_extra.nombre
        `, [alumno_id]);
        res.json(rows);
    } catch (err) { manejarErrorSQL(res, err); }
};

// El alumno cancela su inscripción a una actividad.
exports.desinscribirActividad = async (req, res) => {
    const { actividad_id } = req.params;
    try {
        const pool = await getPool();
        const alumno_id = await resolverAlumnoId(pool, req.user.id);
        if (!alumno_id) return res.status(403).json({ message: "Tu cuenta no está vinculada a un legajo de alumno" });

        const { rowCount } = await pool.query(
            "DELETE FROM inscripciones_extra WHERE actividad_id = $1 AND alumno_id = $2",
            [actividad_id, alumno_id]
        );
        if (rowCount === 0) return res.status(404).json({ message: "No estabas inscripto en esta actividad" });
        res.json({ message: "Inscripción cancelada" });
    } catch (err) { manejarErrorSQL(res, err); }
};


// --- ASISTENCIA Y NOTAS DE ACTIVIDADES EXTRACURRICULARES (profesores) ---
// Las inscripciones (inscripciones_extra.alumno_id) referencian el legajo del
// alumno (tabla `alumnos`), por eso el nombre se obtiene de ahí.
exports.getInscriptosActividad = async (req, res) => {
    const { actividad_id } = req.params;
    try {
        const pool = await getPool();
        const { rows } = await pool.query(`
            SELECT ie.alumno_id, (al.nombre || ' ' || al.apellido) AS alumno_nombre, ie.fecha_inscripcion,
                   (SELECT nota FROM actividad_calificaciones
                     WHERE actividad_id = ie.actividad_id AND alumno_id = ie.alumno_id
                     ORDER BY id DESC LIMIT 1) AS ultima_nota
            FROM inscripciones_extra ie
            JOIN alumnos al ON ie.alumno_id = al.id
            WHERE ie.actividad_id = $1
            ORDER BY al.apellido, al.nombre
        `, [actividad_id]);
        res.json(rows);
    } catch (err) { manejarErrorSQL(res, err); }
};

exports.registrarAsistenciaActividad = async (req, res) => {
    const { actividad_id, alumno_id, fecha, estado } = req.body;
    if (!actividad_id || !alumno_id || !estado) {
        return res.status(400).json({ message: "Datos incompletos" });
    }
    if (!['Presente', 'Ausente', 'Tarde'].includes(estado)) {
        return res.status(400).json({ message: "Estado inválido" });
    }
    try {
        const pool = await getPool();
        const { rows } = await pool.query(
            "INSERT INTO actividad_asistencias (actividad_id, alumno_id, fecha, estado) VALUES ($1, $2, $3, $4) RETURNING id",
            [actividad_id, alumno_id, fecha || null, estado]
        );
        res.status(201).json({ id: rows[0].id });
    } catch (err) { manejarErrorSQL(res, err); }
};

exports.cargarCalificacionActividad = async (req, res) => {
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
    try {
        const pool = await getPool();
        const { rows } = await pool.query(
            "INSERT INTO actividad_calificaciones (actividad_id, alumno_id, nota) VALUES ($1, $2, $3) RETURNING id",
            [actividad_id, alumno_id, notaNum]
        );
        res.status(201).json({ id: rows[0].id });
    } catch (err) { manejarErrorSQL(res, err); }
};
