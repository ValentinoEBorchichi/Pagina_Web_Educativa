import { useState } from 'react';
import { ActivityIndicator, ImageBackground, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { apiUrl, SIMULAR_RECUPERACION } from '../config';

const FONDO_EDUCATIVO = 'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=900&q=80';

// HU2: el padre ingresa su DNI y el backend le envía por correo el token de recuperación.

const DNI_REGEX = /^\d{7,8}$/;
const MENSAJE_ENVIADO = 'Si el DNI está registrado, vas a recibir un correo con las instrucciones.';

async function solicitarRecuperacion(dni) {
  if (SIMULAR_RECUPERACION) {
    await new Promise((resolve) => setTimeout(resolve, 800));
    return { message: MENSAJE_ENVIADO };
  }
  const res = await fetch(apiUrl('/api/auth/recuperar-password'), {
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
  const [token, setToken] = useState('');
  const [nueva, setNueva] = useState('');
  const [repetida, setRepetida] = useState('');
  const [codigoEnviado, setCodigoEnviado] = useState(false);

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
      setCodigoEnviado(true);
    } catch (e) {
      // fetch lanza TypeError cuando no hay conexión con el servidor.
      setError(e instanceof TypeError ? 'No se pudo conectar con el servidor' : e.message);
    } finally {
      setCargando(false);
    }
  };

  const restablecer = async () => {
    setError(''); setMensaje('');
    if (nueva !== repetida) return setError('Las contraseñas no coinciden.');
    setCargando(true);
    try {
      const res = await fetch(apiUrl('/api/auth/restablecer-password'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password_nueva: nueva }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'No se pudo cambiar la contraseña.');
      setMensaje(data.message || 'Contraseña actualizada. Ya podés iniciar sesión.');
      setCodigoEnviado(false); setDni(''); setToken(''); setNueva(''); setRepetida('');
    } catch (e) { setError(e instanceof TypeError ? 'No se pudo conectar con el servidor.' : e.message); }
    finally { setCargando(false); }
  };

  return (
    <View style={styles.container}>
      <ImageBackground source={{ uri: FONDO_EDUCATIVO }} style={styles.encabezado} imageStyle={styles.encabezadoImagen}><View style={styles.encabezadoCapa}><Text style={styles.encabezadoTitulo}>Recuperar contraseña</Text><Text style={styles.encabezadoSubtitulo}>Te ayudamos a recuperar el acceso</Text></View></ImageBackground>
      <View style={styles.tarjeta}>
      <Text style={styles.descripcion}>Ingresá el DNI del alumno asociado a tu cuenta para recibir las instrucciones.</Text>
      <Text style={styles.label}>DNI del alumno</Text>
      <TextInput
        style={styles.input}
        value={dni}
        onChangeText={(texto) => setDni(texto.replace(/\D/g, ''))}
        keyboardType="number-pad"
        maxLength={8}
        placeholder="Ej: 28456789"
        editable={!cargando}
      />
      {codigoEnviado ? <>
        <Text style={styles.label}>Código recibido por correo</Text>
        <TextInput style={styles.input} value={token} onChangeText={setToken} autoCapitalize="none" placeholder="Código de recuperación" editable={!cargando} />
        <Text style={styles.label}>Nueva contraseña</Text>
        <TextInput style={styles.input} value={nueva} onChangeText={setNueva} secureTextEntry placeholder="8+ caracteres, mayúscula, número y símbolo" editable={!cargando} />
        <TextInput style={styles.input} value={repetida} onChangeText={setRepetida} secureTextEntry placeholder="Repetí la nueva contraseña" editable={!cargando} />
      </> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {mensaje ? <Text style={styles.ok}>{mensaje}</Text> : null}
      {cargando ? <ActivityIndicator color="#1a5fa8" /> : <Pressable style={styles.boton} onPress={codigoEnviado ? restablecer : enviar}><Text style={styles.botonTexto}>{codigoEnviado ? 'CAMBIAR CONTRASEÑA' : 'ENVIAR CÓDIGO'}</Text></Pressable>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 14, backgroundColor: '#f8fafc' },
  encabezado: { height: 145, borderRadius: 18, overflow: 'hidden' }, encabezadoImagen: { borderRadius: 18 }, encabezadoCapa: { flex: 1, justifyContent: 'flex-end', padding: 18, backgroundColor: 'rgba(46,157,104,0.8)' }, encabezadoTitulo: { color: '#fff', fontSize: 23, fontWeight: '800' }, encabezadoSubtitulo: { color: '#dcfce7', marginTop: 5 },
  tarjeta: { backgroundColor: '#fff', padding: 20, borderRadius: 16, gap: 12, shadowColor: '#0f172a', shadowOpacity: 0.08, shadowRadius: 10, elevation: 3 }, descripcion: { color: '#64748b', lineHeight: 20 }, label: { color: '#154e8a', fontSize: 14, fontWeight: '700' },
  input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, padding: 13, fontSize: 16, color: '#0f172a', backgroundColor: '#f8fafc' },
  boton: { minHeight: 48, borderRadius: 10, backgroundColor: '#1a5fa8', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 }, botonTexto: { color: '#fff', fontWeight: '800', fontSize: 13 }, error: { color: '#b91c1c', backgroundColor: '#fef2f2', padding: 10, borderRadius: 8 }, ok: { color: '#166534', backgroundColor: '#dcfce7', padding: 10, borderRadius: 8 },
});
