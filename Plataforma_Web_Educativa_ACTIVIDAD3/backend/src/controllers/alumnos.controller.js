const db = require('../config/database');
const { sql, getPool } = require('../config/db');
const { NOMBRE_REGEX } = require('../utils/validators');
const { manejarErrorSQL, manejarErrorMssql } = require('../utils/dbErrors');

// Controlador de alumnos: legajos (alta/edición), resumen académico para
// el rol padre y vinculación de hijos a la cuenta del padre. Se separó de
// academico.controller.js, que antes mezclaba esto con niveles, cursos,
// materias, actividades y horarios en un solo archivo.

// --- ALUMNOS (Legajos, Sprint 3: RF-03/RF-04/RF-10) sobre SQL Server ---
exports.getAlumnos = async (req, res) => {
    try {
        const pool = await getPool();
        const { recordset } = await pool.request()
            .query(`SELECT a.id, a.dni, a.nombre, a.apellido,
                           CONVERT(char(10), a.fecha_nacimiento, 23) AS fecha_nacimiento,
                           a.curso_id, c.nivel, c.grado, c.division,
                           a.padre_id, a.usa_comedor, a.transporte_id
                    FROM dbo.Alumnos a
                    JOIN dbo.Cursos c ON c.id = a.curso_id
                    ORDER BY a.apellido, a.nombre`);
        res.json(recordset);
    } catch (err) {
        manejarErrorMssql(res, err);
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
        const { recordset: existentes } = await pool.request()
            .input('dni', sql.VarChar(8), dni)
            .query('SELECT id FROM dbo.Alumnos WHERE dni = @dni');
        if (existentes[0]) {
            return res.status(409).json({ message: "Ya existe un alumno registrado con ese DNI" });
        }

        const { recordset } = await pool.request()
            .input('dni', sql.VarChar(8), dni)
            .input('nombre', sql.NVarChar(100), nombre)
            .input('apellido', sql.NVarChar(100), apellido)
            .input('fecha_nacimiento', sql.Date, fecha_nacimiento)
            .input('curso', sql.Int, curso_id)
            .input('padre', sql.Int, padre_id)
            .input('usa_comedor', sql.Bit, !!req.body.usa_comedor)
            .input('transporte', sql.Int, req.body.transporte_id ? parseInt(req.body.transporte_id) : null)
            .query(`INSERT INTO dbo.Alumnos (dni, nombre, apellido, fecha_nacimiento, curso_id, padre_id, usa_comedor, transporte_id)
                    OUTPUT INSERTED.id
                    VALUES (@dni, @nombre, @apellido, @fecha_nacimiento, @curso, @padre, @usa_comedor, @transporte)`);

        res.status(201).json({ id: recordset[0].id, message: "Alumno registrado correctamente" });
    } catch (err) {
        if (err.number === 2627 || err.number === 2601) {
            return res.status(409).json({ message: "Ya existe un alumno registrado con ese DNI" });
        }
        if (err.number === 547) {
            return res.status(409).json({ message: "El curso o el padre indicado no existe, o no tiene el rol requerido" });
        }
        manejarErrorMssql(res, err);
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
// (promedio, asistencia o listado de notas), sobre SQL Server.
async function calcularPromedio(pool, alumno_id) {
    const { recordset } = await pool.request()
        .input('alumno', sql.Int, alumno_id)
        .query('SELECT AVG(CAST(nota AS DECIMAL(4,2))) AS prom FROM dbo.Calificaciones WHERE alumno_id = @alumno');
    const prom = recordset[0] && recordset[0].prom;
    return prom != null ? Math.round(prom * 100) / 100 : null;
}

async function calcularAsistencia(pool, alumno_id) {
    const { recordset } = await pool.request()
        .input('alumno', sql.Int, alumno_id)
        .query(`SELECT COUNT(*) AS total,
                       SUM(CASE WHEN estado = 'Presente' THEN 1 ELSE 0 END) AS presentes,
                       SUM(CASE WHEN estado = 'Ausente' THEN 1 ELSE 0 END) AS faltas
                FROM dbo.Asistencias WHERE alumno_id = @alumno`);
    const row = recordset[0] || {};
    const total = row.total || 0;
    const presentes = row.presentes || 0;
    return {
        total_clases: total,
        presentes,
        faltas: row.faltas || 0,
        asistencia_pct: total ? Math.round((presentes / total) * 100) : null
    };
}

async function obtenerCalificacionesAlumno(pool, alumno_id) {
    const { recordset } = await pool.request()
        .input('alumno', sql.Int, alumno_id)
        .query(`SELECT m.nombre AS materia_nombre, c.nota, c.trimestre
                FROM dbo.Calificaciones c
                LEFT JOIN dbo.Materias m ON c.materia_id = m.id
                WHERE c.alumno_id = @alumno
                ORDER BY m.nombre, c.trimestre`);
    return recordset;
}

// Resumen académico de un hijo (rol padre, solo lectura): promedio, asistencia
// y faltas reales calculados desde Calificaciones y Asistencias (SQL Server).
// Restringido a los alumnos cuyo padre_id sea el padre logueado.
exports.getResumenHijo = async (req, res) => {
    const alumno_id = parseInt(req.params.alumno_id);
    if (!alumno_id) return res.status(400).json({ message: "Alumno inválido" });

    try {
        const pool = await getPool();
        const { recordset } = await pool.request()
            .input('alumno', sql.Int, alumno_id)
            .input('padre', sql.Int, req.user.id)
            .query('SELECT id FROM dbo.Alumnos WHERE id = @alumno AND padre_id = @padre');

        if (!recordset[0]) return res.status(403).json({ message: "No tenés acceso a este alumno" });

        const [promedio, asistencia, calificaciones] = await Promise.all([
            calcularPromedio(pool, alumno_id),
            calcularAsistencia(pool, alumno_id),
            obtenerCalificacionesAlumno(pool, alumno_id)
        ]);

        res.json({ promedio, ...asistencia, calificaciones });
    } catch (err) {
        manejarErrorMssql(res, err);
    }
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

