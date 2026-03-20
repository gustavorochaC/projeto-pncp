"use client";

import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import type {
  NoticeMultiTermMode,
  NoticeSearchTermGroup,
} from "@pncp/types";

const ALL_TERMS_TAB_VALUE = "__all_terms__";

interface SearchDashboardMultiTermControlsProps {
  searchTerms: string[];
  multiTermMode: NoticeMultiTermMode;
  activeTerm?: string;
  termGroups: NoticeSearchTermGroup[];
  onModeChange: (mode: NoticeMultiTermMode) => void;
  onActiveTermChange: (term?: string) => void;
}

export function SearchDashboardMultiTermControls({
  searchTerms,
  multiTermMode,
  activeTerm,
  termGroups,
  onModeChange,
  onActiveTermChange,
}: SearchDashboardMultiTermControlsProps) {
  if (searchTerms.length <= 1) {
    return null;
  }

  const termTotals = new Map(termGroups.map((group) => [group.term, group.total]));
  const currentTabValue = activeTerm ?? ALL_TERMS_TAB_VALUE;

  return (
    <Paper sx={{ p: 2.5 }}>
      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", md: "row" },
          alignItems: { xs: "flex-start", md: "center" },
          justifyContent: "space-between",
          gap: 2,
        }}
      >
        <Box>
          <Typography variant="subtitle2" fontWeight={700} color="text.primary">
            Metodo da busca por palavras
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Escolha se quer juntar os editais por qualquer termo ou exigir todas
            as palavras no mesmo edital.
          </Typography>
        </Box>

        <ToggleButtonGroup
          exclusive
          color="primary"
          size="small"
          value={multiTermMode}
          onChange={(_event, nextMode: NoticeMultiTermMode | null) => {
            if (nextMode) {
              onModeChange(nextMode);
            }
          }}
          aria-label="Modo da busca multi-termo"
        >
          <ToggleButton value="any" aria-label="Qualquer palavra">
            Qualquer palavra
          </ToggleButton>
          <ToggleButton value="same_notice" aria-label="Mesmo edital">
            Mesmo edital
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {multiTermMode === "any" ? (
        <Tabs
          value={currentTabValue}
          onChange={(_event, value: string) => {
            onActiveTermChange(
              value === ALL_TERMS_TAB_VALUE ? undefined : value,
            );
          }}
          variant="scrollable"
          allowScrollButtonsMobile
          sx={{ mt: 2 }}
          aria-label="Abas por termo pesquisado"
        >
          <Tab label="Todos" value={ALL_TERMS_TAB_VALUE} />
          {searchTerms.map((term) => {
            const total = termTotals.get(term);
            const label =
              typeof total === "number" ? `${term} (${total})` : term;

            return <Tab key={term} label={label} value={term} />;
          })}
        </Tabs>
      ) : null}
    </Paper>
  );
}
