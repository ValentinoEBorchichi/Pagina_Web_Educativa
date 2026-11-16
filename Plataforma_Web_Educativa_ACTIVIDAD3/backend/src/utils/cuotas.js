// Aritmética de planes de pago en cuotas. Todo se calcula en CENTAVOS enteros
// (nunca con decimales de punto flotante) para que la suma de las cuotas sea
// exactamente el monto financiado.

// "45000.00" | 45000 | 45000.5 -> 4500000 | 4500000 | 4500050
function aCentavos(valor) {
    const numero = Number(valor);
    if (!Number.isFinite(numero)) throw new Error('Monto inválido');
    return Math.round(numero * 100);
}

// 4500050 -> "45000.50" (formato que Postgres acepta para DECIMAL).
function deCentavos(centavos) {
    return (centavos / 100).toFixed(2);
}

// Recargo sobre el saldo, redondeado al centavo (mitad hacia arriba).
// recargoPct viene de plan_pago.recargo_pct (DECIMAL(5,2): hasta 999.99).
// Se usa BigInt para que saldo * porcentaje no pierda precisión.
function calcularRecargoCentavos(saldoCentavos, recargoPct) {
    const pctCentesimas = BigInt(Math.round(Number(recargoPct) * 100));
    return Number((BigInt(saldoCentavos) * pctCentesimas + 5000n) / 10000n);
}

// Reparte totalCentavos en `cantidad` cuotas: todas iguales y, si no divide
// exacto, los centavos sobrantes se suman de a uno a las PRIMERAS cuotas.
// Devuelve [] si no se puede armar un plan con cuotas de al menos $0,01.
function repartirEnCuotas(totalCentavos, cantidad) {
    if (!Number.isInteger(cantidad) || cantidad < 1) return [];
    if (!Number.isInteger(totalCentavos) || totalCentavos < cantidad) return [];
    const base = Math.floor(totalCentavos / cantidad);
    const resto = totalCentavos - base * cantidad;
    return Array.from({ length: cantidad }, (_, i) => base + (i < resto ? 1 : 0));
}

module.exports = { aCentavos, deCentavos, calcularRecargoCentavos, repartirEnCuotas };
