import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAlumnos } from '../context/AlumnosContext';
import { COLORS, FONTS, RADIUS, SHADOW } from '../theme';

function Opcion({ titulo, descripcion, onPress, danger = false, disabled = false }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.opcion, pressed && !disabled && styles.opcionPresionada, disabled && styles.opcionDeshabilitada]}
    >
      <Text style={[styles.opcionTitulo, danger && { color: COLORS.danger }]}>{titulo}</Text>
      {descripcion ? <Text style={styles.opcionDescripcion}>{descripcion}</Text> : null}
    </Pressable>
  );
}

// Pestaña "Más": todo lo que no entra en Home/Cobranzas/Transporte.
export default function MasScreen({ navigation }) {
  const { token, onLogout } = useAlumnos();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contenido}>
      <View style={styles.seccion}>
        <Text style={styles.tituloSeccion}>Mi cuenta</Text>
        <View style={styles.tarjeta}>
          <Opcion titulo="Cambiar contraseña" descripcion="Actualizá la contraseña de tu cuenta" onPress={() => navigation.navigate('CambiarPassword', { token })} />
        </View>
      </View>

      <View style={styles.seccion}>
        <Text style={styles.tituloSeccion}>Familia</Text>
        <View style={styles.tarjeta}>
          <Opcion titulo="Mis hijos" descripcion="Vincular o desvincular un alumno" onPress={() => navigation.navigate('MisHijos')} />
          <Opcion titulo="Avisos y citaciones" descripcion="Avisos institucionales" onPress={() => navigation.navigate('Avisos')} />
          <Opcion titulo="Menú semanal del comedor" descripcion="Menú de la semana" onPress={() => navigation.navigate('MenuSemanal')} />
        </View>
      </View>

      <View style={styles.seccion}>
        <View style={styles.tarjeta}>
          <Opcion titulo="Cerrar sesión" danger onPress={onLogout} />
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  contenido: { padding: 16, paddingBottom: 32 },
  seccion: { marginBottom: 20 },
  tituloSeccion: { color: COLORS.textSoft, fontFamily: FONTS.bodyExtraBold, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, paddingHorizontal: 4 },
  tarjeta: { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, overflow: 'hidden', ...SHADOW.sm },
  opcion: { paddingVertical: 16, paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: COLORS.bg },
  opcionPresionada: { backgroundColor: COLORS.bg },
  opcionDeshabilitada: { opacity: 0.5 },
  opcionTitulo: { color: COLORS.text, fontFamily: FONTS.bodyBold, fontSize: 15 },
  opcionDescripcion: { color: COLORS.textSoft, fontFamily: FONTS.body, fontSize: 12, marginTop: 2 },
});
