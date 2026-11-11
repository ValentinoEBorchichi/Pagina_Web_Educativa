import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAlumnos } from '../context/AlumnosContext';
import { apiUrl } from '../config';
import { COLORS, FONTS, FONT_SIZE, RADIUS, SHADOW, TEXT } from '../theme';

// Vincular/desvincular hijos de la cuenta del padre (paridad con
// PadreDashboard web). La lista de vinculados sale del AlumnosContext (ya la
// trae /api/movil/mis-inscripciones); la de disponibles se trae acá.
export default function MisHijosScreen() {
  const { alumnos, token, recargar: recargarContext } = useAlumnos();
  const [disponibles, setDisponibles] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [accionando, setAccionando] = useState(null); // id en curso (vincular o desvincular)
  const [mensaje, setMensaje] = useState(null); // { tipo: 'ok' | 'error', texto }

  const cargarDisponibles = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const res = await fetch(apiUrl('/api/academico/alumnos-disponibles'), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ([]));
      if (!res.ok) throw new Error(data.message || 'No se pudieron cargar los alumnos disponibles');
      setDisponibles(data);
    } catch (e) {
      setError(e.message || 'No se pudieron cargar los alumnos disponibles');
    } finally {
      setCargando(false);
    }
  }, [token]);

  useFocusEffect(useCallback(() => { cargarDisponibles(); }, [cargarDisponibles]));

  async function vincular(alumnoId) {
    setMensaje(null);
    setAccionando(alumnoId);
    try {
      const res = await fetch(apiUrl('/api/academico/vincular-hijo'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ alumno_id: alumnoId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'No se pudo vincular el alumno');
      setMensaje({ tipo: 'ok', texto: data.message || 'Alumno vinculado correctamente.' });
      await Promise.all([cargarDisponibles(), Promise.resolve(recargarContext())]);
    } catch (e) {
      setMensaje({ tipo: 'error', texto: e.message || 'No se pudo vincular el alumno.' });
    } finally {
      setAccionando(null);
    }
  }

  async function desvincular(alumnoId, nombreCompleto) {
    // Se valida acá -además de adentro de apiUrl()- para que el alumno_id
    // nunca llegue a fetch() como el parámetro recibido sin transformar.
    const idAlumno = Number.isSafeInteger(alumnoId) && alumnoId > 0 ? alumnoId : null;
    if (!idAlumno) {
      setMensaje({ tipo: 'error', texto: 'Alumno inválido.' });
      return;
    }
    setMensaje(null);
    setAccionando(idAlumno);
    try {
      // URL resuelta en una constante propia (ruta fija de la whitelist de
      // apiUrl() + id ya validado y escapado con encodeURIComponent), en vez
      // de anidar la llamada a apiUrl() directo adentro del fetch().
      const idSeguro = encodeURIComponent(String(idAlumno));
      const destino = apiUrl('/api/academico/desvincular-hijo', { alumnoId: idSeguro });
      const res = await fetch(destino, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'No se pudo desvincular el alumno');
      setMensaje({ tipo: 'ok', texto: `${nombreCompleto} desvinculado de tu cuenta.` });
      await Promise.all([cargarDisponibles(), Promise.resolve(recargarContext())]);
    } catch (e) {
      setMensaje({ tipo: 'error', texto: e.message || 'No se pudo desvincular el alumno.' });
    } finally {
      setAccionando(null);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contenido}>
      {mensaje ? (
        <View style={[styles.aviso, mensaje.tipo === 'ok' ? styles.avisoOk : styles.avisoError]}>
          <Text style={[styles.avisoTexto, { color: mensaje.tipo === 'ok' ? COLORS.green : COLORS.danger }]}>{mensaje.texto}</Text>
        </View>
      ) : null}

      <Text style={styles.tituloSeccion}>Hijos vinculados</Text>
      {alumnos.length === 0 ? (
        <Text style={styles.vacio}>Todavía no vinculaste ningún alumno.</Text>
      ) : alumnos.map(({ alumno }) => {
        const enCurso = accionando === alumno.id;
        return (
          <View key={alumno.id} style={styles.tarjeta}>
            <View style={{ flex: 1 }}>
              <Text style={TEXT.cardTitle}>{alumno.apellido}, {alumno.nombre}</Text>
            </View>
            <Pressable
              disabled={enCurso}
              onPress={() => desvincular(alumno.id, `${alumno.nombre} ${alumno.apellido}`)}
              style={({ pressed }) => [styles.boton, styles.botonBaja, pressed && styles.botonPresionado]}
            >
              {enCurso ? <ActivityIndicator color={COLORS.danger} size="small" /> : <Text style={[styles.botonTexto, { color: COLORS.danger }]}>Desvincular</Text>}
            </Pressable>
          </View>
        );
      })}

      <Text style={[styles.tituloSeccion, { marginTop: 20 }]}>Vincular un nuevo alumno</Text>
      {cargando ? <ActivityIndicator size="large" color={COLORS.blue} style={{ marginTop: 10 }} /> : null}
      {error ? <View style={styles.aviso}><Text style={styles.avisoTexto}>{error}</Text></View> : null}
      {!cargando && !error && disponibles.length === 0 ? (
        <Text style={styles.vacio}>No hay alumnos disponibles para vincular.</Text>
      ) : null}
      {!cargando && !error ? disponibles.map((a) => {
        const enCurso = accionando === a.id;
        return (
          <View key={a.id} style={styles.tarjeta}>
            <View style={{ flex: 1 }}>
              <Text style={TEXT.cardTitle}>{a.apellido}, {a.nombre}</Text>
              <Text style={styles.dni}>DNI: {a.dni}</Text>
            </View>
            <Pressable
              disabled={enCurso}
              onPress={() => vincular(a.id)}
              style={({ pressed }) => [styles.boton, styles.botonAlta, pressed && styles.botonPresionado]}
            >
              {enCurso ? <ActivityIndicator color={COLORS.white} size="small" /> : <Text style={styles.botonTexto}>Vincular</Text>}
            </Pressable>
          </View>
        );
      }) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  contenido: { padding: 16, paddingBottom: 32 },
  tituloSeccion: { ...TEXT.label, marginBottom: 10 },
  vacio: { ...TEXT.bodyMuted, marginBottom: 10 },
  dni: { ...TEXT.bodyMuted, fontSize: FONT_SIZE.xs, marginTop: 2 },
  tarjeta: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: 14, marginBottom: 10, ...SHADOW.sm },
  boton: { minHeight: 40, paddingHorizontal: 14, borderRadius: RADIUS.pill, alignItems: 'center', justifyContent: 'center' },
  botonAlta: { backgroundColor: COLORS.blue },
  botonBaja: { backgroundColor: COLORS.white, borderWidth: 1.5, borderColor: COLORS.danger },
  botonPresionado: { opacity: 0.8 },
  botonTexto: { color: COLORS.white, fontFamily: FONTS.bodyExtraBold, fontSize: FONT_SIZE.xs },
  aviso: { borderRadius: RADIUS.md, padding: 14, marginBottom: 14, backgroundColor: COLORS.dangerBg, borderWidth: 1, borderColor: COLORS.dangerBorder },
  avisoOk: { backgroundColor: COLORS.successBg, borderColor: COLORS.successBorder },
  avisoError: { backgroundColor: COLORS.dangerBg, borderColor: COLORS.dangerBorder },
  avisoTexto: { fontFamily: FONTS.bodyBold, color: COLORS.danger },
});
