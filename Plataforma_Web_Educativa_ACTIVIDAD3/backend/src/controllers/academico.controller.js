const db = require('../config/database');
const { NOMBRE_REGEX } = require('../utils/validators');
const { manejarErrorSQL } = require('../utils/dbErrors');

// Antes este archivo mezclaba 8 entidades distintas en un único controlador de más de 700 líneas; mezclaba 8 entidades distintas en un único archivo de más de 700 líneas (problema señalado en el diagnóstico de la Actividad 1). Cada controlador nuevo agrupa las entidades que cambian juntas y se usan juntas.
// Acá quedan las entidades de catálogo/estructura académica: niveles,
// aulas, cursos y materias. Alumnos, actividades y horarios se movieron
// a sus propios controladores (ver alumnos.controller.js,
// actividades.controller.js y horarios.controller.js).

// --- NIVELES ---
exports.getNiveles = (req, res) => {
    db.all("SELECT * FROM niveles", [], (err, rows) => {
        if (err) return manejarErrorSQL(res, err);
        res.json(rows);
    });
};

exports.createNivel = (req, res) => {
    const nombre = (req.body.nombre || '').trim();
    if (!nombre) return res.status(400).json({ message: "El nombre del nivel es obligatorio" });
    if (!NOMBRE_REGEX.test(nombre)) return res.status(400).json({ message: "El nombre del nivel solo puede contener letras (sin números ni símbolos)" });
    db.run("INSERT INTO niveles (nombre) VALUES (?)", [nombre], function(err) {
        if (err) return manejarErrorSQL(res, err);
        res.status(201).json({ id: this.lastID });
    });
};

exports.updateNivel = (req, res) => {
    const { id } = req.params;
    const nombre = (req.body.nombre || '').trim();
    if (!nombre) return res.status(400).json({ message: "El nombre del nivel es obligatorio" });
    if (!NOMBRE_REGEX.test(nombre)) return res.status(400).json({ message: "El nombre del nivel solo puede contener letras (sin números ni símbolos)" });
    db.run("UPDATE niveles SET nombre = ? WHERE id = ?", [nombre, id], function(err) {
        if (err) return manejarErrorSQL(res, err);
        if (this.changes === 0) return res.status(404).json({ message: "Nivel no encontrado" });
        res.json({ message: "Nivel actualizado correctamente" });
    });
};

// Baja de nivel: se impide si tiene cursos asociados, para no dejar datos huérfanos.
exports.deleteNivel = (req, res) => {
    const { id } = req.params;
    db.get("SELECT COUNT(*) as total FROM cursos WHERE nivel_id = ?", [id], (err, row) => {
        if (err) return manejarErrorSQL(res, err);
        if (row.total > 0) {
            return res.status(400).json({ message: "No se puede eliminar: el nivel tiene cursos/divisiones asociados" });
        }
        db.run("DELETE FROM niveles WHERE id = ?", [id], function(err) {
            if (err) return manejarErrorSQL(res, err);
            if (this.changes === 0) return res.status(404).json({ message: "Nivel no encontrado" });
            res.json({ message: "Nivel eliminado correctamente" });
        });
    });
};


// --- AULAS ---
exports.getAulas = (req, res) => {
    db.all("SELECT * FROM aulas", [], (err, rows) => {
        if (err) return manejarErrorSQL(res, err);
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
        if (err) return manejarErrorSQL(res, err);
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
        if (err) return manejarErrorSQL(res, err);
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
        if (err) return manejarErrorSQL(res, err);
        res.status(201).json({ id: this.lastID });
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
        if (err) return manejarErrorSQL(res, err);
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
        if (err) return manejarErrorSQL(res, err);
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
        if (err) return manejarErrorSQL(res, err);
        if (this.changes === 0) return res.status(404).json({ message: "Materia no encontrada" });
        res.json({ message: "Materia actualizada correctamente" });
    });
};

exports.deleteMateria = (req, res) => {
    const { id } = req.params;
    db.run("DELETE FROM materias WHERE id = ?", [id], function(err) {
        if (err) return manejarErrorSQL(res, err);
        if (this.changes === 0) return res.status(404).json({ message: "Materia no encontrada" });
        res.json({ message: "Materia eliminada correctamente" });
    });
};


exports.deleteAula = (req, res) => {
    const { id } = req.params;
    db.run("DELETE FROM aulas WHERE id = ?", [id], function(err) {
        if (err) return manejarErrorSQL(res, err);
        res.json({ message: "Aula eliminada" });
    });
};


exports.deleteCurso = (req, res) => {
    const { id } = req.params;
    db.run("DELETE FROM cursos WHERE id = ?", [id], function(err) {
        if (err) return manejarErrorSQL(res, err);
        res.json({ message: "Curso eliminado" });
    });
};

