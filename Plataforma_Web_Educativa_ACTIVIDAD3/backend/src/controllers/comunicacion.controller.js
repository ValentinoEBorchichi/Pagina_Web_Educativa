const { getPool } = require('../config/db');
const { manejarErrorSQL } = require('../utils/dbErrors');

// --- NOTIFICACIONES ---
exports.getNotificaciones = async (req, res) => {
    const { rol } = req.user;
    try {
        const pool = await getPool();
        const { rows } = await pool.query(
            "SELECT * FROM notificaciones WHERE rol_destino = $1 OR rol_destino = 'all' ORDER BY fecha_envio DESC",
            [rol]
        );
        res.json(rows);
    } catch (err) { manejarErrorSQL(res, err); }
};

exports.crearNotificacion = async (req, res) => {
    const { titulo, mensaje, rol_destino } = req.body;
    try {
        const pool = await getPool();
        const { rows } = await pool.query(
            "INSERT INTO notificaciones (titulo, mensaje, rol_destino) VALUES ($1, $2, $3) RETURNING id",
            [titulo, mensaje, rol_destino]
        );
        res.status(201).json({ id: rows[0].id });
    } catch (err) { manejarErrorSQL(res, err); }
};

// --- ACTIVIDADES EXTRA ---
exports.getActividadesExtra = async (req, res) => {
    try {
        const pool = await getPool();
        const { rows } = await pool.query("SELECT * FROM actividades_extra");
        res.json(rows);
    } catch (err) { manejarErrorSQL(res, err); }
};

exports.inscribirActividad = async (req, res) => {
    const { alumno_id, actividad_id } = req.body;
    try {
        const pool = await getPool();
        const { rows } = await pool.query(
            "INSERT INTO inscripciones_extra (alumno_id, actividad_id) VALUES ($1, $2) RETURNING id",
            [alumno_id, actividad_id]
        );
        res.status(201).json({ id: rows[0].id });
    } catch (err) { manejarErrorSQL(res, err); }
};
