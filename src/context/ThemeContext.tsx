import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Preferences } from '@capacitor/preferences';

type Theme = 'light' | 'dark';

type ThemeContextValue = {
  theme: Theme;
  toggle: () => void;
  setTheme: (t: Theme) => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light');

  useEffect(() => {
    (async () => {
      try {
        const { value } = await Preferences.get({ key: 'shatir_theme' });
        if (value === 'dark' || value === 'light') {
          setThemeState(value);
          applyTheme(value);
        } else {
          applyTheme('light');
        }
      } catch {
        const saved = localStorage.getItem('shatir_theme') as Theme | null;
        if (saved) {
          setThemeState(saved);
          applyTheme(saved);
        } else {
          applyTheme('light');
        }
      }
    })();
  }, []);

  function applyTheme(t: Theme) {
    const root = document.documentElement;
    if (t === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
  }

  async function setTheme(t: Theme) {
    setThemeState(t);
    applyTheme(t);
    try {
      await Preferences.set({ key: 'shatir_theme', value: t });
    } catch {
      localStorage.setItem('shatir_theme', t);
    }
  }

  return (
    <ThemeContext.Provider
      value={{ theme, toggle: () => setTheme(theme === 'light' ? 'dark' : 'light'), setTheme }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
