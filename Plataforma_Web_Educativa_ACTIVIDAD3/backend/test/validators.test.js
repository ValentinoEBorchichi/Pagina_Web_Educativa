const test = require('node:test');
const assert = require('node:assert/strict');

const { NOMBRE_REGEX, esNombreValido } = require('../src/utils/validators');

test('acepta nombres con letras, espacios y signos habituales', () => {
    assert.equal(NOMBRE_REGEX.test('Ana María López'), true);
    assert.equal(esNombreValido("O'Connor"), true);
    assert.equal(esNombreValido('José Pérez-Gómez'), true);
});

test('rechaza nombres con números o símbolos no permitidos', () => {
    assert.equal(esNombreValido('Ana123'), false);
    assert.equal(esNombreValido('Nombre@Prueba'), false);
    assert.equal(esNombreValido(''), false);
});

test('recorta espacios externos antes de validar', () => {
    assert.equal(esNombreValido('  Juan Pérez  '), true);
});
