import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { COLORS, FONTS, FONT_SIZE, RADIUS, SHADOW, TEXT } from '../theme';

// Mismo menú hardcodeado que PadreDashboard.jsx (web): el comedor no tiene
// un endpoint propio, es un dato fijo que se repite ahí también.
const MENU_SEMANAL = [
  { dia: 'Lunes', plato: 'Tallarines con salsa bolognesa', postre: 'Fruta de estación' },
  { dia: 'Martes', plato: 'Pollo al horno con puré', postre: 'Gelatina' },
  { dia: 'Miércoles', plato: 'Milanesa de carne con ensalada', postre: 'Flan con dulce' },
  { dia: 'Jueves', plato: 'Arroz con pollo y vegetales', postre: 'Yogur' },
  { dia: 'Viernes', plato: 'Pizza artesanal y empanadas', postre: 'Helado' },
];

export default function MenuSemanalScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contenido}>
      {MENU_SEMANAL.map((m) => (
        <View key={m.dia} style={styles.tarjeta}>
          <Text style={styles.dia}>{m.dia}</Text>
          <Text style={TEXT.body}>{m.plato}</Text>
          <Text style={styles.postre}>Postre: {m.postre}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  contenido: { padding: 16, paddingBottom: 32 },
  tarjeta: { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: 16, marginBottom: 12, ...SHADOW.sm },
  dia: { fontFamily: FONTS.bodyExtraBold, fontSize: FONT_SIZE.md, color: COLORS.orange, marginBottom: 4 },
  postre: { ...TEXT.bodyMuted, fontStyle: 'italic', marginTop: 4 },
});
