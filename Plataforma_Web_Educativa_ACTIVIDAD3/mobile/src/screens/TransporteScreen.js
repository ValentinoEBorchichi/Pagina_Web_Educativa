import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAlumnos } from '../context/AlumnosContext';
import SelectorHijos from '../components/SelectorHijos';
import { apiUrl } from '../config';
import { COLORS, FONTS, FONT_SIZE, RADIUS, SHADOW, TEXT } from '../theme';

// Transporte escolar (RF-09): recorrido vigente del hijo seleccionado, con
// alta, cambio de recorrido y baja. La baja necesita
// DELETE /api/transporte/desinscribir?alumno_id= -contrato acordado con el
// backend, nuevo-: hasta que esté desplegado, ese botón puede devolver 404.
export default function TransporteScreen() {
  const {
    alumnos, alumnoId, alumnoSeleccionado, setAlumnoId, token,
    cargando, error, recargar: recargarContext,
  } = useAlumnos();
  const [recorridos, setRecorridos] = useState([]);
  const [cargandoRecorridos, setCargandoRecorridos] = useState(true);
  const [errorRecorridos, setErrorRecorridos] = useState('');
  const [accionando, setAccionando] = useState(null);
  const [mensaje, setMensaje] = useState(null);

  const cargarRecorridos = useCallback(async () => {
    setCargandoRecorridos(true);
    setErrorRecorridos('');
    try {
      const res = await fetch(apiUrl('/api/transporte'), { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json().catch(() => ([]));
      if (!res.ok) throw new Error(data.message || 'No se pudieron cargar los recorridos');
      setRecorridos(data);
    } catch (e) {
      setErrorRecorridos(e.message || 'No se pudieron cargar los recorridos');
    } finally {
      setCargandoRecorridos(false);
    }
  }, [token]);

  useFocusEffect(useCallback(() => { cargarRecorridos(); }, [cargarRecorridos]));

  if (cargando) {
    return <ActivityIndicator style={styles.centro} size="large" color={COLORS.blue} />;
  }

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.aviso}><Text style={styles.avisoTexto}>{error}</Text></View>
      </View>
    );
  }

  const transporte = alumnoSeleccionado?.transporte;

  async function inscribir(numeroRecorrido) {
    setMensaje(null);
    setAccionando(numeroRecorrido);
    try {
      const res = await fetch(apiUrl('/api/transporte/inscribir'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ alumno_id: alumnoId, numero_recorrido: numeroRecorrido }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'No se pudo inscribir al transporte');
      setMensaje({ tipo: 'ok', texto: data.message || 'Inscripción confirmada.' });
      await Promise.all([cargarRecorridos(), Promise.resolve(recargarContext())]);
    } catch (e) {
      setMensaje({ tipo: 'error', texto: e.message || 'No se pudo inscribir al transporte.' });
    } finally {
      setAccionando(null);
    }
  }

  async function darDeBaja() {
    setMensaje(null);
    setAccionando('baja');
    try {
      const res = await fetch(apiUrl('/api/transporte/desinscribir', { alumnoId }), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'No se pudo dar de baja el transporte');
      setMensaje({ tipo: 'ok', texto: data.message || 'Baja confirmada.' });
      await Promise.all([cargarRecorridos(), Promise.resolve(recargarContext())]);
    } catch (e) {
      setMensaje({ tipo: 'error', texto: e.message || 'No se pudo dar de baja el transporte.' });
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

      <View style={styles.tarjeta}>
        <Text style={styles.titulo}>Recorrido actual</Text>
        {transporte ? (
          <>
            <Text style={styles.recorrido}>{transporte.nombre}</Text>
            <Text style={styles.detalle}>Recorrido N° {transporte.numero_recorrido}</Text>
            {transporte.hora_salida ? <Text style={styles.detalle}>Salida: {transporte.hora_salida}</Text> : null}
            <Pressable
              disabled={accionando === 'baja'}
              onPress={darDeBaja}
              style={({ pressed }) => [styles.boton, styles.botonBaja, pressed && styles.botonPresionado]}
            >
              {accionando === 'baja'
                ? <ActivityIndicator color={COLORS.danger} size="small" />
                : <Text style={styles.botonTextoBaja}>Dar de baja</Text>}
            </Pressable>
          </>
        ) : (
          <Text style={styles.vacio}>{alumnoSeleccionado?.alumno?.nombre} no usa transporte escolar.</Text>
        )}
      </View>

      <Text style={styles.subtituloLista}>{transporte ? 'Cambiar de recorrido' : 'Recorridos disponibles'}</Text>

      {cargandoRecorridos ? <ActivityIndicator size="large" color={COLORS.blue} style={{ marginTop: 10 }} /> : null}
      {errorRecorridos ? <View style={styles.aviso}><Text style={styles.avisoTexto}>{errorRecorridos}</Text></View> : null}

      {!cargandoRecorridos && !errorRecorridos ? recorridos
        .filter((r) => r.id !== transporte?.id)
        .map((r) => {
          const sinCupo = Number(r.inscriptos) >= Number(r.capacidad);
          const enCurso = accionando === r.numero_recorrido;
          return (
            <View key={r.id} style={styles.tarjeta}>
              <View style={styles.filaRecorrido}>
                <View style={styles.iconoChip}>
                  <Ionicons name="bus" size={20} color={COLORS.blue} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={TEXT.cardTitle}>{r.nombre}</Text>
                  <Text style={styles.detalle}>Recorrido N° {r.numero_recorrido}{r.zona ? ` · ${r.zona}` : ''}</Text>
                  <Text style={styles.cupo}>{r.inscriptos}/{r.capacidad} inscriptos{sinCupo ? ' · sin cupo' : ''}</Text>
                </View>
              </View>
              <Pressable
                disabled={enCurso || sinCupo}
                onPress={() => inscribir(r.numero_recorrido)}
                style={({ pressed }) => [styles.boton, styles.botonAlta, (enCurso || sinCupo) && styles.botonDeshabilitado, pressed && styles.botonPresionado]}
              >
                {enCurso
                  ? <ActivityIndicator color={COLORS.white} size="small" />
                  : <Text style={styles.botonTexto}>{sinCupo ? 'Sin cupo' : transporte ? 'Cambiar a este' : 'Inscribir'}</Text>}
              </Pressable>
            </View>
          );
        }) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  centro: { flex: 1, backgroundColor: COLORS.bg },
  contenido: { padding: 16, paddingBottom: 32 },
  tarjeta: { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: 20, ...SHADOW.sm, marginBottom: 14 },
  titulo: { color: COLORS.blue, fontFamily: FONTS.display, fontSize: FONT_SIZE.lg, marginBottom: 12 },
  subtituloLista: { ...TEXT.sectionTitle, marginBottom: 10, marginTop: 4 },
  recorrido: { color: COLORS.text, fontFamily: FONTS.bodyExtraBold, fontSize: FONT_SIZE.lg, marginBottom: 4 },
  detalle: { color: COLORS.textSoft, fontFamily: FONTS.body, fontSize: FONT_SIZE.sm, marginTop: 2 },
  cupo: { color: COLORS.textSoft, fontFamily: FONTS.body, fontSize: FONT_SIZE.xs, marginTop: 4 },
  vacio: { color: COLORS.textSoft, fontFamily: FONTS.body, fontStyle: 'italic' },
  filaRecorrido: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  iconoChip: { width: 36, height: 36, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center', marginRight: 10, backgroundColor: `${COLORS.blue}1A` },
  boton: { minHeight: 44, borderRadius: RADIUS.pill, alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  botonAlta: { backgroundColor: COLORS.blue },
  botonBaja: { backgroundColor: COLORS.white, borderWidth: 1.5, borderColor: COLORS.danger },
  botonDeshabilitado: { opacity: 0.5 },
  botonPresionado: { opacity: 0.8 },
  botonTexto: { color: COLORS.white, fontFamily: FONTS.bodyExtraBold, fontSize: FONT_SIZE.sm },
  botonTextoBaja: { color: COLORS.danger, fontFamily: FONTS.bodyExtraBold, fontSize: FONT_SIZE.sm },
  aviso: { borderRadius: RADIUS.md, padding: 14, marginBottom: 14, backgroundColor: COLORS.dangerBg, borderWidth: 1, borderColor: COLORS.dangerBorder },
  avisoOk: { backgroundColor: COLORS.successBg, borderColor: COLORS.successBorder },
  avisoError: { backgroundColor: COLORS.dangerBg, borderColor: COLORS.dangerBorder },
  avisoTexto: { fontFamily: FONTS.bodyBold, color: COLORS.danger },
});
