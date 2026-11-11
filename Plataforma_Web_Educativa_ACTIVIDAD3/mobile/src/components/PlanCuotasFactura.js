import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { apiUrl } from '../config';
import { COLORS, FONTS, FONT_SIZE, RADIUS, TEXT } from '../theme';

const moneda = (n) => `$${Number(n || 0).toFixed(2)}`;

// Por factura con saldo: si todavía no tiene plan de pago elegido, ofrece
// los planes disponibles con el total simulado (saldo + recargo); si ya
// tiene uno, lista las cuotas generadas con un botón "Subir comprobante"
// por cada cuota Pendiente.
export default function PlanCuotasFactura({ factura, token, planes, navigation, onCambio }) {
  const [cuotas, setCuotas] = useState(null);
  const [cargandoCuotas, setCargandoCuotas] = useState(false);
  const [eligiendo, setEligiendo] = useState(null); // id del plan que se está eligiendo
  const [mensaje, setMensaje] = useState(null);

  const cargarCuotas = useCallback(async () => {
    if (!factura.plan_pago_id) { setCuotas(null); return; }
    setCargandoCuotas(true);
    try {
      const res = await fetch(apiUrl('/api/financiero/facturas/cuotas', { facturaId: factura.id }), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ([]));
      if (!res.ok) throw new Error(data.message || 'No se pudieron cargar las cuotas');
      setCuotas(data);
    } catch (e) {
      setMensaje({ tipo: 'error', texto: e.message });
    } finally {
      setCargandoCuotas(false);
    }
  }, [factura.id, factura.plan_pago_id, token]);

  useEffect(() => { cargarCuotas(); }, [cargarCuotas]);
  useFocusEffect(useCallback(() => { cargarCuotas(); }, [cargarCuotas]));

  async function elegirPlan(planPagoId) {
    setMensaje(null);
    setEligiendo(planPagoId);
    try {
      const res = await fetch(apiUrl('/api/financiero/facturas/elegir-plan', { facturaId: factura.id }), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ plan_pago_id: planPagoId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'No se pudo elegir el plan de pago');
      onCambio(); // CuentaScreen refetchea /api/facturas (trae el plan_pago_id ya asignado)
    } catch (e) {
      setMensaje({ tipo: 'error', texto: e.message });
    } finally {
      setEligiendo(null);
    }
  }

  if (mensaje) {
    return <Text style={styles.avisoError}>{mensaje.texto}</Text>;
  }

  // --- Factura sin plan: elegir uno ---
  if (!factura.plan_pago_id) {
    return (
      <View style={styles.bloque}>
        <Text style={styles.subtitulo}>Elegí un plan de pago</Text>
        {(planes || []).map((plan) => {
          const totalConRecargo = Number(factura.saldo) * (1 + Number(plan.recargo_pct || 0) / 100);
          const porCuota = totalConRecargo / plan.cantidad_cuotas;
          return (
            <Pressable
              key={plan.id}
              disabled={eligiendo != null}
              onPress={() => elegirPlan(plan.id)}
              style={({ pressed }) => [styles.planCard, pressed && styles.planCardPresionada]}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.planNombre}>{plan.nombre}</Text>
                <Text style={styles.planDetalle}>
                  {plan.cantidad_cuotas} cuota{plan.cantidad_cuotas > 1 ? 's' : ''} de {moneda(porCuota)}
                  {Number(plan.recargo_pct) > 0 ? ` · recargo ${plan.recargo_pct}%` : ' · sin recargo'}
                </Text>
                <Text style={styles.planTotal}>Total: {moneda(totalConRecargo)}</Text>
              </View>
              {eligiendo === plan.id ? <ActivityIndicator color={COLORS.blue} /> : null}
            </Pressable>
          );
        })}
        {!planes?.length ? <Text style={styles.vacio}>No hay planes de pago configurados todavía.</Text> : null}
      </View>
    );
  }

  // --- Factura con plan: listar cuotas ---
  if (cargandoCuotas && !cuotas) {
    return <ActivityIndicator color={COLORS.blue} style={{ marginVertical: 8 }} />;
  }

  return (
    <View style={styles.bloque}>
      <Text style={styles.subtitulo}>Cuotas</Text>
      {(cuotas || []).map((cuota) => (
        <View key={cuota.id} style={styles.cuotaFila}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cuotaTitulo}>Cuota {cuota.numero_cuota}/{cuotas.length}</Text>
            <Text style={styles.cuotaDetalle}>{moneda(cuota.monto)} · vence {cuota.vencimiento} · {cuota.estado}</Text>
          </View>
          {cuota.estado === 'Pendiente' ? (
            <Pressable
              style={styles.botonSubir}
              onPress={() => navigation.navigate('SubirComprobante', {
                token,
                facturaCuotaId: cuota.id,
                montoSugerido: cuota.monto,
                titulo: `Factura ${factura.id}`,
                subtitulo: `Cuota ${cuota.numero_cuota}/${cuotas.length}`,
              })}
            >
              <Text style={styles.botonSubirTexto}>Subir comprobante</Text>
            </Pressable>
          ) : (
            <Text style={styles.cuotaEstadoOk}>{cuota.estado}</Text>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bloque: { marginTop: 10, borderTopWidth: 1, borderTopColor: COLORS.bg, paddingTop: 10 },
  subtitulo: { ...TEXT.label, marginBottom: 8 },
  planCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.bg, borderRadius: RADIUS.md, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: COLORS.border },
  planCardPresionada: { opacity: 0.7 },
  planNombre: { fontFamily: FONTS.bodyExtraBold, color: COLORS.text, fontSize: FONT_SIZE.sm },
  planDetalle: { fontFamily: FONTS.body, color: COLORS.textSoft, fontSize: FONT_SIZE.xs, marginTop: 2 },
  planTotal: { fontFamily: FONTS.bodyBold, color: COLORS.blue, fontSize: FONT_SIZE.sm, marginTop: 4 },
  vacio: { fontFamily: FONTS.body, color: COLORS.textSoft, fontStyle: 'italic', fontSize: FONT_SIZE.sm },
  cuotaFila: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.bg },
  cuotaTitulo: { fontFamily: FONTS.bodyBold, color: COLORS.text, fontSize: FONT_SIZE.sm },
  cuotaDetalle: { fontFamily: FONTS.body, color: COLORS.textSoft, fontSize: FONT_SIZE.xs, marginTop: 2 },
  cuotaEstadoOk: { fontFamily: FONTS.bodyBold, color: COLORS.green, fontSize: FONT_SIZE.xs },
  botonSubir: { backgroundColor: COLORS.blue, borderRadius: RADIUS.pill, paddingVertical: 8, paddingHorizontal: 12 },
  botonSubirTexto: { color: COLORS.white, fontFamily: FONTS.bodyExtraBold, fontSize: FONT_SIZE.xs },
  avisoError: { color: COLORS.danger, fontFamily: FONTS.bodyBold, fontSize: FONT_SIZE.sm, marginTop: 8 },
});
