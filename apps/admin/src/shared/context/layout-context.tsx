import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

export type NavigationPreset =
  | 'bottom-dock'
  | 'top-navbar'
  | 'left-sidebar'
  | 'left-mini'
  | 'floating-drawer'
  | 'action-fab';

export type AccentColor = 'orange' | 'emerald' | 'violet' | 'blue';
export type ContainerWidth = 'fluid' | 'boxed';
export type TypographyPreset = 'sf-pro' | 'inter' | 'geist' | 'plus-jakarta' | 'jetbrains-mono';

export interface TypographyOption {
  id: TypographyPreset;
  label: string;
  category: string;
  preview: string;
  desc: string;
  sans: string;
  heading: string;
}

export const TYPOGRAPHY_OPTIONS: TypographyOption[] = [
  {
    id: 'sf-pro',
    label: 'SF Pro (Apple System)',
    category: 'Nativa Apple HIG',
    preview: 'Aa',
    desc: 'Tipografía oficial del sistema Apple con nitidez superior y números tabulares perfectos.',
    sans: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "SF Pro", system-ui, sans-serif',
    heading: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", system-ui, sans-serif',
  },
  {
    id: 'inter',
    label: 'Inter Display',
    category: 'Precisión Suiza',
    preview: 'Aa',
    desc: 'El estándar de la industria para interfaces SaaS densas y métricas complejas.',
    sans: '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
    heading: '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
  },
  {
    id: 'geist',
    label: 'Geist Sans',
    category: 'Minimalismo Moderno',
    preview: 'Aa',
    desc: 'Líneas sobrias, proporciones geométricas contemporáneas y excelente legibilidad en pantalla.',
    sans: '"Geist", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
    heading: '"Geist", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
  },
  {
    id: 'plus-jakarta',
    label: 'Plus Jakarta Sans',
    category: 'Geométrica Editorial',
    preview: 'Aa',
    desc: 'Curvas redondas y personalidad de alta gama para productos comerciales y marketplaces.',
    sans: '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
    heading: '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
  },
  {
    id: 'jetbrains-mono',
    label: 'JetBrains Mono',
    category: 'Ingeniería & Código',
    preview: '>_',
    desc: 'Monoespaciado de grado terminal para observabilidad, logs de consola y analítica.',
    sans: '"JetBrains Mono", "SF Mono", Menlo, Consolas, monospace',
    heading: '"JetBrains Mono", "SF Mono", Menlo, Consolas, monospace',
  },
];

interface LayoutContextType {
  preset: NavigationPreset;
  setPreset: (preset: NavigationPreset) => void;
  accent: AccentColor;
  setAccent: (accent: AccentColor) => void;
  containerWidth: ContainerWidth;
  setContainerWidth: (w: ContainerWidth) => void;
  glassMode: boolean;
  setGlassMode: (glass: boolean) => void;
  toggleGlassMode: () => void;
  typography: TypographyPreset;
  setTypography: (font: TypographyPreset) => void;
  isCustomizerOpen: boolean;
  setIsCustomizerOpen: (open: boolean) => void;
  isDrawerOpen: boolean;
  setIsDrawerOpen: (open: boolean) => void;
  isFabOpen: boolean;
  setIsFabOpen: (open: boolean) => void;
}

const LayoutContext = createContext<LayoutContextType | undefined>(undefined);

export const LayoutProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [preset, setPresetState] = useState<NavigationPreset>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('blakor_nav_preset') as NavigationPreset | null;
      if (stored) return stored;
    }
    return 'bottom-dock'; // Default showcase layout (iOS Dock)
  });

  const [accent, setAccentState] = useState<AccentColor>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('blakor_accent_color') as AccentColor | null;
      if (stored) return stored;
    }
    return 'orange'; // Blakor Orange #F97316
  });

  const [containerWidth, setContainerWidthState] = useState<ContainerWidth>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('blakor_container_width') as ContainerWidth | null;
      if (stored) return stored;
    }
    return 'fluid';
  });

  const [glassMode, setGlassModeState] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('blakor_glass_mode');
      if (stored !== null) return stored === 'true';
    }
    return true; // Default Liquid Glass ON
  });

  const [typography, setTypographyState] = useState<TypographyPreset>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('blakor_typography') as TypographyPreset | null;
      if (stored && TYPOGRAPHY_OPTIONS.some((o) => o.id === stored)) return stored;
    }
    return 'sf-pro'; // Default Apple HIG native typography
  });

  const [isCustomizerOpen, setIsCustomizerOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isFabOpen, setIsFabOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('blakor_nav_preset', preset);
  }, [preset]);

  useEffect(() => {
    localStorage.setItem('blakor_accent_color', accent);
    // Apply accent class or style variables
    const root = document.documentElement;
    const accentColors = {
      orange: '#F97316',
      emerald: '#10B981',
      violet: '#8B5CF6',
      blue: '#3B82F6',
    };
    root.style.setProperty('--primary', accentColors[accent]);
    root.style.setProperty('--accent', accentColors[accent]);
    root.style.setProperty('--ring', accentColors[accent]);
  }, [accent]);

  useEffect(() => {
    localStorage.setItem('blakor_container_width', containerWidth);
  }, [containerWidth]);

  useEffect(() => {
    try {
      localStorage.setItem('blakor_glass_mode', String(glassMode));
    } catch {}
    if (typeof document !== 'undefined') {
      if (glassMode) {
        document.documentElement.classList.add('liquid-glass-active');
      } else {
        document.documentElement.classList.remove('liquid-glass-active');
      }
    }
  }, [glassMode]);

  useEffect(() => {
    try {
      localStorage.setItem('blakor_typography', typography);
    } catch {}
    if (typeof document !== 'undefined') {
      const selected = TYPOGRAPHY_OPTIONS.find((t) => t.id === typography) || TYPOGRAPHY_OPTIONS[0];
      const root = document.documentElement;
      root.style.setProperty('--font-family-sans', selected.sans);
      root.style.setProperty('--font-family-heading', selected.heading);
      root.setAttribute('data-typography', typography);
    }
  }, [typography]);

  const setPreset = useCallback((p: NavigationPreset) => {
    setPresetState(p);
    setIsFabOpen(false);
    setIsDrawerOpen(false);
  }, []);

  const setAccent = useCallback((a: AccentColor) => setAccentState(a), []);
  const setContainerWidth = useCallback((w: ContainerWidth) => setContainerWidthState(w), []);
  const setGlassMode = useCallback((g: boolean) => setGlassModeState(g), []);
  const toggleGlassMode = useCallback(() => setGlassModeState((prev) => !prev), []);
  const setTypography = useCallback((font: TypographyPreset) => setTypographyState(font), []);

  return (
    <LayoutContext.Provider
      value={{
        preset,
        setPreset,
        accent,
        setAccent,
        containerWidth,
        setContainerWidth,
        glassMode,
        setGlassMode,
        toggleGlassMode,
        typography,
        setTypography,
        isCustomizerOpen,
        setIsCustomizerOpen,
        isDrawerOpen,
        setIsDrawerOpen,
        isFabOpen,
        setIsFabOpen,
      }}
    >
      {children}
    </LayoutContext.Provider>
  );
};

export const useLayout = (): LayoutContextType => {
  const context = useContext(LayoutContext);
  if (!context) {
    throw new Error('useLayout must be used within a LayoutProvider');
  }
  return context;
};
