const { getPool } = require('../config/db');
const { NOMBRE_REGEX } = require('../utils/validators');
const { manejarErrorPg } = require('../utils/dbErrors');
const { aCentavos, deCentavos, calcularRecargoCentavos, repartirEnCuotas } = require('../utils/cuotas');
const { calcularHash, guardarComprobante, eliminarComprobante } = require('../services/comprobanteStorage');
const { generarFacturaPDF } = require('../services/facturaPdf.service');
const { generarReciboPDF } = require('../services/reciboPdf.service');
const { obtenerUrlFirmada, BUCKET_COMPROBANTES } = require('../config/supabaseStorage');

// Módulo financiero: SOLO el sistema de facturación/comprobantes (antes en
// SQL Server). El sistema viejo de SQLite (cuotas_config/pagos/saldos_alumnos,
// con alta manual de pagos por el admin) se eliminó por completo -ver
// backend/supabase/schema.sql-: el flujo ahora es que el padre/alumno sube el
// comprobante de transferencia y el admin lo aprueba o rechaza desde la
// bandeja de verificación (getComprobantes/aprobarComprobante/rechazarComprobante).
//
// Planes de pago en cuotas (ver supabase/migracion_cuotas.sql): el padre elige
// un plan para una factura con saldo (elegirPlan), eso genera las cuotas
// (factura_cuota) y cada comprobante se sube contra UNA cuota
// (factura_cuota_id). Al aprobarlo la cuota pasa a 'Pagada'.

function respuestaErrorComprobante(res, status, message) {
    return res.status(status).json({ message });
}

// Error de regla de negocio con el status HTTP que corresponde. Se lanza
// dentro de los bloques try (incluidas las transacciones, para que el catch
// haga ROLLBACK) y se traduce a respuesta en un solo lugar: responderError.
class ErrorNegocio extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

function responderError(res, err) {
    if (err instanceof ErrorNegocio) return res.status(err.status).json({ message: err.message });
    return manejarErrorPg(res, err);
}

// Filtro de dueño reutilizable: admin ve todo; padre solo las facturas de sus
// hijos (alumnos.padre_id); alumno solo las propias (alumnos.usuario_id).
// Requiere que la consulta tenga la tabla alumnos con alias "a". Es SQL
// estático: solo se interpolan las POSICIONES de los parámetros ($2, $3...),
// el rol y el id viajan siempre como parámetros.
const filtroDuenio = (posRol, posUsuario) => `(
    $${posRol} = 'admin'
    OR ($${posRol} = 'alumno' AND a.usuario_id = $${posUsuario})
    OR ($${posRol} = 'padre' AND a.padre_id = $${posUsuario})
)`;

const ZONA_HORARIA_SQL = 'America/Argentina/Buenos_Aires';

// `bloquear` toma un lock de escritura sobre la fila (solo dentro de una
// transacción) para serializar operaciones concurrentes. El lock va en una
// sentencia APARTE y la lectura después: en READ COMMITTED una sola sentencia
// con FOR UPDATE + JOIN re-lee la fila bloqueada pero no las filas unidas que
// otra transacción haya confirmado mientras esperaba el lock, y la validación
// vería datos viejos.
async function bloquearFila(db, tabla, id) {
    await db.query(`SELECT 1 FROM ${tabla} WHERE id = $1 FOR UPDATE`, [id]);
}

// Una factura solo se consulta si el usuario es su dueño (o admin). Devuelve
// la fila o undefined. base_vencimiento: fecha desde la que se arman los
// vencimientos de las cuotas (el mayor entre el vencimiento de la factura y hoy).
async function obtenerFacturaConAcceso(db, facturaId, user, { bloquear = false } = {}) {
    if (bloquear) await bloquearFila(db, 'factura', facturaId);
    const { rows } = await db.query(
        `SELECT f.id, f.alumno_id, f.estado, f.total, f.saldo, f.plan_pago_id,
                to_char(GREATEST(f.fecha_vencimiento,
                    (now() AT TIME ZONE '${ZONA_HORARIA_SQL}')::date), 'YYYY-MM-DD') AS base_vencimiento
         FROM factura f
         INNER JOIN alumnos a ON a.id = f.alumno_id
         WHERE f.id = $1 AND ${filtroDuenio(2, 3)}`,
        [facturaId, user.rol, user.id]
    );
    return rows[0];
}

// Igual que la anterior pero para una cuota (con el estado de su comprobante).
async function obtenerCuotaConAcceso(db, cuotaId, user, { bloquear = false } = {}) {
    if (bloquear) await bloquearFila(db, 'factura_cuota', cuotaId);
    const { rows } = await db.query(
        `SELECT fc.id, fc.factura_id, fc.numero_cuota, fc.monto, fc.estado,
                fc.comprobante_transferencia_id,
                ct.estado_verificacion AS comprobante_estado
         FROM factura_cuota fc
         INNER JOIN factura f ON f.id = fc.factura_id
         INNER JOIN alumnos a ON a.id = f.alumno_id
         LEFT JOIN comprobante_transferencia ct ON ct.id = fc.comprobante_transferencia_id
         WHERE fc.id = $1 AND ${filtroDuenio(2, 3)}`,
        [cuotaId, user.rol, user.id]
    );
    return rows[0];
}

// saldos.saldo_pendiente = deuda total del alumno (suma de los saldos de sus
// facturas no anuladas), no solo la de la factura que se acaba de tocar.
async function recalcularSaldoAlumno(client, alumnoId) {
    await client.query(
        `INSERT INTO saldos (alumno_id, saldo_pendiente, ultima_actualizacion)
         SELECT $1, COALESCE(SUM(saldo), 0), now()
         FROM factura WHERE alumno_id = $1 AND estado <> 'Anulada'
         ON CONFLICT (alumno_id) DO UPDATE
             SET saldo_pendiente = EXCLUDED.saldo_pendiente, ultima_actualizacion = now()`,
        [alumnoId]
    );
}

// nombre_archivo viene del nombre original que subió el usuario: nunca se
// usa tal cual en una cabecera HTTP (CRLF/comillas podrían inyectar otras
// cabeceras o romper el Content-Disposition).
function sanitizarNombreArchivo(nombre) {
    const limpio = String(nombre || '').replace(/[^\w .-]/g, '').slice(0, 150).trim();
    return limpio || 'comprobante';
}

// tipo_mime también viene del archivo que subió el usuario (ver
// uploadComprobante.js): aunque ya se valida al subirlo, se revalida acá
// contra la misma lista blanca antes de usarlo para armar la respuesta, en
// vez de confiar en lo que haya quedado guardado en la base.
const TIPOS_MIME_PERMITIDOS = new Set(['image/jpeg', 'image/png', 'application/pdf']);
function tipoMimeSeguro(tipoMime) {
    return TIPOS_MIME_PERMITIDOS.has(tipoMime) ? tipoMime : 'application/octet-stream';
}

const CUOTA_ESTADOS_PAGABLES = ['Pendiente', 'Vencida'];

// Decide contra qué se registra el comprobante y valida las reglas:
//  - con factura_cuota_id: la cuota debe ser del usuario, estar pendiente, no
//    tener ya un comprobante en revisión y el monto debe ser el de la cuota;
//  - sin cuota: solo vale para facturas SIN plan de pago (si tiene plan, cada
//    pago tiene que ir atado a una cuota para que el estado de las cuotas
//    siga siendo coherente con el saldo).
// Devuelve { facturaId, cuotaId } o lanza ErrorNegocio.
async function resolverDestinoComprobante(db, { facturaId, cuotaId, monto, user, bloquear = false }) {
    if (cuotaId) {
        const cuota = await obtenerCuotaConAcceso(db, cuotaId, user, { bloquear });
        if (!cuota) throw new ErrorNegocio(404, 'Cuota inexistente o sin permisos');
        if (facturaId && facturaId !== cuota.factura_id) {
            throw new ErrorNegocio(400, 'La cuota no pertenece a la factura indicada');
        }
        if (!CUOTA_ESTADOS_PAGABLES.includes(cuota.estado)) {
            throw new ErrorNegocio(409, `La cuota ya está ${cuota.estado.toLowerCase()}`);
        }
        if (cuota.comprobante_estado === 'Pendiente') {
            throw new ErrorNegocio(409, 'La cuota ya tiene un comprobante pendiente de revisión');
        }
        if (aCentavos(monto) !== aCentavos(cuota.monto)) {
            throw new ErrorNegocio(400, `El monto debe coincidir con el de la cuota (${cuota.monto})`);
        }
        return { facturaId: cuota.factura_id, cuotaId: cuota.id };
    }

    const factura = await obtenerFacturaConAcceso(db, facturaId, user, { bloquear });
    if (!factura) throw new ErrorNegocio(404, 'Factura inexistente o sin permisos');
    if (factura.plan_pago_id) {
        throw new ErrorNegocio(400, 'La factura tiene un plan de pago: indicá la cuota que estás pagando (factura_cuota_id)');
    }
    return { facturaId: factura.id, cuotaId: null };
}

// Recibe el comprobante, calcula SHA-256, evita duplicados y lo registra.
// Campos (multipart): archivo, monto, fecha_transferencia y factura_cuota_id
// (si se paga una cuota) o factura_id (factura sin plan de pago). Si vienen
// ambos, la cuota tiene que pertenecer a esa factura.
exports.subirComprobante = async (req, res) => {
    const hayFactura = req.body.factura_id != null && req.body.factura_id !== '';
    const hayCuota = req.body.factura_cuota_id != null && req.body.factura_cuota_id !== '';
    const facturaId = hayFactura ? Number(req.body.factura_id) : null;
    const cuotaId = hayCuota ? Number(req.body.factura_cuota_id) : null;
    const monto = Number(req.body.monto);
    const fechaTransferencia = req.body.fecha_transferencia;
    const archivo = req.file;

    if (hayFactura && !(Number.isInteger(facturaId) && facturaId > 0)) {
        return respuestaErrorComprobante(res, 400, 'factura_id inválido');
    }
    if (hayCuota && !(Number.isInteger(cuotaId) && cuotaId > 0)) {
        return respuestaErrorComprobante(res, 400, 'factura_cuota_id inválido');
    }
    if (!hayFactura && !hayCuota) {
        return respuestaErrorComprobante(res, 400, 'Indicá factura_cuota_id (o factura_id si la factura no tiene plan de pago)');
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
    let client;

    try {
        const pool = await getPool();

        // Validación previa (sin lock): evita subir el archivo a Storage si el
        // pedido ya es inválido. Se repite dentro de la transacción, con lock.
        await resolverDestinoComprobante(pool, { facturaId, cuotaId, monto, user: req.user });

        const duplicado = await pool.query(
            'SELECT id FROM comprobante_transferencia WHERE hash_archivo = $1 LIMIT 1',
            [hashArchivo]
        );

        if (duplicado.rows.length) {
            return respuestaErrorComprobante(res, 409, 'El archivo ya fue cargado anteriormente');
        }

        comprobanteGuardado = await guardarComprobante(archivo);

        client = await pool.connect();
        await client.query('BEGIN');

        const destino = await resolverDestinoComprobante(client, {
            facturaId, cuotaId, monto, user: req.user, bloquear: true
        });

        const insertado = await client.query(
            `INSERT INTO comprobante_transferencia
                (factura_id, nombre_archivo, ruta_archivo, tipo_mime,
                 tamano_bytes, monto, fecha_transferencia, hash_archivo,
                 estado_verificacion)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Pendiente')
             RETURNING id, factura_id, nombre_archivo, monto, fecha_transferencia, hash_archivo, estado_verificacion`,
            [destino.facturaId, comprobanteGuardado.nombreArchivo, comprobanteGuardado.rutaArchivo,
                archivo.mimetype, archivo.size, monto, fechaTransferencia, hashArchivo]
        );

        // La cuota queda atada a este comprobante (si tenía uno rechazado, se
        // reemplaza: el rechazado queda en la bandeja como historial).
        if (destino.cuotaId) {
            await client.query(
                'UPDATE factura_cuota SET comprobante_transferencia_id = $1 WHERE id = $2',
                [insertado.rows[0].id, destino.cuotaId]
            );
        }

        await client.query('COMMIT');

        return res.status(201).json({
            message: 'Comprobante cargado correctamente',
            comprobante: { ...insertado.rows[0], factura_cuota_id: destino.cuotaId }
        });
    } catch (err) {
        if (client) await client.query('ROLLBACK').catch(() => undefined);
        if (comprobanteGuardado) {
            await eliminarComprobante(comprobanteGuardado.rutaArchivo);
        }
        if (err.code === '23505') {
            return respuestaErrorComprobante(res, 409, 'El archivo ya fue cargado anteriormente');
        }
        return responderError(res, err);
    } finally {
        if (client) client.release();
    }
};

// Da acceso al archivo subido (Supabase Storage) SIN que el backend lea ni
// escriba esos bytes: devuelve una URL firmada de corta duración y el
// cliente descarga directo de Supabase. Admin puede ver cualquiera;
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

        const url = await obtenerUrlFirmada(BUCKET_COMPROBANTES, comprobante.ruta_archivo, 60);
        res.json({
            url,
            nombre_archivo: sanitizarNombreArchivo(comprobante.nombre_archivo),
            tipo_mime: tipoMimeSeguro(comprobante.tipo_mime)
        });
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
        // SQL estático y siempre parametrizado (nada de armar el WHERE
        // concatenando strings): el rol/alumno_id/soloDeuda viajan como
        // parámetros, nunca como texto dentro de la consulta.
        const alumnoIdFiltro = req.user.rol === 'admin' && req.query.alumno_id
            ? parseInt(req.query.alumno_id, 10)
            : null;
        const soloDeuda = req.query.soloDeuda === '1';

        const { rows } = await pool.query(
            `SELECT f.*, a.nombre AS alumno_nombre, a.apellido AS alumno_apellido, a.dni AS alumno_dni
             FROM factura f
             JOIN alumnos a ON a.id = f.alumno_id
             WHERE (
                 ($1 = 'padre' AND a.padre_id = $2)
                 OR ($1 = 'alumno' AND a.usuario_id = $2)
                 OR ($1 = 'admin' AND ($3::integer IS NULL OR a.id = $3))
             )
             AND ($4::boolean IS NOT TRUE OR f.saldo > 0)
             ORDER BY f.periodo DESC, a.apellido, a.nombre`,
            [req.user.rol, req.user.id, alumnoIdFiltro, soloDeuda]
        );
        res.json(rows);
    } catch (err) { manejarErrorPg(res, err); }
};

// Detalle (conceptos) de una factura: solo para su dueño (o admin).
exports.getFacturaDetalle = async (req, res) => {
    const facturaId = parseInt(req.params.id);
    if (!facturaId) return res.status(400).json({ message: 'Factura inválida' });
    try {
        const pool = await getPool();
        const factura = await obtenerFacturaConAcceso(pool, facturaId, req.user);
        if (!factura) return res.status(404).json({ message: 'Factura inexistente o sin permisos' });

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

// Saldo pendiente de un alumno: el padre solo ve el de sus hijos; admin el de
// cualquiera. 404 tanto si el alumno no existe como si no es suyo (no se
// revela cuáles legajos existen).
exports.getSaldoAlumno = async (req, res) => {
    const alumno_id = parseInt(req.params.alumno_id);
    if (!alumno_id) return res.status(400).json({ message: "Alumno inválido" });

    try {
        const pool = await getPool();
        const { rows } = await pool.query(
            `SELECT a.id AS alumno_id, s.saldo_pendiente, s.ultima_actualizacion
             FROM alumnos a
             LEFT JOIN saldos s ON s.alumno_id = a.id
             WHERE a.id = $1 AND ${filtroDuenio(2, 3)}`,
            [alumno_id, req.user.rol, req.user.id]
        );
        if (!rows[0]) return res.status(404).json({ message: 'Alumno inexistente o sin permisos' });
        res.json(rows[0].saldo_pendiente == null ? { alumno_id, saldo_pendiente: 0 } : rows[0]);
    } catch (err) {
        manejarErrorPg(res, err);
    }
};

// --- PLANES DE PAGO ---
// Catálogo de planes (cantidad de cuotas + recargo %). El admin ve todos
// (incluso los desactivados, con el campo "activo"); el resto solo los activos.
exports.getPlanesPago = async (req, res) => {
    try {
        const pool = await getPool();
        const { rows } = await pool.query(
            `SELECT id, nombre, cantidad_cuotas, recargo_pct, activo
             FROM plan_pago
             WHERE ($1::boolean OR activo)
             ORDER BY cantidad_cuotas, nombre`,
            [req.user.rol === 'admin']
        );
        res.json(rows);
    } catch (err) { manejarErrorPg(res, err); }
};

exports.createPlanPago = async (req, res) => {
    const nombre = String(req.body.nombre ?? '').trim();
    const cantidadCuotas = Number(req.body.cantidad_cuotas);
    const recargoPct = req.body.recargo_pct == null || req.body.recargo_pct === ''
        ? 0
        : Number(String(req.body.recargo_pct).replace(',', '.'));

    if (!nombre || nombre.length > 50) {
        return res.status(400).json({ message: 'El nombre es obligatorio y no puede superar los 50 caracteres' });
    }
    if (!Number.isInteger(cantidadCuotas) || cantidadCuotas < 1 || cantidadCuotas > 24) {
        return res.status(400).json({ message: 'La cantidad de cuotas debe ser un entero entre 1 y 24' });
    }
    if (!Number.isFinite(recargoPct) || recargoPct < 0 || recargoPct > 999.99) {
        return res.status(400).json({ message: 'El recargo debe ser un porcentaje entre 0 y 999,99' });
    }

    try {
        const pool = await getPool();
        const { rows } = await pool.query(
            `INSERT INTO plan_pago (nombre, cantidad_cuotas, recargo_pct)
             VALUES ($1, $2, $3)
             RETURNING id, nombre, cantidad_cuotas, recargo_pct, activo`,
            [nombre, cantidadCuotas, recargoPct]
        );
        res.status(201).json(rows[0]);
    } catch (err) {
        if (err.code === '23505') {
            return res.status(409).json({ message: 'Ya existe un plan de pago con ese nombre (puede estar desactivado)' });
        }
        manejarErrorPg(res, err);
    }
};

// Baja lógica: las facturas que ya eligieron el plan siguen referenciándolo.
exports.deletePlanPago = async (req, res) => {
    const id = parseInt(req.params.id);
    if (!id) return res.status(400).json({ message: 'Plan de pago inválido' });
    try {
        const pool = await getPool();
        const { rowCount } = await pool.query('UPDATE plan_pago SET activo = FALSE WHERE id = $1', [id]);
        if (!rowCount) return res.status(404).json({ message: 'Plan de pago no encontrado' });
        res.json({ message: 'Plan de pago desactivado' });
    } catch (err) { manejarErrorPg(res, err); }
};

// --- CUOTAS DE UNA FACTURA ---
// El padre (o el admin) elige un plan para una factura con saldo. En UNA
// transacción: se bloquea la factura, se suma el recargo del plan a total y
// saldo (así total - saldo sigue siendo lo pagado), se guarda plan_pago_id y
// se generan las cuotas. El plan no se puede cambiar una vez elegido.
exports.elegirPlan = async (req, res) => {
    const facturaId = parseInt(req.params.id);
    const planPagoId = Number(req.body.plan_pago_id);
    if (!facturaId) return res.status(400).json({ message: 'Factura inválida' });
    if (!Number.isInteger(planPagoId) || planPagoId <= 0) {
        return res.status(400).json({ message: 'plan_pago_id es obligatorio y debe ser un número entero positivo' });
    }

    const pool = await getPool();
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const factura = await obtenerFacturaConAcceso(client, facturaId, req.user, { bloquear: true });
        if (!factura) throw new ErrorNegocio(404, 'Factura inexistente o sin permisos');
        if (factura.plan_pago_id) {
            throw new ErrorNegocio(409, 'La factura ya tiene un plan de pago elegido');
        }
        if (['Pagada', 'Anulada'].includes(factura.estado) || Number(factura.saldo) <= 0) {
            throw new ErrorNegocio(409, 'La factura no tiene saldo pendiente para financiar');
        }

        const { rows: pendientes } = await client.query(
            `SELECT 1 FROM comprobante_transferencia
             WHERE factura_id = $1 AND estado_verificacion = 'Pendiente' LIMIT 1`,
            [facturaId]
        );
        if (pendientes.length) {
            throw new ErrorNegocio(409, 'La factura tiene un comprobante pendiente de revisión: esperá a que se verifique antes de elegir un plan');
        }

        const { rows: planes } = await client.query(
            'SELECT id, nombre, cantidad_cuotas, recargo_pct, activo FROM plan_pago WHERE id = $1',
            [planPagoId]
        );
        const plan = planes[0];
        if (!plan) throw new ErrorNegocio(404, 'Plan de pago inexistente');
        if (!plan.activo) throw new ErrorNegocio(409, 'El plan de pago no está disponible');

        const saldoCentavos = aCentavos(factura.saldo);
        const recargoCentavos = calcularRecargoCentavos(saldoCentavos, plan.recargo_pct);
        const montos = repartirEnCuotas(saldoCentavos + recargoCentavos, plan.cantidad_cuotas);
        if (!montos.length) {
            throw new ErrorNegocio(409, `El saldo es demasiado bajo para dividirlo en ${plan.cantidad_cuotas} cuotas`);
        }

        const { rows: facturaRows } = await client.query(
            `UPDATE factura
             SET plan_pago_id = $2, total = total + $3::numeric, saldo = saldo + $3::numeric
             WHERE id = $1
             RETURNING id, alumno_id, plan_pago_id, estado, total, saldo`,
            [facturaId, plan.id, deCentavos(recargoCentavos)]
        );

        // Cuota 1 vence en base_vencimiento (el mayor entre el vencimiento de
        // la factura y hoy); las siguientes, de a un mes (Postgres acomoda los
        // fines de mes: 31/01 + 1 mes = 28/02).
        const { rows: cuotas } = await client.query(
            `INSERT INTO factura_cuota (factura_id, plan_pago_id, numero_cuota, monto, vencimiento)
             SELECT $1::int, $2::int, t.numero, t.monto, ($3::date + make_interval(months => t.numero - 1))::date
             FROM unnest($4::int[], $5::numeric[]) AS t(numero, monto)
             ORDER BY t.numero
             RETURNING id, factura_id, plan_pago_id, numero_cuota, monto,
                       to_char(vencimiento, 'YYYY-MM-DD') AS vencimiento, estado,
                       comprobante_transferencia_id`,
            [
                facturaId,
                plan.id,
                factura.base_vencimiento,
                montos.map((_, i) => i + 1),
                montos.map(deCentavos)
            ]
        );

        cuotas.sort((a, b) => a.numero_cuota - b.numero_cuota);
        await recalcularSaldoAlumno(client, factura.alumno_id);
        await client.query('COMMIT');

        res.status(201).json({
            message: `Plan elegido: ${plan.nombre}`,
            factura: facturaRows[0],
            cuotas
        });
    } catch (err) {
        await client.query('ROLLBACK').catch(() => undefined);
        responderError(res, err);
    } finally {
        client.release();
    }
};

// Cuotas generadas de una factura (vacío si todavía no eligió plan), con el
// estado del comprobante atado a cada una. El vencimiento viaja como texto
// 'YYYY-MM-DD' (sin zona horaria) para que los clientes lo muestren tal cual.
exports.getCuotasFactura = async (req, res) => {
    const facturaId = parseInt(req.params.id);
    if (!facturaId) return res.status(400).json({ message: 'Factura inválida' });
    try {
        const pool = await getPool();
        const factura = await obtenerFacturaConAcceso(pool, facturaId, req.user);
        if (!factura) return res.status(404).json({ message: 'Factura inexistente o sin permisos' });

        const { rows } = await pool.query(
            `SELECT fc.id, fc.factura_id, fc.plan_pago_id, fc.numero_cuota, fc.monto,
                    to_char(fc.vencimiento, 'YYYY-MM-DD') AS vencimiento, fc.estado,
                    fc.comprobante_transferencia_id,
                    ct.estado_verificacion AS comprobante_estado,
                    ct.observaciones AS comprobante_observaciones
             FROM factura_cuota fc
             LEFT JOIN comprobante_transferencia ct ON ct.id = fc.comprobante_transferencia_id
             WHERE fc.factura_id = $1
             ORDER BY fc.numero_cuota`,
            [facturaId]
        );
        res.json(rows);
    } catch (err) { manejarErrorPg(res, err); }
};

// --- BANDEJA DE VERIFICACIÓN DE COMPROBANTES ---
// Admin ve todos (opcionalmente filtrados por ?estado=Pendiente|Aprobado|Rechazado);
// padre/alumno ven solo los propios (reemplaza al viejo listado de "pagos").
const ESTADOS_COMPROBANTE = ['Pendiente', 'Aprobado', 'Rechazado'];

exports.getComprobantes = async (req, res) => {
    try {
        const pool = await getPool();
        // Mismo criterio que getFacturas: SQL estático, filtros por parámetro.
        const estadoFiltro = ESTADOS_COMPROBANTE.includes(req.query.estado) ? req.query.estado : null;

        const { rows } = await pool.query(
            `SELECT ct.id, ct.factura_id, ct.nombre_archivo, ct.tipo_mime, ct.monto,
                    ct.fecha_transferencia, ct.estado_verificacion, ct.observaciones, ct.fecha_carga,
                    f.periodo, a.nombre AS alumno_nombre, a.apellido AS alumno_apellido, a.dni AS alumno_dni,
                    fc.id AS factura_cuota_id, fc.numero_cuota
             FROM comprobante_transferencia ct
             JOIN factura f ON f.id = ct.factura_id
             JOIN alumnos a ON a.id = f.alumno_id
             LEFT JOIN factura_cuota fc ON fc.comprobante_transferencia_id = ct.id
             WHERE (
                 ($1 = 'padre' AND a.padre_id = $2)
                 OR ($1 = 'alumno' AND a.usuario_id = $2)
                 OR $1 = 'admin'
             )
             AND ($3::varchar IS NULL OR ct.estado_verificacion = $3)
             ORDER BY ct.fecha_carga DESC`,
            [req.user.rol, req.user.id, estadoFiltro]
        );
        res.json(rows);
    } catch (err) { manejarErrorPg(res, err); }
};

// Aprueba el comprobante: descuenta el monto de la factura y de saldos y, si
// el comprobante está atado a una cuota, la marca 'Pagada'. Todo en una
// transacción: o se aplica el pago completo o no se aplica nada.
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
            throw new ErrorNegocio(409, 'El comprobante ya fue verificado o no existe');
        }
        const { factura_id, monto } = comprobanteRows[0];

        // Cuota atada a este comprobante (si la hay): se bloquea y se verifica
        // que siga pendiente antes de aplicar el pago.
        const { rows: cuotaRows } = await client.query(
            'SELECT id, estado FROM factura_cuota WHERE comprobante_transferencia_id = $1 FOR UPDATE',
            [id]
        );
        const cuota = cuotaRows[0];
        if (cuota && !CUOTA_ESTADOS_PAGABLES.includes(cuota.estado)) {
            throw new ErrorNegocio(409, `No se puede aprobar: la cuota ya está ${cuota.estado.toLowerCase()}`);
        }

        const { rows: facturaRows } = await client.query(
            `UPDATE factura SET
                saldo = GREATEST(saldo - $1, 0),
                estado = CASE
                    WHEN saldo - $1 <= 0 THEN 'Pagada'
                    WHEN saldo - $1 < total THEN 'Pago parcial'
                    ELSE estado
                END
             WHERE id = $2
             RETURNING alumno_id`,
            [monto, factura_id]
        );
        const { alumno_id } = facturaRows[0];

        if (cuota) {
            await client.query("UPDATE factura_cuota SET estado = 'Pagada' WHERE id = $1", [cuota.id]);
        }

        await recalcularSaldoAlumno(client, alumno_id);

        await client.query('COMMIT');
        res.json({ message: 'Comprobante aprobado: factura y saldo actualizados' });
    } catch (err) {
        await client.query('ROLLBACK').catch(() => undefined);
        responderError(res, err);
    } finally {
        client.release();
    }
};

// Rechaza el comprobante. La cuota atada (si la hay) NO cambia de estado: sigue
// 'Pendiente' y conserva el vínculo para mostrar el motivo del rechazo; el
// padre puede subir un comprobante nuevo, que reemplaza el vínculo.
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

// --- PDFs (factura y recibo) ---
// Se generan en el momento con los datos vigentes (estado, saldo, cuotas) y se
// devuelven como binario: el cliente los pide con su JWT y los abre como blob.
function enviarPdf(res, { buffer, nombreArchivo }) {
    res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${nombreArchivo}"`,
        'Content-Length': buffer.length,
        'Cache-Control': 'private, no-store'
    });
    // end (no send): es un binario ya generado por el servidor, con su
    // Content-Type fijo; no se interpreta ni se refleja entrada del usuario.
    res.end(buffer);
}

// GET /api/financiero/facturas/:id/pdf — dueño o admin.
exports.descargarFacturaPdf = async (req, res) => {
    const facturaId = parseInt(req.params.id);
    if (!facturaId) return res.status(400).json({ message: 'Factura inválida' });
    try {
        const pool = await getPool();
        const { rows } = await pool.query(
            `SELECT f.id, f.estado, f.total, f.saldo, f.plan_pago_id,
                    to_char(f.periodo, 'YYYY-MM-DD') AS periodo,
                    to_char(f.fecha_emision, 'YYYY-MM-DD') AS fecha_emision,
                    to_char(f.fecha_vencimiento, 'YYYY-MM-DD') AS fecha_vencimiento,
                    a.nombre, a.apellido, a.dni
             FROM factura f
             INNER JOIN alumnos a ON a.id = f.alumno_id
             WHERE f.id = $1 AND ${filtroDuenio(2, 3)}`,
            [facturaId, req.user.rol, req.user.id]
        );
        const factura = rows[0];
        if (!factura) return res.status(404).json({ message: 'Factura inexistente o sin permisos' });

        const { rows: detalles } = await pool.query(
            `SELECT descripcion, cantidad, importe_unitario, subtotal
             FROM factura_detalle WHERE factura_id = $1 ORDER BY id`,
            [facturaId]
        );

        let plan = null;
        let cuotas = [];
        if (factura.plan_pago_id) {
            const { rows: planes } = await pool.query(
                'SELECT nombre, cantidad_cuotas, recargo_pct FROM plan_pago WHERE id = $1',
                [factura.plan_pago_id]
            );
            plan = planes[0] || null;
            ({ rows: cuotas } = await pool.query(
                `SELECT numero_cuota, monto, to_char(vencimiento, 'YYYY-MM-DD') AS vencimiento, estado
                 FROM factura_cuota WHERE factura_id = $1 ORDER BY numero_cuota`,
                [facturaId]
            ));
        }

        const pdf = await generarFacturaPDF(
            factura, detalles,
            { nombre: factura.nombre, apellido: factura.apellido, dni: factura.dni },
            { cuotas, plan }
        );
        enviarPdf(res, pdf);
    } catch (err) { manejarErrorPg(res, err); }
};

// GET /api/financiero/comprobantes/:id/recibo — dueño o admin, y solo cuando
// el comprobante ya fue aprobado (un recibo certifica un pago acreditado).
exports.descargarReciboPdf = async (req, res) => {
    const comprobanteId = parseInt(req.params.id);
    if (!comprobanteId) return res.status(400).json({ message: 'Comprobante inválido' });
    try {
        const pool = await getPool();
        const { rows } = await pool.query(
            `SELECT ct.id, ct.monto, ct.estado_verificacion, ct.observaciones,
                    to_char(ct.fecha_transferencia, 'YYYY-MM-DD') AS fecha_transferencia,
                    to_char(ct.fecha_carga AT TIME ZONE '${ZONA_HORARIA_SQL}', 'YYYY-MM-DD') AS fecha_carga,
                    f.id AS factura_id, f.total, f.saldo, f.plan_pago_id,
                    to_char(f.periodo, 'YYYY-MM-DD') AS periodo,
                    a.nombre, a.apellido, a.dni,
                    fc.numero_cuota
             FROM comprobante_transferencia ct
             INNER JOIN factura f ON f.id = ct.factura_id
             INNER JOIN alumnos a ON a.id = f.alumno_id
             LEFT JOIN factura_cuota fc ON fc.comprobante_transferencia_id = ct.id
             WHERE ct.id = $1 AND ${filtroDuenio(2, 3)}`,
            [comprobanteId, req.user.rol, req.user.id]
        );
        const r = rows[0];
        if (!r) return res.status(404).json({ message: 'Comprobante inexistente o sin permisos' });
        if (r.estado_verificacion !== 'Aprobado') {
            return res.status(409).json({ message: 'El recibo solo está disponible para comprobantes aprobados' });
        }

        let plan = null;
        if (r.plan_pago_id) {
            const { rows: planes } = await pool.query(
                'SELECT nombre, cantidad_cuotas FROM plan_pago WHERE id = $1',
                [r.plan_pago_id]
            );
            plan = planes[0] || null;
        }

        const pdf = await generarReciboPDF({
            comprobante: {
                id: r.id,
                monto: r.monto,
                fecha_transferencia: r.fecha_transferencia,
                fecha_carga: r.fecha_carga,
                observaciones: r.observaciones
            },
            factura: { id: r.factura_id, periodo: r.periodo, total: r.total, saldo: r.saldo },
            alumno: { nombre: r.nombre, apellido: r.apellido, dni: r.dni },
            cuota: r.numero_cuota ? { numero_cuota: r.numero_cuota } : null,
            plan
        });
        enviarPdf(res, pdf);
    } catch (err) { manejarErrorPg(res, err); }
};
