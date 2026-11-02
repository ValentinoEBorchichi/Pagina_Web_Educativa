const PDFDocument = require('pdfkit');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');

const FACTURAS_DIR = path.resolve(__dirname, '../../uploads/facturas');
const FACTURAS_PREFIX = `${FACTURAS_DIR}${path.sep}`;

function validarFacturaId(valor) {
    const id = Number(valor);
    if (!Number.isSafeInteger(id) || id <= 0) {
        throw new Error('El ID de factura no es válido');
    }
    return id;
}

function moneda(valor) {
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS'
    }).format(Number(valor || 0));
}

function generarFacturaPDF(factura, detalles, alumno) {
    const facturaId = validarFacturaId(factura.id);
    const nombreArchivo = `factura_${facturaId}.pdf`;
    const destino = path.normalize(path.resolve(FACTURAS_DIR, nombreArchivo));
    const rutaRelativa = path.relative(FACTURAS_DIR, destino);

    if (!destino.startsWith(FACTURAS_PREFIX)
        || rutaRelativa.startsWith('..')
        || path.isAbsolute(rutaRelativa)) {
        return Promise.reject(new Error('Ruta de factura no permitida'));
    }

    return fsp.mkdir(FACTURAS_DIR, { recursive: true }).then(() => new Promise((resolve, reject) => {
        const documento = new PDFDocument({ size: 'A4', margin: 50 });
        const salida = fs.createWriteStream(destino, { flags: 'wx' });
        let finalizado = false;

        const rechazar = (error) => {
            if (finalizado) return;
            finalizado = true;
            reject(error);
        };

        salida.once('error', rechazar);
        documento.once('error', rechazar);
        salida.once('finish', () => {
            if (finalizado) return;
            finalizado = true;
            resolve(destino);
        });

        try {
            documento.pipe(salida);

            documento.fillColor('#1e3a8a').fontSize(22).font('Helvetica-Bold')
                .text('Educar para Transformar', { align: 'center' });
            documento.fillColor('#475569').fontSize(10).font('Helvetica')
                .text('Sistema de gestión educativa', { align: 'center' });
            documento.moveDown(1);
            documento.moveTo(50, documento.y).lineTo(545, documento.y)
                .strokeColor('#cbd5e1').stroke();
            documento.moveDown(1);

            documento.fillColor('#0f172a').fontSize(17).font('Helvetica-Bold')
                .text('FACTURA', { align: 'center' });
            documento.moveDown(1);

            const fila = (etiqueta, valor) => {
                documento.fillColor('#334155').fontSize(10).font('Helvetica-Bold')
                    .text(`${etiqueta}: `, 60, documento.y, { continued: true });
                documento.fillColor('#0f172a').font('Helvetica').text(String(valor || '-'));
                documento.moveDown(0.35);
            };

            fila('N° de factura', facturaId);
            fila('Período', factura.periodo);
            fila('Estado', factura.estado || 'Pendiente');
            fila('Alumno', `${alumno.apellido || ''}, ${alumno.nombre || ''}`.trim());
            fila('DNI', alumno.dni);
            documento.moveDown(0.8);

            const encabezadoY = documento.y;
            documento.rect(50, encabezadoY, 495, 24).fill('#dbeafe');
            documento.fillColor('#1e3a8a').fontSize(10).font('Helvetica-Bold')
                .text('Concepto', 60, encabezadoY + 7);
            documento.text('Importe', 440, encabezadoY + 7, { width: 95, align: 'right' });
            documento.y = encabezadoY + 30;

            detalles.forEach((detalle, indice) => {
                const y = documento.y;
                if (indice % 2 === 1) documento.rect(50, y - 4, 495, 24).fill('#f8fafc');
                documento.fillColor('#0f172a').fontSize(10).font('Helvetica')
                    .text(detalle.descripcion, 60, y, { width: 350 });
                documento.text(moneda(detalle.importe_unitario), 440, y, { width: 95, align: 'right' });
                documento.y = y + 24;
            });

            documento.moveDown(0.8);
            documento.moveTo(330, documento.y).lineTo(545, documento.y)
                .strokeColor('#94a3b8').stroke();
            documento.moveDown(0.5);
            documento.fillColor('#0f172a').fontSize(13).font('Helvetica-Bold')
                .text(`TOTAL: ${moneda(factura.total)}`, 330, documento.y, { width: 215, align: 'right' });
            documento.moveDown(2);
            documento.fillColor('#64748b').fontSize(9).font('Helvetica')
                .text('Documento generado automáticamente por el sistema institucional.', { align: 'center' });

            documento.end();
        } catch (error) {
            salida.destroy();
            rechazar(error);
        }
    }));
}

module.exports = { generarFacturaPDF };
