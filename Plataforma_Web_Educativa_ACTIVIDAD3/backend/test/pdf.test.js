const test = require('node:test');
const assert = require('node:assert/strict');

const { generarFacturaPDF } = require('../src/services/facturaPdf.service');
const { generarReciboPDF } = require('../src/services/reciboPdf.service');

const alumno = { nombre: 'Lucía', apellido: 'Fernández', dni: '53111222' };
const detalles = [
    { descripcion: 'Cuota mensual Nivel Primario', cantidad: 1, importe_unitario: '45000.00', subtotal: '45000.00' },
    { descripcion: 'Fútbol', cantidad: 1, importe_unitario: '8000.00', subtotal: '8000.00' }
];

const esPdf = (buffer) => buffer.subarray(0, 5).toString() === '%PDF-' && buffer.length > 1500;
const contarPaginas = (buffer) => (buffer.toString('latin1').match(/\/Type \/Page\b(?!s)/g) || []).length;

test('la factura sin plan de pago genera un PDF válido de una página', async () => {
    const { buffer, nombreArchivo } = await generarFacturaPDF(
        { id: 7, periodo: '2026-11-01', fecha_emision: '2026-11-30', fecha_vencimiento: '2026-11-30', estado: 'Pendiente', total: '53000.00', saldo: '53000.00' },
        detalles,
        alumno
    );
    assert.equal(nombreArchivo, 'factura_7.pdf');
    assert.ok(esPdf(buffer));
    assert.equal(contarPaginas(buffer), 1);
});

test('la factura con plan de pago incluye el recargo y las cuotas', async () => {
    const plan = { nombre: '6 cuotas', cantidad_cuotas: 6, recargo_pct: '10.00' };
    const cuotas = Array.from({ length: 6 }, (_, i) => ({
        numero_cuota: i + 1,
        monto: '9716.67',
        vencimiento: `2026-${String(11 + i > 12 ? i - 1 : 11 + i).padStart(2, '0')}-30`,
        estado: i === 0 ? 'Pagada' : 'Pendiente'
    }));
    const { buffer } = await generarFacturaPDF(
        { id: 8, periodo: new Date(2026, 10, 1), estado: 'Pago parcial', total: '58300.00', saldo: '48583.33' },
        detalles,
        alumno,
        { cuotas, plan }
    );
    assert.ok(esPdf(buffer));
    assert.equal(contarPaginas(buffer), 1);
});

test('una factura con muchos conceptos y cuotas pasa a más páginas sin romperse', async () => {
    const muchos = Array.from({ length: 45 }, (_, i) => ({
        descripcion: `Concepto ${i + 1} con una descripción bastante larga ${'x'.repeat(120)}`,
        cantidad: 1,
        importe_unitario: 1000,
        subtotal: 1000
    }));
    const cuotas = Array.from({ length: 24 }, (_, i) => ({
        numero_cuota: i + 1, monto: 1875, vencimiento: '2027-01-15', estado: 'Pendiente'
    }));
    const { buffer } = await generarFacturaPDF(
        { id: 9, periodo: '2026-11-01', estado: 'Pendiente', total: 45000 },
        muchos,
        alumno,
        { cuotas, plan: { nombre: '24 cuotas', cantidad_cuotas: 24, recargo_pct: 0 } }
    );
    assert.ok(esPdf(buffer));
    assert.ok(contarPaginas(buffer) >= 2);
});

test('rechaza un id de factura inválido', async () => {
    await assert.rejects(() => generarFacturaPDF({ id: 'abc', total: 1 }, [], alumno), /ID de factura/);
    await assert.rejects(() => generarFacturaPDF({ id: -3, total: 1 }, [], alumno), /ID de factura/);
});

test('el recibo de una cuota genera un PDF válido', async () => {
    const { buffer, nombreArchivo } = await generarReciboPDF({
        comprobante: { id: 12, monto: '9716.67', fecha_transferencia: '2026-11-03', fecha_carga: '2026-11-04', observaciones: 'Verificado' },
        factura: { id: 8, periodo: '2026-11-01', total: '58300.00', saldo: '48583.33' },
        alumno,
        cuota: { numero_cuota: 1 },
        plan: { nombre: '6 cuotas', cantidad_cuotas: 6 }
    });
    assert.equal(nombreArchivo, 'recibo_12.pdf');
    assert.ok(esPdf(buffer));
});

test('el recibo de un pago a cuenta (sin cuota ni observaciones) también se genera', async () => {
    const { buffer } = await generarReciboPDF({
        comprobante: { id: 13, monto: 400, fecha_transferencia: '2026-11-03', fecha_carga: '2026-11-03' },
        factura: { id: 9, periodo: '2026-10-01', total: 1000, saldo: 600 },
        alumno
    });
    assert.ok(esPdf(buffer));
});

test('rechaza un id de comprobante inválido', async () => {
    await assert.rejects(
        () => generarReciboPDF({ comprobante: { id: 0, monto: 1 }, factura: { id: 1 }, alumno }),
        /ID de comprobante/
    );
});
