"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Link from "@mui/material/Link";
import Paper from "@mui/material/Paper";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Tabs from "@mui/material/Tabs";
import Typography from "@mui/material/Typography";
import Grid from "@mui/material/Grid2";
import ArrowBackOutlinedIcon from "@mui/icons-material/ArrowBackOutlined";
import ArticleOutlinedIcon from "@mui/icons-material/ArticleOutlined";
import AttachFileOutlinedIcon from "@mui/icons-material/AttachFileOutlined";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import OpenInNewOutlinedIcon from "@mui/icons-material/OpenInNewOutlined";
import { AIChatFab } from "@/components/ai/ai-chat-fab";
import { AIChatDrawer } from "@/components/ai/ai-chat-drawer";
import { NoticeStatusBadge } from "@/components/notices/notice-status-badge";
import { useNotice } from "@/hooks/use-notice";
import { useNoticeItems } from "@/hooks/use-notice-items";
import { useNoticeArchives } from "@/hooks/use-notice-archives";
import {
  appendHighlightToReturnTo,
  NOTICE_RETURN_TO_PARAM,
  resolveSafeReturnTo,
} from "@/lib/notice-navigation";

function fmt(iso?: string | null): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return "—";
  }
}

function fmtCurrency(value?: number | null): string {
  if (value == null) return "—";
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function MetaField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Paper variant="outlined" sx={{ p: 2, height: "100%", bgcolor: "grey.50" }}>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ textTransform: "uppercase", letterSpacing: "0.08em", display: "block" }}
      >
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={500} sx={{ mt: 0.5 }}>
        {value || "—"}
      </Typography>
    </Paper>
  );
}

function TimelineEntry({
  label,
  value,
  isLast,
}: {
  label: string;
  value: string | null | undefined;
  isLast?: boolean;
}) {
  return (
    <Box sx={{ display: "flex", gap: 2 }}>
      <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <Box
          sx={{
            width: 12,
            height: 12,
            borderRadius: "50%",
            bgcolor: value ? "primary.main" : "grey.300",
            mt: 0.5,
            flexShrink: 0,
          }}
        />
        {!isLast && <Box sx={{ width: 2, flex: 1, bgcolor: "grey.200", my: 0.5 }} />}
      </Box>
      <Box sx={{ pb: isLast ? 0 : 2 }}>
        <Typography variant="caption" color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: "0.08em" }}>
          {label}
        </Typography>
        <Typography variant="body2" fontWeight={500}>
          {value ? fmt(value) : "—"}
        </Typography>
      </Box>
    </Box>
  );
}

function TabDetalhes({ notice }: { notice: ReturnType<typeof useNotice>["data"] & object }) {
  if (!notice) return null;

  const location =
    notice.city && notice.state
      ? `${notice.city} — ${notice.state}`
      : notice.state ?? notice.city ?? "—";

  const metaFields: [string, React.ReactNode][] = [
    ["Local", location],
    ["Órgão", notice.orgaoEntidade ?? notice.agency],
    ["Unidade", notice.unidadeOrgao ?? "—"],
    ["CNPJ", notice.cnpjOrgao ?? "—"],
    ["Modalidade", notice.modality],
    ["Tipo de instrumento", notice.instrumentType ?? "—"],
    ["Modo de disputa", notice.procurementType ?? "—"],
    ["Nº controle PNCP", notice.processNumber ?? "—"],
    ["Nº processo", notice.processo ?? "—"],
    ["Amparo legal", notice.amparoLegal ?? "—"],
    ["SRP", notice.srp == null ? "—" : notice.srp ? "Sim" : "Não"],
    ["Situação", notice.status],
  ];

  return (
    <Stack spacing={3}>
      <Grid container spacing={2}>
        {metaFields.map(([label, value]) => (
          <Grid key={label as string} size={{ xs: 12, sm: 6, lg: 3 }}>
            <MetaField label={label as string} value={value} />
          </Grid>
        ))}
      </Grid>

      <Divider />

      <Box>
        <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: "0.08em", display: "block", mb: 0.75 }}>
          Objeto
        </Typography>
        <Typography variant="body1" sx={{ lineHeight: 1.75 }}>
          {notice.object}
        </Typography>
      </Box>

      {notice.complementaryInfo && (
        <Box>
          <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: "0.08em", display: "block", mb: 0.75 }}>
            Informação complementar
          </Typography>
          <Typography variant="body2" sx={{ lineHeight: 1.75 }}>
            {notice.complementaryInfo}
          </Typography>
        </Box>
      )}

      {notice.justification && (
        <Box>
          <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: "0.08em", display: "block", mb: 0.75 }}>
            Justificativa
          </Typography>
          <Typography variant="body2" sx={{ lineHeight: 1.75 }}>
            {notice.justification}
          </Typography>
        </Box>
      )}

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6 }}>
          <Paper variant="outlined" sx={{ p: 2.5, bgcolor: "grey.50" }}>
            <Typography variant="caption" color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: "0.08em", display: "block" }}>
              Valor Total Estimado
            </Typography>
            <Typography variant="h6" fontWeight={700} sx={{ mt: 0.5 }}>
              {fmtCurrency(notice.estimatedValue)}
            </Typography>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <Paper variant="outlined" sx={{ p: 2.5, bgcolor: "grey.50" }}>
            <Typography variant="caption" color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: "0.08em", display: "block" }}>
              Valor Total Homologado
            </Typography>
            <Typography variant="h6" fontWeight={700} sx={{ mt: 0.5 }}>
              {fmtCurrency(notice.valorTotalHomologado)}
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {notice.officialLinks.length > 0 && (
        <Paper variant="outlined" sx={{ p: 2.5 }}>
          <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: "0.08em", display: "block", mb: 1 }}>
            Links oficiais
          </Typography>
          <Stack direction="row" flexWrap="wrap" gap={1}>
            {notice.officialLinks.map((link) => (
              <Button
                key={link.id}
                component={Link}
                href={link.url}
                target="_blank"
                rel="noreferrer"
                variant="outlined"
                size="small"
                startIcon={<OpenInNewOutlinedIcon fontSize="small" />}
                sx={{ textTransform: "none" }}
              >
                {link.label}
              </Button>
            ))}
            {notice.linkSistemaOrigem && !notice.officialLinks.some((l) => l.url === notice.linkSistemaOrigem) && (
              <Button
                component={Link}
                href={notice.linkSistemaOrigem}
                target="_blank"
                rel="noreferrer"
                variant="outlined"
                size="small"
                startIcon={<OpenInNewOutlinedIcon fontSize="small" />}
                sx={{ textTransform: "none" }}
              >
                Sistema de origem
              </Button>
            )}
            {notice.linkProcessoEletronico && (
              <Button
                component={Link}
                href={notice.linkProcessoEletronico}
                target="_blank"
                rel="noreferrer"
                variant="outlined"
                size="small"
                startIcon={<OpenInNewOutlinedIcon fontSize="small" />}
                sx={{ textTransform: "none" }}
              >
                Processo eletrônico
              </Button>
            )}
          </Stack>
        </Paper>
      )}
    </Stack>
  );
}

function TabItens({ id }: { id: string }) {
  const { data: items, isLoading } = useNoticeItems(id);

  if (isLoading) {
    return (
      <Stack spacing={1}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} variant="rectangular" height={48} />
        ))}
      </Stack>
    );
  }

  if (!items || items.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        Nenhum item encontrado para este edital.
      </Typography>
    );
  }

  const totalEstimado = items.reduce((sum, item) => sum + (item.valorTotal ?? 0), 0);

  return (
    <TableContainer component={Paper} variant="outlined">
      <Table size="small">
        <TableHead>
          <TableRow sx={{ bgcolor: "grey.50" }}>
            <TableCell component="th" scope="col" sx={{ fontWeight: 600, width: 60 }}>Nº</TableCell>
            <TableCell component="th" scope="col" sx={{ fontWeight: 600 }}>Descrição</TableCell>
            <TableCell component="th" scope="col" sx={{ fontWeight: 600 }}>Tipo</TableCell>
            <TableCell component="th" scope="col" sx={{ fontWeight: 600 }} align="right">Qtd</TableCell>
            <TableCell component="th" scope="col" sx={{ fontWeight: 600 }}>Unid.</TableCell>
            <TableCell component="th" scope="col" sx={{ fontWeight: 600 }} align="right">Vl. Unit. Est.</TableCell>
            <TableCell component="th" scope="col" sx={{ fontWeight: 600 }} align="right">Vl. Total</TableCell>
            <TableCell component="th" scope="col" sx={{ fontWeight: 600 }}>Situação</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.numeroItem} hover>
              <TableCell>{item.numeroItem}</TableCell>
              <TableCell>{item.descricao}</TableCell>
              <TableCell>
                <Chip
                  label={item.materialOuServicoNome}
                  size="small"
                  variant="outlined"
                  color={item.materialOuServico === "S" ? "info" : "default"}
                />
              </TableCell>
              <TableCell align="right">{item.quantidade ?? "—"}</TableCell>
              <TableCell>{item.unidadeMedida ?? "—"}</TableCell>
              <TableCell align="right">{fmtCurrency(item.valorUnitarioEstimado)}</TableCell>
              <TableCell align="right">{fmtCurrency(item.valorTotal)}</TableCell>
              <TableCell>{item.situacaoCompraItemNome ?? "—"}</TableCell>
            </TableRow>
          ))}
          <TableRow sx={{ bgcolor: "grey.50" }}>
            <TableCell colSpan={6} sx={{ fontWeight: 600 }}>
              Total estimado
            </TableCell>
            <TableCell align="right" sx={{ fontWeight: 700 }}>
              {fmtCurrency(totalEstimado)}
            </TableCell>
            <TableCell />
          </TableRow>
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function TabAnexos({ id }: { id: string }) {
  const { data: archives, isLoading } = useNoticeArchives(id);

  if (isLoading) {
    return (
      <Stack spacing={1.5}>
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} variant="rectangular" height={64} />
        ))}
      </Stack>
    );
  }

  if (!archives || archives.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        Nenhum anexo encontrado para este edital.
      </Typography>
    );
  }

  return (
    <Stack spacing={1.5}>
      {archives.map((arq) => (
        <Paper key={arq.sequencialDocumento} variant="outlined" sx={{ p: 2 }}>
          <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ sm: "center" }} gap={1.5}>
            <ArticleOutlinedIcon color="action" />
            <Box sx={{ flex: 1 }}>
              <Typography variant="body2" fontWeight={500}>
                {arq.titulo}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {arq.tipoDocumentoNome}
              </Typography>
            </Box>
            <Button
              component={Link}
              href={arq.url}
              target="_blank"
              rel="noreferrer"
              variant="outlined"
              size="small"
              startIcon={<DownloadOutlinedIcon fontSize="small" />}
              sx={{ textTransform: "none", flexShrink: 0 }}
            >
              Baixar
            </Button>
          </Stack>
        </Paper>
      ))}
    </Stack>
  );
}

function TabHistorico({ notice }: { notice: ReturnType<typeof useNotice>["data"] & object }) {
  if (!notice) return null;
  const entries = notice.timeline ?? [];
  return (
    <Box sx={{ maxWidth: 480 }}>
      {entries.length === 0 ? (
        <Typography variant="body2" color="text.secondary">Sem histórico disponível.</Typography>
      ) : (
        entries.map((entry, idx) => (
          <TimelineEntry
            key={entry.kind}
            label={entry.label}
            value={entry.value}
            isLast={idx === entries.length - 1}
          />
        ))
      )}
    </Box>
  );
}

export function NoticeDetailView({ id }: { id: string }) {
  const [tab, setTab] = useState(0);
  const [aiDrawerOpen, setAiDrawerOpen] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const noticeQuery = useNotice(id);

  if (noticeQuery.isLoading) {
    return (
      <Paper sx={{ p: 3 }}>
        <Typography color="text.secondary">Carregando edital...</Typography>
      </Paper>
    );
  }

  if (noticeQuery.isError || !noticeQuery.data) {
    return (
      <Paper sx={{ p: 3 }}>
        <Typography color="error">Não foi possível carregar o edital.</Typography>
      </Paper>
    );
  }

  const notice = noticeQuery.data;
  const returnTo = resolveSafeReturnTo(searchParams.get(NOTICE_RETURN_TO_PARAM));

  const handleGoBack = () => {
    if (returnTo) {
      router.push(appendHighlightToReturnTo(returnTo, notice.id));
      return;
    }

    router.push("/dashboard");
  };

  return (
    <Stack spacing={3}>
      {/* Header */}
      <Paper sx={{ p: 3, borderTop: "3px solid", borderColor: "primary.main" }} component="article" aria-label="Detalhes do edital">
        <Stack spacing={2}>
          <Box>
            <Button
              variant="text"
              color="inherit"
              startIcon={<ArrowBackOutlinedIcon aria-hidden />}
              onClick={handleGoBack}
              sx={{ px: 0, minWidth: "auto" }}
            >
              Voltar para a lista
            </Button>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
            <NoticeStatusBadge status={notice.status} />
          </Box>
          <Typography component="h2" variant="h5" fontWeight={700} sx={{ maxWidth: 900, lineHeight: 1.35 }}>
            {notice.object}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {notice.orgaoEntidade ?? notice.agency}
            {notice.unidadeOrgao && ` — ${notice.unidadeOrgao}`}
          </Typography>
          {notice.cnpjOrgao && (
            <Typography variant="caption" color="text.secondary">
              CNPJ: {notice.cnpjOrgao}
            </Typography>
          )}
        </Stack>
      </Paper>

      {/* Tabs */}
      <Paper sx={{ overflow: "hidden" }}>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          aria-label="Seções do edital"
          sx={{ borderBottom: 1, borderColor: "divider", px: 2, minHeight: 48 }}
        >
          <Tab id="tab-detalhes" aria-controls="panel-detalhes" label="Detalhes" />
          <Tab id="tab-itens" aria-controls="panel-itens" label="Itens" />
          <Tab id="tab-anexos" aria-controls="panel-anexos" label="Anexos" />
          <Tab id="tab-historico" aria-controls="panel-historico" label="Histórico" />
        </Tabs>
        <Box
          role="tabpanel"
          id="panel-detalhes"
          aria-labelledby="tab-detalhes"
          hidden={tab !== 0}
          sx={{ p: 3, ...(tab !== 0 && { display: "none" }) }}
        >
          {tab === 0 && <TabDetalhes notice={notice} />}
        </Box>
        <Box
          role="tabpanel"
          id="panel-itens"
          aria-labelledby="tab-itens"
          hidden={tab !== 1}
          sx={{ p: 3, ...(tab !== 1 && { display: "none" }) }}
        >
          {tab === 1 && <TabItens id={id} />}
        </Box>
        <Box
          role="tabpanel"
          id="panel-anexos"
          aria-labelledby="tab-anexos"
          hidden={tab !== 2}
          sx={{ p: 3, ...(tab !== 2 && { display: "none" }) }}
        >
          {tab === 2 && <TabAnexos id={id} />}
        </Box>
        <Box
          role="tabpanel"
          id="panel-historico"
          aria-labelledby="tab-historico"
          hidden={tab !== 3}
          sx={{ p: 3, ...(tab !== 3 && { display: "none" }) }}
        >
          {tab === 3 && <TabHistorico notice={notice} />}
        </Box>
      </Paper>

      <AIChatFab open={aiDrawerOpen} onClick={() => setAiDrawerOpen((o) => !o)} />
      <AIChatDrawer open={aiDrawerOpen} onClose={() => setAiDrawerOpen(false)} noticeId={notice.id} />
    </Stack>
  );
}
