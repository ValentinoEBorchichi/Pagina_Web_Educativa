const { sql, getPool } = require('../config/db');

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
        const { recordset } = await pool.request()
            .input('tipoServicio', sql.VarChar(20), tipo_servicio)
            .input('monto', sql.Decimal(12, 2), monto)
            .input('vigencia', sql.Date, vigencia)
            .query(`INSERT INTO dbo.TarifaConcepto (tipo_servicio, monto, vigencia)
                    OUTPUT INSERTED.id, INSERTED.tipo_servicio, INSERTED.monto, INSERTED.vigencia
                    VALUES (@tipoServicio, @monto, @vigencia)`);

        return res.status(201).json(recordset[0]);
    } catch (err) {
        console.error('Error al crear tarifa:', err.message);
        return res.status(500).json({ message: 'Error interno del servidor' });
    }
};
