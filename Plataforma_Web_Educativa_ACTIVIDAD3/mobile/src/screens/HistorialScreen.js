import { FlatList, StyleSheet, Text, View } from 'react-native';

export function HistorialScreen({ route }) {
  const facturas = route.params?.facturas || [];
  return <FlatList contentContainerStyle={styles.container} data={facturas} keyExtractor={(item) => String(item.id)}
    ListEmptyComponent={<Text>No hay facturas anteriores.</Text>}
    renderItem={({ item }) => <View style={styles.item}>
      <Text style={styles.titulo}>Factura {item.id} · {item.estado}</Text>
      <Text>Emisión: {new Date(item.fecha_emision).toLocaleDateString('es-AR')}</Text>
      <Text>Total ${Number(item.total).toFixed(2)} · Saldo ${Number(item.saldo).toFixed(2)}</Text>
    </View>} />;
}

export function ComprobanteProvisorioScreen({ route }) {
  const { facturas = [], total = 0 } = route.params || {};
  return <View style={styles.container}>
    <Text style={styles.titulo}>Comprobante provisorio</Text>
    <Text>Detalle de selección para presentar al área administrativa:</Text>
    {facturas.map((f) => <Text key={f.id} style={styles.item}>Factura {f.id} · saldo ${Number(f.saldo).toFixed(2)}</Text>)}
    <Text style={styles.total}>Total a pagar: ${Number(total).toFixed(2)}</Text>
    <Text style={styles.aviso}>Este comprobante no acredita un pago. Conservá el comprobante de transferencia para su validación.</Text>
  </View>;
}

const styles = StyleSheet.create({ container: { flex: 1, padding: 16, gap: 12 }, item: { padding: 12, borderBottomWidth: 1, borderColor: '#e2e8f0' }, titulo: { fontWeight: '700', fontSize: 17 }, total: { fontWeight: '700', fontSize: 20, marginTop: 12 }, aviso: { color: '#92400e' } });
