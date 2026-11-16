const {
    COLORES,
    PAGINA,
    ANCHO_UTIL,
    moneda,
    fechaCorta,
    periodoTexto,
    numeroDocumento,
    texto,
    renderizar,
    dibujarEncabezado,
    dibujarBadge,
    dibujarTarjeta,
    asegurarEspacio,
    dibujarEncabezadoTabla,
    dibujarTituloSeccion
} = require('./pdfBase');

function validarComprobanteId(valor) {
    const id = Number(valor);
    if (!Number.isSafeInteger(id) || id <= 0) {
        throw new Error('El ID de comprobante no es válido');
    }
    return id;
}

// Tilde blanca dentro de un círculo, dibujada con trazos (sin depender de
// glifos que la fuente estándar no trae).
function dibujarTilde(doc, centroX, centroY) {
    doc.circle(centroX, centroY, 17).fill(COLORES.blanco);
    doc.lineWidth(3.2).lineCap('round').lineJoin('round').strokeColor(COLORES.verde)
        .moveTo(centroX - 7, centroY + 0.5)
        .lineTo(centroX - 2, centroY + 6)
        .lineTo(centroX + 8, centroY - 6)
        .stroke();
    doc.lineWidth(1);
}

// Genera el recibo de un pago APROBADO (comprobante de transferencia
// verificado por la institución). Devuelve { buffer, nombreArchivo }.
//
//   comprobante: { id, monto, fecha_transferencia, fecha_carga, observaciones? }
//   factura    : { id, periodo, total, saldo, estado }
//   alumno     : { nombre, apellido, dni }
//   cuota      : { numero_cuota, vencimiento } | null   (pago atado a una cuota)
//   plan       : { nombre, cantidad_cuotas } | null
async function generarReciboPDF({ comprobante, factura, alumno, cuota = null, plan = null }) {
    const comprobanteId = validarComprobanteId(comprobante.id);
    const nombreArchivo = `recibo_${comprobanteId}.pdf`;
    const monto = Number(comprobante.monto || 0);
    const total = Number(factura.total || 0);
    const saldo = Number(factura.saldo || 0);

    const concepto = cuota
        ? `Cuota ${cuota.numero_cuota}${plan ? ` de ${plan.cantidad_cuotas}` : ''}`
        : 'Pago a cuenta de factura';
    const detalleConcepto = [
        `Factura ${numeroDocumento(factura.id)}`,
        periodoTexto(factura.periodo),
        plan ? `Plan ${plan.nombre}` : null
    ].filter(Boolean).join(' · ');

    return renderizar(`Recibo ${comprobanteId}`, (doc) => {
        dibujarEncabezado(doc, { tipo: 'RECIBO', numero: numeroDocumento(comprobanteId) });

        // --- Banner de pago acreditado ---
        const yBanner = doc.y;
        doc.roundedRect(PAGINA.margen, yBanner, ANCHO_UTIL, 64, 10).fill(COLORES.verde);
        doc.fillColor(COLORES.verdeSuave).font('Helvetica-Bold').fontSize(8.5);
        texto(doc, 'TOTAL PAGADO', PAGINA.margen + 20, yBanner + 13, { characterSpacing: 0.8 });
        doc.fillColor(COLORES.blanco).font('Helvetica-Bold').fontSize(26);
        texto(doc, moneda(monto), PAGINA.margen + 20, yBanner + 28, { width: 300 });
        doc.fillColor(COLORES.blanco).font('Helvetica-Bold').fontSize(11);
        texto(doc, 'PAGO ACREDITADO', PAGINA.margen + ANCHO_UTIL - 232, yBanner + 26,
            { width: 170, align: 'right' });
        dibujarTilde(doc, PAGINA.margen + ANCHO_UTIL - 36, yBanner + 32);
        doc.y = yBanner + 64 + 20;

        // --- Tarjetas: alumno y datos del pago ---
        const yTarjetas = doc.y;
        const anchoTarjeta = (ANCHO_UTIL - 14) / 2;
        const nombreAlumno = `${alumno.apellido || ''}, ${alumno.nombre || ''}`.replace(/^,\s*|,\s*$/g, '');
        const alto = dibujarTarjeta(doc, {
            x: PAGINA.margen,
            y: yTarjetas,
            ancho: anchoTarjeta,
            titulo: 'Alumno',
            acento: COLORES.verde,
            filas: [
                ['Apellido y nombre', nombreAlumno],
                ['DNI', alumno.dni],
                ['Factura', `${numeroDocumento(factura.id)} · ${periodoTexto(factura.periodo)}`]
            ]
        });
        dibujarTarjeta(doc, {
            x: PAGINA.margen + anchoTarjeta + 14,
            y: yTarjetas,
            ancho: anchoTarjeta,
            titulo: 'Datos del pago',
            filas: [
                ['Medio de pago', 'Transferencia bancaria'],
                ['Fecha transferencia', fechaCorta(comprobante.fecha_transferencia)],
                ['Estado', (x, y) => dibujarBadge(doc, 'Aprobado', x, y)]
            ]
        });
        doc.y = yTarjetas + alto + 22;

        // --- Detalle del pago ---
        dibujarTituloSeccion(doc, 'Detalle del pago');
        const columnas = [
            { titulo: 'Concepto', x: PAGINA.margen + 12, ancho: 360 },
            { titulo: 'Importe', x: PAGINA.margen + 390, ancho: 113, align: 'right' }
        ];
        dibujarEncabezadoTabla(doc, columnas);
        const yFila = doc.y;
        doc.rect(PAGINA.margen, yFila - 4, ANCHO_UTIL, 40).fill(COLORES.fondo);
        doc.fillColor(COLORES.texto).font('Helvetica-Bold').fontSize(10.5);
        texto(doc, concepto, columnas[0].x, yFila + 2, { width: columnas[0].ancho });
        doc.fillColor(COLORES.textoSuave).font('Helvetica').fontSize(9);
        texto(doc, detalleConcepto, columnas[0].x, yFila + 18, { width: columnas[0].ancho });
        doc.fillColor(COLORES.texto).font('Helvetica-Bold').fontSize(10.5);
        texto(doc, moneda(monto), columnas[1].x, yFila + 2, { width: columnas[1].ancho, align: 'right' });
        doc.y = yFila + 44;

        // --- Estado de la factura a la fecha ---
        asegurarEspacio(doc, 100);
        const xCaja = PAGINA.margen + ANCHO_UTIL - 230;
        const yCaja = doc.y + 8;
        doc.roundedRect(xCaja, yCaja, 230, 82, 8).fillAndStroke(COLORES.fondo, COLORES.borde);
        const fila = (etiqueta, valor, y, color = COLORES.texto) => {
            doc.fillColor(COLORES.textoSuave).font('Helvetica').fontSize(9.5);
            texto(doc, etiqueta, xCaja + 14, y, { width: 110 });
            doc.fillColor(color).font('Helvetica-Bold').fontSize(10);
            texto(doc, valor, xCaja + 110, y, { width: 106, align: 'right' });
        };
        fila('Total de la factura', moneda(total), yCaja + 12);
        fila('Pagado a la fecha', moneda(Math.max(total - saldo, 0)), yCaja + 32, COLORES.verde);
        doc.moveTo(xCaja + 14, yCaja + 52).lineTo(xCaja + 216, yCaja + 52)
            .lineWidth(0.5).strokeColor(COLORES.borde).stroke();
        fila('Saldo pendiente', moneda(saldo), yCaja + 60, saldo > 0 ? COLORES.naranja : COLORES.verde);
        doc.y = yCaja + 82 + 22;

        // --- Observaciones de la institución ---
        if (comprobante.observaciones) {
            asegurarEspacio(doc, 70);
            const yObs = doc.y;
            doc.roundedRect(PAGINA.margen, yObs, ANCHO_UTIL, 52, 8).fillAndStroke(COLORES.fondo, COLORES.borde);
            doc.fillColor(COLORES.textoTenue).font('Helvetica-Bold').fontSize(8);
            texto(doc, 'OBSERVACIONES', PAGINA.margen + 14, yObs + 10, { characterSpacing: 0.8 });
            doc.fillColor(COLORES.texto).font('Helvetica').fontSize(9.5);
            doc.text(String(comprobante.observaciones), PAGINA.margen + 14, yObs + 24,
                { width: ANCHO_UTIL - 28, height: 24, ellipsis: true });
            doc.y = yObs + 52 + 16;
        }

        // --- Leyenda ---
        asegurarEspacio(doc, 44);
        const yNota = doc.y + 4;
        doc.roundedRect(PAGINA.margen, yNota, ANCHO_UTIL, 36, 8).fill(COLORES.verdeSuave);
        doc.fillColor(COLORES.textoSuave).font('Helvetica').fontSize(8.5);
        doc.text(
            'Este recibo certifica que la transferencia informada fue verificada y aprobada por la institución. '
            + `Comprobante cargado el ${fechaCorta(comprobante.fecha_carga)}.`,
            PAGINA.margen + 14, yNota + 10, { width: ANCHO_UTIL - 28, height: 20 }
        );
    }).then((buffer) => ({ buffer, nombreArchivo }));
}

module.exports = { generarReciboPDF };
