'use client';

import * as React from 'react';

type Theme = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'studymate-theme';

const ThemeContext = React.createContext<{
  theme: Theme;
  resolved: 'light' | 'dark';
  setTheme: (t: Theme) => void;
} | null>(null);

export function useTheme() {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}

/**
 * Runs before first paint to stamp the theme class on <html>.
 *
 * Without this the page renders light, then flips to dark once React hydrates.
 * It is inlined as a blocking script for exactly that reason, and mirrors the
 * resolution logic below.
 */
export const themeScript = `(function(){try{
var s=localStorage.getItem('${STORAGE_KEY}')||'system';
var d=s==='dark'||(s==='system'&&window.matchMedia('(prefers-color-scheme:dark)').matches);
document.documentElement.classList.toggle('dark',d);
}catch(e){}})();`;

function systemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = React.useState<Theme>('system');
  const [resolved, setResolved] = React.useState<'light' | 'dark'>('light');

  // Read the stored preference after mount. Doing this in useState's initialiser
  // would run on the server, where localStorage does not exist.
  React.useEffect(() => {
    let stored: Theme = 'system';
    try {
      stored = (localStorage.getItem(STORAGE_KEY) as Theme) ?? 'system';
    } catch {
      // Private mode or blocked storage: fall back to following the OS.
    }
    setThemeState(stored);
    setResolved(stored === 'system' ? systemTheme() : stored);
  }, []);

  // Keep following the OS while the user is on "system".
  React.useEffect(() => {
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setResolved(mq.matches ? 'dark' : 'light');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [theme]);

  React.useEffect(() => {
    document.documentElement.classList.toggle('dark', resolved === 'dark');
  }, [resolved]);

  const setTheme = React.useCallback((next: Theme) => {
    setThemeState(next);
    setResolved(next === 'system' ? systemTheme() : next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Preference simply will not persist; the app still works this session.
    }
  }, []);

  const value = React.useMemo(() => ({ theme, resolved, setTheme }), [theme, resolved, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
