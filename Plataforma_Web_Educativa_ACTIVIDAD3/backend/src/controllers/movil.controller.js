const { sql, getPool } = require('../config/db');
const { manejarErrorMssql } = require('../utils/dbErrors');

exports.getMisInscripciones = async (req, res) => {
    try {
        const pool = await getPool();
        const { recordset } = await pool.request()
            .input('usuarioId', sql.Int, req.user.id)
            .query(`
                SELECT a.id AS alumno_id, a.nombre AS alumno_nombre, a.apellido AS alumno_apellido,
                       a.usa_comedor, d.id AS deporte_id, d.nombre AS deporte,
                       CONVERT(VARCHAR(5), d.hora_inicio, 108) AS hora_inicio,
                       CONVERT(VARCHAR(5), d.hora_fin, 108) AS hora_fin,
                       t.id AS transporte_id, t.numero_recorrido, t.nombre AS transporte,
                       CONVERT(VARCHAR(5), t.hora_salida, 108) AS hora_salida
                FROM dbo.Alumnos a
                LEFT JOIN dbo.Inscripciones_Deportes i ON i.alumno_id = a.id
                LEFT JOIN dbo.Deportes d ON d.id = i.deporte_id AND d.activo = 1
                LEFT JOIN dbo.Transportes t ON t.id = a.transporte_id
                WHERE a.padre_id = @usuarioId
                ORDER BY a.apellido, a.nombre, d.nombre
            `);
        const alumnos = new Map();
        for (const row of recordset) {
            if (!alumnos.has(row.alumno_id)) alumnos.set(row.alumno_id, {
                alumno: { id: row.alumno_id, nombre: row.alumno_nombre, apellido: row.alumno_apellido },
                deportes: [], comedor: Boolean(row.usa_comedor),
                transporte: row.transporte_id ? {
                    id: row.transporte_id, nombre: row.transporte,
                    numero_recorrido: row.numero_recorrido, hora_salida: row.hora_salida
                } : null
            });
            if (row.deporte_id) alumnos.get(row.alumno_id).deportes.push({
                id: row.deporte_id, nombre: row.deporte,
                horario: `${row.hora_inicio}–${row.hora_fin}`
            });
        }
        return res.json({ alumnos: [...alumnos.values()] });
    } catch (err) { return manejarErrorMssql(res, err); }
};

// El vínculo se valida en SQL para que el padre solo lea la información de sus hijos.
exports.getInscripcionesAlumno = async (req, res) => {
    const alumnoId = Number.parseInt(req.params.alumnoId, 10);
    if (!Number.isInteger(alumnoId) || alumnoId <= 0) return res.status(400).json({ message: 'Alumno inválido' });
    try {
        const pool = await getPool();
        const result = await pool.request()
            .input('alumnoId', sql.Int, alumnoId)
            .input('usuarioId', sql.Int, req.user.id)
            .input('rol', sql.VarChar(20), req.user.rol)
            .query(`
                SELECT a.id AS alumno_id, a.nombre, a.apellido, a.usa_comedor,
                       d.id AS deporte_id, d.nombre AS deporte,
                       d.dias_semana, CONVERT(VARCHAR(5), d.hora_inicio, 108) AS hora_inicio,
                       CONVERT(VARCHAR(5), d.hora_fin, 108) AS hora_fin,
                       t.id AS transporte_id, t.numero_recorrido, t.nombre AS transporte,
                       CONVERT(VARCHAR(5), t.hora_salida, 108) AS hora_salida
                FROM dbo.Alumnos a
                LEFT JOIN dbo.Inscripciones_Deportes i ON i.alumno_id = a.id
                LEFT JOIN dbo.Deportes d ON d.id = i.deporte_id AND d.activo = 1
                LEFT JOIN dbo.Transportes t ON t.id = a.transporte_id
                WHERE a.id = @alumnoId AND (@rol = 'admin' OR a.padre_id = @usuarioId)
                ORDER BY d.nombre
            `);
        if (!result.recordset.length) return res.status(404).json({ message: 'Alumno inexistente o sin permisos' });
        const row = result.recordset[0];
        const deportes = result.recordset.filter((r) => r.deporte_id).map((r) => ({
            id: r.deporte_id, nombre: r.deporte, dias_semana: r.dias_semana,
            horario: `${r.hora_inicio}–${r.hora_fin}`
        }));
        return res.json({
            alumno: { id: row.alumno_id, nombre: row.nombre, apellido: row.apellido },
            deportes,
            comedor: Boolean(row.usa_comedor),
            transporte: row.transporte_id ? {
                id: row.transporte_id, nombre: row.transporte,
                numero_recorrido: row.numero_recorrido, hora_salida: row.hora_salida
            } : null
        });
    } catch (err) { return manejarErrorMssql(res, err); }
};

exports.getEstadoCuentaAlumno = async (req, res) => {
    const alumnoId = Number.parseInt(req.params.alumnoId || req.query.alumno_id, 10);
    if (!Number.isInteger(alumnoId) || alumnoId <= 0) return res.status(400).json({ message: 'Alumno inválido' });
    try {
        const pool = await getPool();
        const result = await pool.request()
            .input('alumnoId', sql.Int, alumnoId)
            .input('usuarioId', sql.Int, req.user.id)
            .input('rol', sql.VarChar(20), req.user.rol)
            .query(`
                SELECT f.id AS factura_id, f.periodo, f.fecha_emision, f.fecha_vencimiento,
                       f.estado, f.total, f.saldo,
                       d.id AS detalle_id, d.descripcion, d.cantidad, d.importe_unitario, d.subtotal,
                       tc.tipo_servicio
                FROM dbo.Factura f
                LEFT JOIN dbo.FacturaDetalle d ON d.factura_id = f.id
                LEFT JOIN dbo.TarifaConcepto tc ON tc.id = d.tarifa_concepto_id
                INNER JOIN dbo.Alumnos a ON a.id = f.alumno_id
                WHERE a.id = @alumnoId AND (@rol = 'admin' OR a.padre_id = @usuarioId)
                ORDER BY f.periodo DESC, f.id DESC, d.id
            `);
        if (!result.recordset.length) {
            const exists = await pool.request().input('alumnoId', sql.Int, alumnoId).input('usuarioId', sql.Int, req.user.id)
                .input('rol', sql.VarChar(20), req.user.rol)
                .query("SELECT id FROM dbo.Alumnos WHERE id = @alumnoId AND (@rol = 'admin' OR padre_id = @usuarioId)");
            if (!exists.recordset.length) return res.status(404).json({ message: 'Alumno inexistente o sin permisos' });
        }
        const facturas = new Map();
        for (const row of result.recordset) {
            if (!facturas.has(row.factura_id)) facturas.set(row.factura_id, {
                id: row.factura_id, periodo: row.periodo, fecha_emision: row.fecha_emision,
                fecha_vencimiento: row.fecha_vencimiento, estado: row.estado, total: row.total,
                saldo: row.saldo, detalles: []
            });
            if (row.detalle_id) facturas.get(row.factura_id).detalles.push({
                id: row.detalle_id, descripcion: row.descripcion, tipo_servicio: row.tipo_servicio,
                cantidad: row.cantidad, subtotal: row.subtotal
            });
        }
        const items = [...facturas.values()];
        return res.json({ facturas: items, total_adeudado: items.reduce((sum, f) => sum + Number(f.saldo || 0), 0) });
    } catch (err) { return manejarErrorMssql(res, err); }
};

exports.getReportesFinancieros = async (_req, res) => {
    try {
        const pool = await getPool();
        const [totales, categorias, morosos, pagos] = await Promise.all([
            pool.request().query(`SELECT COUNT(*) AS facturas, SUM(total - saldo) AS ingresos,
                SUM(saldo) AS saldo_pendiente FROM dbo.Factura WHERE estado <> 'Anulada'`),
            pool.request().query(`SELECT COALESCE(tc.tipo_servicio, 'sin categoría') AS servicio,
                SUM(fd.subtotal) AS facturado, SUM(fd.subtotal - CASE WHEN f.total = 0 THEN 0 ELSE fd.subtotal * f.saldo / f.total END) AS ingresos
                FROM dbo.FacturaDetalle fd INNER JOIN dbo.Factura f ON f.id = fd.factura_id
                LEFT JOIN dbo.TarifaConcepto tc ON tc.id = fd.tarifa_concepto_id
                WHERE f.estado <> 'Anulada' GROUP BY tc.tipo_servicio ORDER BY tc.tipo_servicio`),
            pool.request().query(`SELECT a.id AS alumno_id, a.nombre, a.apellido, SUM(f.saldo) AS deuda
                FROM dbo.Factura f INNER JOIN dbo.Alumnos a ON a.id = f.alumno_id
                WHERE f.estado IN ('Pendiente', 'Pago parcial', 'Vencida') AND f.saldo > 0
                GROUP BY a.id, a.nombre, a.apellido ORDER BY deuda DESC`),
            pool.request().query(`SELECT f.id AS factura_id, f.periodo, f.fecha_emision, f.estado,
                f.total, f.saldo, a.nombre, a.apellido
                FROM dbo.Factura f INNER JOIN dbo.Alumnos a ON a.id = f.alumno_id
                WHERE f.estado <> 'Anulada' ORDER BY f.fecha_emision DESC`)
        ]);
        return res.json({ resumen: totales.recordset[0], por_servicio: categorias.recordset,
            morosos: morosos.recordset, facturas: pagos.recordset });
    } catch (err) { return manejarErrorMssql(res, err); }
};
