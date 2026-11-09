'use client';

import { useEffect, useSyncExternalStore } from 'react';

export type ThemeMode = 'system' | 'light' | 'dark';

const emptySubscribe = () => () => {};

function subscribeTheme(callback: () => void) {
  window.addEventListener('storage', callback);
  window.addEventListener('cartograph-theme-change', callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener('cartograph-theme-change', callback);
  };
}

function getThemeSnapshot(): ThemeMode {
  if (typeof window === 'undefined') return 'system';
  return (localStorage.getItem('cartograph-theme') as ThemeMode) || 'system';
}

function getServerThemeSnapshot(): ThemeMode {
  return 'system';
}

export function ThemeToggle() {
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const theme = useSyncExternalStore(subscribeTheme, getThemeSnapshot, getServerThemeSnapshot);

  const applyTheme = (mode: ThemeMode) => {
    localStorage.setItem('cartograph-theme', mode);
    window.dispatchEvent(new Event('cartograph-theme-change'));

    const root = document.documentElement;
    const isDark =
      mode === 'dark' ||
      (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

    if (isDark) {
      root.classList.add('dark');
      root.classList.remove('light');
      root.setAttribute('data-theme', 'dark');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
      root.setAttribute('data-theme', 'light');
      root.style.colorScheme = 'light';
    }
  };

  useEffect(() => {
    if (!mounted) return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      const current = localStorage.getItem('cartograph-theme') as ThemeMode;
      if (current === 'system' || !current) {
        applyTheme('system');
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [mounted]);

  // Keep layout stable during SSR
  if (!mounted) {
    return (
      <div className="flex items-center rounded border border-border bg-surface p-0.5 text-xs text-foreground-muted font-mono">
        <span className="px-2 py-0.5">sys</span>
        <span className="px-2 py-0.5">light</span>
        <span className="px-2 py-0.5">dark</span>
      </div>
    );
  }

  return (
    <div
      role="group"
      aria-label="Theme selection"
      className="flex items-center rounded border border-border bg-surface p-0.5 text-xs font-mono"
    >
      <button
        type="button"
        data-testid="theme-btn-system"
        onClick={() => applyTheme('system')}
        className={`rounded px-2 py-0.5 transition-colors focus:outline-hidden ${
          theme === 'system'
            ? 'bg-accent/15 text-accent font-semibold border border-accent/30'
            : 'text-foreground-muted hover:text-foreground'
        }`}
      >
        sys
      </button>

      <button
        type="button"
        data-testid="theme-btn-light"
        onClick={() => applyTheme('light')}
        className={`rounded px-2 py-0.5 transition-colors focus:outline-hidden ${
          theme === 'light'
            ? 'bg-accent/15 text-accent font-semibold border border-accent/30'
            : 'text-foreground-muted hover:text-foreground'
        }`}
      >
        light
      </button>

      <button
        type="button"
        data-testid="theme-btn-dark"
        onClick={() => applyTheme('dark')}
        className={`rounded px-2 py-0.5 transition-colors focus:outline-hidden ${
          theme === 'dark'
            ? 'bg-accent/15 text-accent font-semibold border border-accent/30'
            : 'text-foreground-muted hover:text-foreground'
        }`}
      >
        dark
      </button>
    </div>
  );
}
