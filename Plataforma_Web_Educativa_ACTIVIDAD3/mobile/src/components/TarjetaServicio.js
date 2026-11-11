import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, FONT_SIZE, RADIUS, SHADOW, TEXT } from '../theme';

// Tarjeta moderna reutilizable para cada sección del Home (Deportes, Comedor,
// Notas, Inasistencias): ícono representativo + título en negrita + sombra
// sutil del tema, en vez de la lista plana que había antes.
export default function TarjetaServicio({ icono, color = COLORS.blue, titulo, vacio, children }) {
  const hayContenido = Array.isArray(children) ? children.some(Boolean) : Boolean(children);

  return (
    <View style={styles.tarjeta}>
      <View style={styles.encabezado}>
        <View style={[styles.iconoChip, { backgroundColor: `${color}1A` }]}>
          <Ionicons name={icono} size={20} color={color} />
        </View>
        <Text style={TEXT.cardTitle}>{titulo}</Text>
      </View>
      {hayContenido ? children : <Text style={styles.vacio}>{vacio}</Text>}
    </View>
  );
}

export function FilaServicio({ titulo, detalle }) {
  return (
    <View style={styles.fila}>
      <Text style={styles.filaTitulo}>{titulo}</Text>
      {detalle ? <Text style={styles.filaDetalle}>{detalle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tarjeta: { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: 16, marginBottom: 14, ...SHADOW.sm },
  encabezado: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  iconoChip: { width: 36, height: 36, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  vacio: { ...TEXT.bodyMuted, fontStyle: 'italic' },
  fila: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.bg },
  filaTitulo: { ...TEXT.body, fontFamily: FONTS.bodyBold },
  filaDetalle: { ...TEXT.bodyMuted, marginTop: 2, fontSize: FONT_SIZE.sm },
});
