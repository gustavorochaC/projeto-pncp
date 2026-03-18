"use client";

import type { PropsWithChildren } from "react";
import Box from "@mui/material/Box";
import { zIndexScale } from "@/theme/portal-editals-theme";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

export function AppShell({ children }: PropsWithChildren) {
  return (
    <Box
      sx={{
        display: "flex",
        minHeight: "100vh",
        width: "100%",
      }}
    >
      <Box
        component="a"
        href="#main-content"
        sx={{
          position: "absolute",
          left: -9999,
          zIndex: 9999,
          py: 1.5,
          px: 2,
          bgcolor: "primary.main",
          color: "primary.contrastText",
          borderRadius: 1,
          fontWeight: 600,
          textDecoration: "none",
          "&:focus": {
            left: 16,
            top: 16,
            outline: "2px solid",
            outlineColor: "primary.dark",
            outlineOffset: 2,
          },
        }}
      >
        Ir para o conteúdo
      </Box>
      <Sidebar />
      <Box
        component="main"
        id="main-content"
        tabIndex={-1}
        sx={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          position: "relative",
          zIndex: zIndexScale.main,
        }}
      >
        <Topbar />
        <Box
          sx={{
            flex: 1,
            overflow: "auto",
            px: { xs: 3, sm: 4 },
            py: 4,
            background: (theme) =>
              `radial-gradient(ellipse 80% 50% at 50% 0%, ${theme.palette.primary.main}0F, transparent 50%), ${theme.palette.background.default}`,
          }}
        >
          {children}
        </Box>
      </Box>
    </Box>
  );
}
