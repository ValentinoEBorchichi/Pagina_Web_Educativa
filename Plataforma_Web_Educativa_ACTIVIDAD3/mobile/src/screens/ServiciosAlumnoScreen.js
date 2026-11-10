import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { apiUrl } from '../config';

// HU4: deportes (máximo 2, RF-06) y transporte (RF-09) vigentes del alumno.
// Parámetros de navegación: { alumnoId }.

const MAX_DEPORTES = 2;

const TEMAS_HIJOS = [
  { fondo: '#1a5fa8', fondoActivo: '#dbeafe', textoActivo: '#154e8a' },
  { fondo: '#2e9d68', fondoActivo: '#dcfce7', textoActivo: '#17603d' },
  { fondo: '#7652a8', fondoActivo: '#f3e8ff', textoActivo: '#5b2f88' },
  { fondo: '#f5820d', fondoActivo: '#ffedd5', textoActivo: '#a44905' },
];

const COLORS = {
  primary: '#1a5fa8',
  primaryDark: '#154e8a',
  accent: '#f5820d',
  background: '#f8fafc',
  surface: '#ffffff',
  text: '#0f172a',
  muted: '#64748b',
  border: '#e2e8f0',
  danger: '#b91c1c',
};

function Accion({ title, onPress, secondary = false }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.accion,
        secondary ? styles.accionSecundaria : styles.accionPrimaria,
        pressed && styles.presionado,
      ]}
    >
      <Text style={secondary ? styles.textoAccionSecundaria : styles.textoAccion}>{title}</Text>
    </Pressable>
  );
}

async function obtenerServicios(token) {
  const res = await fetch(apiUrl('/api/movil/mis-inscripciones'), {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'No se pudieron cargar los servicios');
  if (!data.alumnos?.length) throw new Error('No hay alumnos vinculados a esta cuenta.');
  return data.alumnos;
}

export default function ServiciosAlumnoScreen({ route, navigation, token: tokenProp, onLogout }) {
  const token = tokenProp || route.params?.token;
  const [datos, setDatos] = useState(null);
  const [alumnoId, setAlumnoId] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let cancelado = false;
    setCargando(true);
    setError('');
    obtenerServicios(token)
      .then((alumnos) => {
        if (!cancelado) {
          const seleccionado = alumnos.find((item) => item.alumno.id === alumnoId) || alumnos[0];
          setAlumnoId(seleccionado.alumno.id);
          setDatos({ ...seleccionado, deportes: (seleccionado.deportes || []).slice(0, MAX_DEPORTES), alumnos });
        }
      })
      .catch((e) => {
        if (!cancelado) setError(e.message || 'No se pudieron cargar los servicios');
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });
    return () => {
      cancelado = true;
    };
  }, [token, intento]);

  if (cargando) {
    return <ActivityIndicator style={styles.centro} size="large" />;
  }

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.errorCard}>
          <Text style={styles.errorTitulo}>No pudimos cargar los servicios</Text>
          <Text style={styles.error}>{error}</Text>
          <Accion title="Reintentar" onPress={() => setIntento((n) => n + 1)} />
        </View>
      </View>
    );
  }

  const { alumno, deportes = [], transporte } = datos;
  const indiceAlumno = Math.max(0, (datos.alumnos || []).findIndex((item) => item.alumno.id === alumnoId));
  const temaAlumno = TEMAS_HIJOS[indiceAlumno % TEMAS_HIJOS.length];
  const secciones = [
    {
      titulo: `Deportes (${deportes.length}/${MAX_DEPORTES})`,
      vacio: 'Sin deportes inscriptos',
      data: deportes.map((d) => ({ key: `deporte-${d.id}`, nombre: d.nombre, detalle: d.horario })),
    },
    {
      titulo: 'Transporte',
      vacio: 'No usa transporte escolar',
      data: transporte
        ? [{
            key: `transporte-${transporte.id}`,
            nombre: transporte.nombre,
            detalle: `Recorrido N° ${transporte.numero_recorrido}` +
              (transporte.hora_salida ? ` · Salida ${transporte.hora_salida}` : ''),
          }]
        : [],
    },
    {
      titulo: 'Comedor',
      vacio: datos.comedor ? 'Inscripto al comedor' : 'Sin inscripción al comedor',
      data: [],
    },
  ];

  return (
    <SectionList
      style={styles.container}
      contentContainerStyle={styles.contenido}
      sections={secciones}
      ListHeaderComponent={alumno ? <View>
        <View style={[styles.resumen, { backgroundColor: temaAlumno.fondo }]}>
          <Text style={styles.periodo}>Servicios de {new Date().toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}</Text>
          <Text style={styles.alumno}>{alumno.nombre} {alumno.apellido}</Text>
        </View>
        {(datos.alumnos || []).length > 1 ? <View style={styles.hijos}>
          <Text style={styles.etiqueta}>Seleccioná un alumno</Text>
          {(datos.alumnos || []).map((hijo, indice) => {
            const temaHijo = TEMAS_HIJOS[indice % TEMAS_HIJOS.length];
            const seleccionado = hijo.alumno.id === alumnoId;
            return <Pressable key={hijo.alumno.id} onPress={() => {
          setAlumnoId(hijo.alumno.id);
          setDatos({ ...hijo, deportes: (hijo.deportes || []).slice(0, MAX_DEPORTES), alumnos: datos.alumnos });
          }} style={({ pressed }) => [styles.hijo, seleccionado && { backgroundColor: temaHijo.fondoActivo, borderLeftColor: temaHijo.fondo }, pressed && styles.presionado]}>
            <Text style={[styles.textoHijo, seleccionado && { color: temaHijo.textoActivo }]}>{seleccionado ? '✓ ' : ''}{hijo.alumno.nombre} {hijo.alumno.apellido}</Text>
          </Pressable>;
          })}
        </View> : null}
        <View style={styles.acciones}>
          <Accion title="Ver cuotas e historial" onPress={() => navigation.navigate('Cuenta', { alumnoId, token })} />
          <Accion title="Cambiar contraseña" secondary onPress={() => navigation.navigate('CambiarPassword', { token })} />
          {onLogout ? <Accion title="Cerrar sesión" secondary onPress={onLogout} /> : null}
        </View>
      </View> : null}
      renderSectionHeader={({ section }) => <View style={styles.seccionFila}><Text style={styles.seccion}>{section.titulo}</Text></View>}
      renderSectionFooter={({ section }) =>
        section.data.length === 0 ? <Text style={styles.vacio}>{section.vacio}</Text> : null
      }
      renderItem={({ item }) => (
        <View style={styles.item}>
          <Text style={styles.nombre}>{item.nombre}</Text>
          <Text style={styles.detalle}>{item.detalle}</Text>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  contenido: { padding: 16, paddingBottom: 32 },
  centro: { flex: 1 },
  resumen: { backgroundColor: COLORS.primary, borderRadius: 18, padding: 20, marginBottom: 16 },
  periodo: { color: '#dbeafe', textTransform: 'capitalize', marginBottom: 8, fontSize: 14, fontWeight: '600' },
  alumno: { color: COLORS.surface, fontSize: 24, fontWeight: '800' },
  hijos: { backgroundColor: COLORS.surface, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: COLORS.border, marginBottom: 16 },
  etiqueta: { color: COLORS.muted, fontSize: 13, fontWeight: '700', marginBottom: 8 },
  hijo: { paddingVertical: 12, paddingHorizontal: 14, borderRadius: 10, marginBottom: 6, backgroundColor: '#f1f5f9' },
  hijoActivo: { backgroundColor: '#dbeafe' },
  textoHijo: { color: COLORS.text, fontWeight: '600' },
  textoHijoActivo: { color: COLORS.primaryDark, fontWeight: '800' },
  acciones: { gap: 10, marginBottom: 12 },
  accion: { minHeight: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  accionPrimaria: { backgroundColor: COLORS.primary },
  accionSecundaria: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  textoAccion: { color: COLORS.surface, fontWeight: '800', fontSize: 15 },
  textoAccionSecundaria: { color: COLORS.primaryDark, fontWeight: '800', fontSize: 15 },
  presionado: { opacity: 0.75 },
  seccionFila: { borderBottomWidth: 1, borderBottomColor: COLORS.border, marginTop: 12, marginBottom: 8, paddingBottom: 8 },
  seccion: { color: COLORS.text, fontSize: 18, fontWeight: '800' },
  item: { backgroundColor: COLORS.surface, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, marginBottom: 8 },
  nombre: { color: COLORS.text, fontSize: 16, fontWeight: '700' },
  detalle: { color: COLORS.muted, marginTop: 4 },
  vacio: { color: COLORS.muted, fontStyle: 'italic', paddingVertical: 4 },
  errorCard: { backgroundColor: COLORS.surface, borderRadius: 16, padding: 20, margin: 16, borderWidth: 1, borderColor: '#fecaca' },
  errorTitulo: { color: COLORS.danger, fontSize: 17, fontWeight: '800', marginBottom: 8 },
  error: { color: COLORS.danger, marginBottom: 16 },
});
