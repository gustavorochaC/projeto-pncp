"use client";

import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import type { AIMessageItem } from "@pncp/types";

interface Props {
  message: AIMessageItem;
  pending?: boolean;
}

const confidenceColors = {
  high: "success",
  medium: "warning",
  low: "error",
} as const;

const confidenceLabels = {
  high: "Alta confiança",
  medium: "Confiança média",
  low: "Baixa confiança",
} as const;

export function AIMessageBubble({ message, pending = false }: Props) {
  const isUser = message.role === "user";

  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: isUser ? "flex-end" : "flex-start",
        mb: 1.5,
      }}
    >
      <Box sx={{ maxWidth: "85%" }}>
        <Box
          sx={{
            px: 2,
            py: 1.25,
            borderRadius: isUser ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
            bgcolor: isUser ? "primary.main" : "grey.100",
            color: isUser ? "primary.contrastText" : "text.primary",
          }}
        >
          {pending && !isUser ? (
            <Stack direction="row" spacing={1.25} alignItems="center">
              <CircularProgress size={16} />
              <Typography variant="body2" sx={{ lineHeight: 1.6 }}>
                {message.content || "Analisando o edital..."}
              </Typography>
            </Stack>
          ) : (
            <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
              {message.content}
            </Typography>
          )}
        </Box>

        {!pending && !isUser && message.confidence && (
          <Box sx={{ mt: 0.5, display: "flex", gap: 1, alignItems: "center" }}>
            <Chip
              label={confidenceLabels[message.confidence]}
              color={confidenceColors[message.confidence]}
              size="small"
              variant="outlined"
              sx={{ fontSize: "0.65rem", height: 20 }}
            />
          </Box>
        )}

        {!pending && !isUser && message.citations && message.citations.length > 0 && (
          <Accordion
            disableGutters
            elevation={0}
            sx={{
              mt: 0.75,
              border: "1px solid",
              borderColor: "divider",
              borderRadius: "8px !important",
              "&:before": { display: "none" },
              bgcolor: "background.paper",
            }}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon fontSize="small" />} sx={{ minHeight: 36, py: 0, px: 1.5 }}>
              <Typography variant="caption" color="text.secondary">
                {message.citations.length} trecho{message.citations.length !== 1 ? "s" : ""} referenciado{message.citations.length !== 1 ? "s" : ""}
              </Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ px: 1.5, pt: 0, pb: 1.5 }}>
              {message.citations.map((citation, idx) => (
                <Box
                  key={idx}
                  sx={{
                    p: 1,
                    mb: 0.75,
                    bgcolor: "grey.50",
                    borderRadius: 1,
                    borderLeft: "3px solid",
                    borderLeftColor: "primary.light",
                  }}
                >
                  <Typography variant="caption" color="text.secondary" display="block">
                    {citation.title}
                    {citation.similarity != null && ` · ${(citation.similarity * 100).toFixed(0)}% relevância`}
                  </Typography>
                  <Typography variant="caption" sx={{ color: "text.secondary", fontStyle: "italic" }}>
                    &quot;{citation.excerpt.substring(0, 150)}{citation.excerpt.length > 150 ? "..." : ""}&quot;
                  </Typography>
                </Box>
              ))}
            </AccordionDetails>
          </Accordion>
        )}
      </Box>
    </Box>
  );
}
