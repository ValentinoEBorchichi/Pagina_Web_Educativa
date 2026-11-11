const test = require('node:test');
const assert = require('node:assert/strict');

const { aCentavos, deCentavos, calcularRecargoCentavos, repartirEnCuotas } = require('../src/utils/cuotas');

test('convierte montos a centavos sin errores de punto flotante', () => {
    assert.equal(aCentavos('45000.00'), 4500000);
    assert.equal(aCentavos(0.1 + 0.2), 30);
    assert.equal(aCentavos('9716.67'), 971667);
    assert.throws(() => aCentavos('abc'));
});

test('convierte centavos al formato decimal de Postgres', () => {
    assert.equal(deCentavos(4500050), '45000.50');
    assert.equal(deCentavos(5), '0.05');
    assert.equal(deCentavos(0), '0.00');
});

test('calcula el recargo redondeando al centavo', () => {
    assert.equal(calcularRecargoCentavos(5300000, '10.00'), 530000);
    assert.equal(calcularRecargoCentavos(5300000, 0), 0);
    // 0,10 * 5% = 0,005 -> sube a 0,01 (mitad hacia arriba)
    assert.equal(calcularRecargoCentavos(10, '5.00'), 1);
    // sin perder precisión con saldos y porcentajes grandes
    assert.equal(calcularRecargoCentavos(999999999999, '999.99'), 9999899999990);
});

test('reparte en cuotas iguales cuando el total divide exacto', () => {
    assert.deepEqual(repartirEnCuotas(5565000, 3), [1855000, 1855000, 1855000]);
    assert.deepEqual(repartirEnCuotas(100, 1), [100]);
});

test('reparte los centavos sobrantes en las primeras cuotas y la suma es exacta', () => {
    const cuotas = repartirEnCuotas(5830000, 6);
    assert.deepEqual(cuotas, [971667, 971667, 971667, 971667, 971666, 971666]);
    assert.equal(cuotas.reduce((a, b) => a + b, 0), 5830000);

    for (const [total, cantidad] of [[1, 1], [7, 3], [100003, 24], [999, 7]]) {
        const partes = repartirEnCuotas(total, cantidad);
        assert.equal(partes.length, cantidad);
        assert.equal(partes.reduce((a, b) => a + b, 0), total);
        assert.ok(Math.max(...partes) - Math.min(...partes) <= 1);
        assert.ok(partes.every((p) => p >= 1));
    }
});

test('no arma planes cuyas cuotas quedarían en cero', () => {
    assert.deepEqual(repartirEnCuotas(10, 24), []);
    assert.deepEqual(repartirEnCuotas(0, 3), []);
    assert.deepEqual(repartirEnCuotas(100, 0), []);
    assert.deepEqual(repartirEnCuotas(100, 2.5), []);
});
