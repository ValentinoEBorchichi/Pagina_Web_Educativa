import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { ActivityIndicator, ImageBackground, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { apiUrl } from '../config';

const FONDO_EDUCATIVO = 'https://images.unsplash.com/photo-1509062522246-3755977927d7?w=900&q=80';

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
  if (error) return <View style={styles.container}><View style={styles.errorCard}><Text style={styles.error}>{error}</Text><Pressable style={styles.boton} onPress={() => navigation.goBack()}><Text style={styles.botonTexto}>VOLVER</Text></Pressable></View></View>;

  return <ScrollView contentContainerStyle={styles.container}>
    <ImageBackground source={{ uri: FONDO_EDUCATIVO }} style={styles.encabezado} imageStyle={styles.encabezadoImagen}>
      <View style={styles.encabezadoCapa}><Text style={styles.encabezadoTitulo}>Cuotas e historial</Text><Text style={styles.encabezadoSubtitulo}>Consultá el estado de cuenta y tus comprobantes</Text></View>
    </ImageBackground>
    <View style={styles.totalCard}><Text style={styles.totalLabel}>Deuda total</Text><Text style={styles.total}>${Number(cuenta?.total_adeudado || 0).toFixed(2)}</Text></View>
    {facturas.length === 0 ? <Text>No hay facturas registradas.</Text> : facturas.map((factura) => {
      const pagable = Number(factura.saldo) > 0 && factura.estado !== 'Anulada';
      return <View key={factura.id} style={styles.card}>
        <Text style={styles.titulo}>Factura {factura.id}</Text>
        <Text style={styles.periodo}>{new Date(factura.periodo).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}</Text>
        <Text style={styles.estado}>Estado: {factura.estado} · Saldo: ${Number(factura.saldo).toFixed(2)}</Text>
        {(factura.detalles || []).map((detalle) => <View key={detalle.id} style={styles.linea}>
          <View style={styles.textos}><Text style={styles.detalle}>{detalle.descripcion}</Text><Text>${Number(detalle.subtotal).toFixed(2)}</Text></View>
          {pagable ? <Switch accessibilityLabel={`Seleccionar ${detalle.descripcion}`} value={Boolean(seleccionadas[detalle.id])}
            onValueChange={(valor) => setSeleccionadas((actuales) => ({ ...actuales, [detalle.id]: valor }))} /> : null}
        </View>)}
          {pagable ? <Pressable style={styles.boton} onPress={() => navigation.navigate('SubirComprobante', { factura, token })}><Text style={styles.botonTexto}>SUBIR COMPROBANTE</Text></Pressable> : null}
      </View>;
    })}
    <View style={styles.seleccionCard}><Text style={styles.seleccionLabel}>Conceptos seleccionados</Text><Text style={styles.total}>${totalSeleccionado.toFixed(2)}</Text></View>
    <Text style={styles.aviso}>El comprobante es provisorio y no confirma el pago. El pago se acredita al validar la transferencia.</Text>
    <Pressable style={[styles.boton, !Object.values(seleccionadas).some(Boolean) && styles.botonDeshabilitado]} disabled={!Object.values(seleccionadas).some(Boolean)} onPress={() => navigation.navigate('ComprobanteProvisorio', {
      conceptos: conceptos.filter((d) => seleccionadas[d.id]), total: totalSeleccionado,
    })}><Text style={styles.botonTexto}>GENERAR COMPROBANTE PROVISORIO</Text></Pressable>
    <Pressable style={styles.botonSecundario} onPress={() => navigation.navigate('Historial', { alumnoId, token })}><Text style={styles.botonSecundarioTexto}>VER HISTORIAL</Text></Pressable>
  </ScrollView>;
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12, backgroundColor: '#f8fafc' }, centro: { flex: 1 },
  encabezado: { height: 150, borderRadius: 18, overflow: 'hidden' }, encabezadoImagen: { borderRadius: 18 }, encabezadoCapa: { flex: 1, justifyContent: 'flex-end', padding: 18, backgroundColor: 'rgba(21,78,138,0.78)' }, encabezadoTitulo: { color: '#fff', fontSize: 24, fontWeight: '800' }, encabezadoSubtitulo: { color: '#dbeafe', marginTop: 5 },
  totalCard: { backgroundColor: '#dbeafe', borderRadius: 14, padding: 16, borderLeftWidth: 5, borderLeftColor: '#1a5fa8' }, totalLabel: { color: '#154e8a', fontWeight: '700' }, total: { color: '#0f172a', fontSize: 22, fontWeight: '800' },
  card: { padding: 16, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 14, gap: 8, marginBottom: 2, backgroundColor: '#fff' }, titulo: { color: '#154e8a', fontWeight: '800', fontSize: 17 }, periodo: { color: '#64748b', textTransform: 'capitalize' }, estado: { color: '#334155', fontWeight: '600' }, linea: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#f1f5f9' }, textos: { flex: 1 }, detalle: { color: '#334155', fontWeight: '600' },
  seleccionCard: { backgroundColor: '#f3e8ff', borderRadius: 14, padding: 16, borderLeftWidth: 5, borderLeftColor: '#7652a8' }, seleccionLabel: { color: '#5b2f88', fontWeight: '700', marginBottom: 4 }, aviso: { color: '#92400e', backgroundColor: '#fff7ed', padding: 12, borderRadius: 10 }, boton: { minHeight: 46, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, backgroundColor: '#1a5fa8', marginTop: 4 }, botonTexto: { color: '#fff', fontWeight: '800', fontSize: 13, textAlign: 'center' }, botonDeshabilitado: { opacity: 0.45 }, botonSecundario: { minHeight: 46, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#1a5fa8' }, botonSecundarioTexto: { color: '#154e8a', fontWeight: '800', fontSize: 13 }, errorCard: { backgroundColor: '#fff', padding: 18, borderRadius: 14, gap: 12 }, error: { color: '#b91c1c', fontWeight: '600' },
});
