import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
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
    <View style={styles.decoracion}>
      <View style={[styles.acento, styles.acentoNaranja]} />
      <View style={[styles.acento, styles.acentoVerde]} />
      <View style={[styles.acento, styles.acentoVioleta]} />
    </View>

    <View style={styles.marca}>
      <Image source={require('../../assets/educar-logo.png')} style={styles.logo} resizeMode="contain" />
      <Text style={styles.subtitulo}>Portal de familias</Text>
    </View>

    <View style={styles.tarjeta}>
      <Text style={styles.titulo}>Ingresá a tu cuenta</Text>
      <Text style={styles.descripcion}>Accedé para consultar los servicios y cuotas de tus hijos.</Text>

      <Text style={styles.etiqueta}>Usuario o correo</Text>
      <TextInput
        style={styles.input}
        placeholder="Usuario o correo de la cuenta"
        placeholderTextColor="#94a3b8"
        autoCapitalize="none"
        value={dni}
        onChangeText={setDni}
      />

      <Text style={styles.etiqueta}>Contraseña</Text>
      <TextInput
        style={styles.input}
        placeholder="Ingresá tu contraseña"
        placeholderTextColor="#94a3b8"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        onSubmitEditing={ingresar}
      />

      {error ? <View style={styles.errorCaja}><Text style={styles.error}>{error}</Text></View> : null}

      <Pressable
        style={({ pressed }) => [styles.boton, pressed && styles.botonPresionado]}
        onPress={ingresar}
        disabled={cargando}
      >
        {cargando ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.botonTexto}>INGRESAR</Text>}
      </Pressable>

      <Pressable onPress={() => navigation.navigate('RecuperarPassword')} style={styles.recuperar}>
        <Text style={styles.recuperarTexto}>¿Olvidaste tu contraseña?</Text>
      </Pressable>
    </View>

    <Text style={styles.pie}>Acceso exclusivo para cuentas de padre</Text>
  </View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#f1f6fb' },
  decoracion: { position: 'absolute', top: 0, left: 0, right: 0, height: 9, flexDirection: 'row' },
  acento: { flex: 1 },
  acentoNaranja: { backgroundColor: '#f5820d' },
  acentoVerde: { backgroundColor: '#2e9d68' },
  acentoVioleta: { backgroundColor: '#7652a8' },
  marca: { alignItems: 'center', marginBottom: 24 },
  logo: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1a5fa8', marginBottom: 12, shadowColor: '#154e8a', shadowOpacity: 0.25, shadowRadius: 8, elevation: 5 },
  logoTexto: { color: '#ffffff', fontSize: 38, fontWeight: '800' },
  institucion: { color: '#154e8a', fontSize: 24, fontWeight: '800', textAlign: 'center' },
  subtitulo: { color: '#64748b', fontSize: 15, marginTop: 4 },
  tarjeta: { backgroundColor: '#ffffff', borderRadius: 18, padding: 22, shadowColor: '#0f172a', shadowOpacity: 0.1, shadowRadius: 14, elevation: 4 },
  titulo: { color: '#0f172a', fontSize: 24, fontWeight: '800', marginBottom: 8 },
  descripcion: { color: '#64748b', fontSize: 14, lineHeight: 20, marginBottom: 20 },
  etiqueta: { color: '#154e8a', fontSize: 13, fontWeight: '700', marginBottom: 7 },
  input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 13, fontSize: 16, color: '#0f172a', marginBottom: 16, backgroundColor: '#f8fafc' },
  errorCaja: { borderRadius: 9, padding: 10, marginBottom: 14, backgroundColor: '#fef2f2' },
  error: { color: '#b91c1c', fontSize: 13, lineHeight: 18 },
  boton: { minHeight: 50, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1a5fa8', shadowColor: '#154e8a', shadowOpacity: 0.2, shadowRadius: 5, elevation: 3 },
  botonPresionado: { backgroundColor: '#154e8a', transform: [{ scale: 0.99 }] },
  botonTexto: { color: '#ffffff', fontSize: 15, fontWeight: '800', letterSpacing: 0.5 },
  recuperar: { alignItems: 'center', paddingTop: 18, paddingBottom: 2 },
  recuperarTexto: { color: '#7652a8', fontWeight: '700', fontSize: 14 },
  pie: { textAlign: 'center', color: '#64748b', fontSize: 12, marginTop: 20 },
});
