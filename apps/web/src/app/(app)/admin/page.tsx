import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

export default function AdminPage() {
  return (
    <Paper sx={{ p: 3, borderTop: "3px solid", borderColor: "primary.main" }}>
      <Stack spacing={2}>
        <Typography component="h2" variant="h5" fontWeight={700} color="text.primary">
          Admin operacional
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
          Aqui entrarão logs de sync, filas BullMQ, processamento de documentos e métricas da IA.
        </Typography>
        <Box
          sx={{
            py: 4,
            px: 2,
            textAlign: "center",
            bgcolor: "action.hover",
            borderRadius: 2,
          }}
        >
          <Typography variant="body2" color="text.secondary">
            Painel em configuração.
          </Typography>
        </Box>
      </Stack>
    </Paper>
  );
}
