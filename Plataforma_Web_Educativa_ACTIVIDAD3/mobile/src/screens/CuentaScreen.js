import { useEffect, useState } from 'react';
import { ActivityIndicator, Button, FlatList, StyleSheet, Text, View } from 'react-native';
import { apiUrl } from '../config';

export default function CuentaScreen({ route, navigation }) {
  const { alumnoId, token } = route.params;
  const [cuenta, setCuenta] = useState(null);
  const [seleccionadas, setSeleccionadas] = useState([]);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let vigente = true;
    fetch(apiUrl('estado-cuenta', alumnoId), {
      headers: { Authorization: `Bearer ${token}` },
    }).then(async (res) => {
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'No se pudo cargar la cuenta');
      if (vigente) setCuenta(data);
    }).catch((e) => vigente && setError(e.message))
      .finally(() => vigente && setCargando(false));
    return () => { vigente = false; };
  }, [alumnoId, token]);

  const facturas = cuenta?.facturas || [];
  const alternar = (id) => setSeleccionadas((actuales) => actuales.includes(id)
    ? actuales.filter((item) => item !== id) : [...actuales, id]);
  const totalSeleccionado = facturas.filter((f) => seleccionadas.includes(f.id))
    .reduce((total, f) => total + Number(f.saldo || 0), 0);

  if (cargando) return <ActivityIndicator style={styles.centro} size="large" />;
  if (error) return <View style={styles.container}><Text style={styles.error}>{error}</Text></View>;

  return <View style={styles.container}>
    <Text style={styles.total}>Deuda total: ${Number(cuenta?.total_adeudado || 0).toFixed(2)}</Text>
    <FlatList data={facturas} keyExtractor={(item) => String(item.id)} ListEmptyComponent={<Text>No hay facturas registradas.</Text>}
      renderItem={({ item }) => {
        const pagable = Number(item.saldo) > 0 && item.estado !== 'Anulada';
        return <View style={styles.card}>
          <Text style={styles.titulo}>Factura {item.id} · {new Date(item.periodo).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}</Text>
          <Text>Estado: {item.estado} · Saldo: ${Number(item.saldo).toFixed(2)}</Text>
          {(item.detalles || []).map((d) => <Text key={d.id} style={styles.detalle}>• {d.descripcion} (${Number(d.subtotal).toFixed(2)})</Text>)}
          {pagable ? <Button title={seleccionadas.includes(item.id) ? '✓ Seleccionada' : 'Seleccionar para pagar'} onPress={() => alternar(item.id)} /> : null}
        </View>;
      }} />
    <Text style={styles.total}>Selección: ${totalSeleccionado.toFixed(2)}</Text>
    <Text style={styles.aviso}>Comprobante provisorio · el pago se confirma luego de la acreditación.</Text>
    <Button title="Generar comprobante provisorio" disabled={!seleccionadas.length} onPress={() => navigation.navigate('ComprobanteProvisorio', {
      facturas: facturas.filter((f) => seleccionadas.includes(f.id)), total: totalSeleccionado,
    })} />
    <Button title="Ver historial" onPress={() => navigation.navigate('Historial', { facturas })} />
  </View>;
}

const styles = StyleSheet.create({ container: { flex: 1, padding: 16, gap: 12 }, centro: { flex: 1 }, card: { padding: 14, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, gap: 6, marginBottom: 10 }, titulo: { fontWeight: '700', fontSize: 16 }, detalle: { color: '#475569' }, total: { fontSize: 18, fontWeight: '700' }, aviso: { color: '#92400e' }, error: { color: '#b91c1c' } });
