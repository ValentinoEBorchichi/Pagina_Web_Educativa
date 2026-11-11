import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAlumnos } from '../context/AlumnosContext';
import SelectorHijos from '../components/SelectorHijos';
import AlertaDeuda from '../components/AlertaDeuda';
import TarjetaServicio, { FilaServicio } from '../components/TarjetaServicio';
import { COLORS, FONTS, FONT_SIZE, TEXT } from '../theme';

// Home: selector de hijo, alerta de deuda, y el resumen del hijo
// seleccionado (deportes, comedor, notas e inasistencias) en tarjetas.
// Cobranzas/Transporte/Mi Cuenta tienen sus propias pestañas.
const MAX_DEPORTES = 2;

export default function ServiciosAlumnoScreen({ navigation }) {
  const {
    alumnos, alumnoId, alumnoSeleccionado, setAlumnoId, cargando, error, recargar,
    resumenAlumno, deudaAlumno, cargandoDetalle,
  } = useAlumnos();

  if (cargando) {
    return <ActivityIndicator style={styles.centro} size="large" color={COLORS.blue} />;
  }

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.errorCard}>
          <Text style={styles.errorTitulo}>No pudimos cargar los servicios</Text>
          <Text style={styles.error}>{error}</Text>
          <Text onPress={recargar} style={styles.reintentar}>Reintentar</Text>
        </View>
      </View>
    );
  }

  const alumno = alumnoSeleccionado?.alumno;
  const deportes = (alumnoSeleccionado?.deportes || []).slice(0, MAX_DEPORTES);
  const calificaciones = resumenAlumno?.calificaciones || [];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contenido}>
      <SelectorHijos alumnos={alumnos} alumnoId={alumnoId} onSeleccionar={setAlumnoId} />

      {alumno ? (
        <AlertaDeuda monto={deudaAlumno?.totalAdeudado} cargando={cargandoDetalle} />
      ) : null}

      {cargandoDetalle ? <ActivityIndicator size="small" color={COLORS.blue} style={{ marginBottom: 14 }} /> : null}

      <TarjetaServicio icono="football" color={COLORS.green} titulo={`Deportes (${deportes.length}/${MAX_DEPORTES})`} vacio="Sin deportes inscriptos">
        {deportes.map((d) => <FilaServicio key={d.id} titulo={d.nombre} detalle={d.horario} />)}
      </TarjetaServicio>

      <Pressable onPress={() => navigation.navigate('Deportes')} style={({ pressed }) => [styles.botonGestionar, pressed && styles.botonGestionarPresionado]}>
        <Text style={styles.botonGestionarTexto}>Gestionar deportes (inscribir / dar de baja) →</Text>
      </Pressable>

      <TarjetaServicio icono="restaurant" color={COLORS.orange} titulo="Comedor" vacio={alumnoSeleccionado?.comedor ? null : 'Sin inscripción al comedor'}>
        {alumnoSeleccionado?.comedor ? <FilaServicio titulo="Inscripto al comedor" /> : null}
      </TarjetaServicio>

      <TarjetaServicio icono="ribbon" color={COLORS.violet} titulo="Notas" vacio="Todavía no hay calificaciones cargadas">
        {calificaciones.map((c, i) => (
          <FilaServicio
            key={i}
            titulo={`${c.materia_nombre || 'Materia'}${c.trimestre ? ` · Trim. ${c.trimestre}` : ''}`}
            detalle={`Nota: ${Number(c.nota).toFixed(2)}`}
          />
        ))}
        {resumenAlumno?.promedio != null ? (
          <View style={styles.promedioFila}>
            <Text style={styles.promedioEtiqueta}>Promedio general</Text>
            <Text style={styles.promedioValor}>{resumenAlumno.promedio}</Text>
          </View>
        ) : null}
      </TarjetaServicio>

      <TarjetaServicio icono="calendar" color={COLORS.blue} titulo="Inasistencias" vacio="Todavía no hay asistencia registrada">
        {resumenAlumno && resumenAlumno.total_clases > 0 ? (
          <>
            <FilaServicio titulo="Asistencia" detalle={resumenAlumno.asistencia_pct != null ? `${resumenAlumno.asistencia_pct}%` : '—'} />
            <FilaServicio titulo="Clases totales" detalle={String(resumenAlumno.total_clases)} />
            <FilaServicio titulo="Presentes" detalle={String(resumenAlumno.presentes)} />
            <FilaServicio titulo="Faltas" detalle={String(resumenAlumno.faltas)} />
          </>
        ) : null}
      </TarjetaServicio>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  contenido: { padding: 16, paddingBottom: 32 },
  centro: { flex: 1, backgroundColor: COLORS.bg },
  botonGestionar: { alignItems: 'center', paddingVertical: 12, marginTop: -4, marginBottom: 16 },
  botonGestionarPresionado: { opacity: 0.6 },
  botonGestionarTexto: { color: COLORS.blue, fontFamily: FONTS.bodyExtraBold, fontSize: FONT_SIZE.sm },
  promedioFila: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: COLORS.bg },
  promedioEtiqueta: { ...TEXT.subtitle },
  promedioValor: { fontSize: FONT_SIZE.xl, fontFamily: FONTS.bodyBlack, color: COLORS.blue },
  errorCard: { backgroundColor: COLORS.white, borderRadius: 18, padding: 20, margin: 16, borderWidth: 1, borderColor: COLORS.dangerBorder },
  errorTitulo: { color: COLORS.danger, fontSize: FONT_SIZE.lg, fontFamily: FONTS.bodyExtraBold, marginBottom: 8 },
  error: { color: COLORS.danger, marginBottom: 16, ...TEXT.body },
  reintentar: { color: COLORS.blue, fontFamily: FONTS.bodyExtraBold, textAlign: 'center' },
});
