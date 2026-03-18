"use client";

import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Typography from "@mui/material/Typography";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import type { AnalyzerSectionResult } from "@pncp/types";
import { AnalyzerSectionCard } from "./analyzer-section-card";

interface Props {
  result: AnalyzerSectionResult | null;
  loading: boolean;
  onRegenerate: () => void;
}

function getSeverityChip(line: string) {
  if (/ALTO/i.test(line)) return <Chip label="ALTO" color="error" size="small" sx={{ mr: 1 }} />;
  if (/MEDIO/i.test(line)) return <Chip label="MÉDIO" color="warning" size="small" sx={{ mr: 1 }} />;
  if (/BAIXO/i.test(line)) return <Chip label="BAIXO" color="success" size="small" sx={{ mr: 1 }} />;
  return null;
}

export function AnalyzerRiscosSection({ result, loading, onRegenerate }: Props) {
  return (
    <AnalyzerSectionCard
      title="Análise de Riscos"
      icon={<WarningAmberOutlinedIcon color="warning" />}
      loading={loading}
      onRegenerate={onRegenerate}
    >
      {result ? (
        <Box>
          {result.content.split("\n").map((line, i) => {
            const chip = getSeverityChip(line);
            return line.trim() ? (
              <Box key={i} sx={{ display: "flex", alignItems: "flex-start", mb: 0.5 }}>
                {chip}
                <Typography variant="body2" sx={{ flex: 1 }}>
                  {line.replace(/^[-•*]\s*/, "").replace(/^(ALTO|MEDIO|BAIXO)[:\s]*/i, "")}
                </Typography>
              </Box>
            ) : null;
          })}
        </Box>
      ) : (
        <Typography variant="body2" color="text.secondary">
          Clique em regenerar para analisar os riscos.
        </Typography>
      )}
    </AnalyzerSectionCard>
  );
}
