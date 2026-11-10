const { getPool } = require('../config/db');

exports.crearTarifa = async (req, res) => {
    const tipo_servicio = String(req.body.tipo_servicio || '').trim().toLowerCase();
    const monto = Number(req.body.monto);
    const vigencia = req.body.vigencia;
    const tiposValidos = ['cuota', 'deporte', 'transporte', 'comedor'];

    if (!tiposValidos.includes(tipo_servicio) || !Number.isFinite(monto) || monto <= 0 || !vigencia) {
        return res.status(400).json({ message: 'tipo_servicio, monto y vigencia son obligatorios y válidos' });
    }

    try {
        const pool = await getPool();
        const { rows } = await pool.query(
            `INSERT INTO tarifa_concepto (tipo_servicio, monto, vigencia)
             VALUES ($1, $2, $3) RETURNING id, tipo_servicio, monto, vigencia`,
            [tipo_servicio, monto, vigencia]
        );

        return res.status(201).json(rows[0]);
    } catch (err) {
        console.error('Error al crear tarifa:', err.message);
        return res.status(500).json({ message: 'Error interno del servidor' });
    }
};
