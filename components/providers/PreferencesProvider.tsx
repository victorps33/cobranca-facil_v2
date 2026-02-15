"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type Theme = "light" | "dark" | "system";
export type Density = "comfortable" | "compact";

export interface Preferences {
  theme: Theme;
  density: Density;
  sidebarCollapsed: boolean;
}

interface PreferencesContextValue extends Preferences {
  /** Persists to localStorage and applies visually */
  setPreferences: (update: Partial<Preferences>) => void;
  /** Applies visually without persisting (for live preview) */
  previewPreferences: (update: Partial<Preferences>) => void;
  /** Reverts visual state to what's persisted in localStorage */
  revertPreview: () => void;
}

const STORAGE_KEY = "menlo-preferences";

const defaults: Preferences = {
  theme: "light",
  density: "comfortable",
  sidebarCollapsed: false,
};

const PreferencesContext = createContext<PreferencesContextValue>({
  ...defaults,
  setPreferences: () => {},
  previewPreferences: () => {},
  revertPreview: () => {},
});

function loadPreferences(): Preferences {
  if (typeof window === "undefined") return defaults;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    return { ...defaults, ...parsed };
  } catch {
    return defaults;
  }
}

function applyThemeClass(theme: Theme) {
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
  } else if (theme === "system") {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    root.classList.toggle("dark", prefersDark);
  } else {
    root.classList.remove("dark");
  }
}

function applyDensityAttr(density: Density) {
  if (density === "compact") {
    document.documentElement.setAttribute("data-density", "compact");
  } else {
    document.documentElement.removeAttribute("data-density");
  }
}

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [prefs, setPrefs] = useState<Preferences>(defaults);
  const [hydrated, setHydrated] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const loaded = loadPreferences();
    setPrefs(loaded);
    applyThemeClass(loaded.theme);
    applyDensityAttr(loaded.density);
    setHydrated(true);
  }, []);

  // Listen for system theme changes when theme === "system"
  useEffect(() => {
    if (!hydrated) return;
    if (prefs.theme !== "system") return;

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => {
      document.documentElement.classList.toggle("dark", e.matches);
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [prefs.theme, hydrated]);

  const setPreferences = useCallback((update: Partial<Preferences>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...update };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      applyThemeClass(next.theme);
      applyDensityAttr(next.density);
      return next;
    });
  }, []);

  const previewPreferences = useCallback((update: Partial<Preferences>) => {
    if (update.theme !== undefined) applyThemeClass(update.theme);
    if (update.density !== undefined) applyDensityAttr(update.density);
  }, []);

  const revertPreview = useCallback(() => {
    const saved = loadPreferences();
    applyThemeClass(saved.theme);
    applyDensityAttr(saved.density);
    setPrefs(saved);
  }, []);

  const value = useMemo(
    () => ({ ...prefs, setPreferences, previewPreferences, revertPreview }),
    [prefs, setPreferences, previewPreferences, revertPreview]
  );

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  return useContext(PreferencesContext);
}
