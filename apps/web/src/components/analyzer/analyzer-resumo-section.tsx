"use client";

import Typography from "@mui/material/Typography";
import SummarizeOutlinedIcon from "@mui/icons-material/SummarizeOutlined";
import type { AnalyzerSectionResult } from "@pncp/types";
import { AnalyzerSectionCard } from "./analyzer-section-card";

interface Props {
  result: AnalyzerSectionResult | null;
  loading: boolean;
  onRegenerate: () => void;
}

export function AnalyzerResumoSection({ result, loading, onRegenerate }: Props) {
  return (
    <AnalyzerSectionCard
      title="Resumo Executivo"
      icon={<SummarizeOutlinedIcon color="primary" />}
      loading={loading}
      onRegenerate={onRegenerate}
    >
      {result ? (
        <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
          {result.content}
        </Typography>
      ) : (
        <Typography variant="body2" color="text.secondary">
          Clique em regenerar para gerar o resumo executivo.
        </Typography>
      )}
    </AnalyzerSectionCard>
  );
}
