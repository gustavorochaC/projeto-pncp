import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

export default function HistoryPage() {
  return (
    <Paper sx={{ p: 3, borderTop: "3px solid", borderColor: "primary.main" }}>
      <Stack spacing={2}>
        <Typography component="h2" variant="h5" fontWeight={700} color="text.primary">
          Histórico de pesquisas
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
          O histórico do usuário será ativado junto com as tabelas dedicadas no Supabase.
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
            Nenhuma pesquisa no histórico.
          </Typography>
        </Box>
      </Stack>
    </Paper>
  );
}
