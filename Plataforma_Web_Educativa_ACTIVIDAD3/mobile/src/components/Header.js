import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, FONTS, GRADIENT_HEADER, RADIUS } from '../theme';

// Header institucional reutilizable (mismo diseño que DashboardLayout.jsx en
// la web: degradé azul, logo en una chapa blanca, título en Playfair Display,
// datos del usuario + botón de salir a la derecha). Sirve como `header`
// custom de un Stack/Tab de React Navigation, o embebido directo en una
// pantalla.
export default function Header({ title, subtitle = 'Gestión institucional', userName, userRole, onLogout }) {
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
            <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
          </View>
        </View>

        {(userName || onLogout) && (
          <View style={styles.right}>
            {userName ? (
              <View style={styles.userInfo}>
                <Text style={styles.userName} numberOfLines={1}>{userName}</Text>
                {userRole ? <Text style={styles.userRole} numberOfLines={1}>{userRole}</Text> : null}
              </View>
            ) : null}
            {onLogout ? (
              <Pressable onPress={onLogout} style={({ pressed }) => [styles.logoutBtn, pressed && styles.logoutBtnPressed]}>
                <Text style={styles.logoutText}>Salir</Text>
              </Pressable>
            ) : null}
          </View>
        )}
      </View>
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
    fontSize: 18,
  },
  subtitle: {
    color: COLORS.white,
    opacity: 0.8,
    fontFamily: FONTS.body,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 10,
  },
  userInfo: {
    marginRight: 10,
    alignItems: 'flex-end',
  },
  userName: {
    color: COLORS.white,
    fontFamily: FONTS.bodyExtraBold,
    fontSize: 13,
    maxWidth: 110,
  },
  userRole: {
    color: COLORS.white,
    opacity: 0.8,
    fontFamily: FONTS.body,
    fontSize: 10,
    textTransform: 'uppercase',
  },
  logoutBtn: {
    backgroundColor: COLORS.orange,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.pill,
  },
  logoutBtnPressed: {
    opacity: 0.85,
  },
  logoutText: {
    color: COLORS.white,
    fontFamily: FONTS.bodyExtraBold,
    fontSize: 12,
  },
});
