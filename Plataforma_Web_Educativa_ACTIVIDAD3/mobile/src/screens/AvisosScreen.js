import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAlumnos } from '../context/AlumnosContext';
import { apiUrl } from '../config';
import { COLORS, FONTS, FONT_SIZE, RADIUS, SHADOW, TEXT } from '../theme';

// Avisos institucionales (paridad con PadreDashboard web). "Leído" es solo
// estado local -igual que en la web-, no hay endpoint para marcarlo en el
// backend.
export default function AvisosScreen() {
  const { token } = useAlumnos();
  const [avisos, setAvisos] = useState([]);
  const [leidos, setLeidos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  useFocusEffect(useCallback(() => {
    let vigente = true;
    setCargando(true);
    setError('');
    fetch(apiUrl('/api/comunicacion/notificaciones'), { headers: { Authorization: `Bearer ${token}` } })
      .then(async (res) => {
        const data = await res.json().catch(() => ([]));
        if (!res.ok) throw new Error(data.message || 'No se pudieron cargar los avisos');
        if (vigente) setAvisos(data);
      })
      .catch((e) => vigente && setError(e.message || 'No se pudieron cargar los avisos'))
      .finally(() => vigente && setCargando(false));
    return () => { vigente = false; };
  }, [token]));

  const marcarLeido = (id) => setLeidos((actuales) => (actuales.includes(id) ? actuales : [...actuales, id]));

  if (cargando) return <ActivityIndicator size="large" color={COLORS.blue} style={styles.centro} />;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contenido}>
      {error ? <View style={styles.aviso}><Text style={styles.avisoTexto}>{error}</Text></View> : null}
      {!error && avisos.length === 0 ? <Text style={styles.vacio}>No hay avisos nuevos.</Text> : null}
      {avisos.map((a) => {
        const leido = leidos.includes(a.id);
        return (
          <Pressable key={a.id} onPress={() => marcarLeido(a.id)} style={[styles.tarjeta, leido && styles.tarjetaLeida]}>
            <View style={styles.filaTitulo}>
              <Text style={TEXT.cardTitle}>{a.titulo}</Text>
              {!leido ? <View style={styles.chip}><Text style={styles.chipTexto}>NUEVO</Text></View> : null}
            </View>
            <Text style={styles.fecha}>{new Date(a.fecha_envio).toLocaleDateString('es-AR')}</Text>
            <Text style={styles.mensaje}>{a.mensaje}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg }, centro: { flex: 1 },
  contenido: { padding: 16, paddingBottom: 32 },
  vacio: { ...TEXT.bodyMuted },
  tarjeta: { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: 16, marginBottom: 12, borderLeftWidth: 4, borderLeftColor: COLORS.orange, ...SHADOW.sm },
  tarjetaLeida: { borderLeftColor: COLORS.border, opacity: 0.75 },
  filaTitulo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chip: { backgroundColor: COLORS.orange, borderRadius: RADIUS.sm, paddingHorizontal: 6, paddingVertical: 2, marginLeft: 8 },
  chipTexto: { color: COLORS.white, fontFamily: FONTS.bodyExtraBold, fontSize: 9 },
  fecha: { ...TEXT.bodyMuted, fontSize: FONT_SIZE.xs, marginTop: 4 },
  mensaje: { ...TEXT.body, marginTop: 6 },
  aviso: { borderRadius: RADIUS.md, padding: 14, marginBottom: 14, backgroundColor: COLORS.dangerBg, borderWidth: 1, borderColor: COLORS.dangerBorder },
  avisoTexto: { fontFamily: FONTS.bodyBold, color: COLORS.danger },
});
