import { useState } from 'react';
import { ActivityIndicator, Button, Image, StyleSheet, Text, TextInput, View } from 'react-native';
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
    datos.append('archivo', { uri: imagen.uri, name: `ticket.${extension}`, type: tipo });

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
    <Text style={styles.titulo}>Factura {factura.id} · saldo ${Number(factura.saldo).toFixed(2)}</Text>
    <Text>Monto transferido</Text>
    <TextInput accessibilityLabel="Monto transferido" keyboardType="decimal-pad" value={monto} onChangeText={setMonto} style={styles.input} />
    <Text>Fecha de transferencia (AAAA-MM-DD)</Text>
    <TextInput accessibilityLabel="Fecha de transferencia" value={fecha} onChangeText={setFecha} style={styles.input} />
    <Button title={imagen ? 'Cambiar imagen del ticket' : 'Elegir imagen del ticket'} onPress={elegirImagen} />
    {imagen ? <Image source={{ uri: imagen.uri }} style={styles.preview} resizeMode="contain" /> : null}
    {error ? <Text style={styles.error}>{error}</Text> : null}
    {enviando ? <ActivityIndicator /> : <Button title="Enviar comprobante" onPress={enviar} />}
    <Text style={styles.nota}>Se aceptan imágenes JPG o PNG de hasta 5 MB. La validación del pago queda pendiente.</Text>
  </View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 18, gap: 14 },
  titulo: { fontWeight: '700', fontSize: 17 },
  input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 6, padding: 10 },
  preview: { width: '100%', height: 220 },
  error: { color: '#b91c1c' },
  nota: { color: '#64748b', fontSize: 13 },
});
