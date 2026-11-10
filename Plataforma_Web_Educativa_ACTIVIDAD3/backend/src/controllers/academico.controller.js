const { getPool } = require('../config/db');
const { NOMBRE_REGEX } = require('../utils/validators');
const { manejarErrorPg } = require('../utils/dbErrors');

// Catálogo/estructura académica sobre la tabla unificada de Postgres: niveles,
// aulas, cursos y materias. Alumnos, actividades y horarios se movieron a sus
// propios controladores (ver alumnos.controller.js, actividades.controller.js
// y horarios.controller.js).

// --- NIVELES ---
exports.getNiveles = async (req, res) => {
    try {
        const pool = await getPool();
        const { rows } = await pool.query('SELECT * FROM niveles');
        res.json(rows);
    } catch (err) { manejarErrorPg(res, err); }
};

exports.createNivel = async (req, res) => {
    const nombre = (req.body.nombre || '').trim();
    if (!nombre) return res.status(400).json({ message: "El nombre del nivel es obligatorio" });
    if (!NOMBRE_REGEX.test(nombre)) return res.status(400).json({ message: "El nombre del nivel solo puede contener letras (sin números ni símbolos)" });
    try {
        const pool = await getPool();
        const { rows } = await pool.query('INSERT INTO niveles (nombre) VALUES ($1) RETURNING id', [nombre]);
        res.status(201).json({ id: rows[0].id });
    } catch (err) { manejarErrorPg(res, err); }
};

exports.updateNivel = async (req, res) => {
    const { id } = req.params;
    const nombre = (req.body.nombre || '').trim();
    if (!nombre) return res.status(400).json({ message: "El nombre del nivel es obligatorio" });
    if (!NOMBRE_REGEX.test(nombre)) return res.status(400).json({ message: "El nombre del nivel solo puede contener letras (sin números ni símbolos)" });
    try {
        const pool = await getPool();
        const { rowCount } = await pool.query('UPDATE niveles SET nombre = $1 WHERE id = $2', [nombre, id]);
        if (rowCount === 0) return res.status(404).json({ message: "Nivel no encontrado" });
        res.json({ message: "Nivel actualizado correctamente" });
    } catch (err) { manejarErrorPg(res, err); }
};

// Baja de nivel: se impide si tiene cursos asociados, para no dejar datos huérfanos.
exports.deleteNivel = async (req, res) => {
    const { id } = req.params;
    try {
        const pool = await getPool();
        const { rows } = await pool.query('SELECT COUNT(*) AS total FROM cursos WHERE nivel_id = $1', [id]);
        if (Number(rows[0].total) > 0) {
            return res.status(400).json({ message: "No se puede eliminar: el nivel tiene cursos/divisiones asociados" });
        }
        const { rowCount } = await pool.query('DELETE FROM niveles WHERE id = $1', [id]);
        if (rowCount === 0) return res.status(404).json({ message: "Nivel no encontrado" });
        res.json({ message: "Nivel eliminado correctamente" });
    } catch (err) { manejarErrorPg(res, err); }
};


// --- AULAS ---
exports.getAulas = async (req, res) => {
    try {
        const pool = await getPool();
        const { rows } = await pool.query('SELECT * FROM aulas');
        res.json(rows);
    } catch (err) { manejarErrorPg(res, err); }
};

exports.createAula = async (req, res) => {
    const { nombre, capacidad } = req.body;
    if (!nombre || capacidad === undefined || capacidad === null || capacidad === '') {
        return res.status(400).json({ message: "Campos obligatorios" });
    }
    const capacidadNum = Number(capacidad);
    if (!Number.isInteger(capacidadNum) || capacidadNum <= 0) {
        return res.status(400).json({ message: "La capacidad debe ser un número entero mayor a 0" });
    }
    try {
        const pool = await getPool();
        const { rows } = await pool.query('INSERT INTO aulas (nombre, capacidad) VALUES ($1, $2) RETURNING id', [nombre, capacidadNum]);
        res.status(201).json({ id: rows[0].id });
    } catch (err) { manejarErrorPg(res, err); }
};

exports.deleteAula = async (req, res) => {
    const { id } = req.params;
    try {
        const pool = await getPool();
        await pool.query('DELETE FROM aulas WHERE id = $1', [id]);
        res.json({ message: "Aula eliminada" });
    } catch (err) { manejarErrorPg(res, err); }
};


// --- CURSOS ---
// Única tabla de cursos (antes había una en SQLite y otra -dbo.Cursos- en SQL
// Server, con dos espacios de IDs distintos; se unificaron en backend/supabase/schema.sql).
exports.getCursos = async (req, res) => {
    try {
        const pool = await getPool();
        const { rows } = await pool.query(`
            SELECT cursos.*, niveles.nombre AS nivel_nombre
            FROM cursos
            JOIN niveles ON cursos.nivel_id = niveles.id
        `);
        res.json(rows);
    } catch (err) { manejarErrorPg(res, err); }
};

// Variante con la forma que espera el alta de alumnos (nivel como texto,
// grado/turno/ciclo_lectivo/cupo_maximo): solo cursos dados de alta con esos
// datos completos (ciclo_lectivo no nulo), igual que antes filtraba dbo.Cursos.
exports.getCursosMssql = async (req, res) => {
    try {
        const pool = await getPool();
        const { rows } = await pool.query(`
            SELECT cursos.id, niveles.nombre AS nivel, cursos.grado, cursos.division, cursos.turno, cursos.ciclo_lectivo, cursos.cupo_maximo
            FROM cursos
            JOIN niveles ON niveles.id = cursos.nivel_id
            WHERE cursos.ciclo_lectivo IS NOT NULL
            ORDER BY cursos.ciclo_lectivo DESC, niveles.nombre, cursos.grado, cursos.division
        `);
        res.json(rows);
    } catch (err) { manejarErrorPg(res, err); }
};

exports.createCurso = async (req, res) => {
    const { nivel_id, division, cupo } = req.body;
    if (!nivel_id || !division || cupo === undefined || cupo === null || cupo === '') {
        return res.status(400).json({ message: "Campos obligatorios" });
    }
    const cupoNum = Number(cupo);
    if (!Number.isInteger(cupoNum) || cupoNum <= 0) {
        return res.status(400).json({ message: "El cupo debe ser un número entero mayor a 0" });
    }
    try {
        const pool = await getPool();
        const { rows } = await pool.query(
            'INSERT INTO cursos (nivel_id, division, cupo) VALUES ($1, $2, $3) RETURNING id',
            [nivel_id, division, cupoNum]
        );
        res.status(201).json({ id: rows[0].id });
    } catch (err) { manejarErrorPg(res, err); }
};

exports.deleteCurso = async (req, res) => {
    const { id } = req.params;
    try {
        const pool = await getPool();
        await pool.query('DELETE FROM cursos WHERE id = $1', [id]);
        res.json({ message: "Curso eliminado" });
    } catch (err) { manejarErrorPg(res, err); }
};


// --- MATERIAS ---
// Devuelve las materias con el curso al que pertenecen (nivel y división).
// Se agregan campos extra por JOIN; los existentes (id, nombre, curso_id) se mantienen.
exports.getMaterias = async (req, res) => {
    try {
        const pool = await getPool();
        const { rows } = await pool.query(`
            SELECT materias.*, niveles.nombre AS nivel_nombre, cursos.division
            FROM materias
            LEFT JOIN cursos ON materias.curso_id = cursos.id
            LEFT JOIN niveles ON cursos.nivel_id = niveles.id
            ORDER BY niveles.nombre, cursos.division, materias.nombre
        `);
        res.json(rows);
    } catch (err) { manejarErrorPg(res, err); }
};

// Crea una materia asociada a un curso. Como el alumno pertenece a un curso,
// automáticamente "cursa" las materias de ese curso (modelo por curso, no por alumno).
exports.createMateria = async (req, res) => {
    const nombre = (req.body.nombre || '').trim();
    const { curso_id } = req.body;
    if (!nombre || !curso_id) {
        return res.status(400).json({ message: "Nombre y curso son obligatorios" });
    }
    if (!NOMBRE_REGEX.test(nombre)) return res.status(400).json({ message: "El nombre de la materia solo puede contener letras (sin números ni símbolos)" });
    try {
        const pool = await getPool();
        const { rows } = await pool.query('INSERT INTO materias (nombre, curso_id) VALUES ($1, $2) RETURNING id', [nombre, curso_id]);
        res.status(201).json({ id: rows[0].id });
    } catch (err) { manejarErrorPg(res, err); }
};

exports.updateMateria = async (req, res) => {
    const { id } = req.params;
    const nombre = (req.body.nombre || '').trim();
    const { curso_id } = req.body;
    if (!nombre || !curso_id) {
        return res.status(400).json({ message: "Nombre y curso son obligatorios" });
    }
    if (!NOMBRE_REGEX.test(nombre)) return res.status(400).json({ message: "El nombre de la materia solo puede contener letras (sin números ni símbolos)" });
    try {
        const pool = await getPool();
        const { rowCount } = await pool.query('UPDATE materias SET nombre = $1, curso_id = $2 WHERE id = $3', [nombre, curso_id, id]);
        if (rowCount === 0) return res.status(404).json({ message: "Materia no encontrada" });
        res.json({ message: "Materia actualizada correctamente" });
    } catch (err) { manejarErrorPg(res, err); }
};

exports.deleteMateria = async (req, res) => {
    const { id } = req.params;
    try {
        const pool = await getPool();
        const { rowCount } = await pool.query('DELETE FROM materias WHERE id = $1', [id]);
        if (rowCount === 0) return res.status(404).json({ message: "Materia no encontrada" });
        res.json({ message: "Materia eliminada correctamente" });
    } catch (err) { manejarErrorPg(res, err); }
};
