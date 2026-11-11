// Tema compartido de la app: mismos tokens que frontend/src/index.css (:root),
// para que mobile y web se vean como el mismo producto. Importar siempre de
// acá en vez de redefinir colores sueltos en cada screen.

export const COLORS = {
  blue: '#1a5fa8',
  blueLight: '#2d80d4',
  blueDark: '#154e8a',
  green: '#2da84a',
  orange: '#f5820d',
  violet: '#7c3aed',
  violetLight: '#9d61f2',
  text: '#1e293b',
  textMuted: '#475569',
  textSoft: '#64748b',
  bg: '#f8fafc',
  white: '#ffffff',
  border: '#e2e8f0',
  danger: '#dc2626',
  dangerBg: '#fee2e2',
  dangerBorder: '#fecaca',
  successBg: '#dcfce7',
  successBorder: '#bbf7d0',
};

// Nombres de familia tal como los registra useFonts() en App.js (ver
// @expo-google-fonts/nunito y @expo-google-fonts/playfair-display).
export const FONTS = {
  display: 'PlayfairDisplay_800ExtraBold', // títulos grandes / logo
  displayBold: 'PlayfairDisplay_700Bold',
  body: 'Nunito_400Regular',
  bodySemiBold: 'Nunito_600SemiBold',
  bodyBold: 'Nunito_700Bold',
  bodyExtraBold: 'Nunito_800ExtraBold',
  bodyBlack: 'Nunito_900Black',
};

export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 18,
  xl: 24,
  pill: 50,
};

// React Native separa sombra iOS (shadow*) de Android (elevation); estos
// objetos se spread-ean directo en un style.
export const SHADOW = {
  sm: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: COLORS.blue,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
};

export const GRADIENT_BRAND = [COLORS.blue, COLORS.violet];
export const GRADIENT_HEADER = [COLORS.blue, COLORS.blueLight];

export default { COLORS, FONTS, RADIUS, SHADOW, GRADIENT_BRAND, GRADIENT_HEADER };
