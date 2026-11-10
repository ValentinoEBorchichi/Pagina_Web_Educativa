const PDFDocument = require('pdfkit');

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

// Genera el PDF en memoria (reemplaza el guardado en backend/uploads/facturas,
// efímero en Render): devuelve el buffer y el nombre de archivo sugerido.
// El llamador decide qué hacer con el buffer (adjuntarlo a un mail, subirlo a
// Supabase Storage, o ambos).
function generarFacturaPDF(factura, detalles, alumno) {
    const facturaId = validarFacturaId(factura.id);
    const nombreArchivo = `factura_${facturaId}.pdf`;

    return new Promise((resolve, reject) => {
        const documento = new PDFDocument({ size: 'A4', margin: 50 });
        const trozos = [];
        let finalizado = false;

        const rechazar = (error) => {
            if (finalizado) return;
            finalizado = true;
            reject(error);
        };

        documento.once('error', rechazar);
        documento.on('data', (trozo) => trozos.push(trozo));
        documento.once('end', () => {
            if (finalizado) return;
            finalizado = true;
            resolve({ buffer: Buffer.concat(trozos), nombreArchivo });
        });

        try {
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
            rechazar(error);
        }
    });
}

module.exports = { generarFacturaPDF };
