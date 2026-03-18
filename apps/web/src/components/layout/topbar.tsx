"use client";

import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";

export function Topbar() {
  return (
    <AppBar
      position="sticky"
      color="default"
      elevation={0}
      sx={{
        bgcolor: "background.paper",
      }}
    >
      <Toolbar sx={{ justifyContent: "space-between", px: { xs: 3, sm: 4 }, minHeight: 64 }}>
        <Box>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ letterSpacing: "0.12em", display: "block", fontWeight: 500 }}
          >
            Painel de inteligência
          </Typography>
          <Typography variant="h6" component="h1" fontWeight={700} color="text.primary">
            Licitações públicas
          </Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }} role="group" aria-label="Status do sistema">
          <Chip label="PNCP online" size="small" color="primary" variant="filled" aria-label="Fonte de dados: PNCP online" />
          <Chip label="IA local via Ollama" size="small" color="info" variant="outlined" aria-label="IA local via Ollama" />
        </Box>
      </Toolbar>
    </AppBar>
  );
}
