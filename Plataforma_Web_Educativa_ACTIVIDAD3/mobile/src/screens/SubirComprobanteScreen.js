import { useState } from 'react';
import { ActivityIndicator, Image, ImageBackground, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { apiUrl } from '../config';

const hoy = () => new Date().toISOString().slice(0, 10);

export default function SubirComprobanteScreen({ route, navigation }) {
  const { factura, token } = route.params;
  const [imagen, setImagen] = useState(null);
  const [monto, setMonto] = useState(String(factura.saldo));
  const [fecha, setFecha] = useState(hoy());
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function elegirImagen() {
    setError('');
    const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permiso.granted) {
      setError('Hace falta permiso para acceder a las fotos.');
      return;
    }
    const resultado = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
    });
    if (!resultado.canceled) setImagen(resultado.assets[0]);
  }

  async function enviar() {
    if (!imagen) return setError('Elegí una imagen del ticket antes de enviarlo.');
    const montoNormalizado = Number(monto.replace(',', '.'));
    if (!Number.isFinite(montoNormalizado) || montoNormalizado <= 0) return setError('Ingresá un monto válido.');
    const fechaParseada = new Date(`${fecha}T00:00:00.000Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || Number.isNaN(fechaParseada.valueOf()) || fechaParseada.toISOString().slice(0, 10) !== fecha) {
      return setError('Ingresá una fecha válida con formato AAAA-MM-DD.');
    }
    if (imagen.fileSize > 5 * 1024 * 1024) return setError('La imagen no puede superar los 5 MB.');

    const tipo = imagen.mimeType || 'image/jpeg';
    if (!['image/jpeg', 'image/png'].includes(tipo)) return setError('Elegí una imagen JPG o PNG.');
    const extension = tipo === 'image/png' ? 'png' : 'jpg';
    const datos = new FormData();
    datos.append('factura_id', String(factura.id));
    datos.append('monto', String(montoNormalizado));
    datos.append('fecha_transferencia', fecha);
    // Expo puede devolver un objeto de asset que React Native no reconoce como
    // parte multipart. Convertimos la URI local a Blob antes de agregarla.
    const archivoLocal = await fetch(imagen.uri);
    const blob = await archivoLocal.blob();
    datos.append('archivo', blob, `ticket.${extension}`);

    setEnviando(true);
    setError('');
    try {
      const respuesta = await fetch(apiUrl('/api/comprobantes'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: datos,
      });
      const contenido = await respuesta.json().catch(() => ({}));
      if (!respuesta.ok) throw new Error(contenido.message || 'No se pudo cargar el ticket.');
      navigation.goBack();
    } catch (e) {
      setError(e.message || 'No se pudo conectar con el servidor.');
    } finally {
      setEnviando(false);
    }
  }

  return <View style={styles.container}>
    <ImageBackground source={{ uri: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=900&q=80' }} style={styles.encabezado} imageStyle={styles.encabezadoImagen}><View style={styles.encabezadoCapa}><Text style={styles.encabezadoTitulo}>Subir comprobante</Text><Text style={styles.encabezadoSubtitulo}>Factura {factura.id} · saldo ${Number(factura.saldo).toFixed(2)}</Text></View></ImageBackground>
    <View style={styles.tarjeta}><Text style={styles.label}>Monto transferido</Text><TextInput accessibilityLabel="Monto transferido" keyboardType="decimal-pad" value={monto} onChangeText={setMonto} style={styles.input} placeholderTextColor="#94a3b8" />
    <Text style={styles.label}>Fecha de transferencia (AAAA-MM-DD)</Text><TextInput accessibilityLabel="Fecha de transferencia" value={fecha} onChangeText={setFecha} style={styles.input} placeholderTextColor="#94a3b8" />
    <Pressable style={styles.botonSecundario} onPress={elegirImagen}><Text style={styles.botonSecundarioTexto}>{imagen ? 'CAMBIAR IMAGEN DEL TICKET' : 'ELEGIR IMAGEN DEL TICKET'}</Text></Pressable>
    {imagen ? <Image source={{ uri: imagen.uri }} style={styles.preview} resizeMode="contain" /> : null}
    {error ? <Text style={styles.error}>{error}</Text> : null}
    {enviando ? <ActivityIndicator color="#1a5fa8" /> : <Pressable style={styles.boton} onPress={enviar}><Text style={styles.botonTexto}>ENVIAR COMPROBANTE</Text></Pressable>}
    <Text style={styles.nota}>Se aceptan imágenes JPG o PNG de hasta 5 MB. La validación del pago queda pendiente.</Text></View>
  </View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 14, backgroundColor: '#f8fafc' }, encabezado: { height: 145, borderRadius: 18, overflow: 'hidden' }, encabezadoImagen: { borderRadius: 18 }, encabezadoCapa: { flex: 1, justifyContent: 'flex-end', padding: 18, backgroundColor: 'rgba(245,130,13,0.7)' }, encabezadoTitulo: { color: '#fff', fontSize: 23, fontWeight: '800' }, encabezadoSubtitulo: { color: '#ffedd5', marginTop: 5 }, tarjeta: { backgroundColor: '#fff', padding: 18, borderRadius: 16, gap: 12 }, label: { color: '#154e8a', fontWeight: '700' }, input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, padding: 13, color: '#0f172a', backgroundColor: '#f8fafc' }, preview: { width: '100%', height: 220, borderRadius: 10 }, boton: { minHeight: 48, borderRadius: 10, backgroundColor: '#1a5fa8', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 }, botonTexto: { color: '#fff', fontWeight: '800', fontSize: 13 }, botonSecundario: { minHeight: 48, borderRadius: 10, backgroundColor: '#fff7ed', borderWidth: 1, borderColor: '#f5820d', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 }, botonSecundarioTexto: { color: '#a44905', fontWeight: '800', fontSize: 13 }, error: { color: '#b91c1c', backgroundColor: '#fef2f2', padding: 10, borderRadius: 8 }, nota: { color: '#64748b', fontSize: 13, lineHeight: 18 },
});
