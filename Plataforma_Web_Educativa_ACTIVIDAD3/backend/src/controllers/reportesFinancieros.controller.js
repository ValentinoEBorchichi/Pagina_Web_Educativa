const { sql, getPool } = require('../config/db');
const { manejarErrorMssql } = require('../utils/dbErrors');

const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function obtenerRango(req, res) {
    const desde = String(req.query.desde || '').trim();
    const hasta = String(req.query.hasta || '').trim();
    const fechaValida = (fecha) => {
        if (!FECHA_REGEX.test(fecha)) return false;
        const parsed = new Date(`${fecha}T00:00:00Z`);
        return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === fecha;
    };

    if (!fechaValida(desde) || !fechaValida(hasta) || desde > hasta) {
        res.status(400).json({ message: 'desde y hasta son obligatorios y deben tener formato YYYY-MM-DD válido' });
        return null;
    }
    return { desde, hasta };
}

function prepararConsulta(pool, rango) {
    return pool.request()
        .input('desde', sql.Date, rango.desde)
        .input('hasta', sql.Date, rango.hasta);
}

// HU12-01: ingresos reconocidos por período y alumno.
exports.obtenerIngresos = async (req, res) => {
    const rango = obtenerRango(req, res);
    if (!rango) return;

    try {
        const pool = await getPool();
        const { recordset } = await prepararConsulta(pool, rango).query(`
            SELECT f.periodo,
                   YEAR(f.periodo) AS anio,
                   a.id AS alumno_id,
                   CONCAT(a.apellido, ', ', a.nombre) AS alumno,
                   SUM(f.total) AS total_facturado,
                   SUM(f.total - f.saldo) AS ingresos,
                   SUM(f.saldo) AS saldo_pendiente
            FROM dbo.Factura f
            INNER JOIN dbo.Alumnos a ON a.id = f.alumno_id
            WHERE f.periodo BETWEEN @desde AND @hasta
              AND f.estado <> 'Anulada'
            GROUP BY f.periodo, a.id, a.apellido, a.nombre
            ORDER BY f.periodo, a.apellido, a.nombre;
        `);
        return res.json(recordset);
    } catch (err) {
        return manejarErrorMssql(res, err);
    }
};

// HU12-02: facturas completamente pagadas, agrupadas por año y alumno.
exports.obtenerPagosCompletos = async (req, res) => {
    const rango = obtenerRango(req, res);
    if (!rango) return;

    try {
        const pool = await getPool();
        const { recordset } = await prepararConsulta(pool, rango).query(`
            SELECT YEAR(f.periodo) AS anio,
                   a.id AS alumno_id,
                   CONCAT(a.apellido, ', ', a.nombre) AS alumno,
                   COUNT(f.id) AS facturas_pagadas,
                   SUM(f.total) AS total_pagado
            FROM dbo.Factura f
            INNER JOIN dbo.Alumnos a ON a.id = f.alumno_id
            WHERE f.periodo BETWEEN @desde AND @hasta
              AND f.estado <> 'Anulada'
              AND f.saldo = 0
            GROUP BY YEAR(f.periodo), a.id, a.apellido, a.nombre
            ORDER BY anio, a.apellido, a.nombre;
        `);
        return res.json(recordset);
    } catch (err) {
        return manejarErrorMssql(res, err);
    }
};

// HU12-03: facturas con deuda parcial, agrupadas por año y alumno.
exports.obtenerPagosIncompletos = async (req, res) => {
    const rango = obtenerRango(req, res);
    if (!rango) return;

    try {
        const pool = await getPool();
        const { recordset } = await prepararConsulta(pool, rango).query(`
            SELECT YEAR(f.periodo) AS anio,
                   a.id AS alumno_id,
                   CONCAT(a.apellido, ', ', a.nombre) AS alumno,
                   COUNT(f.id) AS facturas_con_deuda,
                   SUM(f.total - f.saldo) AS total_pagado,
                   SUM(f.saldo) AS deuda_pendiente
            FROM dbo.Factura f
            INNER JOIN dbo.Alumnos a ON a.id = f.alumno_id
            WHERE f.periodo BETWEEN @desde AND @hasta
              AND f.estado <> 'Anulada'
              AND f.saldo > 0
              AND f.saldo < f.total
            GROUP BY YEAR(f.periodo), a.id, a.apellido, a.nombre
            ORDER BY anio, deuda_pendiente DESC, a.apellido, a.nombre;
        `);
        return res.json(recordset);
    } catch (err) {
        return manejarErrorMssql(res, err);
    }
};

// HU12-04: pagos asociados a deportes y datos de la actividad/profesor.
exports.obtenerPagosDeportes = async (req, res) => {
    const rango = obtenerRango(req, res);
    if (!rango) return;

    try {
        const pool = await getPool();
        const { recordset } = await prepararConsulta(pool, rango).query(`
            SELECT YEAR(f.periodo) AS anio,
                   f.periodo,
                   a.id AS alumno_id,
                   CONCAT(a.apellido, ', ', a.nombre) AS alumno,
                   c.nivel AS nivel,
                   d.id AS deporte_id,
                   d.nombre AS deporte,
                   d.dias_semana,
                   d.hora_inicio,
                   d.hora_fin,
                   CONCAT(u.nombre, ' ', u.apellido) AS profesor,
                   fd.subtotal AS importe_deporte,
                   CASE WHEN f.total = 0 THEN 0
                        ELSE fd.subtotal * (f.total - f.saldo) / f.total
                   END AS importe_pagado,
                   f.estado
            FROM dbo.Factura f
            INNER JOIN dbo.Alumnos a ON a.id = f.alumno_id
            INNER JOIN dbo.Cursos c ON c.id = a.curso_id
            INNER JOIN dbo.FacturaDetalle fd ON fd.factura_id = f.id
            INNER JOIN dbo.TarifaConcepto tc ON tc.id = fd.tarifa_concepto_id
                                             AND tc.tipo_servicio = 'deporte'
            INNER JOIN dbo.Deportes d ON d.id = tc.deporte_id
            INNER JOIN dbo.Inscripciones_Deportes i ON i.alumno_id = a.id
                                                     AND i.deporte_id = d.id
            LEFT JOIN dbo.Profesores p ON p.id = d.profesor_id
            LEFT JOIN dbo.Usuarios u ON u.id = p.usuario_id
            WHERE f.periodo BETWEEN @desde AND @hasta
              AND f.estado <> 'Anulada'
            ORDER BY f.periodo, a.apellido, a.nombre, d.nombre;
        `);
        return res.json(recordset);
    } catch (err) {
        return manejarErrorMssql(res, err);
    }
};

// HU12-05: pagos asociados al servicio de transporte por recorrido.
exports.obtenerPagosTransporte = async (req, res) => {
    const rango = obtenerRango(req, res);
    if (!rango) return;

    try {
        const pool = await getPool();
        const { recordset } = await prepararConsulta(pool, rango).query(`
            SELECT YEAR(f.periodo) AS anio,
                   f.periodo,
                   t.numero_recorrido,
                   t.nombre AS recorrido,
                   a.id AS alumno_id,
                   CONCAT(a.apellido, ', ', a.nombre) AS alumno,
                   fd.subtotal AS importe_transporte,
                   CASE WHEN f.total = 0 THEN 0
                        ELSE fd.subtotal * (f.total - f.saldo) / f.total
                   END AS importe_pagado,
                   f.estado
            FROM dbo.Factura f
            INNER JOIN dbo.Alumnos a ON a.id = f.alumno_id
            INNER JOIN dbo.Transportes t ON t.id = a.transporte_id
            INNER JOIN dbo.FacturaDetalle fd ON fd.factura_id = f.id
            INNER JOIN dbo.TarifaConcepto tc ON tc.id = fd.tarifa_concepto_id
                                             AND tc.tipo_servicio = 'transporte'
                                             AND tc.transporte_id = t.id
            WHERE f.periodo BETWEEN @desde AND @hasta
              AND f.estado <> 'Anulada'
            ORDER BY f.periodo, t.numero_recorrido, a.apellido, a.nombre;
        `);
        return res.json(recordset);
    } catch (err) {
        return manejarErrorMssql(res, err);
    }
};
