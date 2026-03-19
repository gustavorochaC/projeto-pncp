"use client";

import { useDeferredValue, useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import FormControl from "@mui/material/FormControl";
import Grid from "@mui/material/Grid2";
import InputAdornment from "@mui/material/InputAdornment";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import SearchOutlinedIcon from "@mui/icons-material/SearchOutlined";
import {
  PNCP_PORTAL_MAX_PAGES,
  type NoticeSearchFilters,
  parseSearchTerms,
} from "@pncp/types";
import {
  formatPortalResultsSummary,
  normalizePortalDashboardFilters,
} from "@/components/dashboard/search-dashboard.utils";
import { NoticeCardList } from "@/components/notices/notice-card-list";
import { useNotices } from "@/hooks/use-notices";
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
  const [filters, setFilters] = useState<NoticeSearchFilters>(() =>
    normalizePortalDashboardFilters(initialFilters),
  );
  const [highlightedNoticeId, setHighlightedNoticeId] = useState<string | null>(
    initialHighlightNoticeId,
  );
  const deferredQuery = useDeferredValue(filters.query);
  const queryChips = parseSearchTerms(filters.query);

  useEffect(() => {
    const normalizedFilters = normalizePortalDashboardFilters(filters);
    const searchParams = buildNoticeSearchParams(normalizedFilters);
    const queryString = searchParams.toString();
    window.history.replaceState(
      null,
      "",
      queryString ? `?${queryString}` : window.location.pathname,
    );
  }, [filters]);

  const effectiveFilters = {
    ...normalizePortalDashboardFilters(filters),
    query: deferredQuery,
  };
  const noticesQuery = useNotices(effectiveFilters);
  const resultsSummary = noticesQuery.data
    ? formatPortalResultsSummary(
        noticesQuery.data.items.length,
        noticesQuery.data.total,
      )
    : null;

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
              <Autocomplete
                multiple
                freeSolo
                options={[]}
                value={queryChips}
                onChange={(_event, newValue) => {
                  const expanded = (newValue as string[]).flatMap((v) =>
                    v
                      .split(",")
                      .map((t) => t.trim())
                      .filter((t) => t.length > 0),
                  );
                  setFilters((current) => ({
                    ...current,
                    query: expanded.join(", "),
                    page: 1,
                  }));
                }}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => {
                    const { key, ...chipProps } = getTagProps({ index });
                    return (
                      <Chip
                        key={key}
                        label={option}
                        size="small"
                        color="primary"
                        variant="outlined"
                        {...chipProps}
                      />
                    );
                  })
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Buscar licitacoes"
                    placeholder={
                      queryChips.length === 0
                        ? "Digite e pressione Enter"
                        : ""
                    }
                    helperText="Digite um termo e pressione Enter para adicionar"
                    InputProps={{
                      ...params.InputProps,
                      startAdornment: (
                        <>
                          <InputAdornment position="start">
                            <SearchOutlinedIcon
                              fontSize="small"
                              sx={{ color: "text.secondary" }}
                              aria-hidden
                            />
                          </InputAdornment>
                          {params.InputProps.startAdornment}
                        </>
                      ),
                    }}
                  />
                )}
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
                onChange={(e) =>
                  setFilters((current) => ({
                    ...current,
                    state: e.target.value,
                    page: 1,
                  }))
                }
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4, lg: 2 }}>
              <TextField
                fullWidth
                size="small"
                id="filter-city"
                label="Municipio"
                placeholder="Ex.: Sao Paulo"
                value={filters.city ?? ""}
                onChange={(e) =>
                  setFilters((current) => ({
                    ...current,
                    city: e.target.value,
                    page: 1,
                  }))
                }
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4, lg: 2 }}>
              <TextField
                fullWidth
                size="small"
                id="filter-modality"
                label="Modalidade"
                placeholder="Ex.: Pregao"
                value={filters.modality ?? ""}
                onChange={(e) =>
                  setFilters((current) => ({
                    ...current,
                    modality: e.target.value,
                    page: 1,
                  }))
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
                  setFilters((current) => ({
                    ...current,
                    sort: e.target.value as NoticeSearchFilters["sort"],
                    page: 1,
                  }))
                }
              >
                <MenuItem value="relevance">Relevancia</MenuItem>
                <MenuItem value="publishedAt:desc">Mais recentes</MenuItem>
                <MenuItem value="closingAt:asc">
                  Encerramento mais proximo
                </MenuItem>
                <MenuItem value="estimatedValue:desc">Maior valor</MenuItem>
                <MenuItem value="estimatedValue:asc">Menor valor</MenuItem>
              </Select>
            </FormControl>
            <Button
              variant={filters.onlyOpen ? "contained" : "outlined"}
              onClick={() =>
                setFilters((current) => ({
                  ...current,
                  onlyOpen: !current.onlyOpen,
                  page: 1,
                }))
              }
            >
              Somente em aberto
            </Button>
            <Button
              variant="text"
              onClick={() => {
                setFilters(normalizePortalDashboardFilters(defaultNoticeFilters));
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
          <Typography color="text.secondary">
            Carregando oportunidades...
          </Typography>
        </Paper>
      ) : noticesQuery.isError ? (
        <Alert severity="error" role="alert">
          Nao foi possivel carregar os editais agora. Tente novamente em alguns
          instantes.
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
            <Paper sx={{ p: 2.5 }}>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1}
                alignItems={{ xs: "flex-start", sm: "center" }}
                justifyContent="space-between"
              >
                <Box>
                  <Typography variant="overline" color="text.secondary">
                    Resultados
                  </Typography>
                  <Typography
                    variant="h6"
                    fontWeight={700}
                    color="text.primary"
                  >
                    {resultsSummary}
                  </Typography>
                </Box>
              </Stack>
            </Paper>

            <NoticeCardList
              items={noticesQuery.data.items}
              highlightedNoticeId={highlightedNoticeId}
            />

            <Paper
              sx={{
                p: 2.5,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 2,
              }}
            >
              <Typography variant="body2" color="text.secondary">
                {resultsSummary}
              </Typography>
              <Stack direction="row" spacing={1}>
                <Button
                  variant="outlined"
                  size="small"
                  disabled={filters.page === 1}
                  startIcon={<ChevronLeftIcon aria-hidden />}
                  onClick={() =>
                    setFilters((current) => ({
                      ...current,
                      page: Math.max((current.page ?? 1) - 1, 1),
                    }))
                  }
                  aria-label="Pagina anterior"
                >
                  Anterior
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  disabled={
                    filters.page === noticesQuery.data.totalPages ||
                    filters.page === PNCP_PORTAL_MAX_PAGES
                  }
                  endIcon={<ChevronRightIcon aria-hidden />}
                  onClick={() =>
                    setFilters((current) => ({
                      ...current,
                      page: Math.min(
                        (current.page ?? 1) + 1,
                        noticesQuery.data!.totalPages,
                      ),
                    }))
                  }
                  aria-label="Proxima pagina"
                >
                  Proxima
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
