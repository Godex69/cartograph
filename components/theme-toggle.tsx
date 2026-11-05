'use client';

import { useEffect, useState } from 'react';

export type ThemeMode = 'system' | 'light' | 'dark';

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>('system');

  useEffect(() => {
    setMounted(true);
    const stored = (localStorage.getItem('cartograph-theme') as ThemeMode) || 'system';
    setTheme(stored);
  }, []);

  const applyTheme = (mode: ThemeMode) => {
    setTheme(mode);
    localStorage.setItem('cartograph-theme', mode);

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
      className="inline-flex items-center rounded border border-border bg-surface-raised p-0.5 text-xs font-mono select-none"
    >
      <button
        type="button"
        onClick={() => applyTheme('system')}
        data-active={theme === 'system'}
        className={`px-2 py-0.5 rounded transition-colors ${
          theme === 'system'
            ? 'bg-surface font-semibold text-foreground shadow-xs'
            : 'text-foreground-muted hover:text-foreground'
        }`}
        title="Follow system theme"
      >
        system
      </button>
      <button
        type="button"
        onClick={() => applyTheme('light')}
        data-active={theme === 'light'}
        className={`px-2 py-0.5 rounded transition-colors ${
          theme === 'light'
            ? 'bg-surface font-semibold text-foreground shadow-xs'
            : 'text-foreground-muted hover:text-foreground'
        }`}
        title="Force light theme"
      >
        light
      </button>
      <button
        type="button"
        onClick={() => applyTheme('dark')}
        data-active={theme === 'dark'}
        className={`px-2 py-0.5 rounded transition-colors ${
          theme === 'dark'
            ? 'bg-surface font-semibold text-foreground shadow-xs'
            : 'text-foreground-muted hover:text-foreground'
        }`}
        title="Force dark theme"
      >
        dark
      </button>
    </div>
  );
}
