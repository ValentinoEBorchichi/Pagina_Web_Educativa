import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAlumnos } from '../context/AlumnosContext';
import SelectorHijos from '../components/SelectorHijos';
import { apiUrl } from '../config';
import { COLORS, FONTS, FONT_SIZE, RADIUS, SHADOW, TEXT } from '../theme';

// Alta y baja de deportes (RF-06/RF-07/cupo, validados por el backend).
// La baja necesita DELETE /api/deportes/desinscribir/:deporte_id?alumno_id=
// con rol padre habilitado -contrato acordado con el backend-: hasta que esa
// parte esté desplegada, el botón de "Dar de baja" puede devolver 403.
export default function DeportesScreen() {
  const { alumnos, alumnoId, alumnoSeleccionado, setAlumnoId, token, recargar: recargarContext } = useAlumnos();
  const [deportes, setDeportes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [accionando, setAccionando] = useState(null); // id del deporte con una acción en curso
  const [mensaje, setMensaje] = useState(null); // { tipo: 'ok' | 'error', texto }

  const cargarDeportes = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const res = await fetch(apiUrl('/api/deportes'), { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json().catch(() => ([]));
      if (!res.ok) throw new Error(data.message || 'No se pudieron cargar los deportes');
      setDeportes(data);
    } catch (e) {
      setError(e.message || 'No se pudieron cargar los deportes');
    } finally {
      setCargando(false);
    }
  }, [token]);

  useFocusEffect(useCallback(() => { cargarDeportes(); }, [cargarDeportes]));

  const idsInscriptos = new Set((alumnoSeleccionado?.deportes || []).map((d) => d.id));

  async function inscribir(deporteId) {
    setMensaje(null);
    setAccionando(deporteId);
    try {
      const res = await fetch(apiUrl('/api/deportes/inscribir'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ alumno_id: alumnoId, deporte_id: deporteId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'No se pudo inscribir');
      setMensaje({ tipo: 'ok', texto: data.message || 'Inscripción confirmada.' });
      await Promise.all([cargarDeportes(), Promise.resolve(recargarContext())]);
    } catch (e) {
      setMensaje({ tipo: 'error', texto: e.message || 'No se pudo inscribir.' });
    } finally {
      setAccionando(null);
    }
  }

  async function darDeBaja(deporteId) {
    setMensaje(null);
    setAccionando(deporteId);
    try {
      const res = await fetch(apiUrl('/api/deportes/desinscribir', { deporteId, alumnoId }), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'No se pudo dar de baja');
      setMensaje({ tipo: 'ok', texto: data.message || 'Baja confirmada.' });
      await Promise.all([cargarDeportes(), Promise.resolve(recargarContext())]);
    } catch (e) {
      setMensaje({ tipo: 'error', texto: e.message || 'No se pudo dar de baja.' });
    } finally {
      setAccionando(null);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contenido}>
      <SelectorHijos alumnos={alumnos} alumnoId={alumnoId} onSeleccionar={setAlumnoId} />

      {mensaje ? (
        <View style={[styles.aviso, mensaje.tipo === 'ok' ? styles.avisoOk : styles.avisoError]}>
          <Text style={[styles.avisoTexto, { color: mensaje.tipo === 'ok' ? COLORS.green : COLORS.danger }]}>{mensaje.texto}</Text>
        </View>
      ) : null}

      {cargando ? <ActivityIndicator size="large" color={COLORS.blue} style={{ marginTop: 20 }} /> : null}

      {error ? (
        <View style={styles.aviso}><Text style={styles.avisoTexto}>{error}</Text></View>
      ) : null}

      {!cargando && !error ? deportes.map((d) => {
        const inscripto = idsInscriptos.has(d.id);
        const sinCupo = Number(d.inscriptos) >= Number(d.cupo_maximo);
        const enCurso = accionando === d.id;
        return (
          <View key={d.id} style={styles.tarjeta}>
            <View style={styles.tarjetaHeader}>
              <View style={styles.iconoChip}>
                <Ionicons name="football" size={20} color={COLORS.green} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={TEXT.cardTitle}>{d.nombre}</Text>
                <Text style={styles.horario}>{d.horario}</Text>
                <Text style={styles.cupo}>{d.inscriptos}/{d.cupo_maximo} inscriptos{sinCupo ? ' · sin cupo' : ''}</Text>
              </View>
            </View>
            <Pressable
              disabled={enCurso || (!inscripto && sinCupo)}
              onPress={() => (inscripto ? darDeBaja(d.id) : inscribir(d.id))}
              style={({ pressed }) => [
                styles.boton,
                inscripto ? styles.botonBaja : styles.botonAlta,
                (enCurso || (!inscripto && sinCupo)) && styles.botonDeshabilitado,
                pressed && styles.botonPresionado,
              ]}
            >
              {enCurso ? (
                <ActivityIndicator color={inscripto ? COLORS.danger : COLORS.white} size="small" />
              ) : (
                <Text style={[styles.botonTexto, inscripto && { color: COLORS.danger }]}>
                  {inscripto ? 'Dar de baja' : sinCupo ? 'Sin cupo' : 'Inscribir'}
                </Text>
              )}
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
  tarjeta: { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: 16, marginBottom: 14, ...SHADOW.sm },
  tarjetaHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  iconoChip: { width: 36, height: 36, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center', marginRight: 10, backgroundColor: `${COLORS.green}1A` },
  horario: { ...TEXT.bodyMuted, marginTop: 2 },
  cupo: { ...TEXT.bodyMuted, fontSize: FONT_SIZE.xs, marginTop: 4 },
  boton: { minHeight: 44, borderRadius: RADIUS.pill, alignItems: 'center', justifyContent: 'center' },
  botonAlta: { backgroundColor: COLORS.blue },
  botonBaja: { backgroundColor: COLORS.white, borderWidth: 1.5, borderColor: COLORS.danger },
  botonDeshabilitado: { opacity: 0.5 },
  botonPresionado: { opacity: 0.8 },
  botonTexto: { color: COLORS.white, fontFamily: FONTS.bodyExtraBold, fontSize: FONT_SIZE.sm },
  aviso: { borderRadius: RADIUS.md, padding: 14, marginBottom: 14, backgroundColor: COLORS.dangerBg, borderWidth: 1, borderColor: COLORS.dangerBorder },
  avisoOk: { backgroundColor: COLORS.successBg, borderColor: COLORS.successBorder },
  avisoError: { backgroundColor: COLORS.dangerBg, borderColor: COLORS.dangerBorder },
  avisoTexto: { fontFamily: FONTS.bodyBold, color: COLORS.danger },
});
