const cron = require('node-cron');
const { getPool } = require('../config/db');
const { generarFacturaPDF } = require('../services/facturaPdf.service');
const { enviarFactura } = require('../services/email.service');
const { subirArchivo, BUCKET_FACTURAS } = require('../config/supabaseStorage');

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
            const { rows } = await pool.query(
                'SELECT 1 AS existe FROM feriado WHERE fecha = $1 LIMIT 1',
                [fechaCandidata]
            );

            if (!rows.length) {
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

async function consultarConceptosAlumno(client, alumnoId, periodo) {
    const { rows } = await client.query(
        `SELECT tc.id AS tarifa_concepto_id,
                COALESCE(tc.descripcion, tc.tipo_servicio) AS descripcion,
                tc.monto AS importe_unitario
         FROM tarifa_concepto tc
         WHERE tc.tipo_servicio = 'cuota'
           AND tc.vigencia <= $2
           AND (tc.vigencia_hasta IS NULL OR tc.vigencia_hasta >= $2)
           AND tc.activo = TRUE
           AND tc.id = (
               SELECT cuota.id
               FROM tarifa_concepto cuota
               WHERE cuota.tipo_servicio = 'cuota'
                 AND cuota.vigencia <= $2
                 AND (cuota.vigencia_hasta IS NULL OR cuota.vigencia_hasta >= $2)
                 AND cuota.activo = TRUE
               ORDER BY cuota.vigencia DESC, cuota.id DESC
               LIMIT 1
           )

         UNION ALL

         SELECT tc.id,
                COALESCE(tc.descripcion, CONCAT('Deporte: ', d.nombre)),
                tc.monto
         FROM inscripciones_deportes i
         INNER JOIN deportes d ON d.id = i.deporte_id
         INNER JOIN tarifa_concepto tc ON tc.tipo_servicio = 'deporte'
             AND tc.deporte_id = d.id
             AND tc.vigencia <= $2
             AND (tc.vigencia_hasta IS NULL OR tc.vigencia_hasta >= $2)
             AND tc.activo = TRUE
         WHERE i.alumno_id = $1
           AND tc.id = (
               SELECT deporte.id
               FROM tarifa_concepto deporte
               WHERE deporte.tipo_servicio = 'deporte'
                 AND deporte.deporte_id = d.id
                 AND deporte.vigencia <= $2
                 AND (deporte.vigencia_hasta IS NULL OR deporte.vigencia_hasta >= $2)
                 AND deporte.activo = TRUE
               ORDER BY deporte.vigencia DESC, deporte.id DESC
               LIMIT 1
           )

         UNION ALL

         SELECT tc.id,
                COALESCE(tc.descripcion, CONCAT('Transporte: ', t.nombre)),
                tc.monto
         FROM alumnos a
         INNER JOIN transportes t ON t.id = a.transporte_id
         INNER JOIN tarifa_concepto tc ON tc.tipo_servicio = 'transporte'
             AND tc.transporte_id = t.id
             AND tc.vigencia <= $2
             AND (tc.vigencia_hasta IS NULL OR tc.vigencia_hasta >= $2)
             AND tc.activo = TRUE
         WHERE a.id = $1
           AND tc.id = (
               SELECT transporte.id
               FROM tarifa_concepto transporte
               WHERE transporte.tipo_servicio = 'transporte'
                 AND transporte.transporte_id = t.id
                 AND transporte.vigencia <= $2
                 AND (transporte.vigencia_hasta IS NULL OR transporte.vigencia_hasta >= $2)
                 AND transporte.activo = TRUE
               ORDER BY transporte.vigencia DESC, transporte.id DESC
               LIMIT 1
           )

         UNION ALL

         SELECT comedor.id, comedor.descripcion, comedor.monto
         FROM (
             SELECT tc.id,
                    COALESCE(tc.descripcion, 'Comedor') AS descripcion,
                    tc.monto
             FROM alumnos a
             INNER JOIN tarifa_concepto tc ON tc.tipo_servicio = 'comedor'
                 AND tc.vigencia <= $2
                 AND (tc.vigencia_hasta IS NULL OR tc.vigencia_hasta >= $2)
                 AND tc.activo = TRUE
             WHERE a.id = $1
               AND a.usa_comedor = TRUE
             ORDER BY tc.vigencia DESC, tc.id DESC
             LIMIT 1
         ) AS comedor`,
        [alumnoId, periodo]
    );
    return rows;
}

async function generarFacturasDelPeriodo(fecha = new Date()) {
    if (!(await esHoyUltimoDiaHabil(fecha))) {
        return { ejecutado: false, motivo: 'Hoy no es el último día hábil del mes', creadas: 0, duplicadas: 0 };
    }

    const periodo = periodoDelMes(fecha);
    const vencimiento = ultimoDiaDelMes(periodo);
    const pool = await getPool();
    const { rows: alumnos } = await pool.query('SELECT id FROM alumnos ORDER BY id');

    let creadas = 0;
    let duplicadas = 0;

    for (const alumno of alumnos) {
        const client = await pool.connect();
        let iniciada = false;

        try {
            await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
            iniciada = true;

            const conceptos = await consultarConceptosAlumno(client, alumno.id, periodo);
            if (!conceptos.length) {
                await client.query('COMMIT');
                iniciada = false;
                continue;
            }

            const total = conceptos.reduce(
                (suma, concepto) => suma + Number(concepto.importe_unitario),
                0
            );

            const { rows: datosAlumnoRows } = await client.query(
                `SELECT a.id, a.nombre, a.apellido, a.dni, u.email AS padre_email
                 FROM alumnos a
                 INNER JOIN usuarios u ON u.id = a.padre_id
                 WHERE a.id = $1`,
                [alumno.id]
            );

            if (!datosAlumnoRows.length) {
                throw new Error(`No se encontró el alumno ${alumno.id}`);
            }

            const { rows: facturaRows } = await client.query(
                `INSERT INTO factura (alumno_id, periodo, fecha_vencimiento, estado, total, saldo)
                 VALUES ($1, $2, $3, 'Pendiente', $4, $4)
                 RETURNING id`,
                [alumno.id, periodo, vencimiento, total]
            );

            const facturaId = facturaRows[0].id;
            for (const concepto of conceptos) {
                await client.query(
                    `INSERT INTO factura_detalle (factura_id, tarifa_concepto_id, descripcion, cantidad, importe_unitario)
                     VALUES ($1, $2, $3, 1, $4)`,
                    [facturaId, concepto.tarifa_concepto_id, concepto.descripcion, concepto.importe_unitario]
                );
            }

            await client.query('COMMIT');
            iniciada = false;
            creadas += 1;

            const facturaParaPdf = {
                id: facturaId,
                alumno_id: alumno.id,
                periodo,
                fecha_emision: fechaLocal(fecha),
                fecha_vencimiento: vencimiento,
                estado: 'Pendiente',
                total,
                saldo: total
            };
            try {
                const pdf = await generarFacturaPDF(facturaParaPdf, conceptos, datosAlumnoRows[0]);
                await subirArchivo(BUCKET_FACTURAS, pdf.nombreArchivo, pdf.buffer, 'application/pdf');
                const emailPadre = datosAlumnoRows[0].padre_email;
                if (emailPadre && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
                    await enviarFactura(emailPadre, facturaParaPdf, pdf);
                }
            } catch (pdfError) {
                // La factura ya fue confirmada; un fallo de PDF o correo no la duplica.
                console.error(`[facturacion] Error al generar PDF o enviar factura ${facturaId}:`, pdfError.message);
            }
        } catch (error) {
            if (iniciada) await client.query('ROLLBACK').catch(() => undefined);

            if (error.code === '23505') {
                duplicadas += 1;
                continue;
            }

            throw error;
        } finally {
            client.release();
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
