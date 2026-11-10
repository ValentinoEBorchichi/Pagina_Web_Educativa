const { getPool } = require('../config/db');
const { NOMBRE_REGEX } = require('../utils/validators');
const { manejarErrorPg } = require('../utils/dbErrors');
const { calcularHash, guardarComprobante, eliminarComprobante } = require('../services/comprobanteStorage');
const { descargarArchivo, BUCKET_COMPROBANTES } = require('../config/supabaseStorage');

// Módulo financiero: SOLO el sistema de facturación/comprobantes (antes en
// SQL Server). El sistema viejo de SQLite (cuotas_config/pagos/saldos_alumnos,
// con alta manual de pagos por el admin) se eliminó por completo -ver
// backend/supabase/schema.sql-: el flujo ahora es que el padre/alumno sube el
// comprobante de transferencia y el admin lo aprueba o rechaza desde la
// bandeja de verificación (getComprobantes/aprobarComprobante/rechazarComprobante).

function respuestaErrorComprobante(res, status, message) {
    return res.status(status).json({ message });
}

// Recibe el comprobante, calcula SHA-256, evita duplicados y lo registra.
exports.subirComprobante = async (req, res) => {
    const facturaId = Number.parseInt(req.body.factura_id, 10);
    const monto = Number(req.body.monto);
    const fechaTransferencia = req.body.fecha_transferencia;
    const archivo = req.file;

    if (!Number.isInteger(facturaId) || facturaId <= 0) {
        return respuestaErrorComprobante(res, 400, 'factura_id inválido');
    }
    if (!archivo) {
        return respuestaErrorComprobante(res, 400, 'Debe enviar el archivo en el campo archivo');
    }
    if (!Number.isFinite(monto) || monto <= 0) {
        return respuestaErrorComprobante(res, 400, 'El monto debe ser mayor que cero');
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(fechaTransferencia || ''))) {
        return respuestaErrorComprobante(res, 400, 'fecha_transferencia debe tener formato YYYY-MM-DD');
    }

    const hashArchivo = calcularHash(archivo);
    let comprobanteGuardado;

    try {
        const pool = await getPool();
        const acceso = await pool.query(
            `SELECT f.id
             FROM factura f
             INNER JOIN alumnos a ON a.id = f.alumno_id
             WHERE f.id = $1
               AND (
                   $2 = 'admin'
                   OR ($2 = 'alumno' AND a.usuario_id = $3)
                   OR ($2 = 'padre' AND a.padre_id = $3)
               )`,
            [facturaId, req.user.rol, req.user.id]
        );

        if (!acceso.rows.length) {
            return respuestaErrorComprobante(res, 404, 'Factura inexistente o sin permisos');
        }

        const duplicado = await pool.query(
            'SELECT id FROM comprobante_transferencia WHERE hash_archivo = $1 LIMIT 1',
            [hashArchivo]
        );

        if (duplicado.rows.length) {
            return respuestaErrorComprobante(res, 409, 'El archivo ya fue cargado anteriormente');
        }

        comprobanteGuardado = await guardarComprobante(archivo);

        const insertado = await pool.query(
            `INSERT INTO comprobante_transferencia
                (factura_id, nombre_archivo, ruta_archivo, tipo_mime,
                 tamano_bytes, monto, fecha_transferencia, hash_archivo,
                 estado_verificacion)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Pendiente')
             RETURNING id, factura_id, nombre_archivo, monto, fecha_transferencia, hash_archivo, estado_verificacion`,
            [facturaId, comprobanteGuardado.nombreArchivo, comprobanteGuardado.rutaArchivo,
                archivo.mimetype, archivo.size, monto, fechaTransferencia, hashArchivo]
        );

        return res.status(201).json({
            message: 'Comprobante cargado correctamente',
            comprobante: insertado.rows[0]
        });
    } catch (err) {
        if (comprobanteGuardado) {
            await eliminarComprobante(comprobanteGuardado.rutaArchivo);
        }
        if (err.code === '23505') {
            return respuestaErrorComprobante(res, 409, 'El archivo ya fue cargado anteriormente');
        }
        return manejarErrorPg(res, err);
    }
};

// Descarga el archivo subido (Supabase Storage). Admin puede ver cualquiera;
// padre/alumno solo los de su propia factura.
exports.descargarComprobanteArchivo = async (req, res) => {
    const id = parseInt(req.params.id);
    if (!id) return res.status(400).json({ message: 'Comprobante inválido' });
    try {
        const pool = await getPool();
        const { rows } = await pool.query(
            `SELECT ct.ruta_archivo, ct.nombre_archivo, ct.tipo_mime, a.padre_id, a.usuario_id
             FROM comprobante_transferencia ct
             JOIN factura f ON f.id = ct.factura_id
             JOIN alumnos a ON a.id = f.alumno_id
             WHERE ct.id = $1`,
            [id]
        );
        const comprobante = rows[0];
        if (!comprobante) return res.status(404).json({ message: 'Comprobante no encontrado' });

        const tieneAcceso = req.user.rol === 'admin'
            || (req.user.rol === 'padre' && comprobante.padre_id === req.user.id)
            || (req.user.rol === 'alumno' && comprobante.usuario_id === req.user.id);
        if (!tieneAcceso) return res.status(403).json({ message: 'No tiene acceso a este comprobante' });

        const buffer = await descargarArchivo(BUCKET_COMPROBANTES, comprobante.ruta_archivo);
        res.setHeader('Content-Type', comprobante.tipo_mime || 'application/octet-stream');
        res.setHeader('Content-Disposition', `inline; filename="${comprobante.nombre_archivo}"`);
        res.send(buffer);
    } catch (err) {
        manejarErrorPg(res, err);
    }
};

// --- PERSONAL (legajo no docente: no es financiero, pero vive en este
// controlador/ruta por compatibilidad con el frontend ya existente). ---
exports.getPersonal = async (req, res) => {
    try {
        const pool = await getPool();
        const { rows } = await pool.query('SELECT * FROM personal');
        res.json(rows);
    } catch (err) { manejarErrorPg(res, err); }
};

exports.createPersonal = async (req, res) => {
    const { nombre, apellido, dni, tipo, email } = req.body;
    if (!nombre || !apellido || !dni || !tipo) return res.status(400).json({ message: "Campos obligatorios" });
    if (!NOMBRE_REGEX.test(String(nombre).trim()) || !NOMBRE_REGEX.test(String(apellido).trim())) {
        return res.status(400).json({ message: "Nombre y apellido solo pueden contener letras (sin números ni símbolos)" });
    }
    if (!/^\d+$/.test(String(dni).trim())) return res.status(400).json({ message: "El DNI debe ser numérico (sin puntos ni letras)" });
    try {
        const pool = await getPool();
        const { rows } = await pool.query(
            'INSERT INTO personal (nombre, apellido, dni, tipo, email) VALUES ($1, $2, $3, $4, $5) RETURNING id',
            [nombre, apellido, dni, tipo, email]
        );
        res.status(201).json({ id: rows[0].id });
    } catch (err) { manejarErrorPg(res, err); }
};

exports.updatePersonal = async (req, res) => {
    const { id } = req.params;
    const { nombre, apellido, dni, tipo, email } = req.body;
    if (!nombre || !apellido || !dni || !tipo) return res.status(400).json({ message: "Campos obligatorios" });
    if (!NOMBRE_REGEX.test(String(nombre).trim()) || !NOMBRE_REGEX.test(String(apellido).trim())) {
        return res.status(400).json({ message: "Nombre y apellido solo pueden contener letras (sin números ni símbolos)" });
    }
    if (!/^\d+$/.test(String(dni).trim())) return res.status(400).json({ message: "El DNI debe ser numérico (sin puntos ni letras)" });
    try {
        const pool = await getPool();
        const { rowCount } = await pool.query(
            'UPDATE personal SET nombre = $1, apellido = $2, dni = $3, tipo = $4, email = $5 WHERE id = $6',
            [nombre, apellido, dni, tipo, email, id]
        );
        if (rowCount === 0) return res.status(404).json({ message: "Personal no encontrado" });
        res.json({ message: "Legajo de personal actualizado correctamente" });
    } catch (err) { manejarErrorPg(res, err); }
};

exports.deletePersonal = async (req, res) => {
    const { id } = req.params;
    try {
        const pool = await getPool();
        await pool.query('DELETE FROM personal WHERE id = $1', [id]);
        res.json({ message: "Personal eliminado" });
    } catch (err) { manejarErrorPg(res, err); }
};

// --- TARIFAS (tarifa_concepto) — reemplaza a la vieja "cuotas_config" ---
exports.getTarifas = async (req, res) => {
    try {
        const pool = await getPool();
        const { rows } = await pool.query(
            `SELECT tc.*, d.nombre AS deporte_nombre, t.nombre AS transporte_nombre
             FROM tarifa_concepto tc
             LEFT JOIN deportes d ON d.id = tc.deporte_id
             LEFT JOIN transportes t ON t.id = tc.transporte_id
             ORDER BY tc.vigencia DESC, tc.tipo_servicio`
        );
        res.json(rows);
    } catch (err) { manejarErrorPg(res, err); }
};

exports.createTarifa = async (req, res) => {
    const { tipo_servicio, descripcion, monto, vigencia, deporte_id, transporte_id } = req.body;
    const montoNum = parseFloat(monto);
    if (!['cuota', 'deporte', 'transporte', 'comedor'].includes(tipo_servicio)) {
        return res.status(400).json({ message: "tipo_servicio inválido" });
    }
    if (!vigencia || isNaN(montoNum) || montoNum <= 0) {
        return res.status(400).json({ message: "El monto debe ser mayor a 0 y la vigencia es obligatoria" });
    }
    try {
        const pool = await getPool();
        const { rows } = await pool.query(
            `INSERT INTO tarifa_concepto (tipo_servicio, descripcion, monto, vigencia, deporte_id, transporte_id)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
            [tipo_servicio, descripcion || null, montoNum, vigencia, deporte_id || null, transporte_id || null]
        );
        res.status(201).json({ id: rows[0].id });
    } catch (err) { manejarErrorPg(res, err); }
};

exports.deleteTarifa = async (req, res) => {
    const { id } = req.params;
    try {
        const pool = await getPool();
        await pool.query('UPDATE tarifa_concepto SET activo = FALSE WHERE id = $1', [id]);
        res.json({ message: "Tarifa desactivada" });
    } catch (err) { manejarErrorPg(res, err); }
};

// --- FACTURAS (reemplaza a "pagos"/"deudores": una factura con saldo > 0 es,
// justamente, una deuda). Admin ve todas (opcionalmente filtradas por
// alumno_id); padre/alumno solo las propias. ---
exports.getFacturas = async (req, res) => {
    try {
        const pool = await getPool();
        const condiciones = [];
        const params = [];

        if (req.user.rol === 'padre') {
            params.push(req.user.id);
            condiciones.push(`a.padre_id = $${params.length}`);
        } else if (req.user.rol === 'alumno') {
            params.push(req.user.id);
            condiciones.push(`a.usuario_id = $${params.length}`);
        } else if (req.query.alumno_id) {
            params.push(parseInt(req.query.alumno_id));
            condiciones.push(`a.id = $${params.length}`);
        }
        if (req.query.soloDeuda === '1') {
            condiciones.push('f.saldo > 0');
        }

        const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
        const { rows } = await pool.query(
            `SELECT f.*, a.nombre AS alumno_nombre, a.apellido AS alumno_apellido, a.dni AS alumno_dni
             FROM factura f
             JOIN alumnos a ON a.id = f.alumno_id
             ${where}
             ORDER BY f.periodo DESC, a.apellido, a.nombre`,
            params
        );
        res.json(rows);
    } catch (err) { manejarErrorPg(res, err); }
};

exports.getFacturaDetalle = async (req, res) => {
    const facturaId = parseInt(req.params.id);
    if (!facturaId) return res.status(400).json({ message: 'Factura inválida' });
    try {
        const pool = await getPool();
        const { rows } = await pool.query(
            `SELECT fd.*, tc.tipo_servicio
             FROM factura_detalle fd
             JOIN tarifa_concepto tc ON tc.id = fd.tarifa_concepto_id
             WHERE fd.factura_id = $1
             ORDER BY fd.id`,
            [facturaId]
        );
        res.json(rows);
    } catch (err) { manejarErrorPg(res, err); }
};

exports.getSaldoAlumno = async (req, res) => {
    const alumno_id = parseInt(req.params.alumno_id);
    if (!alumno_id) return res.status(400).json({ message: "Alumno inválido" });

    try {
        const pool = await getPool();
        const { rows } = await pool.query(
            'SELECT alumno_id, saldo_pendiente, ultima_actualizacion FROM saldos WHERE alumno_id = $1',
            [alumno_id]
        );
        res.json(rows[0] || { alumno_id, saldo_pendiente: 0 });
    } catch (err) {
        manejarErrorPg(res, err);
    }
};

// --- BANDEJA DE VERIFICACIÓN DE COMPROBANTES ---
// Admin ve todos (opcionalmente filtrados por ?estado=Pendiente|Aprobado|Rechazado);
// padre/alumno ven solo los propios (reemplaza al viejo listado de "pagos").
exports.getComprobantes = async (req, res) => {
    try {
        const pool = await getPool();
        const condiciones = [];
        const params = [];

        if (req.user.rol === 'padre') {
            params.push(req.user.id);
            condiciones.push(`a.padre_id = $${params.length}`);
        } else if (req.user.rol === 'alumno') {
            params.push(req.user.id);
            condiciones.push(`a.usuario_id = $${params.length}`);
        }
        if (req.query.estado) {
            params.push(req.query.estado);
            condiciones.push(`ct.estado_verificacion = $${params.length}`);
        }

        const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
        const { rows } = await pool.query(
            `SELECT ct.id, ct.factura_id, ct.nombre_archivo, ct.tipo_mime, ct.monto,
                    ct.fecha_transferencia, ct.estado_verificacion, ct.observaciones, ct.fecha_carga,
                    f.periodo, a.nombre AS alumno_nombre, a.apellido AS alumno_apellido, a.dni AS alumno_dni
             FROM comprobante_transferencia ct
             JOIN factura f ON f.id = ct.factura_id
             JOIN alumnos a ON a.id = f.alumno_id
             ${where}
             ORDER BY ct.fecha_carga DESC`,
            params
        );
        res.json(rows);
    } catch (err) { manejarErrorPg(res, err); }
};

// Aprueba el comprobante: descuenta el monto de la factura y de saldos.
exports.aprobarComprobante = async (req, res) => {
    const id = parseInt(req.params.id);
    if (!id) return res.status(400).json({ message: 'Comprobante inválido' });

    const pool = await getPool();
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const { rows: comprobanteRows } = await client.query(
            `UPDATE comprobante_transferencia SET estado_verificacion = 'Aprobado', observaciones = $1
             WHERE id = $2 AND estado_verificacion = 'Pendiente'
             RETURNING factura_id, monto`,
            [req.body.observaciones || null, id]
        );
        if (!comprobanteRows[0]) {
            await client.query('ROLLBACK');
            return res.status(409).json({ message: 'El comprobante ya fue verificado o no existe' });
        }
        const { factura_id, monto } = comprobanteRows[0];

        const { rows: facturaRows } = await client.query(
            `UPDATE factura SET
                saldo = GREATEST(saldo - $1, 0),
                estado = CASE
                    WHEN saldo - $1 <= 0 THEN 'Pagada'
                    WHEN saldo - $1 < total THEN 'Pago parcial'
                    ELSE estado
                END
             WHERE id = $2
             RETURNING alumno_id, saldo`,
            [monto, factura_id]
        );
        const { alumno_id, saldo } = facturaRows[0];

        await client.query(
            `INSERT INTO saldos (alumno_id, saldo_pendiente, ultima_actualizacion)
             VALUES ($1, $2, now())
             ON CONFLICT (alumno_id) DO UPDATE SET saldo_pendiente = $2, ultima_actualizacion = now()`,
            [alumno_id, saldo]
        );

        await client.query('COMMIT');
        res.json({ message: 'Comprobante aprobado: factura y saldo actualizados' });
    } catch (err) {
        await client.query('ROLLBACK');
        manejarErrorPg(res, err);
    } finally {
        client.release();
    }
};

exports.rechazarComprobante = async (req, res) => {
    const id = parseInt(req.params.id);
    if (!id) return res.status(400).json({ message: 'Comprobante inválido' });
    try {
        const pool = await getPool();
        const { rows } = await pool.query(
            `UPDATE comprobante_transferencia SET estado_verificacion = 'Rechazado', observaciones = $1
             WHERE id = $2 AND estado_verificacion = 'Pendiente'
             RETURNING id`,
            [req.body.observaciones || null, id]
        );
        if (!rows[0]) return res.status(409).json({ message: 'El comprobante ya fue verificado o no existe' });
        res.json({ message: 'Comprobante rechazado' });
    } catch (err) { manejarErrorPg(res, err); }
};
