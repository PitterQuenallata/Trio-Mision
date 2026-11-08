import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

type Theme = 'dark' | 'light' | 'system';

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: 'dark' | 'light';
  setTheme: (theme: Theme) => void;
  toggleTheme: (event?: React.MouseEvent) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const getInitialTheme = (): Theme => {
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('blakor_theme') as Theme | null;
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        return stored;
      }
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
      }
      return 'light';
    } catch {
      return 'light';
    }
  }
  return 'light';
};

const getResolvedTheme = (t: Theme): 'dark' | 'light' => {
  if (t === 'system') {
    if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  }
  return t;
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);
  const resolvedTheme = getResolvedTheme(theme);

  const applyThemeToDOM = useCallback((themeToApply: 'dark' | 'light') => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    if (themeToApply === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
    }
  }, []);

  useEffect(() => {
    applyThemeToDOM(resolvedTheme);
    try {
      localStorage.setItem('blakor_theme', theme);
    } catch {}
  }, [theme, resolvedTheme, applyThemeToDOM]);

  // Listen for system theme changes if theme === 'system'
  useEffect(() => {
    if (theme !== 'system' || typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      applyThemeToDOM(mediaQuery.matches ? 'dark' : 'light');
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme, applyThemeToDOM]);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
  }, []);

  const toggleTheme = useCallback(
    (event?: React.MouseEvent) => {
      const nextTheme = resolvedTheme === 'dark' ? 'light' : 'dark';

      // Check if native View Transitions API and circular reveal are supported & allowed
      const prefersReducedMotion =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      const supportsViewTransition =
        typeof document !== 'undefined' &&
        'startViewTransition' in document &&
        !prefersReducedMotion &&
        Boolean(event);

      if (!supportsViewTransition || !event) {
        // Fallback to instant transition
        setThemeState(nextTheme);
        applyThemeToDOM(nextTheme);
        return;
      }

      // Origin coordinates from click
      const x = event.clientX;
      const y = event.clientY;
      const endRadius = Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y)
      );

      const transition = (document as any).startViewTransition(() => {
        setThemeState(nextTheme);
        applyThemeToDOM(nextTheme);
      });

      transition.ready.then(() => {
        document.documentElement.animate(
          {
            clipPath: [
              `circle(0px at ${x}px ${y}px)`,
              `circle(${endRadius}px at ${x}px ${y}px)`,
            ],
          },
          {
            duration: 480,
            easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
            pseudoElement: '::view-transition-new(root)',
          }
        );
      });
    },
    [resolvedTheme, applyThemeToDOM]
  );

  return (
    <ThemeContext.Provider
      value={{
        theme,
        resolvedTheme,
        setTheme,
        toggleTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
