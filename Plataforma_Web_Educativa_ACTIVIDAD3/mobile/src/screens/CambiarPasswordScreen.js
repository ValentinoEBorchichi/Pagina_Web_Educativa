import { useState } from 'react';
import { ActivityIndicator, ImageBackground, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { apiUrl } from '../config';

const FONDO_EDUCATIVO = 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=900&q=80';

export default function CambiarPasswordScreen({ route }) {
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [repetida, setRepetida] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const guardar = async () => {
    setError(''); setMensaje('');
    if (nueva !== repetida) return setError('Las contraseñas nuevas no coinciden');
    setCargando(true);
    try {
      const response = await fetch(apiUrl('/api/auth/password'), {
        method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${route.params.token}` },
        body: JSON.stringify({ password_actual: actual, password_nueva: nueva }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || 'No se pudo cambiar la contraseña');
      setMensaje(data.message); setActual(''); setNueva(''); setRepetida('');
    } catch (e) { setError(e.message); }
    finally { setCargando(false); }
  };
  return <View style={styles.container}>
    <ImageBackground source={{ uri: FONDO_EDUCATIVO }} style={styles.encabezado} imageStyle={styles.encabezadoImagen}><View style={styles.encabezadoCapa}><Text style={styles.encabezadoTitulo}>Cambiar contraseña</Text><Text style={styles.encabezadoSubtitulo}>Mantené segura tu cuenta</Text></View></ImageBackground>
    <View style={styles.tarjeta}>
      <Text style={styles.descripcion}>Ingresá tu contraseña actual y elegí una nueva para continuar.</Text>
      <TextInput style={styles.input} placeholder="Contraseña actual" placeholderTextColor="#94a3b8" secureTextEntry value={actual} onChangeText={setActual} />
      <TextInput style={styles.input} placeholder="Nueva contraseña (8+, mayúscula, número y símbolo)" placeholderTextColor="#94a3b8" secureTextEntry value={nueva} onChangeText={setNueva} />
      <TextInput style={styles.input} placeholder="Repetir nueva contraseña" placeholderTextColor="#94a3b8" secureTextEntry value={repetida} onChangeText={setRepetida} />
      {error ? <Text style={styles.error}>{error}</Text> : null}{mensaje ? <Text style={styles.ok}>{mensaje}</Text> : null}
      {cargando ? <ActivityIndicator color="#1a5fa8" /> : <Pressable style={styles.boton} onPress={guardar}><Text style={styles.botonTexto}>ACTUALIZAR CONTRASEÑA</Text></Pressable>}
    </View>
  </View>;
}
const styles = StyleSheet.create({ container: { flex: 1, padding: 16, gap: 14, backgroundColor: '#f8fafc' }, encabezado: { height: 145, borderRadius: 18, overflow: 'hidden' }, encabezadoImagen: { borderRadius: 18 }, encabezadoCapa: { flex: 1, justifyContent: 'flex-end', padding: 18, backgroundColor: 'rgba(118,82,168,0.78)' }, encabezadoTitulo: { color: '#fff', fontSize: 23, fontWeight: '800' }, encabezadoSubtitulo: { color: '#f3e8ff', marginTop: 5 }, tarjeta: { backgroundColor: '#fff', padding: 20, borderRadius: 16, gap: 12, shadowColor: '#0f172a', shadowOpacity: 0.08, shadowRadius: 10, elevation: 3 }, descripcion: { color: '#64748b', lineHeight: 20 }, input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, padding: 13, color: '#0f172a', backgroundColor: '#f8fafc' }, boton: { minHeight: 48, borderRadius: 10, backgroundColor: '#1a5fa8', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 }, botonTexto: { color: '#fff', fontWeight: '800', fontSize: 13 }, error: { color: '#b91c1c', backgroundColor: '#fef2f2', padding: 10, borderRadius: 8 }, ok: { color: '#166534', backgroundColor: '#dcfce7', padding: 10, borderRadius: 8 } });
