const db = require('../config/database');

exports.getEstadisticasGenerales = (req, res) => {
    const stats = {
        total_alumnos: 0,
        deuda_total: 0,
        preinscripciones_pendientes: 0,
        total_docentes: 0
    };

    db.serialize(() => {
        db.get("SELECT COUNT(*) as count FROM alumnos", (err, row) => {
            if (!err && row) stats.total_alumnos = row.count;
        });

        db.get("SELECT SUM(saldo_pendiente) as total FROM saldos_alumnos", (err, row) => {
            if (!err && row) stats.deuda_total = row.total || 0;
        });

        db.get("SELECT COUNT(*) as count FROM preinscripciones WHERE estado = 'pendiente'", (err, row) => {
            if (!err && row) stats.preinscripciones_pendientes = row.count;
        });

        db.get("SELECT COUNT(*) as count FROM personal WHERE tipo = 'Docente'", (err, row) => {
            if (!err && row) stats.total_docentes = row.count;
            res.json(stats);
        });
    });
};

// Reporte académico: calificaciones por alumno y materia (para visualización/impresión).
exports.getReporteAcademico = (req, res) => {
    const query = `
        SELECT a.apellido, a.nombre, a.dni,
               niveles.nombre AS nivel_nombre, cursos.division,
               materias.nombre AS materia_nombre,
               c.nota, c.trimestre
        FROM calificaciones c
        JOIN alumnos a ON c.alumno_id = a.id
        LEFT JOIN materias ON c.materia_id = materias.id
        LEFT JOIN cursos ON a.curso_id = cursos.id
        LEFT JOIN niveles ON cursos.nivel_id = niveles.id
        ORDER BY a.apellido, a.nombre, materias.nombre, c.trimestre
    `;
    db.all(query, [], (err, rows) => {
        if (err) return res.status(500).json({ message: err.message });
        res.json(rows);
    });
};

// Reporte financiero: detalle de pagos registrados (para visualización/impresión).
exports.getReporteFinanciero = (req, res) => {
    const query = `
        SELECT p.fecha_pago, a.apellido, a.nombre, a.dni,
               p.monto_pagado, p.metodo_pago,
               COALESCE(s.saldo_pendiente, 0) AS saldo_pendiente
        FROM pagos p
        LEFT JOIN alumnos a ON p.alumno_id = a.id
        LEFT JOIN saldos_alumnos s ON s.alumno_id = a.id
        ORDER BY p.fecha_pago DESC
    `;
    db.all(query, [], (err, rows) => {
        if (err) return res.status(500).json({ message: err.message });
        res.json(rows);
    });
};
