const { getPool } = require('../config/db');
const { manejarErrorPg } = require('../utils/dbErrors');

const TIPOS_VALIDOS = new Set(['cuota', 'deporte', 'transporte', 'comedor']);
const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function fechaValida(fecha) {
    if (!FECHA_REGEX.test(fecha)) return false;
    const fechaUTC = new Date(`${fecha}T00:00:00Z`);
    return !Number.isNaN(fechaUTC.getTime()) && fechaUTC.toISOString().slice(0, 10) === fecha;
}

function normalizarValor(valor) {
    const tipoServicio = String(valor.tipo_servicio || '').trim().toLowerCase();
    const monto = Number(valor.monto);
    const vigencia = String(valor.vigencia || '').trim();
    const deporteId = valor.deporte_id == null || valor.deporte_id === '' ? null : Number(valor.deporte_id);
    const transporteId = valor.transporte_id == null || valor.transporte_id === '' ? null : Number(valor.transporte_id);

    if (!TIPOS_VALIDOS.has(tipoServicio) || !Number.isFinite(monto) || monto <= 0 || !fechaValida(vigencia)) {
        throw new Error('tipo_servicio, monto y vigencia son obligatorios y válidos');
    }
    if (tipoServicio === 'deporte' && (!Number.isInteger(deporteId) || deporteId <= 0)) {
        throw new Error('deporte_id es obligatorio para una tarifa de deporte');
    }
    if (tipoServicio === 'transporte' && (!Number.isInteger(transporteId) || transporteId <= 0)) {
        throw new Error('transporte_id es obligatorio para una tarifa de transporte');
    }
    if (tipoServicio !== 'deporte' && deporteId !== null) {
        throw new Error('deporte_id solo corresponde a tarifas de deporte');
    }
    if (tipoServicio !== 'transporte' && transporteId !== null) {
        throw new Error('transporte_id solo corresponde a tarifas de transporte');
    }

    return {
        tipoServicio,
        monto,
        vigencia,
        deporteId: tipoServicio === 'deporte' ? deporteId : null,
        transporteId: tipoServicio === 'transporte' ? transporteId : null,
        descripcion: valor.descripcion ? String(valor.descripcion).trim() : null
    };
}

async function obtenerValoresVigentes(req, res) {
    try {
        const pool = await getPool();
        const { rows } = await pool.query(`
            WITH tarifas_vigentes AS (
                SELECT tc.id, tc.tipo_servicio, tc.monto, tc.vigencia,
                       tc.descripcion, tc.deporte_id, tc.transporte_id,
                       ROW_NUMBER() OVER (
                           PARTITION BY tc.tipo_servicio,
                                        COALESCE(tc.deporte_id, 0),
                                        COALESCE(tc.transporte_id, 0)
                           ORDER BY tc.vigencia DESC, tc.id DESC
                       ) AS numero
                FROM tarifa_concepto tc
                WHERE tc.vigencia <= CURRENT_DATE
                  AND (tc.vigencia_hasta IS NULL OR tc.vigencia_hasta >= CURRENT_DATE)
                  AND tc.activo = TRUE
            )
            SELECT id, tipo_servicio, monto, vigencia, descripcion, deporte_id, transporte_id
            FROM tarifas_vigentes
            WHERE numero = 1
            ORDER BY tipo_servicio, transporte_id, deporte_id;
        `);

        return res.json({
            cuota: rows.filter((valor) => valor.tipo_servicio === 'cuota'),
            deportes: rows.filter((valor) => valor.tipo_servicio === 'deporte'),
            transporte: rows.filter((valor) => valor.tipo_servicio === 'transporte'),
            comedor: rows.filter((valor) => valor.tipo_servicio === 'comedor')
        });
    } catch (err) {
        return manejarErrorPg(res, err);
    }
}

async function guardarValores(req, res) {
    const valores = Array.isArray(req.body.valores) ? req.body.valores : [req.body];
    if (!valores.length) {
        return res.status(400).json({ message: 'Debe enviar al menos un valor' });
    }

    let normalizados;
    try {
        normalizados = valores.map(normalizarValor);
    } catch (err) {
        return res.status(400).json({ message: err.message });
    }

    const pool = await getPool();
    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        const guardados = [];

        for (const valor of normalizados) {
            // Si ya existe el mismo concepto con la misma vigencia, se actualiza
            // solo esa versión. Las vigencias anteriores no se modifican.
            const actualizado = await client.query(`
                UPDATE tarifa_concepto
                SET monto = $1,
                    descripcion = $2,
                    activo = TRUE
                WHERE tipo_servicio = $3
                  AND vigencia = $4
                  AND ((deporte_id = $5) OR (deporte_id IS NULL AND $5 IS NULL))
                  AND ((transporte_id = $6) OR (transporte_id IS NULL AND $6 IS NULL))
                RETURNING id, tipo_servicio, monto, vigencia, descripcion, deporte_id, transporte_id;
            `, [valor.monto, valor.descripcion, valor.tipoServicio, valor.vigencia, valor.deporteId, valor.transporteId]);

            if (actualizado.rows.length) {
                guardados.push(actualizado.rows[0]);
                continue;
            }

            // Cerramos la vigencia abierta anterior el día previo a la nueva.
            await client.query(`
                UPDATE tarifa_concepto
                SET vigencia_hasta = $1::date - INTERVAL '1 day'
                WHERE tipo_servicio = $2
                  AND vigencia < $1
                  AND vigencia_hasta IS NULL
                  AND activo = TRUE
                  AND ((deporte_id = $3) OR (deporte_id IS NULL AND $3 IS NULL))
                  AND ((transporte_id = $4) OR (transporte_id IS NULL AND $4 IS NULL));
            `, [valor.vigencia, valor.tipoServicio, valor.deporteId, valor.transporteId]);

            const insertado = await client.query(`
                INSERT INTO tarifa_concepto
                    (tipo_servicio, monto, vigencia, descripcion, deporte_id, transporte_id, activo)
                VALUES ($1, $2, $3, $4, $5, $6, TRUE)
                RETURNING id, tipo_servicio, monto, vigencia, descripcion, deporte_id, transporte_id;
            `, [valor.tipoServicio, valor.monto, valor.vigencia, valor.descripcion, valor.deporteId, valor.transporteId]);
            guardados.push(insertado.rows[0]);
        }

        await client.query('COMMIT');
        return res.status(201).json({ valores: guardados });
    } catch (err) {
        await client.query('ROLLBACK').catch(() => undefined);
        return manejarErrorPg(res, err);
    } finally {
        client.release();
    }
}

module.exports = { obtenerValoresVigentes, guardarValores };
