export const dark = {
  // Backgrounds
  background: '#0A0A0F',
  surface: '#12121A',
  border: '#1E1E2E',

  // Accent
  accent: '#7C3AED',
  accentHover: '#9D5CF6',

  // Text
  textPrimary: '#FFFFFF',
  textSecondary: '#A0A0B8',
  textTertiary: '#4A4A6A',
} as const;

export const light = {
  // Backgrounds
  background: '#F3F0FF',
  surface: '#FFFFFF',
  border: '#DDD6FE',

  // Accent
  accent: '#6D28D9',
  accentHover: '#7C3AED',

  // Text
  textPrimary: '#0A0A0F',
  textSecondary: '#4C1D95',
  textTertiary: '#7C3AED',
} as const;

export const typography = {
  // Font weights
  weightLight: '300' as const,
  weightRegular: '400' as const,
  weightMedium: '500' as const,
  weightSemibold: '600' as const,

  // Letter spacing
  letterSpacingBody: 0.5,
  letterSpacingLabel: 1.5,
} as const;

export const layout = {
  // Border radii
  radiusCard: 16,
  radiusButton: 12,
  radiusInput: 8,

  // Spacing (8px base grid)
  space1: 8,
  space2: 16,
  space3: 24,
  space4: 32,
  space5: 40,
  space6: 48,

  // Button
  buttonHeight: 52,
  buttonBorderWidth: 1,
} as const;

export type ColorTheme = typeof dark; // dark and light share the same shape

const theme = { dark, light, typography, layout };
export default theme;
