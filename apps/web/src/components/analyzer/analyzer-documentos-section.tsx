"use client";

import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Typography from "@mui/material/Typography";
import ArticleOutlinedIcon from "@mui/icons-material/ArticleOutlined";
import FolderOpenOutlinedIcon from "@mui/icons-material/FolderOpenOutlined";
import type { AnalyzerSectionResult, NoticeArchive } from "@pncp/types";
import { AnalyzerSectionCard } from "./analyzer-section-card";

interface Props {
  result: AnalyzerSectionResult | null;
  loading: boolean;
  onRegenerate: () => void;
}

export function AnalyzerDocumentosSection({ result, loading, onRegenerate }: Props) {
  const arquivos = (result?.metadata?.arquivos ?? []) as NoticeArchive[];

  return (
    <AnalyzerSectionCard
      title="Documentos e Anexos"
      icon={<FolderOpenOutlinedIcon color="info" />}
      loading={loading}
      onRegenerate={onRegenerate}
    >
      {result ? (
        <Box>
          {arquivos.length > 0 && (
            <>
              <List dense disablePadding sx={{ mb: 1 }}>
                {arquivos.map((arq) => (
                  <ListItem key={arq.sequencialDocumento} disablePadding>
                    <ListItemIcon sx={{ minWidth: 32 }}>
                      <ArticleOutlinedIcon fontSize="small" color="action" />
                    </ListItemIcon>
                    <ListItemText
                      primary={arq.titulo}
                      secondary={arq.tipoDocumentoNome}
                      primaryTypographyProps={{ variant: "body2" }}
                      secondaryTypographyProps={{ variant: "caption" }}
                    />
                  </ListItem>
                ))}
              </List>
              <Divider sx={{ mb: 1 }} />
            </>
          )}
          <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
            {result.content}
          </Typography>
        </Box>
      ) : (
        <Typography variant="body2" color="text.secondary">
          Clique em regenerar para analisar os documentos.
        </Typography>
      )}
    </AnalyzerSectionCard>
  );
}
