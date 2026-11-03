const cron = require('node-cron');
const { sql, getPool } = require('../config/db');
const { generarFacturaPDF } = require('../services/facturaPdf.service');
const { enviarFactura } = require('../services/email.service');

const CRON_EXPRESION = '0 2 * * *';
const ZONA_HORARIA = process.env.TZ || 'America/Argentina/Buenos_Aires';

function fechaLocal(fecha = new Date()) {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: ZONA_HORARIA,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(fecha);
}

function fechaUTCFormateada(fecha) {
    return fecha.toISOString().slice(0, 10);
}

async function esHoyUltimoDiaHabil(fecha = new Date()) {
    const hoyTexto = fechaLocal(fecha);
    const [anio, mes] = hoyTexto.split('-').map(Number);
    // Date.UTC evita que el horario local altere el día al retroceder.
    const candidato = new Date(Date.UTC(anio, mes, 0));
    const pool = await getPool();
    while (candidato.getUTCFullYear() >= anio - 1) {
        const diaSemana = candidato.getUTCDay();
        const fechaCandidata = fechaUTCFormateada(candidato);

        if (diaSemana !== 0 && diaSemana !== 6) {
            const feriado = await pool.request()
                .input('fecha', sql.Date, fechaCandidata)
                .query(`
                    SELECT TOP 1 1 AS existe
                    FROM dbo.Feriado
                    WHERE fecha = @fecha;
                `);

            if (!feriado.recordset.length) {
                return fechaCandidata === hoyTexto;
            }
        }

        candidato.setUTCDate(candidato.getUTCDate() - 1);
    }

    return false;
}

function periodoDelMes(fecha = new Date()) {
    const [anio, mes] = fechaLocal(fecha).split('-');
    return `${anio}-${mes}-01`;
}

function ultimoDiaDelMes(periodo) {
    const [anio, mes] = periodo.split('-').map(Number);
    return `${anio}-${String(mes).padStart(2, '0')}-${new Date(anio, mes, 0).getDate()}`;
}

async function consultarConceptosAlumno(transaction, alumnoId, periodo) {
    return transaction.request()
        .input('alumnoId', sql.Int, alumnoId)
        .input('periodo', sql.Date, periodo)
        .query(`
            SELECT tc.id AS tarifa_concepto_id,
                   COALESCE(tc.descripcion, tc.tipo_servicio) AS descripcion,
                   tc.monto AS importe_unitario
            FROM dbo.TarifaConcepto tc
            WHERE tc.tipo_servicio = 'cuota'
              AND tc.vigencia <= @periodo
              AND (tc.vigencia_hasta IS NULL OR tc.vigencia_hasta >= @periodo)
              AND tc.activo = 1
              AND tc.id = (
                  SELECT TOP 1 cuota.id
                  FROM dbo.TarifaConcepto cuota
                  WHERE cuota.tipo_servicio = 'cuota'
                    AND cuota.vigencia <= @periodo
                    AND (cuota.vigencia_hasta IS NULL OR cuota.vigencia_hasta >= @periodo)
                    AND cuota.activo = 1
                  ORDER BY cuota.vigencia DESC, cuota.id DESC
              )

            UNION ALL

            SELECT tc.id,
                   COALESCE(tc.descripcion, CONCAT('Deporte: ', d.nombre)),
                   tc.monto
            FROM dbo.Inscripciones_Deportes i
            INNER JOIN dbo.Deportes d ON d.id = i.deporte_id
            INNER JOIN dbo.TarifaConcepto tc ON tc.tipo_servicio = 'deporte'
                AND tc.deporte_id = d.id
                AND tc.vigencia <= @periodo
                AND (tc.vigencia_hasta IS NULL OR tc.vigencia_hasta >= @periodo)
                AND tc.activo = 1
            WHERE i.alumno_id = @alumnoId
              AND tc.id = (
                  SELECT TOP 1 deporte.id
                  FROM dbo.TarifaConcepto deporte
                  WHERE deporte.tipo_servicio = 'deporte'
                    AND deporte.deporte_id = d.id
                    AND deporte.vigencia <= @periodo
                    AND (deporte.vigencia_hasta IS NULL OR deporte.vigencia_hasta >= @periodo)
                    AND deporte.activo = 1
                  ORDER BY deporte.vigencia DESC, deporte.id DESC
              )

            UNION ALL

            SELECT tc.id,
                   COALESCE(tc.descripcion, CONCAT('Transporte: ', t.nombre)),
                   tc.monto
            FROM dbo.Alumnos a
            INNER JOIN dbo.Transportes t ON t.id = a.transporte_id
            INNER JOIN dbo.TarifaConcepto tc ON tc.tipo_servicio = 'transporte'
                AND tc.transporte_id = t.id
                AND tc.vigencia <= @periodo
                AND (tc.vigencia_hasta IS NULL OR tc.vigencia_hasta >= @periodo)
                AND tc.activo = 1
            WHERE a.id = @alumnoId
              AND tc.id = (
                  SELECT TOP 1 transporte.id
                  FROM dbo.TarifaConcepto transporte
                  WHERE transporte.tipo_servicio = 'transporte'
                    AND transporte.transporte_id = t.id
                    AND transporte.vigencia <= @periodo
                    AND (transporte.vigencia_hasta IS NULL OR transporte.vigencia_hasta >= @periodo)
                    AND transporte.activo = 1
                  ORDER BY transporte.vigencia DESC, transporte.id DESC
              )

            UNION ALL

            SELECT comedor.id, comedor.descripcion, comedor.monto
            FROM (
                SELECT TOP (1) tc.id,
                       COALESCE(tc.descripcion, 'Comedor') AS descripcion,
                       tc.monto
                FROM dbo.Alumnos a
                INNER JOIN dbo.TarifaConcepto tc ON tc.tipo_servicio = 'comedor'
                    AND tc.vigencia <= @periodo
                    AND (tc.vigencia_hasta IS NULL OR tc.vigencia_hasta >= @periodo)
                    AND tc.activo = 1
                WHERE a.id = @alumnoId
                  AND a.usa_comedor = 1
                ORDER BY tc.vigencia DESC, tc.id DESC
            ) AS comedor;
        `);
}

async function generarFacturasDelPeriodo(fecha = new Date()) {
    if (!(await esHoyUltimoDiaHabil(fecha))) {
        return { ejecutado: false, motivo: 'Hoy no es el último día hábil del mes', creadas: 0, duplicadas: 0 };
    }

    const periodo = periodoDelMes(fecha);
    const vencimiento = ultimoDiaDelMes(periodo);
    const pool = await getPool();
    const alumnos = await pool.request().query(`
        SELECT id
        FROM dbo.Alumnos
        ORDER BY id;
    `);

    let creadas = 0;
    let duplicadas = 0;

    for (const alumno of alumnos.recordset) {
        const transaction = new sql.Transaction(pool);
        let iniciada = false;

        try {
            await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
            iniciada = true;

            const conceptos = await consultarConceptosAlumno(transaction, alumno.id, periodo);
            if (!conceptos.recordset.length) {
                await transaction.commit();
                iniciada = false;
                continue;
            }

            const total = conceptos.recordset.reduce(
                (suma, concepto) => suma + Number(concepto.importe_unitario),
                0
            );

            const datosAlumno = await transaction.request()
                .input('alumnoId', sql.Int, alumno.id)
                .query(`
                    SELECT a.id, a.nombre, a.apellido, a.dni, u.email AS padre_email
                    FROM dbo.Alumnos a
                    INNER JOIN dbo.Usuarios u ON u.id = a.padre_id
                    WHERE a.id = @alumnoId;
                `);

            if (!datosAlumno.recordset.length) {
                throw new Error(`No se encontró el alumno ${alumno.id}`);
            }

            const factura = await transaction.request()
                .input('alumnoId', sql.Int, alumno.id)
                .input('periodo', sql.Date, periodo)
                .input('vencimiento', sql.Date, vencimiento)
                .input('total', sql.Decimal(12, 2), total)
                .query(`
                    INSERT INTO dbo.Factura
                        (alumno_id, periodo, fecha_vencimiento, estado, total, saldo)
                    OUTPUT INSERTED.id
                    VALUES (@alumnoId, @periodo, @vencimiento, 'Pendiente', @total, @total);
                `);

            const facturaId = factura.recordset[0].id;
            for (const concepto of conceptos.recordset) {
                await transaction.request()
                    .input('facturaId', sql.Int, facturaId)
                    .input('tarifaConceptoId', sql.Int, concepto.tarifa_concepto_id)
                    .input('descripcion', sql.NVarChar(200), concepto.descripcion)
                    .input('importe', sql.Decimal(12, 2), concepto.importe_unitario)
                    .query(`
                        INSERT INTO dbo.FacturaDetalle
                            (factura_id, tarifa_concepto_id, descripcion, cantidad, importe_unitario)
                        VALUES (@facturaId, @tarifaConceptoId, @descripcion, 1, @importe);
                    `);
            }

            await transaction.commit();
            iniciada = false;
            creadas += 1;

            const facturaParaPdf = {
                id: facturaId,
                alumno_id: alumno.id,
                periodo,
                estado: 'Pendiente',
                total
            };
            try {
                const rutaPDF = await generarFacturaPDF(
                    facturaParaPdf,
                    conceptos.recordset,
                    datosAlumno.recordset[0]
                );
                const emailPadre = datosAlumno.recordset[0].padre_email;
                if (emailPadre && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
                    await enviarFactura(emailPadre, facturaParaPdf, rutaPDF);
                }
            } catch (pdfError) {
                // La factura ya fue confirmada; un fallo de PDF o correo no la duplica.
                console.error(`[facturacion] Error al generar PDF o enviar factura ${facturaId}:`, pdfError.message);
            }
        } catch (error) {
            if (iniciada) await transaction.rollback().catch(() => undefined);

            if (error.number === 2601 || error.number === 2627) {
                duplicadas += 1;
                continue;
            }

            throw error;
        }
    }

    return { ejecutado: true, periodo, creadas, duplicadas };
}

function iniciarFacturacionProgramada() {
    return cron.schedule(CRON_EXPRESION, async () => {
        try {
            const resultado = await generarFacturasDelPeriodo();
            console.log('[facturacion] Resultado:', resultado);
        } catch (error) {
            console.error('[facturacion] Error al generar facturas:', error.message);
        }
    }, { timezone: ZONA_HORARIA });
}

module.exports = {
    esHoyUltimoDiaHabil,
    // Alias de compatibilidad para consumidores existentes del job.
    esUltimoDiaHabil: esHoyUltimoDiaHabil,
    periodoDelMes,
    generarFacturasDelPeriodo,
    iniciarFacturacionProgramada
};
