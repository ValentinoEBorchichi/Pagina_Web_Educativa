const db = require('../config/database');

// --- COMEDOR ---
exports.registrarAsistenciaComedor = (req, res) => {
    const { alumno_id, consumio_menu, observaciones } = req.body;
    db.run("INSERT INTO comedor_asistencias (alumno_id, consumio_menu, observaciones) VALUES (?, ?, ?)", [alumno_id, consumio_menu, observaciones], function(err) {
        if (err) return res.status(500).json({ message: err.message });
        res.status(201).json({ id: this.lastID });
    });
};

// --- TRANSPORTE ---
exports.getRutasTransporte = (req, res) => {
    db.all("SELECT * FROM transporte_rutas", [], (err, rows) => {
        if (err) return res.status(500).json({ message: err.message });
        res.json(rows.map(r => ({
            id: r.id,
            nombre: r.nombre_ruta,
            chofer: r.chofer_nombre,
            capacidad: r.capacidad_max
        })));
    });
};

exports.createRutaTransporte = (req, res) => {
    const { nombre, chofer, capacidad } = req.body;
    db.run("INSERT INTO transporte_rutas (nombre_ruta, chofer_nombre, capacidad_max) VALUES (?, ?, ?)", 
        [nombre, chofer, capacidad], function(err) {
            if (err) return res.status(500).json({ message: err.message });
            res.status(201).json({ id: this.lastID });
        }
    );
};

exports.asignarAlumnoTransporte = (req, res) => {
    const { alumno_id, ruta_id, punto_encuentro } = req.body;
    db.run("INSERT INTO transporte_asignaciones (alumno_id, ruta_id, punto_encuentro) VALUES (?, ?, ?)", [alumno_id, ruta_id, punto_encuentro], function(err) {
        if (err) return res.status(500).json({ message: err.message });
        res.status(201).json({ id: this.lastID });
    });
};

exports.deleteRutaTransporte = (req, res) => {
    const { id } = req.params;
    db.run("DELETE FROM transporte_rutas WHERE id = ?", [id], function(err) {
        if (err) return res.status(500).json({ message: err.message });
        res.json({ message: "Ruta eliminada" });
    });
};

// --- INSTALACIONES ---
exports.getInstalaciones = (req, res) => {
    db.all("SELECT * FROM instalaciones", [], (err, rows) => {
        if (err) return res.status(500).json({ message: err.message });
        res.json(rows);
    });
};

exports.reservarInstalacion = (req, res) => {
    const { instalacion_id, fecha, hora_inicio, hora_fin, reservado_por, motivo } = req.body;
    
    // Validar disponibilidad
    const checkQuery = `
        SELECT COUNT(*) as count FROM instalaciones_reservas 
        WHERE instalacion_id = ? AND fecha = ? 
        AND (
            (hora_inicio < ? AND hora_fin > ?) OR
            (hora_inicio < ? AND hora_fin > ?)
        )
    `;
    db.get(checkQuery, [instalacion_id, fecha, hora_fin, hora_inicio, hora_inicio, hora_fin], (err, row) => {
        if (err) return res.status(500).json({ message: err.message });
        if (row.count > 0) return res.status(400).json({ message: "La instalación ya está reservada en ese horario." });

        db.run("INSERT INTO instalaciones_reservas (instalacion_id, fecha, hora_inicio, hora_fin, reservado_por, motivo) VALUES (?, ?, ?, ?, ?, ?)", 
            [instalacion_id, fecha, hora_inicio, hora_fin, reservado_por, motivo], function(err) {
                if (err) return res.status(500).json({ message: err.message });
                res.status(201).json({ id: this.lastID });
            }
        );
    });
};

// --- ENFERMERÍA ---
exports.registrarIncidenciaEnfermeria = (req, res) => {
    const { alumno_id, descripcion, accion_tomada, notificado_padre } = req.body;
    if (descripcion.length < 10) return res.status(400).json({ message: "La descripción debe tener al menos 10 caracteres." });

    db.run("INSERT INTO enfermeria_incidencias (alumno_id, descripcion, accion_tomada, notificado_padre) VALUES (?, ?, ?, ?)", 
        [alumno_id, descripcion, accion_tomada, notificado_padre], function(err) {
            if (err) return res.status(500).json({ message: err.message });
            res.status(201).json({ id: this.lastID });
        }
    );
};
