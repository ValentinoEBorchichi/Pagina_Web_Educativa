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

function validarFacturaId(valor) {
    const id = Number(valor);
    if (!Number.isSafeInteger(id) || id <= 0) {
        throw new Error('El ID de factura no es válido');
    }
    return id;
}

const ALTO_FILA = 22;
const COLUMNAS_CONCEPTOS = [
    { titulo: 'Concepto', x: PAGINA.margen + 12, ancho: 262 },
    { titulo: 'Cant.', x: PAGINA.margen + 278, ancho: 44, align: 'center' },
    { titulo: 'Precio unit.', x: PAGINA.margen + 326, ancho: 84, align: 'right' },
    { titulo: 'Subtotal', x: PAGINA.margen + 414, ancho: 89, align: 'right' }
];
const COLUMNAS_CUOTAS = [
    { titulo: 'Cuota', x: PAGINA.margen + 12, ancho: 80 },
    { titulo: 'Vencimiento', x: PAGINA.margen + 110, ancho: 120 },
    { titulo: 'Monto', x: PAGINA.margen + 240, ancho: 110, align: 'right' },
    { titulo: 'Estado', x: PAGINA.margen + 380, ancho: 120 }
];

function dibujarFilaZebra(doc, indice) {
    if (indice % 2 === 1) {
        doc.rect(PAGINA.margen, doc.y - 4, ANCHO_UTIL, ALTO_FILA).fill(COLORES.fondo);
    }
}

// Genera el PDF de la factura en memoria: devuelve el buffer y el nombre de
// archivo sugerido. El llamador decide qué hacer con el buffer (responderlo,
// adjuntarlo a un mail, subirlo a Supabase Storage, o varias).
//
//   factura : { id, periodo, fecha_emision?, fecha_vencimiento?, estado, total, saldo? }
//   detalles: [{ descripcion, cantidad?, importe_unitario }]
//   alumno  : { nombre, apellido, dni }
//   opciones: { cuotas?: [{ numero_cuota, monto, vencimiento, estado }], plan?: { nombre, cantidad_cuotas, recargo_pct } }
//
// Si la factura tiene plan de pago, el total incluye el recargo: se muestra
// como una línea aparte (total - suma de conceptos) y se detallan las cuotas.
async function generarFacturaPDF(factura, detalles, alumno, { cuotas = [], plan = null } = {}) {
    const facturaId = validarFacturaId(factura.id);
    const nombreArchivo = `factura_${facturaId}.pdf`;
    const estado = factura.estado || 'Pendiente';
    const total = Number(factura.total || 0);
    const saldo = Number(factura.saldo ?? factura.total ?? 0);
    const pagado = Math.max(total - saldo, 0);

    const lineas = (detalles || []).map((d) => {
        const cantidad = Number(d.cantidad ?? 1);
        return {
            descripcion: d.descripcion,
            cantidad,
            unitario: Number(d.importe_unitario || 0),
            subtotal: Number(d.subtotal ?? cantidad * Number(d.importe_unitario || 0))
        };
    });
    const sumaConceptos = lineas.reduce((suma, l) => suma + l.subtotal, 0);
    const recargo = Math.round((total - sumaConceptos) * 100) / 100;
    if (recargo > 0.005) {
        lineas.push({
            descripcion: plan
                ? `Recargo por plan de pago (${plan.nombre}, ${Number(plan.recargo_pct)}%)`
                : 'Recargo por plan de pago',
            cantidad: 1,
            unitario: recargo,
            subtotal: recargo,
            destacada: true
        });
    }

    return renderizar(`Factura ${facturaId}`, (doc) => {
        dibujarEncabezado(doc, { tipo: 'FACTURA', numero: numeroDocumento(facturaId) });

        // --- Tarjetas: alumno y datos de la factura ---
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
                ['Plan de pago', plan ? plan.nombre : 'Sin plan elegido'],
                ['Cantidad', plan ? `${plan.cantidad_cuotas} cuota${plan.cantidad_cuotas > 1 ? 's' : ''} · recargo ${Number(plan.recargo_pct)}%` : '-']
            ]
        });
        dibujarTarjeta(doc, {
            x: PAGINA.margen + anchoTarjeta + 14,
            y: yTarjetas,
            ancho: anchoTarjeta,
            titulo: 'Datos de la factura',
            filas: [
                ['Período', periodoTexto(factura.periodo)],
                ['Emisión', fechaCorta(factura.fecha_emision)],
                ['Vencimiento', fechaCorta(factura.fecha_vencimiento)],
                ['Estado', (x, y) => dibujarBadge(doc, estado, x, y)]
            ]
        });
        doc.y = yTarjetas + alto + 22;

        // --- Conceptos ---
        dibujarTituloSeccion(doc, 'Detalle de conceptos');
        dibujarEncabezadoTabla(doc, COLUMNAS_CONCEPTOS);
        lineas.forEach((linea, indice) => {
            if (asegurarEspacio(doc, ALTO_FILA)) dibujarEncabezadoTabla(doc, COLUMNAS_CONCEPTOS);
            dibujarFilaZebra(doc, indice);
            const y = doc.y;
            doc.fillColor(linea.destacada ? COLORES.naranja : COLORES.texto)
                .font(linea.destacada ? 'Helvetica-Bold' : 'Helvetica').fontSize(9.5);
            texto(doc, linea.descripcion, COLUMNAS_CONCEPTOS[0].x, y + 2, { width: COLUMNAS_CONCEPTOS[0].ancho });
            texto(doc, String(linea.cantidad), COLUMNAS_CONCEPTOS[1].x, y + 2,
                { width: COLUMNAS_CONCEPTOS[1].ancho, align: 'center' });
            texto(doc, moneda(linea.unitario), COLUMNAS_CONCEPTOS[2].x, y + 2,
                { width: COLUMNAS_CONCEPTOS[2].ancho, align: 'right' });
            texto(doc, moneda(linea.subtotal), COLUMNAS_CONCEPTOS[3].x, y + 2,
                { width: COLUMNAS_CONCEPTOS[3].ancho, align: 'right' });
            doc.y = y + ALTO_FILA;
        });
        if (!lineas.length) {
            doc.fillColor(COLORES.textoTenue).font('Helvetica-Oblique').fontSize(9.5);
            texto(doc, 'Esta factura no tiene conceptos cargados.', PAGINA.margen + 12, doc.y + 2);
            doc.y += ALTO_FILA;
        }

        // --- Totales ---
        asegurarEspacio(doc, 96);
        const xTotales = PAGINA.margen + ANCHO_UTIL - 230;
        const yTotales = doc.y + 8;
        doc.roundedRect(xTotales, yTotales, 230, 82, 8).fillAndStroke(COLORES.fondo, COLORES.borde);
        const filaTotal = (etiqueta, valor, y, { fuerte = false, color = COLORES.texto } = {}) => {
            doc.fillColor(COLORES.textoSuave).font('Helvetica').fontSize(9.5);
            texto(doc, etiqueta, xTotales + 14, y, { width: 100 });
            doc.fillColor(color).font('Helvetica-Bold').fontSize(fuerte ? 13 : 10);
            texto(doc, valor, xTotales + 110, fuerte ? y - 2 : y, { width: 106, align: 'right' });
        };
        filaTotal('Total', moneda(total), yTotales + 12);
        filaTotal('Pagado', moneda(pagado), yTotales + 32, { color: COLORES.verde });
        doc.moveTo(xTotales + 14, yTotales + 52).lineTo(xTotales + 216, yTotales + 52)
            .lineWidth(0.5).strokeColor(COLORES.borde).stroke();
        filaTotal('Saldo pendiente', moneda(saldo), yTotales + 59, {
            fuerte: true,
            color: saldo > 0 ? COLORES.naranja : COLORES.verde
        });
        doc.y = yTotales + 82 + 16;

        // --- Plan de pago y cuotas ---
        if (cuotas.length) {
            asegurarEspacio(doc, 28 + 28 + ALTO_FILA);
            dibujarTituloSeccion(
                doc,
                'Plan de pago en cuotas',
                plan ? `Plan ${plan.nombre} · recargo ${Number(plan.recargo_pct)}%` : undefined
            );
            dibujarEncabezadoTabla(doc, COLUMNAS_CUOTAS);
            cuotas.forEach((cuota, indice) => {
                if (asegurarEspacio(doc, ALTO_FILA)) dibujarEncabezadoTabla(doc, COLUMNAS_CUOTAS);
                dibujarFilaZebra(doc, indice);
                const y = doc.y;
                doc.fillColor(COLORES.texto).font('Helvetica-Bold').fontSize(9.5);
                texto(doc, `${cuota.numero_cuota} de ${cuotas.length}`, COLUMNAS_CUOTAS[0].x, y + 2,
                    { width: COLUMNAS_CUOTAS[0].ancho });
                doc.font('Helvetica');
                texto(doc, fechaCorta(cuota.vencimiento), COLUMNAS_CUOTAS[1].x, y + 2,
                    { width: COLUMNAS_CUOTAS[1].ancho });
                texto(doc, moneda(cuota.monto), COLUMNAS_CUOTAS[2].x, y + 2,
                    { width: COLUMNAS_CUOTAS[2].ancho, align: 'right' });
                dibujarBadge(doc, cuota.estado, COLUMNAS_CUOTAS[3].x, y);
                doc.y = y + ALTO_FILA;
            });
            doc.y += 12;
        }

        // --- Nota ---
        asegurarEspacio(doc, 62);
        const yNota = doc.y + 6;
        doc.roundedRect(PAGINA.margen, yNota, ANCHO_UTIL, 50, 8).fill(COLORES.azulSuave);
        doc.fillColor(COLORES.azul).font('Helvetica-Bold').fontSize(9);
        texto(doc, 'Cómo pagar', PAGINA.margen + 14, yNota + 9);
        doc.fillColor(COLORES.textoSuave).font('Helvetica').fontSize(8.5);
        doc.text(
            'El pago se realiza por transferencia bancaria. Subí el comprobante desde la web o la app: '
            + 'el pago se acredita cuando la institución verifica la transferencia.',
            PAGINA.margen + 14, yNota + 22, { width: ANCHO_UTIL - 28, height: 26 }
        );
    }).then((buffer) => ({ buffer, nombreArchivo }));
}

module.exports = { generarFacturaPDF };
