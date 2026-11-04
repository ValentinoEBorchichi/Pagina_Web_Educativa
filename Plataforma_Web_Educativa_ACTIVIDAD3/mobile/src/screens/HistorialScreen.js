import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { ActivityIndicator, Button, FlatList, Platform, StyleSheet, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { apiUrl } from '../config';

export function HistorialScreen({ route }) {
  const { alumnoId, token } = route.params || {};
  const [facturas, setFacturas] = useState([]);
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [picker, setPicker] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  useFocusEffect(useCallback(() => {
    let vigente = true;
    fetch(apiUrl('/api/facturas', alumnoId), { headers: { Authorization: `Bearer ${token}` } })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || 'No se pudo cargar el historial');
        if (vigente) setFacturas(data.facturas || []);
      }).catch((e) => vigente && setError(e.message))
      .finally(() => vigente && setCargando(false));
    return () => { vigente = false; };
  }, [alumnoId, token]));

  const fechaEnRango = (factura) => {
    const fecha = String(factura.fecha_emision || '').slice(0, 10);
    return (!desde || fecha >= desde) && (!hasta || fecha <= hasta);
  };
  const filtradas = facturas.filter(fechaEnRango);
  const validarFecha = (valor) => !valor || /^\d{4}-\d{2}-\d{2}$/.test(valor);
  const fechaLocal = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

  return <View style={styles.container}>
    <Text>Filtrar por fecha de emisión</Text>
    <View style={styles.filtros}>
      <Button title={desde ? `Desde: ${desde}` : 'Fecha desde'} onPress={() => setPicker('desde')} />
      <Button title={hasta ? `Hasta: ${hasta}` : 'Fecha hasta'} onPress={() => setPicker('hasta')} />
    </View>
    {desde || hasta ? <Button title="Limpiar fechas" onPress={() => { setDesde(''); setHasta(''); }} /> : null}
    {picker ? <DateTimePicker value={new Date(`${(picker === 'desde' ? desde : hasta) || new Date().toISOString().slice(0, 10)}T12:00:00`)}
      mode="date" display={Platform.OS === 'ios' ? 'compact' : 'calendar'} maximumDate={new Date()}
      onChange={(_event, date) => {
        if (date) (picker === 'desde' ? setDesde : setHasta)(fechaLocal(date));
        setPicker('');
      }} /> : null}
    {!validarFecha(desde) || !validarFecha(hasta) || (desde && hasta && desde > hasta) ? <Text style={styles.error}>Ingresá fechas válidas y verificá que «Desde» no sea posterior a «Hasta».</Text> : null}
    {error ? <Text style={styles.error}>{error}</Text> : null}
    {cargando ? <ActivityIndicator /> : null}
    <FlatList contentContainerStyle={styles.lista} data={filtradas} keyExtractor={(item) => String(item.id)}
    ListEmptyComponent={!cargando ? <Text>No hay facturas para ese período.</Text> : null}
    renderItem={({ item }) => <View style={styles.item}>
      <Text style={styles.titulo}>Factura {item.id} · {item.estado}</Text>
      <Text>Emisión: {new Date(item.fecha_emision).toLocaleDateString('es-AR')}</Text>
      <Text>Total ${Number(item.total).toFixed(2)} · Saldo ${Number(item.saldo).toFixed(2)}</Text>
    </View>} />
  </View>;
}

export function ComprobanteProvisorioScreen({ route }) {
  const { conceptos = [], total = 0 } = route.params || {};
  return <View style={styles.container}>
    <Text style={styles.titulo}>Comprobante provisorio</Text>
    <Text>Detalle de selección para presentar al área administrativa:</Text>
    {conceptos.map((d) => <Text key={d.id} style={styles.item}>Factura {d.factura.id} · {d.descripcion} · ${Number(d.subtotal).toFixed(2)}</Text>)}
    <Text style={styles.total}>Total a pagar: ${Number(total).toFixed(2)}</Text>
    <Text style={styles.aviso}>Este comprobante no acredita un pago. Conservá el comprobante de transferencia para su validación.</Text>
  </View>;
}

const styles = StyleSheet.create({ container: { flex: 1, padding: 16, gap: 12 }, lista: { gap: 8 }, filtros: { flexDirection: 'row', justifyContent: 'space-around', gap: 10 }, item: { padding: 12, borderBottomWidth: 1, borderColor: '#e2e8f0' }, titulo: { fontWeight: '700', fontSize: 17 }, total: { fontWeight: '700', fontSize: 20, marginTop: 12 }, aviso: { color: '#92400e' }, error: { color: '#b91c1c' } });
