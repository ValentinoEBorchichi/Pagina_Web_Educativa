const PDFDocument = require('pdfkit');
const LOGO = require('../assets/logo');

// Piezas comunes de los PDF institucionales (factura y recibo): paleta de la
// web (frontend/src/index.css, :root), encabezado, tarjetas, tabla, badges y
// pie de página numerado. Todo con las fuentes estándar de PDF (Helvetica),
// sin depender de fuentes del sistema.

const COLORES = Object.freeze({
    azul: '#1a5fa8',
    azulClaro: '#2d80d4',
    azulSuave: '#dbeafe',
    verde: '#2da84a',
    verdeSuave: '#dcfce7',
    naranja: '#f5820d',
    naranjaSuave: '#ffedd5',
    violeta: '#7c3aed',
    rojo: '#dc2626',
    rojoSuave: '#fee2e2',
    texto: '#1e293b',
    textoSuave: '#475569',
    textoTenue: '#64748b',
    fondo: '#f8fafc',
    borde: '#e2e8f0',
    blanco: '#ffffff'
});

// Color de texto y fondo del "badge" según el estado (factura, cuota o comprobante).
const ESTADOS = Object.freeze({
    Pagada: { texto: COLORES.verde, fondo: COLORES.verdeSuave },
    Aprobado: { texto: COLORES.verde, fondo: COLORES.verdeSuave },
    'Pago parcial': { texto: COLORES.naranja, fondo: COLORES.naranjaSuave },
    Pendiente: { texto: COLORES.azul, fondo: COLORES.azulSuave },
    Vencida: { texto: COLORES.rojo, fondo: COLORES.rojoSuave },
    Rechazado: { texto: COLORES.rojo, fondo: COLORES.rojoSuave },
    Anulada: { texto: COLORES.textoTenue, fondo: COLORES.borde }
});

const PAGINA = Object.freeze({ ancho: 595.28, alto: 841.89, margen: 40, pie: 38 });
const ANCHO_UTIL = PAGINA.ancho - PAGINA.margen * 2;
const LIMITE_INFERIOR = PAGINA.alto - PAGINA.margen - PAGINA.pie;

function moneda(valor) {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' })
        .format(Number(valor || 0))
        .replace(/\u00a0/g, ' ');
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
    'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

// Acepta 'YYYY-MM-DD...' (lo que devuelve to_char / un string ISO) o un Date.
function partesFecha(valor) {
    if (!valor) return null;
    if (valor instanceof Date) {
        if (Number.isNaN(valor.getTime())) return null;
        return { anio: valor.getFullYear(), mes: valor.getMonth() + 1, dia: valor.getDate() };
    }
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(valor));
    return m ? { anio: Number(m[1]), mes: Number(m[2]), dia: Number(m[3]) } : null;
}

function fechaCorta(valor) {
    const f = partesFecha(valor);
    if (!f) return '-';
    return `${String(f.dia).padStart(2, '0')}/${String(f.mes).padStart(2, '0')}/${f.anio}`;
}

function periodoTexto(valor) {
    const f = partesFecha(valor);
    if (!f) return '-';
    const mes = MESES[f.mes - 1];
    return `${mes.charAt(0).toUpperCase()}${mes.slice(1)} ${f.anio}`;
}

function numeroDocumento(id) {
    return `N° ${String(id).padStart(6, '0')}`;
}

// Texto de una sola línea: si no entra en `width` se recorta con "…" en vez
// de desbordar (un nombre larguísimo no rompe el layout). Usa la fuente y el
// tamaño ya configurados en el documento.
function texto(doc, contenido, x, y, opciones = {}) {
    let linea = String(contenido ?? '-').replace(/\s+/g, ' ');
    if (opciones.width && doc.widthOfString(linea) > opciones.width) {
        while (linea.length > 1 && doc.widthOfString(`${linea}…`) > opciones.width) {
            linea = linea.slice(0, -1);
        }
        linea = `${linea.trimEnd()}…`;
    }
    doc.text(linea, x, y, { lineBreak: false, ...opciones });
}

function crearDocumento() {
    return new PDFDocument({
        size: 'A4',
        margin: PAGINA.margen,
        bufferPages: true,
        info: { Author: 'Educar para Transformar', Creator: 'Educar para Transformar' }
    });
}

// Ejecuta el dibujo y resuelve con el buffer. Cualquier excepción del dibujo
// rechaza la promesa (y no deja el stream colgado).
function renderizar(titulo, dibujar) {
    return new Promise((resolve, reject) => {
        const doc = crearDocumento();
        doc.info.Title = titulo;
        const trozos = [];
        let finalizado = false;

        const rechazar = (error) => {
            if (finalizado) return;
            finalizado = true;
            reject(error);
        };

        doc.once('error', rechazar);
        doc.on('data', (trozo) => trozos.push(trozo));
        doc.once('end', () => {
            if (finalizado) return;
            finalizado = true;
            resolve(Buffer.concat(trozos));
        });

        try {
            dibujar(doc);
            dibujarPies(doc);
            doc.end();
        } catch (error) {
            rechazar(error);
        }
    });
}

// Banda azul con el logo, el nombre de la institución y el tipo de documento.
function dibujarEncabezado(doc, { tipo, numero }) {
    doc.rect(0, 0, PAGINA.ancho, 98).fill(COLORES.azul);

    // Franja con los colores del logo, como separador.
    const colores = [COLORES.azulClaro, COLORES.verde, COLORES.naranja, COLORES.violeta];
    const ancho = PAGINA.ancho / colores.length;
    colores.forEach((color, i) => doc.rect(i * ancho, 98, ancho + 1, 4).fill(color));

    let xTexto = PAGINA.margen;
    if (LOGO) {
        doc.roundedRect(PAGINA.margen, 17, 64, 64, 10).fill(COLORES.blanco);
        doc.image(LOGO, PAGINA.margen + 4, 21, { fit: [56, 56], align: 'center', valign: 'center' });
        xTexto = PAGINA.margen + 80;
    }

    doc.fillColor(COLORES.blanco).font('Helvetica-Bold').fontSize(19);
    texto(doc, 'Educar para Transformar', xTexto, 32, { width: 300 });
    doc.fillColor(COLORES.azulSuave).font('Helvetica').fontSize(10);
    texto(doc, 'Centro educativo', xTexto, 56, { width: 300 });

    doc.fillColor(COLORES.blanco).font('Helvetica-Bold').fontSize(24);
    texto(doc, tipo, PAGINA.ancho - PAGINA.margen - 200, 28, { width: 200, align: 'right' });
    doc.fillColor(COLORES.azulSuave).font('Helvetica').fontSize(11);
    texto(doc, numero, PAGINA.ancho - PAGINA.margen - 200, 60, { width: 200, align: 'right' });

    doc.y = 122;
}

// Pastilla de color con el nombre del estado. Devuelve el ancho dibujado.
function dibujarBadge(doc, estado, x, y) {
    const colores = ESTADOS[estado] || ESTADOS.Pendiente;
    const etiqueta = String(estado || 'Pendiente').toUpperCase();
    doc.font('Helvetica-Bold').fontSize(8);
    const ancho = doc.widthOfString(etiqueta) + 16;
    doc.roundedRect(x, y, ancho, 16, 8).fill(colores.fondo);
    doc.fillColor(colores.texto);
    texto(doc, etiqueta, x + 8, y + 4.5);
    return ancho;
}

// Tarjeta con título y pares etiqueta/valor. Devuelve su alto.
function dibujarTarjeta(doc, { x, y, ancho, titulo, filas, acento = COLORES.azul }) {
    const altoFila = 18;
    const alto = 34 + filas.length * altoFila;
    doc.lineWidth(1).roundedRect(x, y, ancho, alto, 8).fillAndStroke(COLORES.fondo, COLORES.borde);
    doc.rect(x, y + 10, 3, 14).fill(acento);

    doc.fillColor(COLORES.textoTenue).font('Helvetica-Bold').fontSize(8);
    texto(doc, titulo.toUpperCase(), x + 14, y + 13, { width: ancho - 28, characterSpacing: 0.8 });

    filas.forEach(([etiqueta, valor], i) => {
        const yFila = y + 34 + i * altoFila;
        doc.fillColor(COLORES.textoSuave).font('Helvetica').fontSize(9);
        texto(doc, etiqueta, x + 14, yFila, { width: 82 });
        if (typeof valor === 'function') {
            valor(x + 98, yFila - 3);
        } else {
            doc.fillColor(COLORES.texto).font('Helvetica-Bold').fontSize(9.5);
            texto(doc, valor, x + 98, yFila, { width: ancho - 112 });
        }
    });
    return alto;
}

// Si lo que sigue no entra en la página actual, abre otra. Devuelve true si
// abrió una nueva (para que el llamador repita el encabezado de su tabla).
function asegurarEspacio(doc, alto) {
    if (doc.y + alto <= LIMITE_INFERIOR) return false;
    doc.addPage();
    doc.y = PAGINA.margen;
    return true;
}

// Fila de encabezado de tabla (fondo azul, texto blanco). columnas:
// [{ titulo, x, ancho, align }]. Deja doc.y debajo de la fila.
function dibujarEncabezadoTabla(doc, columnas) {
    const y = doc.y;
    doc.roundedRect(PAGINA.margen, y, ANCHO_UTIL, 24, 6).fill(COLORES.azul);
    doc.fillColor(COLORES.blanco).font('Helvetica-Bold').fontSize(9);
    columnas.forEach((c) => texto(doc, c.titulo, c.x, y + 8, { width: c.ancho, align: c.align || 'left' }));
    doc.y = y + 28;
}

// Título de sección con subrayado fino.
function dibujarTituloSeccion(doc, titulo, detalle) {
    const y = doc.y;
    doc.fillColor(COLORES.azul).font('Helvetica-Bold').fontSize(12);
    texto(doc, titulo, PAGINA.margen, y, { width: ANCHO_UTIL });
    if (detalle) {
        doc.fillColor(COLORES.textoTenue).font('Helvetica').fontSize(9);
        texto(doc, detalle, PAGINA.margen, y + 3, { width: ANCHO_UTIL, align: 'right' });
    }
    doc.moveTo(PAGINA.margen, y + 20).lineTo(PAGINA.margen + ANCHO_UTIL, y + 20)
        .lineWidth(1).strokeColor(COLORES.borde).stroke();
    doc.y = y + 28;
}

// Pie de página en todas las páginas: se dibuja al final porque recién ahí
// se sabe el total. Los márgenes se anulan un instante para que escribir en
// la zona inferior no dispare un salto de página automático.
function dibujarPies(doc) {
    const rango = doc.bufferedPageRange();
    for (let i = 0; i < rango.count; i++) {
        doc.switchToPage(rango.start + i);
        const margenInferior = doc.page.margins.bottom;
        doc.page.margins.bottom = 0;

        const y = PAGINA.alto - PAGINA.pie;
        doc.moveTo(PAGINA.margen, y).lineTo(PAGINA.margen + ANCHO_UTIL, y)
            .lineWidth(0.5).strokeColor(COLORES.borde).stroke();
        doc.fillColor(COLORES.textoTenue).font('Helvetica').fontSize(8);
        texto(doc, 'Educar para Transformar · Documento generado automáticamente por el sistema institucional',
            PAGINA.margen, y + 9, { width: ANCHO_UTIL - 70 });
        texto(doc, `Página ${i + 1} de ${rango.count}`,
            PAGINA.margen + ANCHO_UTIL - 70, y + 9, { width: 70, align: 'right' });

        doc.page.margins.bottom = margenInferior;
    }
}

module.exports = {
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
};
