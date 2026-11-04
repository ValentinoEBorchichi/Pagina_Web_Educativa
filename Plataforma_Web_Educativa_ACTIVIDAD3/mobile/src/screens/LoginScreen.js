import { useState } from 'react';
import { ActivityIndicator, Button, StyleSheet, Text, TextInput, View } from 'react-native';
import { apiUrl } from '../config';

export default function LoginScreen({ navigation, onLogin }) {
  const [dni, setDni] = useState('');
  const [password, setPassword] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  async function ingresar() {
    setError('');
    if (!dni.trim() || !password) return setError('Ingresá tu DNI o usuario y tu contraseña.');
    setCargando(true);
    try {
      const response = await fetch(apiUrl('/api/auth/login'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: dni.trim(), password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || 'No se pudo iniciar sesión.');
      if (data.user?.rol !== 'padre') throw new Error('El acceso móvil está disponible para cuentas de padre. Usá el usuario o correo de tu cuenta.');
      await onLogin(data.token);
    } catch (e) {
      setError(e instanceof TypeError ? 'No se pudo conectar con el servidor.' : e.message);
    } finally { setCargando(false); }
  }

  return <View style={styles.container}>
    <Text style={styles.titulo}>Ingresá a tu cuenta</Text>
    <TextInput style={styles.input} placeholder="DNI o correo de la cuenta" autoCapitalize="none" value={dni} onChangeText={setDni} />
    <TextInput style={styles.input} placeholder="Contraseña" secureTextEntry value={password} onChangeText={setPassword} onSubmitEditing={ingresar} />
    {error ? <Text style={styles.error}>{error}</Text> : null}
    {cargando ? <ActivityIndicator /> : <Button title="Ingresar" onPress={ingresar} />}
    <Button title="¿Olvidó su contraseña?" onPress={() => navigation.navigate('RecuperarPassword')} />
  </View>;
}

const styles = StyleSheet.create({ container: { flex: 1, justifyContent: 'center', padding: 24, gap: 14 }, titulo: { fontSize: 24, fontWeight: '700', marginBottom: 8 }, input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 12, fontSize: 16 }, error: { color: '#b91c1c' } });
