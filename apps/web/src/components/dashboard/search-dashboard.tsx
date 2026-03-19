"use client";

import { useDeferredValue, useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import FormControl from "@mui/material/FormControl";
import InputAdornment from "@mui/material/InputAdornment";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import Grid from "@mui/material/Grid2";
import SearchOutlinedIcon from "@mui/icons-material/SearchOutlined";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import type { NoticeSearchFilters } from "@pncp/types";
import { useNotices } from "@/hooks/use-notices";
import { NoticeCardList } from "@/components/notices/notice-card-list";
import {
  buildNoticeSearchParams,
  defaultNoticeFilters,
} from "@/lib/notice-navigation";

interface SearchDashboardProps {
  initialFilters: NoticeSearchFilters;
  initialHighlightNoticeId?: string | null;
}

export function SearchDashboard({
  initialFilters,
  initialHighlightNoticeId = null,
}: SearchDashboardProps) {
  const [filters, setFilters] = useState<NoticeSearchFilters>(initialFilters);
  const [highlightedNoticeId, setHighlightedNoticeId] = useState<string | null>(
    initialHighlightNoticeId,
  );
  const deferredQuery = useDeferredValue(filters.query);

  useEffect(() => {
    const searchParams = buildNoticeSearchParams(filters);
    const queryString = searchParams.toString();
    window.history.replaceState(null, "", queryString ? `?${queryString}` : window.location.pathname);
  }, [filters]);

  const effectiveFilters = { ...filters, query: deferredQuery };
  const noticesQuery = useNotices(effectiveFilters);

  useEffect(() => {
    if (!highlightedNoticeId || !noticesQuery.data?.items.length) {
      return;
    }

    const targetElement = document.querySelector<HTMLElement>(
      `[data-notice-id="${highlightedNoticeId}"]`,
    );

    if (!targetElement) {
      return;
    }

    targetElement.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });

    const timeoutId = window.setTimeout(() => {
      setHighlightedNoticeId(null);
    }, 2400);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [highlightedNoticeId, noticesQuery.data]);

  return (
    <Stack spacing={3}>
      <Paper sx={{ p: 3, borderTop: "3px solid", borderColor: "primary.main" }}>
        <Stack spacing={3}>
          <Typography variant="h6" fontWeight={600} color="text.primary">
            Filtros de busca
          </Typography>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, lg: 6 }}>
              <TextField
                fullWidth
                size="medium"
                id="search-query"
                label="Buscar licitações"
                placeholder="Ex.: material de escritório"
                value={filters.query ?? ""}
                onChange={(e) =>
                  setFilters((c) => ({ ...c, query: e.target.value, page: 1 }))
                }
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchOutlinedIcon fontSize="small" sx={{ color: "text.secondary" }} aria-hidden />
                      </InputAdornment>
                    ),
                  },
                }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4, lg: 2 }}>
              <TextField
                fullWidth
                size="small"
                id="filter-state"
                label="UF"
                placeholder="Ex.: SP"
                value={filters.state ?? ""}
                onChange={(e) => setFilters((c) => ({ ...c, state: e.target.value, page: 1 }))}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4, lg: 2 }}>
              <TextField
                fullWidth
                size="small"
                id="filter-city"
                label="Município"
                placeholder="Ex.: São Paulo"
                value={filters.city ?? ""}
                onChange={(e) => setFilters((c) => ({ ...c, city: e.target.value, page: 1 }))}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4, lg: 2 }}>
              <TextField
                fullWidth
                size="small"
                id="filter-modality"
                label="Modalidade"
                placeholder="Ex.: Pregão"
                value={filters.modality ?? ""}
                onChange={(e) =>
                  setFilters((c) => ({ ...c, modality: e.target.value, page: 1 }))
                }
              />
            </Grid>
          </Grid>
          <Stack direction="row" flexWrap="wrap" alignItems="center" gap={2}>
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel id="sort-label">Ordenar</InputLabel>
              <Select
                labelId="sort-label"
                label="Ordenar"
                value={filters.sort}
                onChange={(e) =>
                  setFilters((c) => ({
                    ...c,
                    sort: e.target.value as NoticeSearchFilters["sort"],
                    page: 1,
                  }))
                }
              >
                <MenuItem value="relevance">Relevância</MenuItem>
                <MenuItem value="publishedAt:desc">Mais recentes</MenuItem>
                <MenuItem value="closingAt:asc">Encerramento mais próximo</MenuItem>
                <MenuItem value="estimatedValue:desc">Maior valor</MenuItem>
                <MenuItem value="estimatedValue:asc">Menor valor</MenuItem>
              </Select>
            </FormControl>
            <Button
              variant={filters.onlyOpen ? "contained" : "outlined"}
              onClick={() =>
                setFilters((c) => ({ ...c, onlyOpen: !c.onlyOpen, page: 1 }))
              }
            >
              Somente em aberto
            </Button>
            <Button
              variant="text"
              onClick={() => {
                setFilters(defaultNoticeFilters);
                setHighlightedNoticeId(null);
              }}
            >
              Limpar filtros
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {noticesQuery.isLoading ? (
        <Paper sx={{ p: 3 }}>
          <Typography color="text.secondary">Carregando oportunidades...</Typography>
        </Paper>
      ) : noticesQuery.isError ? (
        <Alert severity="error" role="alert">
          Não foi possível carregar os editais agora. Tente novamente em alguns instantes.
        </Alert>
      ) : noticesQuery.data?.items.length ? (
        <Box
          sx={{
            "@keyframes fadeInUp": {
              from: { opacity: 0, transform: "translateY(8px)" },
              to: { opacity: 1, transform: "translateY(0)" },
            },
            animation: "fadeInUp 0.35s ease-out",
            "@media (prefers-reduced-motion: reduce)": {
              animation: "none",
            },
          }}
        >
          <Stack spacing={2}>
            <NoticeCardList
              items={noticesQuery.data.items}
              highlightedNoticeId={highlightedNoticeId}
            />
            <Paper sx={{ p: 2.5, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Página {noticesQuery.data.page} de {noticesQuery.data.totalPages} · {noticesQuery.data.total} resultados
            </Typography>
            <Stack direction="row" spacing={1}>
              <Button
                variant="outlined"
                size="small"
                disabled={filters.page === 1}
                startIcon={<ChevronLeftIcon aria-hidden />}
                onClick={() =>
                  setFilters((c) => ({
                    ...c,
                    page: Math.max((c.page ?? 1) - 1, 1),
                  }))
                }
                aria-label="Página anterior"
              >
                Anterior
              </Button>
              <Button
                variant="outlined"
                size="small"
                disabled={filters.page === noticesQuery.data.totalPages}
                endIcon={<ChevronRightIcon aria-hidden />}
                onClick={() =>
                  setFilters((c) => ({
                    ...c,
                    page: Math.min(
                      (c.page ?? 1) + 1,
                      noticesQuery.data!.totalPages
                    ),
                  }))
                }
                aria-label="Próxima página"
              >
                Próxima
              </Button>
            </Stack>
          </Paper>
          </Stack>
        </Box>
      ) : (
        <Alert severity="info">
          Nenhum edital encontrado para os filtros atuais.
        </Alert>
      )}
    </Stack>
  );
}
