import Chip from "@mui/material/Chip";

const statusColorMap: Record<string, "default" | "primary" | "success" | "info" | "warning" | "error"> = {
  aberto: "success",
  publicado: "info",
  encerrado: "default",
  suspenso: "warning",
  revogado: "error",
  anulado: "error",
};

function formatStatusLabel(status: string): string {
  if (!status) return "—";
  const s = status.trim();
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

export function NoticeStatusBadge({ status }: { status: string }) {
  const color = statusColorMap[status?.toLowerCase()] ?? "default";
  return (
    <Chip
      label={formatStatusLabel(status)}
      size="small"
      color={color}
      variant="outlined"
      sx={{ fontWeight: 500 }}
    />
  );
}
