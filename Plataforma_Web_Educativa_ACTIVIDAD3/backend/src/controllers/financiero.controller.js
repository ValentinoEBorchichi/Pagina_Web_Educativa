const db = require('../config/database');
const { sql, getPool } = require('../config/db');
const PDFDocument = require('pdfkit');
const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const { NOMBRE_REGEX } = require('../utils/validators');
const { manejarErrorSQL, manejarErrorMssql } = require('../utils/dbErrors');

// Directorio fijo y controlado por la aplicación. No se toma desde headers,
// formularios ni variables enviadas por el cliente.
const COMPROBANTES_DIR = path.resolve(__dirname, '../../uploads/comprobantes');

const COMPROBANTES_DIR_PREFIX = COMPROBANTES_DIR.endsWith(path.sep)
    ? COMPROBANTES_DIR
    : `${COMPROBANTES_DIR}${path.sep}`;

function respuestaErrorComprobante(res, status, message) {
    return res.status(status).json({ message });
}

// Recibe, calcula SHA-256, evita duplicados y registra el comprobante en SQL Server.
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

    // Nunca se usa directamente el nombre enviado por el cliente como ruta.
    const nombreArchivoSeguro = path.basename(archivo.originalname);
    const hashArchivo = crypto
        .createHash('sha256')
        .update(archivo.buffer)
        .digest('hex');

    let destino;

    try {
        const pool = await getPool();
        const acceso = await pool.request()
            .input('facturaId', sql.Int, facturaId)
            .input('usuarioId', sql.Int, req.user.id)
            .input('rol', sql.VarChar(20), req.user.rol)
            .query(`
                SELECT f.id
                FROM dbo.Factura f
                INNER JOIN dbo.Alumnos a ON a.id = f.alumno_id
                WHERE f.id = @facturaId
                  AND (
                      @rol = 'admin'
                      OR (@rol = 'alumno' AND a.usuario_id = @usuarioId)
                      OR (@rol = 'padre' AND a.padre_id = @usuarioId)
                  )
            `);

        if (!acceso.recordset.length) {
            return respuestaErrorComprobante(res, 404, 'Factura inexistente o sin permisos');
        }

        const duplicado = await pool.request()
            .input('hashArchivo', sql.VarChar(128), hashArchivo)
            .query(`
                SELECT TOP 1 id
                FROM dbo.ComprobanteTransferencia
                WHERE hash_archivo = @hashArchivo
            `);

        if (duplicado.recordset.length) {
            return respuestaErrorComprobante(res, 409, 'El archivo ya fue cargado anteriormente');
        }

        // El nombre físico no contiene ningún dato del usuario ni su extensión.
        // El tipo real se conserva en tipo_mime y el nombre original en la BD.
        const nombreGuardado = crypto.randomUUID();
        const baseNormalizada = path.normalize(COMPROBANTES_DIR);
        destino = path.normalize(path.join(baseNormalizada, nombreGuardado));

        // Defensa explícita contra path traversal y requisito de análisis estático.
        if (!destino.startsWith(COMPROBANTES_DIR_PREFIX)) {
            return respuestaErrorComprobante(res, 400, 'Ruta de archivo no permitida');
        }

        await fs.writeFile(destino, archivo.buffer, { flag: 'wx' });

        const insertado = await pool.request()
            .input('facturaId', sql.Int, facturaId)
            .input('nombreArchivo', sql.NVarChar(255), nombreArchivoSeguro)
            .input('rutaArchivo', sql.NVarChar(500), destino)
            .input('tipoMime', sql.VarChar(100), archivo.mimetype)
            .input('tamanoBytes', sql.BigInt, archivo.size)
            .input('monto', sql.Decimal(12, 2), monto)
            .input('fechaTransferencia', sql.Date, fechaTransferencia)
            .input('hashArchivo', sql.VarChar(128), hashArchivo)
            .query(`
                INSERT INTO dbo.ComprobanteTransferencia
                    (factura_id, nombre_archivo, ruta_archivo, tipo_mime,
                     tamano_bytes, monto, fecha_transferencia, hash_archivo,
                     estado_verificacion)
                OUTPUT INSERTED.id, INSERTED.factura_id, INSERTED.nombre_archivo,
                       INSERTED.monto, INSERTED.fecha_transferencia,
                       INSERTED.hash_archivo, INSERTED.estado_verificacion
                VALUES
                    (@facturaId, @nombreArchivo, @rutaArchivo, @tipoMime,
                     @tamanoBytes, @monto, @fechaTransferencia, @hashArchivo,
                     'Pendiente')
            `);

        return res.status(201).json({
            message: 'Comprobante cargado correctamente',
            comprobante: insertado.recordset[0]
        });
    } catch (err) {
        if (destino) await fs.unlink(destino).catch(() => undefined);

        if (err.number === 2627 || err.number === 2601) {
            return respuestaErrorComprobante(res, 409, 'El archivo ya fue cargado anteriormente');
        }

        return manejarErrorMssql(res, err);
    }
};

// --- PERSONAL ---
exports.getPersonal = (req, res) => {
    db.all("SELECT * FROM personal", [], (err, rows) => {
        if (err) return manejarErrorSQL(res, err);
        res.json(rows);
    });
};

exports.createPersonal = (req, res) => {
    const { nombre, apellido, dni, tipo, email } = req.body;
    if (!nombre || !apellido || !dni || !tipo) return res.status(400).json({ message: "Campos obligatorios" });
    if (!NOMBRE_REGEX.test(String(nombre).trim()) || !NOMBRE_REGEX.test(String(apellido).trim())) {
        return res.status(400).json({ message: "Nombre y apellido solo pueden contener letras (sin números ni símbolos)" });
    }
    if (!/^\d+$/.test(String(dni).trim())) return res.status(400).json({ message: "El DNI debe ser numérico (sin puntos ni letras)" });
    db.run("INSERT INTO personal (nombre, apellido, dni, tipo, email) VALUES (?, ?, ?, ?, ?)", [nombre, apellido, dni, tipo, email], function(err) {
        if (err) return manejarErrorSQL(res, err);
        res.status(201).json({ id: this.lastID });
    });
};

// Modificación de legajo de personal docente / no docente (mismo ABM que alumnos).
exports.updatePersonal = (req, res) => {
    const { id } = req.params;
    const { nombre, apellido, dni, tipo, email } = req.body;
    if (!nombre || !apellido || !dni || !tipo) return res.status(400).json({ message: "Campos obligatorios" });
    if (!NOMBRE_REGEX.test(String(nombre).trim()) || !NOMBRE_REGEX.test(String(apellido).trim())) {
        return res.status(400).json({ message: "Nombre y apellido solo pueden contener letras (sin números ni símbolos)" });
    }
    if (!/^\d+$/.test(String(dni).trim())) return res.status(400).json({ message: "El DNI debe ser numérico (sin puntos ni letras)" });
    db.run(
        "UPDATE personal SET nombre = ?, apellido = ?, dni = ?, tipo = ?, email = ? WHERE id = ?",
        [nombre, apellido, dni, tipo, email, id],
        function(err) {
            if (err) return manejarErrorSQL(res, err);
            if (this.changes === 0) return res.status(404).json({ message: "Personal no encontrado" });
            res.json({ message: "Legajo de personal actualizado correctamente" });
        }
    );
};

exports.deletePersonal = (req, res) => {
    const { id } = req.params;
    db.run("DELETE FROM personal WHERE id = ?", [id], function(err) {
        if (err) return manejarErrorSQL(res, err);
        res.json({ message: "Personal eliminado" });
    });
};

// --- CUOTAS CONFIG ---
exports.getCuotasConfig = (req, res) => {
    const query = `
        SELECT cc.*, n.nombre as nivel_nombre 
        FROM cuotas_config cc
        JOIN niveles n ON cc.nivel_id = n.id
    `;
    db.all(query, [], (err, rows) => {
        if (err) return manejarErrorSQL(res, err);
        res.json(rows);
    });
};

exports.createCuotaConfig = (req, res) => {
    const { nivel_id, monto, mes, anio, vencimiento } = req.body;
    const montoNum = parseFloat(monto);
    if (isNaN(montoNum) || montoNum <= 0) return res.status(400).json({ message: "El monto debe ser un decimal mayor a 0" });
    
    db.run("INSERT INTO cuotas_config (nivel_id, monto, mes, anio, vencimiento) VALUES (?, ?, ?, ?, ?)", [nivel_id, montoNum, mes, anio, vencimiento], function(err) {
        if (err) return manejarErrorSQL(res, err);
        res.status(201).json({ id: this.lastID });
    });
};

exports.deleteCuotaConfig = (req, res) => {
    const { id } = req.params;
    db.run("DELETE FROM cuotas_config WHERE id = ?", [id], function(err) {
        if (err) return manejarErrorSQL(res, err);
        res.json({ message: "Configuración de cuota eliminada" });
    });
};

// --- PAGOS & DEUDA ---
exports.registrarPago = (req, res) => {
    const { alumno_id, cuota_id, monto_pagado, metodo_pago } = req.body;
    if (!alumno_id || monto_pagado === undefined || monto_pagado === null || monto_pagado === '') {
        return res.status(400).json({ message: "Datos incompletos" });
    }
    const montoNum = parseFloat(monto_pagado);
    if (isNaN(montoNum) || montoNum <= 0) {
        return res.status(400).json({ message: "El monto pagado debe ser un número mayor a 0" });
    }

    db.serialize(() => {
        db.run("BEGIN TRANSACTION");

        const queryPago = "INSERT INTO pagos (alumno_id, cuota_id, monto_pagado, metodo_pago) VALUES (?, ?, ?, ?)";
        db.run(queryPago, [alumno_id, cuota_id, montoNum, metodo_pago], function(err) {
            if (err) {
                db.run("ROLLBACK");
                return res.status(500).json({ message: "Error al registrar el pago" });
            }
            const pagoId = this.lastID;

            // Actualizar deuda
            const queryDeuda = `
                INSERT INTO saldos_alumnos (alumno_id, saldo_pendiente) 
                VALUES (?, -?) 
                ON CONFLICT(alumno_id) DO UPDATE SET 
                saldo_pendiente = saldo_pendiente - ?, 
                ultima_actualizacion = CURRENT_TIMESTAMP
            `;
            db.run(queryDeuda, [alumno_id, montoNum, montoNum], function(err) {
                if (err) {
                    db.run("ROLLBACK");
                    return res.status(500).json({ message: "Error al actualizar la deuda" });
                }
                db.run("COMMIT");
                // Se devuelve el id del pago para poder descargar el comprobante PDF.
                res.status(201).json({ message: "Pago registrado y saldo actualizado", pago_id: pagoId });
            });
        });
    });
};

// Genera y envía el comprobante de pago en PDF (detallado).
// Admin puede descargar cualquiera; un padre solo los de sus hijos vinculados.
exports.generarComprobante = (req, res) => {
    const { pago_id } = req.params;
    const query = `
        SELECT p.id, p.monto_pagado, p.fecha_pago, p.metodo_pago,
               a.nombre AS alumno_nombre, a.apellido AS alumno_apellido, a.dni AS alumno_dni,
               a.tutor_id,
               niveles.nombre AS nivel_nombre, cursos.division AS division,
               cc.mes AS cuota_mes, cc.anio AS cuota_anio,
               COALESCE(s.saldo_pendiente, 0) AS saldo_pendiente
        FROM pagos p
        LEFT JOIN alumnos a ON p.alumno_id = a.id
        LEFT JOIN cursos ON a.curso_id = cursos.id
        LEFT JOIN niveles ON cursos.nivel_id = niveles.id
        LEFT JOIN cuotas_config cc ON p.cuota_id = cc.id
        LEFT JOIN saldos_alumnos s ON s.alumno_id = a.id
        WHERE p.id = ?
    `;
    db.get(query, [pago_id], (err, pago) => {
        if (err) return manejarErrorSQL(res, err);
        if (!pago) return res.status(404).json({ message: "Pago no encontrado" });

        // Control de acceso para padres: solo comprobantes de sus hijos.
        if (req.user.rol === 'padre' && pago.tutor_id !== req.user.id) {
            return res.status(403).json({ message: "No tiene acceso a este comprobante" });
        }

        const doc = new PDFDocument({ size: 'A4', margin: 50 });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="comprobante_pago_${pago.id}.pdf"`);
        doc.pipe(res);

        const azul = '#1e40af';
        const verde = '#166534';
        const gris = '#64748b';
        const formato = (n) => '$' + Number(n || 0).toFixed(2);
        const fecha = pago.fecha_pago ? new Date(pago.fecha_pago).toLocaleString('es-AR') : '-';

        // Encabezado institucional
        doc.fillColor(azul).fontSize(22).font('Helvetica-Bold').text('Educar para Transformar', { align: 'center' });
        doc.fillColor(gris).fontSize(10).font('Helvetica').text('C. French 414, Resistencia, Chaco · info@educartransformar.edu.ar', { align: 'center' });
        doc.moveDown(0.5);
        doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#e2e8f0').stroke();
        doc.moveDown(1);

        // Título
        doc.fillColor(azul).fontSize(16).font('Helvetica-Bold').text('COMPROBANTE DE PAGO', { align: 'center' });
        doc.fillColor(gris).fontSize(11).font('Helvetica').text(`Comprobante N° ${String(pago.id).padStart(6, '0')}`, { align: 'center' });
        doc.moveDown(1.5);

        // Detalle en filas
        const fila = (label, valor) => {
            doc.fillColor(gris).fontSize(11).font('Helvetica-Bold').text(label, 60, doc.y, { continued: true, width: 200 });
            doc.fillColor('#0f172a').font('Helvetica').text('  ' + valor);
            doc.moveDown(0.4);
        };

        fila('Fecha de pago:', fecha);
        fila('Alumno:', `${pago.alumno_apellido || ''}, ${pago.alumno_nombre || ''}`);
        fila('DNI:', pago.alumno_dni || '-');
        fila('Nivel / División:', pago.nivel_nombre ? `${pago.nivel_nombre} ${pago.division || ''}` : 'Sin asignar');
        if (pago.cuota_mes) fila('Cuota:', `${pago.cuota_mes}/${pago.cuota_anio}`);
        fila('Método de pago:', pago.metodo_pago || '-');

        doc.moveDown(0.6);
        doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#e2e8f0').stroke();
        doc.moveDown(0.8);

        // Monto destacado
        doc.fillColor(verde).fontSize(14).font('Helvetica-Bold').text(`Monto abonado: ${formato(pago.monto_pagado)}`, { align: 'right' });
        doc.moveDown(0.3);
        const saldo = Number(pago.saldo_pendiente || 0);
        doc.fillColor(saldo > 0 ? '#991b1b' : verde).fontSize(11).font('Helvetica')
            .text(saldo > 0 ? `Saldo pendiente actual: ${formato(saldo)}` : 'Cuenta al día ✓', { align: 'right' });

        doc.moveDown(3);
        doc.fillColor(gris).fontSize(9).font('Helvetica').text(
            'Este comprobante es válido como constancia de pago. Generado automáticamente por el sistema institucional.',
            { align: 'center' }
        );

        doc.end();
    });
};

exports.getSaldoAlumno = async (req, res) => {
    const alumno_id = parseInt(req.params.alumno_id);
    if (!alumno_id) return res.status(400).json({ message: "Alumno inválido" });

    try {
        const pool = await getPool();
        const { recordset } = await pool.request()
            .input('alumno', sql.Int, alumno_id)
            .query('SELECT alumno_id, saldo_pendiente, ultima_actualizacion FROM dbo.Saldos WHERE alumno_id = @alumno');
        res.json(recordset[0] || { alumno_id, saldo_pendiente: 0 });
    } catch (err) {
        manejarErrorMssql(res, err);
    }
};

// Lista de pagos registrados. Admin ve todos; un padre solo los de sus hijos.
exports.getPagos = (req, res) => {
    let query = `
        SELECT p.id, p.monto_pagado, p.fecha_pago, p.metodo_pago,
               a.nombre AS alumno_nombre, a.apellido AS alumno_apellido, a.dni AS alumno_dni
        FROM pagos p
        LEFT JOIN alumnos a ON p.alumno_id = a.id
    `;
    const params = [];
    if (req.user.rol === 'padre') {
        query += ` WHERE a.tutor_id = ?`;
        params.push(req.user.id);
    }
    query += ` ORDER BY p.fecha_pago DESC`;
    db.all(query, params, (err, rows) => {
        if (err) return manejarErrorSQL(res, err);
        res.json(rows);
    });
};

exports.getDeudores = (req, res) => {
    const query = `
        SELECT a.id, a.nombre, a.apellido, a.dni,
               COALESCE(s.saldo_pendiente, 0) as saldo_pendiente
        FROM alumnos a
        LEFT JOIN saldos_alumnos s ON s.alumno_id = a.id
        WHERE COALESCE(s.saldo_pendiente, 0) > 0
        ORDER BY s.saldo_pendiente DESC
    `;
    db.all(query, [], (err, rows) => {
        if (err) return manejarErrorSQL(res, err);
        res.json(rows);
    });
};
