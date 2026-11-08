import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { ActivityIndicator, Button, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { apiUrl } from '../config';

export default function CuentaScreen({ route, navigation }) {
  const { alumnoId, token } = route.params;
  const [cuenta, setCuenta] = useState(null);
  const [seleccionadas, setSeleccionadas] = useState({});
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);

  useFocusEffect(useCallback(() => {
    let vigente = true;
    setCargando(true); setError('');
    fetch(apiUrl('/api/facturas', alumnoId), { headers: { Authorization: `Bearer ${token}` } })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || 'No se pudo cargar la cuenta');
        if (vigente) { setCuenta(data); setSeleccionadas({}); }
      }).catch((e) => vigente && setError(e.message))
      .finally(() => vigente && setCargando(false));
    return () => { vigente = false; };
  }, [alumnoId, token]));

  const facturas = cuenta?.facturas || [];
  const disponibles = facturas.filter((f) => Number(f.saldo) > 0 && f.estado !== 'Anulada');
  const conceptos = disponibles.flatMap((f) => (f.detalles || []).map((d) => ({ ...d, factura: f })));
  const totalSeleccionado = conceptos.filter((d) => seleccionadas[d.id])
    .reduce((total, d) => total + Number(d.subtotal || 0), 0);

  if (cargando) return <ActivityIndicator style={styles.centro} size="large" />;
  if (error) return <View style={styles.container}><Text style={styles.error}>{error}</Text><Button title="Volver a intentar" onPress={() => navigation.goBack()} /></View>;

  return <ScrollView contentContainerStyle={styles.container}>
    <Text style={styles.total}>Deuda total: ${Number(cuenta?.total_adeudado || 0).toFixed(2)}</Text>
    {facturas.length === 0 ? <Text>No hay facturas registradas.</Text> : facturas.map((factura) => {
      const pagable = Number(factura.saldo) > 0 && factura.estado !== 'Anulada';
      return <View key={factura.id} style={styles.card}>
        <Text style={styles.titulo}>Factura {factura.id} · {new Date(factura.periodo).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}</Text>
        <Text>Estado: {factura.estado} · Saldo: ${Number(factura.saldo).toFixed(2)}</Text>
        {(factura.detalles || []).map((detalle) => <View key={detalle.id} style={styles.linea}>
          <View style={styles.textos}><Text style={styles.detalle}>{detalle.descripcion}</Text><Text>${Number(detalle.subtotal).toFixed(2)}</Text></View>
          {pagable ? <Switch accessibilityLabel={`Seleccionar ${detalle.descripcion}`} value={Boolean(seleccionadas[detalle.id])}
            onValueChange={(valor) => setSeleccionadas((actuales) => ({ ...actuales, [detalle.id]: valor }))} /> : null}
        </View>)}
        {pagable ? <Button title="Subir ticket de transferencia" onPress={() => navigation.navigate('SubirComprobante', { factura, token })} /> : null}
      </View>;
    })}
    <Text style={styles.total}>Total de conceptos seleccionados: ${totalSeleccionado.toFixed(2)}</Text>
    <Text style={styles.aviso}>El comprobante es provisorio y no confirma el pago. El pago se acredita al validar la transferencia.</Text>
    <Button title="Generar comprobante provisorio" disabled={!Object.values(seleccionadas).some(Boolean)} onPress={() => navigation.navigate('ComprobanteProvisorio', {
      conceptos: conceptos.filter((d) => seleccionadas[d.id]), total: totalSeleccionado,
    })} />
    <Button title="Ver historial" onPress={() => navigation.navigate('Historial', { alumnoId, token })} />
  </ScrollView>;
}

const styles = StyleSheet.create({ container: { padding: 16, gap: 12 }, centro: { flex: 1 }, card: { padding: 14, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, gap: 6, marginBottom: 10 }, titulo: { fontWeight: '700', fontSize: 16 }, linea: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 5, borderTopWidth: 1, borderTopColor: '#f1f5f9' }, textos: { flex: 1 }, detalle: { color: '#334155' }, total: { fontSize: 18, fontWeight: '700' }, aviso: { color: '#92400e' }, error: { color: '#b91c1c' } });
