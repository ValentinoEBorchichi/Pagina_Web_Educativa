import { useState } from 'react';
import { ActivityIndicator, Button, StyleSheet, Text, TextInput, View } from 'react-native';
import { API_URL, SIMULAR_RECUPERACION } from '../config';

// HU2: el padre ingresa su DNI y el backend le envía por correo el token de recuperación.

const DNI_REGEX = /^\d{7,8}$/;
const MENSAJE_ENVIADO = 'Si el DNI está registrado, vas a recibir un correo con las instrucciones.';

async function solicitarRecuperacion(dni) {
  if (SIMULAR_RECUPERACION) {
    await new Promise((resolve) => setTimeout(resolve, 800));
    return { message: MENSAJE_ENVIADO };
  }
  const res = await fetch(`${API_URL}/api/auth/recuperar-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dni }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'No se pudo enviar la solicitud');
  return data;
}

export default function RecuperarPasswordScreen() {
  const [dni, setDni] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');

  const enviar = async () => {
    setError('');
    setMensaje('');
    if (!DNI_REGEX.test(dni)) {
      setError('El DNI debe tener 7 u 8 dígitos numéricos');
      return;
    }
    setCargando(true);
    try {
      const data = await solicitarRecuperacion(dni);
      setMensaje(data.message || MENSAJE_ENVIADO);
    } catch (e) {
      // fetch lanza TypeError cuando no hay conexión con el servidor.
      setError(e instanceof TypeError ? 'No se pudo conectar con el servidor' : e.message);
    } finally {
      setCargando(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Ingresá tu DNI</Text>
      <TextInput
        style={styles.input}
        value={dni}
        onChangeText={(texto) => setDni(texto.replace(/\D/g, ''))}
        keyboardType="number-pad"
        maxLength={8}
        placeholder="Ej: 28456789"
        editable={!cargando}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {mensaje ? <Text style={styles.ok}>{mensaje}</Text> : null}
      {cargando ? <ActivityIndicator /> : <Button title="Enviar" onPress={enviar} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12 },
  label: { fontSize: 16 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 6, padding: 10, fontSize: 16 },
  error: { color: '#b91c1c' },
  ok: { color: '#166534' },
});
