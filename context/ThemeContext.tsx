import React, { createContext, useContext } from 'react';
import { useColorScheme } from 'react-native';
import { dark, light, typography, layout, type ColorTheme } from '../constants/theme';

interface ThemeContextValue {
  colors: ColorTheme;
  typography: typeof typography;
  layout: typeof layout;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const scheme = useColorScheme();
  const isDark = scheme !== 'light';

  const value: ThemeContextValue = {
    colors: isDark ? dark : light,
    typography,
    layout,
    isDark,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
