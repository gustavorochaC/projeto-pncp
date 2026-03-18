import { createTheme, type PaletteMode } from "@mui/material/styles";

const fontFamily = '"Satoshi", system-ui, sans-serif';

const lightPalette = {
  primary: {
    main: "#0f766e",
    dark: "#115e59",
    light: "#14b8a6",
    contrastText: "#ffffff",
  },
  secondary: {
    main: "#475569",
    dark: "#334155",
    light: "#64748b",
    contrastText: "#ffffff",
  },
  error: {
    main: "#dc2626",
    dark: "#b91c1c",
    light: "#ef4444",
    contrastText: "#ffffff",
  },
  success: {
    main: "#059669",
    dark: "#047857",
    light: "#10b981",
    contrastText: "#ffffff",
  },
  info: {
    main: "#1565c0",
    dark: "#0d47a1",
    light: "#42a5f5",
    contrastText: "#ffffff",
  },
  background: {
    default: "#f0f1f3",
    paper: "#fafafa",
  },
  text: {
    primary: "#0f172a",
    secondary: "#64748b",
  },
} as const;

const darkPalette = {
  ...lightPalette,
  secondary: {
    main: "#94a3b8",
    dark: "#64748b",
    light: "#cbd5e1",
    contrastText: "#0f172a",
  },
  error: {
    main: "#f87171",
    dark: "#ef4444",
    light: "#fca5a5",
    contrastText: "#1e293b",
  },
  success: {
    main: "#34d399",
    dark: "#10b981",
    light: "#6ee7b7",
    contrastText: "#1e293b",
  },
  background: {
    default: "#0f172a",
    paper: "#1e293b",
  },
  text: {
    primary: "#f8fafc",
    secondary: "#94a3b8",
  },
} as const;

/** Escala de z-index (skill: z-index-management). */
export const zIndexScale = {
  base: 0,
  sidebar: 10,
  main: 20,
  sticky: 40,
  dropdown: 100,
  modal: 1000,
} as const;

export function getPortalEditalsTheme(mode: PaletteMode) {
  return createTheme({
    palette: {
      mode,
      ...(mode === "light" ? lightPalette : darkPalette),
    },
    typography: {
      fontFamily,
      h1: { fontFamily, fontSize: "1.875rem", fontWeight: 700 },
      h2: { fontFamily, fontSize: "1.5rem", fontWeight: 700 },
      h5: { fontFamily, fontSize: "1.25rem", fontWeight: 600 },
      h6: { fontFamily, fontSize: "1.125rem", fontWeight: 600 },
      body1: { fontFamily, fontSize: "1rem", fontWeight: 400 },
      body2: { fontFamily, fontSize: "0.875rem", fontWeight: 400 },
    },
    shape: {
      borderRadius: 8,
    },
    spacing: 8,
    shadows: [
    "none",
    "0 1px 3px rgba(0,0,0,0.06)",
    "0 4px 12px rgba(0,0,0,0.08)",
    "0 8px 24px rgba(0,0,0,0.08)",
    "0 12px 32px rgba(0,0,0,0.10)",
    "0 16px 40px rgba(0,0,0,0.10)",
    "0 20px 48px rgba(0,0,0,0.12)",
    "0 24px 56px rgba(0,0,0,0.12)",
    "0 28px 64px rgba(0,0,0,0.14)",
    "0 32px 72px rgba(0,0,0,0.14)",
    "0 36px 80px rgba(0,0,0,0.16)",
    "0 40px 88px rgba(0,0,0,0.16)",
    "0 44px 96px rgba(0,0,0,0.18)",
    "0 48px 104px rgba(0,0,0,0.18)",
    "0 52px 112px rgba(0,0,0,0.20)",
    "0 56px 120px rgba(0,0,0,0.20)",
    "0 60px 128px rgba(0,0,0,0.22)",
    "0 64px 136px rgba(0,0,0,0.22)",
    "0 68px 144px rgba(0,0,0,0.24)",
    "0 72px 152px rgba(0,0,0,0.24)",
    "0 76px 160px rgba(0,0,0,0.26)",
    "0 80px 168px rgba(0,0,0,0.26)",
    "0 84px 176px rgba(0,0,0,0.28)",
    "0 88px 184px rgba(0,0,0,0.28)",
    "0 92px 192px rgba(0,0,0,0.30)",
    ],
    components: {
      MuiButtonBase: {
        styleOverrides: {
          root: {
            "&:focus-visible": {
              outline: "2px solid",
              outlineColor: "primary.main",
              outlineOffset: "2px",
            },
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: "none",
            borderRadius: 8,
            transition: "background-color 0.2s ease, box-shadow 0.2s ease",
          },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: {
            minWidth: 44,
            minHeight: 44,
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            borderRight: 1,
            borderColor: "divider",
            boxShadow: "none",
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            boxShadow: "0 1px 0",
            borderColor: "divider",
          },
        },
      },
    },
  });
}

/** Tema claro (compatibilidade e SSR). */
export const portalEditalsTheme = getPortalEditalsTheme("light");
