const db = require('../config/database');

// --- NOTIFICACIONES ---
exports.getNotificaciones = (req, res) => {
    const { rol } = req.user;
    db.all("SELECT * FROM notificaciones WHERE rol_destino = ? OR rol_destino = 'all' ORDER BY fecha_envio DESC", [rol], (err, rows) => {
        if (err) return res.status(500).json({ message: err.message });
        res.json(rows);
    });
};

exports.crearNotificacion = (req, res) => {
    const { titulo, mensaje, rol_destino } = req.body;
    db.run("INSERT INTO notificaciones (titulo, mensaje, rol_destino) VALUES (?, ?, ?)", [titulo, mensaje, rol_destino], function(err) {
        if (err) return res.status(500).json({ message: err.message });
        res.status(201).json({ id: this.lastID });
    });
};

// --- ACTIVIDADES EXTRA ---
exports.getActividadesExtra = (req, res) => {
    db.all("SELECT * FROM actividades_extra", [], (err, rows) => {
        if (err) return res.status(500).json({ message: err.message });
        res.json(rows);
    });
};

exports.inscribirActividad = (req, res) => {
    const { alumno_id, actividad_id } = req.body;
    db.run("INSERT INTO inscripciones_extra (alumno_id, actividad_id) VALUES (?, ?)", [alumno_id, actividad_id], function(err) {
        if (err) return res.status(500).json({ message: err.message });
        res.status(201).json({ id: this.lastID });
    });
};
