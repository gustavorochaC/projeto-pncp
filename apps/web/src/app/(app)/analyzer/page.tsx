"use client";

import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import type { NoticeListItem } from "@pncp/types";
import { AnalyzerSearchBar } from "@/components/analyzer/analyzer-search-bar";
import { AnalyzerResumoSection } from "@/components/analyzer/analyzer-resumo-section";
import { AnalyzerRiscosSection } from "@/components/analyzer/analyzer-riscos-section";
import { AnalyzerPrecosSection } from "@/components/analyzer/analyzer-precos-section";
import { AnalyzerDocumentosSection } from "@/components/analyzer/analyzer-documentos-section";
import { AnalyzerChatSection } from "@/components/analyzer/analyzer-chat-section";
import { useAnalyzerReport, useGenerateSection } from "@/hooks/use-analyzer";
import type { AnalyzerSectionName } from "@pncp/types";

const SECTIONS: AnalyzerSectionName[] = ["resumo", "riscos", "precos", "documentos"];

export default function AnalyzerPage() {
  const [selectedNotice, setSelectedNotice] = useState<NoticeListItem | null>(null);
  const [generating, setGenerating] = useState<Set<AnalyzerSectionName>>(new Set());

  const { data: report } = useAnalyzerReport(selectedNotice?.id ?? null);
  const { mutateAsync: generateSection } = useGenerateSection(selectedNotice?.id ?? null);

  const handleRegenerate = async (section: AnalyzerSectionName, force = false) => {
    if (!selectedNotice) return;
    setGenerating((prev) => new Set(prev).add(section));
    try {
      await generateSection({ section, body: { force } });
    } finally {
      setGenerating((prev) => {
        const next = new Set(prev);
        next.delete(section);
        return next;
      });
    }
  };

  // Auto-generate missing sections when a notice is selected
  useEffect(() => {
    if (!selectedNotice || !report) return;

    const missingSections = SECTIONS.filter((s) => !report[s]);
    if (missingSections.length === 0) return;

    let cancelled = false;

    const runSequential = async () => {
      for (const section of missingSections) {
        if (cancelled) break;
        await handleRegenerate(section, false);
      }
    };

    void runSequential();

    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNotice?.id, report?.id]);

  const isGenerating = (section: AnalyzerSectionName) => generating.has(section);

  return (
    <Box sx={{ maxWidth: 900, mx: "auto", p: 3 }}>
      <Typography variant="h5" fontWeight={700} mb={1}>
        Analista de Licitações
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        Selecione uma licitação para gerar automaticamente resumo, riscos, preços e análise de documentos.
      </Typography>

      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <AnalyzerSearchBar onSelect={setSelectedNotice} />
        {selectedNotice && (
          <Box mt={1.5}>
            <Typography variant="caption" color="text.secondary">
              Selecionado:
            </Typography>{" "}
            <Typography variant="caption" fontWeight={600}>
              {selectedNotice.object}
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block">
              {selectedNotice.agency} — {selectedNotice.modality}
            </Typography>
          </Box>
        )}
      </Paper>

      {selectedNotice && (
        <>
          <AnalyzerResumoSection
            result={report?.resumo ?? null}
            loading={isGenerating("resumo")}
            onRegenerate={() => void handleRegenerate("resumo", true)}
          />
          <AnalyzerRiscosSection
            result={report?.riscos ?? null}
            loading={isGenerating("riscos")}
            onRegenerate={() => void handleRegenerate("riscos", true)}
          />
          <AnalyzerPrecosSection
            result={report?.precos ?? null}
            loading={isGenerating("precos")}
            onRegenerate={() => void handleRegenerate("precos", true)}
          />
          <AnalyzerDocumentosSection
            result={report?.documentos ?? null}
            loading={isGenerating("documentos")}
            onRegenerate={() => void handleRegenerate("documentos", true)}
          />

          <Divider sx={{ my: 3 }} />

          <AnalyzerChatSection noticeId={selectedNotice.id} />
        </>
      )}
    </Box>
  );
}
