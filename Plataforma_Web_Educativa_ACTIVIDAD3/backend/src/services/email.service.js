const nodemailer = require('nodemailer');

let transporter;

function obtenerTransporter() {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        throw new Error('Faltan EMAIL_USER y EMAIL_PASS para enviar correos');
    }

    if (!transporter) {
        transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });
    }

    return transporter;
}

function validarDestino(emailDestino) {
    if (!emailDestino || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailDestino)) {
        throw new Error('El correo de destino no es válido');
    }
}

// Un solo correo por padre con el total a abonar y la composición por hijo
// (RFM-12/consigna: "un recordatorio del total que cada padre debe abonar"),
// con la factura de cada hijo adjunta. `items` es [{ alumno, factura, pdf }].
async function enviarFacturasConsolidadas(emailDestino, nombrePadre, items) {
    validarDestino(emailDestino);
    if (!items || !items.length) throw new Error('No hay facturas para enviar');

    const total = items.reduce((suma, item) => suma + Number(item.factura.total), 0);
    const secciones = items.map((item) =>
        `<li><strong>${item.alumno.nombre} ${item.alumno.apellido}</strong>: ` +
        `Factura ${item.factura.id} - $${Number(item.factura.total).toFixed(2)}</li>`
    ).join('');
    const unaSolaFactura = items.length === 1;

    return obtenerTransporter().sendMail({
        from: `Educar para Transformar <${process.env.EMAIL_USER}>`,
        to: emailDestino,
        subject: unaSolaFactura
            ? `Factura ${items[0].factura.id} - Educar para Transformar`
            : `Recordatorio de facturación (${items.length} hijos) - Educar para Transformar`,
        text: `Se adjuntan ${unaSolaFactura ? 'la factura' : 'las facturas'} correspondientes al período ${items[0].factura.periodo}. Total a abonar: $${total.toFixed(2)}.`,
        html: `<p>Estimado/a ${nombrePadre || 'responsable'},</p>
               <p>Se ${unaSolaFactura ? 'adjunta la factura' : 'adjuntan las facturas'} correspondiente${unaSolaFactura ? '' : 's'} al período <strong>${items[0].factura.periodo}</strong>:</p>
               <ul>${secciones}</ul>
               <p>Total a abonar: <strong>$${total.toFixed(2)}</strong></p>
               <p>Saludos cordiales.<br>Educar para Transformar</p>`,
        attachments: items.map((item) => ({ filename: item.pdf.nombreArchivo, content: item.pdf.buffer }))
    });
}

async function enviarRecordatorioDeuda(emailDestino, nombrePadre, deudas) {
    validarDestino(emailDestino);
    const total = deudas.reduce((suma, deuda) => suma + Number(deuda.saldo), 0);
    const filas = deudas.map((deuda) =>
        `<li>Factura ${deuda.factura_id} - ${deuda.alumno}: ${deuda.periodo} - ` +
        `${deuda.estado} - $${Number(deuda.saldo).toFixed(2)}</li>`
    ).join('');

    return obtenerTransporter().sendMail({
        from: `Educar para Transformar <${process.env.EMAIL_USER}>`,
        to: emailDestino,
        subject: 'Recordatorio de deuda - Educar para Transformar',
        text: `Estimado/a ${nombrePadre || 'responsable'}, registra una deuda pendiente por $${total.toFixed(2)}.`,
        html: `<p>Estimado/a ${nombrePadre || 'responsable'},</p>
               <p>Le recordamos que registra las siguientes facturas pendientes:</p>
               <ul>${filas}</ul>
               <p><strong>Total pendiente: $${total.toFixed(2)}</strong></p>
               <p>Por favor, regularice la situación o comuníquese con la institución.</p>
               <p>Saludos cordiales.<br>Educar para Transformar</p>`
    });
}

async function enviarRecuperacionPassword(emailDestino, nombre, token) {
    validarDestino(emailDestino);
    return obtenerTransporter().sendMail({
        from: `Educar para Transformar <${process.env.EMAIL_USER}>`,
        to: emailDestino,
        subject: 'Recuperación de contraseña - Educar para Transformar',
        text: `Hola ${nombre || ''}. Tu código para cambiar la contraseña es ${token}. Vence en 15 minutos. Si no solicitaste este cambio, ignorá este correo.`,
        html: `<p>Hola ${nombre || ''},</p><p>Ingresá este código en la aplicación para cambiar tu contraseña:</p><p style="font-size:22px;font-weight:bold;letter-spacing:2px">${token}</p><p>El código vence en 15 minutos. Si no solicitaste el cambio, ignorá este correo.</p>`
    });
}

module.exports = { enviarFacturasConsolidadas, enviarRecordatorioDeuda, enviarRecuperacionPassword };
