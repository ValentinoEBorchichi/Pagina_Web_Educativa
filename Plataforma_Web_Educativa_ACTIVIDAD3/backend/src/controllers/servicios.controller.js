const { getPool } = require('../config/db');
const { manejarErrorSQL } = require('../utils/dbErrors');

// --- COMEDOR ---
exports.registrarAsistenciaComedor = async (req, res) => {
    const { alumno_id, consumio_menu, observaciones } = req.body;
    try {
        const pool = await getPool();
        const { rows } = await pool.query(
            "INSERT INTO comedor_asistencias (alumno_id, consumio_menu, observaciones) VALUES ($1, $2, $3) RETURNING id",
            [alumno_id, consumio_menu, observaciones]
        );
        res.status(201).json({ id: rows[0].id });
    } catch (err) { manejarErrorSQL(res, err); }
};

// --- TRANSPORTE ---
exports.getRutasTransporte = async (req, res) => {
    try {
        const pool = await getPool();
        const { rows } = await pool.query("SELECT * FROM transporte_rutas");
        res.json(rows.map(r => ({
            id: r.id,
            nombre: r.nombre_ruta,
            chofer: r.chofer_nombre,
            capacidad: r.capacidad_max
        })));
    } catch (err) { manejarErrorSQL(res, err); }
};

exports.createRutaTransporte = async (req, res) => {
    const { nombre, chofer, capacidad } = req.body;
    try {
        const pool = await getPool();
        const { rows } = await pool.query(
            "INSERT INTO transporte_rutas (nombre_ruta, chofer_nombre, capacidad_max) VALUES ($1, $2, $3) RETURNING id",
            [nombre, chofer, capacidad]
        );
        res.status(201).json({ id: rows[0].id });
    } catch (err) { manejarErrorSQL(res, err); }
};

exports.asignarAlumnoTransporte = async (req, res) => {
    const { alumno_id, ruta_id, punto_encuentro } = req.body;
    try {
        const pool = await getPool();
        const { rows } = await pool.query(
            "INSERT INTO transporte_asignaciones (alumno_id, ruta_id, punto_encuentro) VALUES ($1, $2, $3) RETURNING id",
            [alumno_id, ruta_id, punto_encuentro]
        );
        res.status(201).json({ id: rows[0].id });
    } catch (err) { manejarErrorSQL(res, err); }
};

exports.deleteRutaTransporte = async (req, res) => {
    const { id } = req.params;
    try {
        const pool = await getPool();
        await pool.query("DELETE FROM transporte_rutas WHERE id = $1", [id]);
        res.json({ message: "Ruta eliminada" });
    } catch (err) { manejarErrorSQL(res, err); }
};

// --- INSTALACIONES ---
exports.getInstalaciones = async (req, res) => {
    try {
        const pool = await getPool();
        const { rows } = await pool.query("SELECT * FROM instalaciones");
        res.json(rows);
    } catch (err) { manejarErrorSQL(res, err); }
};

exports.reservarInstalacion = async (req, res) => {
    const { instalacion_id, fecha, hora_inicio, hora_fin, reservado_por, motivo } = req.body;

    try {
        const pool = await getPool();
        const { rows: conflictoRows } = await pool.query(`
            SELECT COUNT(*) as count FROM instalaciones_reservas
            WHERE instalacion_id = $1 AND fecha = $2
            AND (
                (hora_inicio < $3 AND hora_fin > $4) OR
                (hora_inicio < $4 AND hora_fin > $3)
            )
        `, [instalacion_id, fecha, hora_fin, hora_inicio]);
        if (Number(conflictoRows[0].count) > 0) {
            return res.status(400).json({ message: "La instalación ya está reservada en ese horario." });
        }

        const { rows } = await pool.query(
            "INSERT INTO instalaciones_reservas (instalacion_id, fecha, hora_inicio, hora_fin, reservado_por, motivo) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id",
            [instalacion_id, fecha, hora_inicio, hora_fin, reservado_por, motivo]
        );
        res.status(201).json({ id: rows[0].id });
    } catch (err) { manejarErrorSQL(res, err); }
};

// --- ENFERMERÍA ---
exports.registrarIncidenciaEnfermeria = async (req, res) => {
    const { alumno_id, descripcion, accion_tomada, notificado_padre } = req.body;
    if (descripcion.length < 10) return res.status(400).json({ message: "La descripción debe tener al menos 10 caracteres." });

    try {
        const pool = await getPool();
        const { rows } = await pool.query(
            "INSERT INTO enfermeria_incidencias (alumno_id, descripcion, accion_tomada, notificado_padre) VALUES ($1, $2, $3, $4) RETURNING id",
            [alumno_id, descripcion, accion_tomada, notificado_padre]
        );
        res.status(201).json({ id: rows[0].id });
    } catch (err) { manejarErrorSQL(res, err); }
};
