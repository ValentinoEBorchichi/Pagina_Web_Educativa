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
  text: '#0f172a', // alto contraste (antes #1e293b, se oscureció a pedido)
  textMuted: '#334155',
  textSoft: '#64748b',
  bg: '#f8fafc',
  white: '#ffffff',
  border: '#e2e8f0',
  danger: '#dc2626',
  dangerBg: '#fee2e2',
  dangerBorder: '#fecaca',
  successBg: '#dcfce7',
  successBorder: '#bbf7d0',
  warning: '#ea580c',
  warningBg: '#ffedd5',
  warningBorder: '#fed7aa',
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

// Escala de tamaños (un poco más grande que el default de RN para que se lea
// cómodo en mano, sin llegar a gigante).
export const FONT_SIZE = {
  xs: 12,
  sm: 14,
  md: 16, // tamaño base de texto de cuerpo
  lg: 18,
  xl: 22,
  xxl: 26,
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
    shadowOpacity: 0.06,
    shadowRadius: 5,
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

// Estilos de texto reutilizables: todo título/subtítulo de sección va en
// negrita por defecto (a pedido), así no queda a criterio de cada screen.
export const TEXT = {
  sectionTitle: { fontFamily: FONTS.bodyExtraBold, fontSize: FONT_SIZE.lg, color: COLORS.text },
  cardTitle: { fontFamily: FONTS.bodyExtraBold, fontSize: FONT_SIZE.md, color: COLORS.text },
  subtitle: { fontFamily: FONTS.bodyBold, fontSize: FONT_SIZE.sm, color: COLORS.textMuted },
  label: { fontFamily: FONTS.bodyExtraBold, fontSize: FONT_SIZE.xs, color: COLORS.textSoft, textTransform: 'uppercase', letterSpacing: 0.4 },
  body: { fontFamily: FONTS.body, fontSize: FONT_SIZE.md, color: COLORS.text },
  bodyMuted: { fontFamily: FONTS.body, fontSize: FONT_SIZE.sm, color: COLORS.textSoft },
};

export default { COLORS, FONTS, FONT_SIZE, RADIUS, SHADOW, GRADIENT_BRAND, GRADIENT_HEADER, TEXT };
