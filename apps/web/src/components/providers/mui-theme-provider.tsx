"use client";

import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { StyledEngineProvider } from "@mui/material/styles";
import { useTheme } from "next-themes";
import type { PropsWithChildren } from "react";
import { getPortalEditalsTheme } from "@/theme/portal-editals-theme";

function MuiThemeProviderInner({ children }: PropsWithChildren) {
  const { resolvedTheme } = useTheme();
  const mode = resolvedTheme === "dark" ? "dark" : "light";
  const theme = getPortalEditalsTheme(mode);
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}

export function MuiThemeProvider({ children }: PropsWithChildren) {
  return (
    <StyledEngineProvider injectFirst>
      <MuiThemeProviderInner>{children}</MuiThemeProviderInner>
    </StyledEngineProvider>
  );
}
