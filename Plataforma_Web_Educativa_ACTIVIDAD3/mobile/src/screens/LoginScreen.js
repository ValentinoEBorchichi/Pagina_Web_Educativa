import { useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { apiUrl } from '../config';
import { COLORS, FONTS, GRADIENT_BRAND, RADIUS, SHADOW } from '../theme';

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

  return (
    <LinearGradient colors={GRADIENT_BRAND} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fondo}>
      <View style={[styles.circulo, styles.circuloArriba]} />
      <View style={[styles.circulo, styles.circuloAbajo]} />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flexCentro}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.marca}>
            <Image source={require('../../assets/educar-logo.png')} style={styles.logo} resizeMode="contain" />
            <Text style={styles.subtituloMarca}>Portal de familias</Text>
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
              {cargando ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.botonTexto}>INGRESAR →</Text>}
            </Pressable>

            <Pressable onPress={() => navigation.navigate('RecuperarPassword')} style={styles.recuperar}>
              <Text style={styles.recuperarTexto}>¿Olvidaste tu contraseña?</Text>
            </Pressable>
          </View>

          <Text style={styles.pie}>Acceso exclusivo para cuentas de padre</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  fondo: { flex: 1 },
  circulo: { position: 'absolute', width: 260, height: 260, borderRadius: 260, backgroundColor: 'rgba(255,255,255,0.06)' },
  circuloArriba: { top: -80, left: -80 },
  circuloAbajo: { bottom: -100, right: -80 },
  flexCentro: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  marca: { alignItems: 'center', marginBottom: 24 },
  logo: { width: 110, height: 95, marginBottom: 8 },
  subtituloMarca: { color: COLORS.white, opacity: 0.85, fontFamily: FONTS.bodySemiBold, fontSize: 14 },
  tarjeta: { backgroundColor: COLORS.white, borderRadius: RADIUS.xl, padding: 24, ...SHADOW.md },
  titulo: { color: COLORS.blue, fontFamily: FONTS.display, fontSize: 24, marginBottom: 6 },
  descripcion: { color: COLORS.textSoft, fontFamily: FONTS.body, fontSize: 14, lineHeight: 20, marginBottom: 20 },
  etiqueta: { color: COLORS.textSoft, fontFamily: FONTS.bodyExtraBold, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 7 },
  input: {
    borderWidth: 2, borderColor: COLORS.border, borderRadius: RADIUS.sm, paddingHorizontal: 14, paddingVertical: 13,
    fontSize: 16, fontFamily: FONTS.body, color: COLORS.text, marginBottom: 16, backgroundColor: COLORS.bg,
  },
  errorCaja: { borderRadius: RADIUS.sm, padding: 10, marginBottom: 14, backgroundColor: COLORS.dangerBg, borderWidth: 1, borderColor: COLORS.dangerBorder },
  error: { color: COLORS.danger, fontFamily: FONTS.bodySemiBold, fontSize: 13, lineHeight: 18 },
  boton: {
    minHeight: 52, borderRadius: RADIUS.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.violet,
    shadowColor: COLORS.violet, shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 4,
  },
  botonPresionado: { backgroundColor: '#6d28d9' },
  botonTexto: { color: COLORS.white, fontSize: 15, fontFamily: FONTS.bodyExtraBold, letterSpacing: 0.5 },
  recuperar: { alignItems: 'center', paddingTop: 18, paddingBottom: 2 },
  recuperarTexto: { color: COLORS.violet, fontFamily: FONTS.bodyBold, fontSize: 14 },
  pie: { textAlign: 'center', color: COLORS.white, opacity: 0.8, fontFamily: FONTS.body, fontSize: 12, marginTop: 20 },
});
