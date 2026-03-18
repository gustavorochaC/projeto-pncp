import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

export default function FavoritesPage() {
  return (
    <Paper sx={{ p: 3, borderTop: "3px solid", borderColor: "primary.main" }}>
      <Stack spacing={2}>
        <Typography component="h2" variant="h5" fontWeight={700} color="text.primary">
          Favoritos
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
          Esta área está pronta para persistência após a aprovação das tabelas de favoritos no banco.
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
            Nenhum favorito salvo ainda.
          </Typography>
        </Box>
      </Stack>
    </Paper>
  );
}
