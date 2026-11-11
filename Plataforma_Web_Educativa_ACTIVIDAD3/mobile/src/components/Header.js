import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, FONTS, FONT_SIZE, GRADIENT_HEADER, RADIUS } from '../theme';

// Header institucional reutilizable (mismo diseño que DashboardLayout.jsx en
// la web: degradé azul, logo en una chapa blanca, título en Playfair
// Display). El botón "Salir" va SIEMPRE visible arriba de todo, nunca
// escondido en una pestaña; si se pasa `nombre`, se muestra el saludo
// "Hola, Padre: {nombre}" en una segunda fila, debajo del título.
export default function Header({ title, subtitle, nombre, onLogout }) {
  const insets = useSafeAreaInsets();

  return (
    <LinearGradient colors={GRADIENT_HEADER} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.container, { paddingTop: insets.top + 10 }]}>
      <View style={styles.row}>
        <View style={styles.left}>
          <View style={styles.logoChip}>
            <Image source={require('../../assets/educar-logo.png')} style={styles.logo} resizeMode="contain" />
          </View>
          <View style={styles.textos}>
            <Text style={styles.title} numberOfLines={1}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
          </View>
        </View>

        {onLogout ? (
          <Pressable onPress={onLogout} style={({ pressed }) => [styles.logoutBtn, pressed && styles.logoutBtnPressed]}>
            <Text style={styles.logoutText}>Salir</Text>
          </Pressable>
        ) : null}
      </View>

      {nombre ? (
        <Text style={styles.saludo} numberOfLines={1}>Hola, Padre: {nombre}</Text>
      ) : null}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
  },
  logoChip: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.sm,
    padding: 4,
    marginRight: 10,
  },
  logo: {
    width: 32,
    height: 28,
  },
  textos: {
    flexShrink: 1,
  },
  title: {
    color: COLORS.white,
    fontFamily: FONTS.display,
    fontSize: FONT_SIZE.lg,
  },
  subtitle: {
    color: COLORS.white,
    opacity: 0.85,
    fontFamily: FONTS.bodyBold,
    fontSize: FONT_SIZE.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  logoutBtn: {
    backgroundColor: COLORS.orange,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: RADIUS.pill,
    marginLeft: 10,
  },
  logoutBtnPressed: {
    opacity: 0.85,
  },
  logoutText: {
    color: COLORS.white,
    fontFamily: FONTS.bodyExtraBold,
    fontSize: FONT_SIZE.sm,
  },
  saludo: {
    color: COLORS.white,
    fontFamily: FONTS.bodyExtraBold,
    fontSize: FONT_SIZE.sm,
    marginTop: 10,
  },
});
