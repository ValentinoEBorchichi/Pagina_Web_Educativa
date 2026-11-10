const cron = require('node-cron');
const { getPool } = require('../config/db');
const { enviarRecordatorioDeuda } = require('../services/email.service');

const CRON_EXPRESION = '0 9 20 * *';
const ZONA_HORARIA = process.env.TZ || 'America/Argentina/Buenos_Aires';

function periodoActual() {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: ZONA_HORARIA,
        year: 'numeric',
        month: '2-digit'
    }).format(new Date()) + '-01';
}

async function obtenerDeudas() {
    const pool = await getPool();
    const { rows } = await pool.query(
        `SELECT u.email,
                CONCAT(u.nombre, ' ', u.apellido) AS nombre_padre,
                f.id AS factura_id,
                CONCAT(a.apellido, ', ', a.nombre) AS alumno,
                f.periodo,
                f.estado,
                CASE WHEN f.saldo > 0 THEN f.saldo ELSE f.total END AS saldo
         FROM factura f
         INNER JOIN alumnos a ON a.id = f.alumno_id
         INNER JOIN usuarios u ON u.id = a.padre_id
         WHERE f.estado IN ('Pendiente', 'Vencida')
           AND f.periodo < $1
           AND u.email IS NOT NULL
         ORDER BY u.email, f.periodo`,
        [periodoActual()]
    );
    return rows;
}

async function enviarRecordatorios() {
    const deudas = await obtenerDeudas();
    const agrupadas = new Map();

    for (const deuda of deudas) {
        if (!agrupadas.has(deuda.email)) {
            agrupadas.set(deuda.email, { nombrePadre: deuda.nombre_padre, deudas: [] });
        }
        agrupadas.get(deuda.email).deudas.push(deuda);
    }

    let enviados = 0;
    for (const [email, datos] of agrupadas) {
        await enviarRecordatorioDeuda(email, datos.nombrePadre, datos.deudas);
        enviados += 1;
    }

    return { deudores: agrupadas.size, enviados };
}

function iniciarRecordatoriosProgramados() {
    return cron.schedule(CRON_EXPRESION, async () => {
        try {
            const resultado = await enviarRecordatorios();
            console.log('[recordatorios] Resultado:', resultado);
        } catch (error) {
            console.error('[recordatorios] Error al enviar recordatorios:', error.message);
        }
    }, { timezone: ZONA_HORARIA });
}

module.exports = { obtenerDeudas, enviarRecordatorios, iniciarRecordatoriosProgramados };
