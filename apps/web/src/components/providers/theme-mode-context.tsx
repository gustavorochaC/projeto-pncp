"use client";

import { useTheme } from "next-themes";
import { useCallback, useMemo } from "react";

export type ThemeMode = "light" | "dark";

type ThemeModeContextValue = {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
};

export function useThemeMode(): ThemeModeContextValue {
  const { resolvedTheme, setTheme } = useTheme();
  const mode: ThemeMode = resolvedTheme === "dark" ? "dark" : "light";

  const setMode = useCallback(
    (next: ThemeMode) => {
      setTheme(next);
    },
    [setTheme]
  );

  const toggleMode = useCallback(() => {
    setTheme(mode === "dark" ? "light" : "dark");
  }, [mode, setTheme]);

  return useMemo(
    () => ({ mode, setMode, toggleMode }),
    [mode, setMode, toggleMode]
  );
}
