const { getPool } = require('../config/db');
const { manejarErrorSQL } = require('../utils/dbErrors');

// NOTA: `saldos_alumnos` y `pagos` (SQLite, sistema financiero viejo) ya no
// existen (RNFM-02: se eliminaron junto con cuotas_config). Este reporte
// pasa a leer del sistema financiero nuevo: `saldos` (mismo significado,
// saldo_pendiente por alumno) y `comprobante_transferencia` (reemplaza al
// registro manual de "pagos": ahora es el comprobante que subió el padre).
exports.getEstadisticasGenerales = async (req, res) => {
    try {
        const pool = await getPool();
        const [alumnos, deuda, preinscripciones, docentes] = await Promise.all([
            pool.query('SELECT COUNT(*) as count FROM alumnos'),
            pool.query('SELECT SUM(saldo_pendiente) as total FROM saldos'),
            pool.query("SELECT COUNT(*) as count FROM preinscripciones WHERE estado = 'pendiente'"),
            pool.query("SELECT COUNT(*) as count FROM personal WHERE tipo = 'Docente'")
        ]);
        res.json({
            total_alumnos: Number(alumnos.rows[0].count),
            deuda_total: Number(deuda.rows[0].total || 0),
            preinscripciones_pendientes: Number(preinscripciones.rows[0].count),
            total_docentes: Number(docentes.rows[0].count)
        });
    } catch (err) { manejarErrorSQL(res, err); }
};

// Reporte académico: calificaciones por alumno y materia (para visualización/impresión).
exports.getReporteAcademico = async (req, res) => {
    try {
        const pool = await getPool();
        const { rows } = await pool.query(`
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
        `);
        res.json(rows);
    } catch (err) { manejarErrorSQL(res, err); }
};

// Reporte financiero: detalle de comprobantes de transferencia cargados
// (reemplaza al viejo listado de "pagos" manuales).
exports.getReporteFinanciero = async (req, res) => {
    try {
        const pool = await getPool();
        const { rows } = await pool.query(`
            SELECT ct.fecha_transferencia AS fecha_pago, a.apellido, a.nombre, a.dni,
                   ct.monto AS monto_pagado, ct.estado_verificacion AS metodo_pago,
                   COALESCE(s.saldo_pendiente, 0) AS saldo_pendiente
            FROM comprobante_transferencia ct
            JOIN factura f ON f.id = ct.factura_id
            LEFT JOIN alumnos a ON f.alumno_id = a.id
            LEFT JOIN saldos s ON s.alumno_id = a.id
            ORDER BY ct.fecha_transferencia DESC
        `);
        res.json(rows);
    } catch (err) { manejarErrorSQL(res, err); }
};
