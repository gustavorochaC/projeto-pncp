"use client";

import Badge from "@mui/material/Badge";
import Fab from "@mui/material/Fab";
import Tooltip from "@mui/material/Tooltip";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import CloseIcon from "@mui/icons-material/Close";
import { useAIStatus } from "@/hooks/use-ai-chat";

interface Props {
  onClick: () => void;
  open: boolean;
}

export function AIChatFab({ onClick, open }: Props) {
  const { data: aiStatus } = useAIStatus();

  const isOnline = aiStatus?.status === "online";
  const isLoading = aiStatus === undefined;

  const badgeColor = isLoading ? "#9e9e9e" : isOnline ? "#4caf50" : "#f44336";
  const tooltipTitle = open
    ? "Fechar assistente"
    : isLoading
      ? "Assistente IA (verificando...)"
      : isOnline
        ? `Assistente IA — ${aiStatus.generationModel} online`
        : "Assistente IA — IA offline";

  return (
    <Tooltip title={tooltipTitle} placement="left">
      <Badge
        overlap="circular"
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        badgeContent={
          !open && (
            <span
              style={{
                width: 12,
                height: 12,
                borderRadius: "50%",
                backgroundColor: badgeColor,
                border: "2px solid white",
                display: "block",
                boxShadow: isOnline ? `0 0 6px ${badgeColor}` : undefined,
              }}
            />
          )
        }
        sx={{ position: "fixed", bottom: 24, right: 24, zIndex: 1200 }}
      >
        <Fab
          color="primary"
          onClick={onClick}
          aria-label={open ? "Fechar assistente IA" : "Abrir assistente IA"}
        >
          {open ? <CloseIcon /> : <AutoAwesomeIcon />}
        </Fab>
      </Badge>
    </Tooltip>
  );
}
