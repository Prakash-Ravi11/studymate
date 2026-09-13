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

/** Same-tab theme writes, since the native 'storage' event only fires cross-tab. */
const THEME_CHANGE_EVENT = 'studymate-theme-change';

function subscribeToStoredTheme(onChange: () => void) {
  window.addEventListener('storage', onChange);
  window.addEventListener(THEME_CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(THEME_CHANGE_EVENT, onChange);
  };
}

/** The stored preference, or 'system' when nothing is stored or storage is blocked. */
function readStoredTheme(): Theme {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw === 'light' || raw === 'dark' || raw === 'system' ? raw : 'system';
  } catch {
    // Private mode or blocked storage: follow the OS.
    return 'system';
  }
}

const darkQuery = () => window.matchMedia('(prefers-color-scheme: dark)');

function subscribeToSystemTheme(onChange: () => void) {
  const mq = darkQuery();
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}

/**
 * Theme state, derived rather than stored.
 *
 * Both inputs -- what is in localStorage and what the OS currently prefers --
 * are things only the browser knows, so both are read through
 * useSyncExternalStore. That is what it is for: React takes the server snapshot
 * while rendering on the server and the client snapshot once hydrating, so the
 * value is right on the first client render.
 *
 * The previous version held these in state and filled them in from effects,
 * which meant one render with the wrong theme before the correct one, and a
 * `resolved` value that could drift out of step with `theme` because two
 * setters had to agree.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const stored = React.useSyncExternalStore(
    subscribeToStoredTheme,
    readStoredTheme,
    () => 'system' as Theme,
  );

  // A change made this session wins over what was stored, so the UI responds
  // immediately without waiting for a storage round trip.
  const [override, setOverride] = React.useState<Theme | null>(null);
  const theme = override ?? stored;

  const systemIsDark = React.useSyncExternalStore(
    subscribeToSystemTheme,
    () => darkQuery().matches,
    () => false,
  );

  const resolved: 'light' | 'dark' =
    theme === 'system' ? (systemIsDark ? 'dark' : 'light') : theme;

  React.useEffect(() => {
    document.documentElement.classList.toggle('dark', resolved === 'dark');
  }, [resolved]);

  const setTheme = React.useCallback((next: Theme) => {
    setOverride(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
      // Same-tab writes do not fire 'storage', so tell our own subscribers.
      window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
    } catch {
      // Preference will not persist; the app still works this session.
    }
  }, []);

  const value = React.useMemo(() => ({ theme, resolved, setTheme }), [theme, resolved, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
