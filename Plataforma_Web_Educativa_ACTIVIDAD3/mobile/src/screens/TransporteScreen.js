import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAlumnos } from '../context/AlumnosContext';
import SelectorHijos from '../components/SelectorHijos';
import { COLORS, FONTS, RADIUS, SHADOW } from '../theme';

// Pestaña Transporte: hoy solo muestra el recorrido vigente del hijo
// seleccionado. El alta/baja de transporte (RF-09) se agrega en el próximo
// paso, cuando el backend tenga listo DELETE /api/transporte/desinscribir.
export default function TransporteScreen() {
  const { alumnos, alumnoId, alumnoSeleccionado, setAlumnoId, cargando, error, recargar } = useAlumnos();

  if (cargando) {
    return <ActivityIndicator style={styles.centro} size="large" color={COLORS.blue} />;
  }

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.errorCard}>
          <Text style={styles.errorTitulo}>No pudimos cargar el transporte</Text>
          <Text style={styles.error}>{error}</Text>
          <Text onPress={recargar} style={styles.reintentar}>Reintentar</Text>
        </View>
      </View>
    );
  }

  const transporte = alumnoSeleccionado?.transporte;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contenido}>
      <SelectorHijos alumnos={alumnos} alumnoId={alumnoId} onSeleccionar={setAlumnoId} />

      <View style={styles.tarjeta}>
        <Text style={styles.titulo}>Transporte escolar</Text>
        {transporte ? (
          <>
            <Text style={styles.recorrido}>{transporte.nombre}</Text>
            <Text style={styles.detalle}>Recorrido N° {transporte.numero_recorrido}</Text>
            {transporte.hora_salida ? <Text style={styles.detalle}>Salida: {transporte.hora_salida}</Text> : null}
          </>
        ) : (
          <Text style={styles.vacio}>{alumnoSeleccionado?.alumno?.nombre} no usa transporte escolar.</Text>
        )}
      </View>

      <Text style={styles.proximamente}>Próximamente vas a poder inscribir o dar de baja el transporte directo desde acá.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  centro: { flex: 1, backgroundColor: COLORS.bg },
  contenido: { padding: 16, paddingBottom: 32 },
  tarjeta: { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: 20, ...SHADOW.sm },
  titulo: { color: COLORS.blue, fontFamily: FONTS.display, fontSize: 18, marginBottom: 12 },
  recorrido: { color: COLORS.text, fontFamily: FONTS.bodyExtraBold, fontSize: 17, marginBottom: 4 },
  detalle: { color: COLORS.textSoft, fontFamily: FONTS.body, fontSize: 14, marginTop: 2 },
  vacio: { color: COLORS.textSoft, fontFamily: FONTS.body, fontStyle: 'italic' },
  proximamente: { color: COLORS.textSoft, fontFamily: FONTS.body, fontSize: 12, textAlign: 'center', marginTop: 16 },
  errorCard: { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: 20, margin: 16, borderWidth: 1, borderColor: COLORS.dangerBorder },
  errorTitulo: { color: COLORS.danger, fontSize: 17, fontFamily: FONTS.bodyExtraBold, marginBottom: 8 },
  error: { color: COLORS.danger, marginBottom: 16, fontFamily: FONTS.body },
  reintentar: { color: COLORS.blue, fontFamily: FONTS.bodyExtraBold, textAlign: 'center' },
});
