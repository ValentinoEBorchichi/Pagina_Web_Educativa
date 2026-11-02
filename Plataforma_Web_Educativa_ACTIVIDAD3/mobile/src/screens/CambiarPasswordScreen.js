import { useState } from 'react';
import { ActivityIndicator, Button, StyleSheet, Text, TextInput, View } from 'react-native';
import { apiUrl } from '../config';

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
    <Text style={styles.titulo}>Cambiar contraseña</Text>
    <TextInput style={styles.input} placeholder="Contraseña actual" secureTextEntry value={actual} onChangeText={setActual} />
    <TextInput style={styles.input} placeholder="Nueva contraseña (8+, mayúscula, número y símbolo)" secureTextEntry value={nueva} onChangeText={setNueva} />
    <TextInput style={styles.input} placeholder="Repetir nueva contraseña" secureTextEntry value={repetida} onChangeText={setRepetida} />
    {error ? <Text style={styles.error}>{error}</Text> : null}{mensaje ? <Text style={styles.ok}>{mensaje}</Text> : null}
    {cargando ? <ActivityIndicator /> : <Button title="Actualizar contraseña" onPress={guardar} />}
  </View>;
}
const styles = StyleSheet.create({ container: { flex: 1, padding: 16, gap: 12 }, titulo: { fontSize: 20, fontWeight: '700' }, input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 6, padding: 10 }, error: { color: '#b91c1c' }, ok: { color: '#166534' } });
