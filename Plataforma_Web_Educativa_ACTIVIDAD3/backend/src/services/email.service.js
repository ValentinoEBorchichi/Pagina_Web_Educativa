const nodemailer = require('nodemailer');
const path = require('path');

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

async function enviarFactura(emailDestino, factura, rutaPDF) {
    validarDestino(emailDestino);
    if (!rutaPDF) throw new Error('La factura no tiene una ruta PDF válida');

    return obtenerTransporter().sendMail({
        from: `Educar para Transformar <${process.env.EMAIL_USER}>`,
        to: emailDestino,
        subject: `Factura ${factura.id} - Educar para Transformar`,
        text: `Se adjunta la factura correspondiente al período ${factura.periodo}. Total: $${factura.total}.`,
        html: `<p>Estimado/a responsable,</p>
               <p>Se adjunta la factura correspondiente al período <strong>${factura.periodo}</strong>.</p>
               <p>Total a pagar: <strong>$${factura.total}</strong></p>
               <p>Saludos cordiales.<br>Educar para Transformar</p>`,
        attachments: [{
            filename: path.basename(rutaPDF),
            path: rutaPDF
        }]
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

module.exports = { enviarFactura, enviarRecordatorioDeuda };
