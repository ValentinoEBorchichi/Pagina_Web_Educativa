import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, FONT_SIZE, RADIUS } from '../theme';

const formatoMonto = (n) => `$${Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Tarjeta de alerta, bien visible arriba del Home: roja si hay deuda
// pendiente (con el monto exacto), verde si la cuenta está al día.
export default function AlertaDeuda({ monto, cargando }) {
  if (cargando) return null;

  const hayDeuda = Number(monto || 0) > 0;

  return (
    <View style={[styles.caja, hayDeuda ? styles.cajaDeuda : styles.cajaAlDia]}>
      <Ionicons name={hayDeuda ? 'alert-circle' : 'checkmark-circle'} size={30} color={hayDeuda ? COLORS.danger : COLORS.green} />
      <View style={styles.textos}>
        <Text style={[styles.titulo, { color: hayDeuda ? COLORS.danger : COLORS.green }]}>
          {hayDeuda ? 'Tiene deuda pendiente' : 'Cuenta al día'}
        </Text>
        <Text style={[styles.monto, { color: hayDeuda ? COLORS.danger : COLORS.green }]}>
          {hayDeuda ? formatoMonto(monto) : '¡Sin saldo pendiente!'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  caja: { flexDirection: 'row', alignItems: 'center', borderRadius: RADIUS.lg, padding: 16, marginBottom: 14, borderWidth: 1 },
  cajaDeuda: { backgroundColor: COLORS.dangerBg, borderColor: COLORS.dangerBorder },
  cajaAlDia: { backgroundColor: COLORS.successBg, borderColor: COLORS.successBorder },
  textos: { marginLeft: 12, flexShrink: 1 },
  titulo: { fontFamily: FONTS.bodyExtraBold, fontSize: FONT_SIZE.sm, textTransform: 'uppercase', letterSpacing: 0.3 },
  monto: { fontFamily: FONTS.bodyBlack, fontSize: FONT_SIZE.xxl, marginTop: 2 },
});
