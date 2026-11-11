import { Pressable, StyleSheet, Text, View } from 'react-native';
import { COLORS, FONTS, RADIUS } from '../theme';

const TEMAS_HIJOS = [
  { fondo: COLORS.blue, fondoActivo: '#dbeafe', textoActivo: COLORS.blueDark },
  { fondo: COLORS.green, fondoActivo: '#dcfce7', textoActivo: '#17603d' },
  { fondo: COLORS.violet, fondoActivo: '#f3e8ff', textoActivo: '#5b2f88' },
  { fondo: COLORS.orange, fondoActivo: '#ffedd5', textoActivo: '#a44905' },
];

export function temaHijo(indice) {
  return TEMAS_HIJOS[indice % TEMAS_HIJOS.length];
}

// Picker de "cuál hijo" compartido por Home/Transporte/Cobranzas, para que
// cambiar de hijo en una pestaña se vea reflejado en las demás (comparten
// el mismo AlumnosContext).
export default function SelectorHijos({ alumnos, alumnoId, onSeleccionar }) {
  if (!alumnos || alumnos.length < 2) return null;

  return (
    <View style={styles.contenedor}>
      <Text style={styles.etiqueta}>Seleccioná un alumno</Text>
      {alumnos.map((item, indice) => {
        const tema = temaHijo(indice);
        const seleccionado = item.alumno.id === alumnoId;
        return (
          <Pressable
            key={item.alumno.id}
            onPress={() => onSeleccionar(item.alumno.id)}
            style={({ pressed }) => [
              styles.item,
              seleccionado && { backgroundColor: tema.fondoActivo, borderLeftColor: tema.fondo, borderLeftWidth: 4 },
              pressed && styles.presionado,
            ]}
          >
            <Text style={[styles.texto, seleccionado && { color: tema.textoActivo, fontFamily: FONTS.bodyExtraBold }]}>
              {seleccionado ? '✓ ' : ''}{item.alumno.nombre} {item.alumno.apellido}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { backgroundColor: COLORS.white, borderRadius: RADIUS.md, padding: 12, borderWidth: 1, borderColor: COLORS.border, marginBottom: 16 },
  etiqueta: { color: COLORS.textSoft, fontFamily: FONTS.bodyBold, fontSize: 13, marginBottom: 8 },
  item: { paddingVertical: 12, paddingHorizontal: 14, borderRadius: RADIUS.sm, marginBottom: 6, backgroundColor: COLORS.bg },
  texto: { color: COLORS.text, fontFamily: FONTS.bodySemiBold },
  presionado: { opacity: 0.75 },
});
