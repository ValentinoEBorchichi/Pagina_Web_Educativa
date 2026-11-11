import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { ActivityIndicator, FlatList, ImageBackground, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { apiUrl } from '../config';
import { descargarYAbrirPdf } from '../utils/pdf';

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
    <ImageBackground source={{ uri: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=900&q=80' }} style={styles.encabezado} imageStyle={styles.encabezadoImagen}><View style={styles.encabezadoCapa}><Text style={styles.encabezadoTitulo}>Historial de facturas</Text><Text style={styles.encabezadoSubtitulo}>Consultá tus movimientos y estados de cuenta</Text></View></ImageBackground>
    <View style={styles.filtroCard}><Text style={styles.label}>Filtrar por fecha de emisión</Text>
    <View style={styles.filtros}>
      <Pressable style={styles.botonFiltro} onPress={() => setPicker('desde')}><Text style={styles.botonFiltroTexto}>{desde ? `Desde: ${desde}` : 'Fecha desde'}</Text></Pressable>
      <Pressable style={styles.botonFiltro} onPress={() => setPicker('hasta')}><Text style={styles.botonFiltroTexto}>{hasta ? `Hasta: ${hasta}` : 'Fecha hasta'}</Text></Pressable>
    </View>
    {desde || hasta ? <Pressable onPress={() => { setDesde(''); setHasta(''); }}><Text style={styles.limpiar}>Limpiar fechas</Text></Pressable> : null}
    </View>
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
    ListEmptyComponent={!cargando ? <Text style={styles.vacio}>No hay facturas para ese período.</Text> : null}
    renderItem={({ item }) => <View style={styles.item}>
      <View style={styles.filaTitulo}><Text style={styles.titulo}>Factura {item.id}</Text><Text style={styles.estado}>{item.estado}</Text></View>
      <Text style={styles.detalle}>Emisión: {new Date(item.fecha_emision).toLocaleDateString('es-AR')}</Text>
      <Text style={styles.monto}>Total ${Number(item.total).toFixed(2)} · Saldo ${Number(item.saldo).toFixed(2)}</Text>
      <Pressable onPress={() => descargarYAbrirPdf(apiUrl('/api/financiero/facturas/pdf', { facturaId: item.id }), token, `factura_${item.id}.pdf`)}>
        <Text style={styles.enlacePdf}>Descargar / Imprimir factura</Text>
      </Pressable>
    </View>} />
  </View>;
}

export function ComprobanteProvisorioScreen({ route }) {
  const { conceptos = [], total = 0 } = route.params || {};
  return <View style={styles.container}>
    <ImageBackground source={{ uri: 'https://images.unsplash.com/photo-1509062522246-3755977927d7?w=900&q=80' }} style={styles.encabezado} imageStyle={styles.encabezadoImagen}><View style={styles.encabezadoCapa}><Text style={styles.encabezadoTitulo}>Comprobante provisorio</Text><Text style={styles.encabezadoSubtitulo}>Detalle para presentar al área administrativa</Text></View></ImageBackground>
    <View style={styles.resumenCard}>{conceptos.map((d) => <View key={d.id} style={styles.concepto}><Text style={styles.conceptoNombre}>{d.descripcion}</Text><Text style={styles.conceptoDetalle}>Factura {d.factura.id} · ${Number(d.subtotal).toFixed(2)}</Text></View>)}
    <View style={styles.totalCard}><Text style={styles.totalLabel}>Total a pagar</Text><Text style={styles.total}>${Number(total).toFixed(2)}</Text></View></View>
    <Text style={styles.aviso}>Este comprobante no acredita un pago. Conservá el comprobante de transferencia para su validación.</Text>
  </View>;
}

const styles = StyleSheet.create({ container: { flex: 1, padding: 16, gap: 12, backgroundColor: '#f8fafc' }, encabezado: { height: 145, borderRadius: 18, overflow: 'hidden' }, encabezadoImagen: { borderRadius: 18 }, encabezadoCapa: { flex: 1, justifyContent: 'flex-end', padding: 18, backgroundColor: 'rgba(21,78,138,0.7)' }, encabezadoTitulo: { color: '#fff', fontSize: 23, fontWeight: '800' }, encabezadoSubtitulo: { color: '#dbeafe', marginTop: 5 }, filtroCard: { backgroundColor: '#fff', padding: 14, borderRadius: 14, gap: 10 }, label: { color: '#154e8a', fontWeight: '700' }, lista: { gap: 8 }, filtros: { flexDirection: 'row', gap: 10 }, botonFiltro: { flex: 1, minHeight: 42, borderRadius: 9, borderWidth: 1, borderColor: '#1a5fa8', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 }, botonFiltroTexto: { color: '#154e8a', fontWeight: '700', fontSize: 12 }, limpiar: { color: '#7652a8', fontWeight: '700', textAlign: 'center' }, item: { padding: 15, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 14, backgroundColor: '#fff', gap: 6 }, filaTitulo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, titulo: { color: '#154e8a', fontWeight: '800', fontSize: 17 }, estado: { color: '#17603d', backgroundColor: '#dcfce7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, fontSize: 12, fontWeight: '800' }, detalle: { color: '#64748b' }, monto: { color: '#0f172a', fontWeight: '700' }, enlacePdf: { color: '#7652a8', fontWeight: '700', fontSize: 12, marginTop: 6 }, totalCard: { marginTop: 12, backgroundColor: '#f3e8ff', borderRadius: 12, padding: 14, borderLeftWidth: 5, borderLeftColor: '#7652a8' }, totalLabel: { color: '#5b2f88', fontWeight: '700' }, total: { color: '#0f172a', fontWeight: '800', fontSize: 22 }, resumenCard: { backgroundColor: '#fff', padding: 14, borderRadius: 14 }, concepto: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }, conceptoNombre: { color: '#154e8a', fontWeight: '800' }, conceptoDetalle: { color: '#64748b', marginTop: 3 }, aviso: { color: '#92400e', backgroundColor: '#fff7ed', padding: 12, borderRadius: 10 }, vacio: { color: '#64748b', textAlign: 'center', padding: 20 }, error: { color: '#b91c1c', backgroundColor: '#fef2f2', padding: 10, borderRadius: 8 } });
