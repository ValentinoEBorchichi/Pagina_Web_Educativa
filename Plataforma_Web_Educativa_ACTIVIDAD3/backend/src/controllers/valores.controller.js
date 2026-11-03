const { sql, getPool } = require('../config/db');
const { manejarErrorMssql } = require('../utils/dbErrors');

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
        const { recordset } = await pool.request().query(`
            WITH tarifas_vigentes AS (
                SELECT tc.id, tc.tipo_servicio, tc.monto, tc.vigencia,
                       tc.descripcion, tc.deporte_id, tc.transporte_id,
                       ROW_NUMBER() OVER (
                           PARTITION BY tc.tipo_servicio,
                                        ISNULL(tc.deporte_id, 0),
                                        ISNULL(tc.transporte_id, 0)
                           ORDER BY tc.vigencia DESC, tc.id DESC
                       ) AS numero
                FROM dbo.TarifaConcepto tc
                WHERE tc.vigencia <= CAST(GETDATE() AS DATE)
                  AND (tc.vigencia_hasta IS NULL OR tc.vigencia_hasta >= CAST(GETDATE() AS DATE))
                  AND tc.activo = 1
            )
            SELECT id, tipo_servicio, monto, vigencia, descripcion, deporte_id, transporte_id
            FROM tarifas_vigentes
            WHERE numero = 1
            ORDER BY tipo_servicio, transporte_id, deporte_id;
        `);

        return res.json({
            cuota: recordset.filter((valor) => valor.tipo_servicio === 'cuota'),
            deportes: recordset.filter((valor) => valor.tipo_servicio === 'deporte'),
            transporte: recordset.filter((valor) => valor.tipo_servicio === 'transporte'),
            comedor: recordset.filter((valor) => valor.tipo_servicio === 'comedor')
        });
    } catch (err) {
        return manejarErrorMssql(res, err);
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
    const transaction = new sql.Transaction(pool);

    try {
        await transaction.begin();
        const guardados = [];

        for (const valor of normalizados) {
            const request = new sql.Request(transaction)
                .input('tipoServicio', sql.VarChar(20), valor.tipoServicio)
                .input('monto', sql.Decimal(12, 2), valor.monto)
                .input('vigencia', sql.Date, valor.vigencia)
                .input('descripcion', sql.NVarChar(150), valor.descripcion)
                .input('deporteId', sql.Int, valor.deporteId)
                .input('transporteId', sql.Int, valor.transporteId);

            // Si ya existe el mismo concepto con la misma vigencia, se actualiza
            // solo esa versión. Las vigencias anteriores no se modifican.
            const actualizado = await request.query(`
                UPDATE dbo.TarifaConcepto
                SET monto = @monto,
                    descripcion = @descripcion,
                    activo = 1
                OUTPUT INSERTED.id, INSERTED.tipo_servicio, INSERTED.monto,
                       INSERTED.vigencia, INSERTED.descripcion,
                       INSERTED.deporte_id, INSERTED.transporte_id
                WHERE tipo_servicio = @tipoServicio
                  AND vigencia = @vigencia
                  AND ((deporte_id = @deporteId) OR (deporte_id IS NULL AND @deporteId IS NULL))
                  AND ((transporte_id = @transporteId) OR (transporte_id IS NULL AND @transporteId IS NULL));
            `);

            if (actualizado.recordset.length) {
                guardados.push(actualizado.recordset[0]);
                continue;
            }

            // Cerramos la vigencia abierta anterior el día previo a la nueva.
            await new sql.Request(transaction)
                .input('tipoServicio', sql.VarChar(20), valor.tipoServicio)
                .input('vigencia', sql.Date, valor.vigencia)
                .input('deporteId', sql.Int, valor.deporteId)
                .input('transporteId', sql.Int, valor.transporteId)
                .query(`
                    UPDATE dbo.TarifaConcepto
                    SET vigencia_hasta = DATEADD(day, -1, @vigencia)
                    WHERE tipo_servicio = @tipoServicio
                      AND vigencia < @vigencia
                      AND vigencia_hasta IS NULL
                      AND activo = 1
                      AND ((deporte_id = @deporteId) OR (deporte_id IS NULL AND @deporteId IS NULL))
                      AND ((transporte_id = @transporteId) OR (transporte_id IS NULL AND @transporteId IS NULL));
                `);

            const insertado = await new sql.Request(transaction)
                .input('tipoServicio', sql.VarChar(20), valor.tipoServicio)
                .input('monto', sql.Decimal(12, 2), valor.monto)
                .input('vigencia', sql.Date, valor.vigencia)
                .input('descripcion', sql.NVarChar(150), valor.descripcion)
                .input('deporteId', sql.Int, valor.deporteId)
                .input('transporteId', sql.Int, valor.transporteId)
                .query(`
                    INSERT INTO dbo.TarifaConcepto
                        (tipo_servicio, monto, vigencia, descripcion, deporte_id, transporte_id, activo)
                    OUTPUT INSERTED.id, INSERTED.tipo_servicio, INSERTED.monto,
                           INSERTED.vigencia, INSERTED.descripcion,
                           INSERTED.deporte_id, INSERTED.transporte_id
                    VALUES (@tipoServicio, @monto, @vigencia, @descripcion,
                            @deporteId, @transporteId, 1);
                `);
            guardados.push(insertado.recordset[0]);
        }

        await transaction.commit();
        return res.status(201).json({ valores: guardados });
    } catch (err) {
        await transaction.rollback().catch(() => undefined);
        return manejarErrorMssql(res, err);
    }
}

module.exports = { obtenerValoresVigentes, guardarValores };
