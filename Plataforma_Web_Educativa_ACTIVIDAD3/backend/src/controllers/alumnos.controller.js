const { getPool } = require('../config/db');
const { NOMBRE_REGEX } = require('../utils/validators');
const { manejarErrorPg } = require('../utils/dbErrors');

// Controlador de alumnos: legajos (alta/edición), resumen académico para el
// rol padre y vinculación de hijos a la cuenta del padre. Antes esto estaba
// repartido entre dos tablas "alumnos" distintas (una en SQL Server, otra en
// SQLite con el flujo de vincular/desvincular hijo); backend/supabase/schema.sql
// las fusionó en una sola tabla `alumnos`, así que todas las funciones de este
// archivo ya operan sobre el mismo legajo.

// --- ALUMNOS (Legajos, RF-03/RF-04/RF-10) ---
exports.getAlumnos = async (req, res) => {
    try {
        const pool = await getPool();
        const { rows } = await pool.query(`
            SELECT a.id, a.dni, a.nombre, a.apellido,
                   to_char(a.fecha_nacimiento, 'YYYY-MM-DD') AS fecha_nacimiento,
                   a.curso_id, n.nombre AS nivel, c.grado, c.division,
                   a.padre_id, a.usa_comedor, a.transporte_id
            FROM alumnos a
            JOIN cursos c ON c.id = a.curso_id
            JOIN niveles n ON n.id = c.nivel_id
            ORDER BY a.apellido, a.nombre
        `);
        res.json(rows);
    } catch (err) {
        manejarErrorPg(res, err);
    }
};

// Alta de alumno: RF-04 lo asigna a un único curso (curso_id es una FK escalar,
// no puede pertenecer a más de uno) y RF-10 bloquea el alta si el DNI ya existe.
exports.createAlumno = async (req, res) => {
    const dni = String(req.body.dni || '').trim();
    const nombre = String(req.body.nombre || '').trim();
    const apellido = String(req.body.apellido || '').trim();
    const fecha_nacimiento = req.body.fecha_nacimiento;
    const curso_id = parseInt(req.body.curso_id);
    const padre_id = parseInt(req.body.padre_id);

    if (!nombre || !apellido || !dni || !fecha_nacimiento || !curso_id || !padre_id) {
        return res.status(400).json({ message: "Nombre, apellido, DNI, fecha de nacimiento, curso_id y padre_id son obligatorios" });
    }
    if (!NOMBRE_REGEX.test(nombre) || !NOMBRE_REGEX.test(apellido)) {
        return res.status(400).json({ message: "Nombre y apellido solo pueden contener letras (sin números ni símbolos)" });
    }
    if (!/^\d{7,8}$/.test(dni)) {
        return res.status(400).json({ message: "El DNI debe ser numérico de 7 u 8 dígitos" });
    }

    try {
        const pool = await getPool();

        // RF-10: bloquear el alta si el DNI ya existe.
        const { rows: existentes } = await pool.query('SELECT id FROM alumnos WHERE dni = $1', [dni]);
        if (existentes[0]) {
            return res.status(409).json({ message: "Ya existe un alumno registrado con ese DNI" });
        }

        const { rows } = await pool.query(
            `INSERT INTO alumnos (dni, nombre, apellido, fecha_nacimiento, curso_id, padre_id, usa_comedor, transporte_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING id`,
            [dni, nombre, apellido, fecha_nacimiento, curso_id, padre_id, !!req.body.usa_comedor,
                req.body.transporte_id ? parseInt(req.body.transporte_id) : null]
        );

        res.status(201).json({ id: rows[0].id, message: "Alumno registrado correctamente" });
    } catch (err) {
        if (err.code === '23505') {
            return res.status(409).json({ message: "Ya existe un alumno registrado con ese DNI" });
        }
        if (err.code === '23503') {
            return res.status(409).json({ message: "El curso o el padre indicado no existe, o no tiene el rol requerido" });
        }
        manejarErrorPg(res, err);
    }
};

exports.updateAlumno = async (req, res) => {
    const { id } = req.params;
    const { nombre, apellido, dni, fecha_nacimiento, curso_id, padre_id } = req.body;

    if (!nombre || !apellido || !dni || !fecha_nacimiento) {
        return res.status(400).json({ message: "Nombre, Apellido, DNI y Fecha de Nacimiento son obligatorios" });
    }
    if (!NOMBRE_REGEX.test(String(nombre).trim()) || !NOMBRE_REGEX.test(String(apellido).trim())) {
        return res.status(400).json({ message: "Nombre y apellido solo pueden contener letras (sin números ni símbolos)" });
    }
    if (!/^\d+$/.test(String(dni).trim())) {
        return res.status(400).json({ message: "El DNI debe ser numérico (sin puntos ni letras)" });
    }

    try {
        const pool = await getPool();
        const { rowCount } = await pool.query(
            `UPDATE alumnos
             SET nombre = $1, apellido = $2, dni = $3, fecha_nacimiento = $4, curso_id = $5, padre_id = $6
             WHERE id = $7`,
            [nombre, apellido, dni, fecha_nacimiento, curso_id || null, padre_id || null, id]
        );
        if (rowCount === 0) return res.status(404).json({ message: "Alumno no encontrado" });
        res.json({ message: "Alumno actualizado correctamente" });
    } catch (err) {
        if (err.code === '23505') {
            return res.status(409).json({ message: "Ya existe un alumno registrado con ese DNI" });
        }
        manejarErrorPg(res, err);
    }
};


// --- MIS HIJOS (para rol padre) ---
exports.getMisHijos = async (req, res) => {
    try {
        const pool = await getPool();
        const { rows } = await pool.query(`
            SELECT alumnos.*, cursos.division, niveles.nombre AS nivel_nombre
            FROM alumnos
            LEFT JOIN cursos ON alumnos.curso_id = cursos.id
            LEFT JOIN niveles ON cursos.nivel_id = niveles.id
            WHERE alumnos.padre_id = $1
        `, [req.user.id]);
        res.json(rows);
    } catch (err) {
        manejarErrorPg(res, err);
    }
};

// Cada una de estas tres funciones resuelve una sola pregunta sobre el alumno
// (promedio, asistencia o listado de notas).
async function calcularPromedio(pool, alumno_id) {
    const { rows } = await pool.query(
        'SELECT AVG(nota::numeric(4,2)) AS prom FROM calificaciones WHERE alumno_id = $1',
        [alumno_id]
    );
    const prom = rows[0] && rows[0].prom;
    return prom != null ? Math.round(prom * 100) / 100 : null;
}

async function calcularAsistencia(pool, alumno_id) {
    const { rows } = await pool.query(
        `SELECT COUNT(*) AS total,
                SUM(CASE WHEN estado = 'Presente' THEN 1 ELSE 0 END) AS presentes,
                SUM(CASE WHEN estado = 'Ausente' THEN 1 ELSE 0 END) AS faltas
         FROM asistencias WHERE alumno_id = $1`,
        [alumno_id]
    );
    const row = rows[0] || {};
    const total = Number(row.total || 0);
    const presentes = Number(row.presentes || 0);
    return {
        total_clases: total,
        presentes,
        faltas: Number(row.faltas || 0),
        asistencia_pct: total ? Math.round((presentes / total) * 100) : null
    };
}

async function obtenerCalificacionesAlumno(pool, alumno_id) {
    const { rows } = await pool.query(
        `SELECT m.nombre AS materia_nombre, c.nota, c.trimestre
         FROM calificaciones c
         LEFT JOIN materias m ON c.materia_id = m.id
         WHERE c.alumno_id = $1
         ORDER BY m.nombre, c.trimestre`,
        [alumno_id]
    );
    return rows;
}

// Resumen académico de un hijo (rol padre, solo lectura): promedio, asistencia
// y faltas reales calculados desde calificaciones y asistencias. Restringido
// a los alumnos cuyo padre_id sea el padre logueado.
exports.getResumenHijo = async (req, res) => {
    const alumno_id = parseInt(req.params.alumno_id);
    if (!alumno_id) return res.status(400).json({ message: "Alumno inválido" });

    try {
        const pool = await getPool();
        const { rows } = await pool.query(
            'SELECT id FROM alumnos WHERE id = $1 AND padre_id = $2',
            [alumno_id, req.user.id]
        );

        if (!rows[0]) return res.status(403).json({ message: "No tenés acceso a este alumno" });

        const [promedio, asistencia, calificaciones] = await Promise.all([
            calcularPromedio(pool, alumno_id),
            calcularAsistencia(pool, alumno_id),
            obtenerCalificacionesAlumno(pool, alumno_id)
        ]);

        res.json({ promedio, ...asistencia, calificaciones });
    } catch (err) {
        manejarErrorPg(res, err);
    }
};


// --- VINCULACIÓN DE HIJOS (para rol padre) ---

// Lista los alumnos que todavía no tienen un padre/tutor asignado,
// para que el padre pueda elegir cuál vincular a su cuenta.
exports.getAlumnosDisponibles = async (req, res) => {
    try {
        const pool = await getPool();
        const { rows } = await pool.query(`
            SELECT id, nombre, apellido, dni
            FROM alumnos
            WHERE padre_id IS NULL
            ORDER BY apellido, nombre
        `);
        res.json(rows);
    } catch (err) {
        manejarErrorPg(res, err);
    }
};

// Vincula un alumno disponible a la cuenta del padre que hace la solicitud.
exports.vincularHijo = async (req, res) => {
    const alumno_id = parseInt(req.body.alumno_id);
    if (!alumno_id) return res.status(400).json({ message: "Debe seleccionar un alumno" });

    try {
        const pool = await getPool();
        // Solo permite vincular si el alumno aún no tiene padre/tutor.
        const { rowCount } = await pool.query(
            'UPDATE alumnos SET padre_id = $1 WHERE id = $2 AND padre_id IS NULL',
            [req.user.id, alumno_id]
        );
        if (rowCount === 0) {
            return res.status(400).json({ message: "El alumno no existe o ya tiene un tutor asignado" });
        }
        res.json({ message: "Alumno vinculado correctamente" });
    } catch (err) {
        manejarErrorPg(res, err);
    }
};

// Desvincula un hijo de la cuenta del padre (solo si le pertenece).
exports.desvincularHijo = async (req, res) => {
    const { id } = req.params;
    try {
        const pool = await getPool();
        const { rowCount } = await pool.query(
            'UPDATE alumnos SET padre_id = NULL WHERE id = $1 AND padre_id = $2',
            [id, req.user.id]
        );
        if (rowCount === 0) {
            return res.status(404).json({ message: "No se encontró el alumno vinculado a su cuenta" });
        }
        res.json({ message: "Alumno desvinculado correctamente" });
    } catch (err) {
        manejarErrorPg(res, err);
    }
};


exports.deleteAlumno = async (req, res) => {
    const { id } = req.params;
    try {
        const pool = await getPool();
        const { rowCount } = await pool.query('DELETE FROM alumnos WHERE id = $1', [id]);
        if (rowCount === 0) return res.status(404).json({ message: "Alumno no encontrado" });
        res.json({ message: "Alumno eliminado correctamente" });
    } catch (err) {
        manejarErrorPg(res, err);
    }
};
