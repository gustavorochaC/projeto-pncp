"use client";

import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import type {
  ParticipationInference,
  ParticipationRequirement,
  ParticipationRequirementsResult,
} from "@pncp/types";

const categoryLabels: Record<ParticipationRequirement["category"], string> = {
  habilitacao_juridica: "Habilitacao juridica",
  regularidade_fiscal_trabalhista: "Regularidade fiscal e trabalhista",
  qualificacao_economico_financeira: "Qualificacao economico-financeira",
  qualificacao_tecnica: "Qualificacao tecnica",
  certificacao: "Certificacoes",
  registro_licenca_credenciamento: "Registros, licencas e credenciamentos",
  declaracao_obrigatoria: "Declaracoes obrigatorias",
  outro_requisito_de_participacao: "Outros requisitos",
};

const confidenceColor = {
  high: "success",
  medium: "warning",
  low: "default",
} as const;

const mandatoryColor = {
  mandatory: "error",
  conditional: "warning",
  optional: "info",
  unclear: "default",
} as const;

const mandatoryLabel = {
  mandatory: "Obrigatorio",
  conditional: "Condicional",
  optional: "Opcional",
  unclear: "Nao claro",
} as const;

type RequirementGroup = {
  category: ParticipationRequirement["category"];
  items: ParticipationRequirement[];
};

type InferenceGroup = {
  category: ParticipationInference["category"];
  items: ParticipationInference[];
};

export function AIParticipationRequirementsCard({
  result,
}: {
  result: ParticipationRequirementsResult;
}) {
  const explicitGroups = groupRequirements(result.explicitRequirements);
  const inferenceGroups = groupInferences(result.possibleInferences);

  return (
    <Paper
      variant="outlined"
      sx={{
        mt: 1,
        borderRadius: 2,
        bgcolor: "background.paper",
        borderColor: "divider",
        overflow: "hidden",
      }}
    >
      <Box sx={{ px: 1.5, py: 1.25, bgcolor: "grey.50", borderBottom: "1px solid", borderColor: "divider" }}>
        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
          <Chip
            size="small"
            color="primary"
            label={`${result.explicitRequirements.length} requisito${result.explicitRequirements.length === 1 ? "" : "s"} explicito${result.explicitRequirements.length === 1 ? "" : "s"}`}
          />
          <Chip
            size="small"
            variant="outlined"
            label={`${result.possibleInferences.length} inferencia${result.possibleInferences.length === 1 ? "" : "s"}`}
          />
          <Chip
            size="small"
            variant="outlined"
            label={`${result.missingEvidence.length} lacuna${result.missingEvidence.length === 1 ? "" : "s"} de evidencia`}
          />
        </Stack>
      </Box>

      <Stack spacing={1.25} sx={{ p: 1.25 }}>
        {explicitGroups.length > 0 ? (
          explicitGroups.map((group) => (
            <Accordion key={group.category} disableGutters defaultExpanded elevation={0} sx={accordionSx}>
              <AccordionSummary expandIcon={<ExpandMoreIcon fontSize="small" />}>
                <Typography variant="subtitle2" fontWeight={700}>
                  {categoryLabels[group.category]} ({group.items.length})
                </Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ pt: 0.25 }}>
                <Stack spacing={1}>
                  {group.items.map((item, index) => (
                    <RequirementCard key={`${group.category}-${index}`} item={item} />
                  ))}
                </Stack>
              </AccordionDetails>
            </Accordion>
          ))
        ) : (
          <Typography variant="body2" color="text.secondary">
            Nenhum requisito explicito foi confirmado com as evidencias atuais.
          </Typography>
        )}

        {inferenceGroups.length > 0 && (
          <>
            <Divider />
            <Box>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
                Possiveis inferencias
              </Typography>
              <Stack spacing={1}>
                {inferenceGroups.map((group) => (
                  <Accordion key={`inference-${group.category}`} disableGutters elevation={0} sx={accordionSx}>
                    <AccordionSummary expandIcon={<ExpandMoreIcon fontSize="small" />}>
                      <Typography variant="body2" fontWeight={600}>
                        {categoryLabels[group.category]} ({group.items.length})
                      </Typography>
                    </AccordionSummary>
                    <AccordionDetails sx={{ pt: 0.25 }}>
                      <Stack spacing={1}>
                        {group.items.map((item, index) => (
                          <InferenceCard key={`${group.category}-${index}`} item={item} />
                        ))}
                      </Stack>
                    </AccordionDetails>
                  </Accordion>
                ))}
              </Stack>
            </Box>
          </>
        )}

        {result.missingEvidence.length > 0 && (
          <>
            <Divider />
            <Box>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
                Evidencias faltantes
              </Typography>
              <Stack spacing={1}>
                {result.missingEvidence.map((item, index) => (
                  <Paper key={`${item.topic}-${index}`} variant="outlined" sx={itemPaperSx}>
                    <Typography variant="body2" fontWeight={600}>
                      {item.topic}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      {item.reason}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.75 }}>
                      Proximo passo: {item.recommendedFollowup}
                    </Typography>
                  </Paper>
                ))}
              </Stack>
            </Box>
          </>
        )}

        {result.analysisNotes.length > 0 && (
          <>
            <Divider />
            <Box>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
                Observacoes
              </Typography>
              <Stack spacing={0.75}>
                {result.analysisNotes.map((note, index) => (
                  <Typography key={`${note}-${index}`} variant="body2" color="text.secondary">
                    - {note}
                  </Typography>
                ))}
              </Stack>
            </Box>
          </>
        )}
      </Stack>
    </Paper>
  );
}

function RequirementCard({ item }: { item: ParticipationRequirement }) {
  return (
    <Paper variant="outlined" sx={itemPaperSx}>
      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mb: 0.75 }}>
        <Chip size="small" color={mandatoryColor[item.mandatoryLevel]} label={mandatoryLabel[item.mandatoryLevel]} />
        <Chip size="small" variant="outlined" color={confidenceColor[item.confidence]} label={`Confianca ${item.confidence}`} />
        <Chip size="small" variant="outlined" label={item.sourceDocument} />
        <Chip size="small" variant="outlined" label={item.appliesTo} />
      </Stack>
      <Typography variant="body2" fontWeight={600}>
        {item.requirement}
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.75 }}>
        Termo normalizado: {item.normalizedTerm}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, fontStyle: "italic" }}>
        "{item.evidenceExcerpt}"
      </Typography>
    </Paper>
  );
}

function InferenceCard({ item }: { item: ParticipationInference }) {
  return (
    <Paper variant="outlined" sx={itemPaperSx}>
      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mb: 0.75 }}>
        <Chip size="small" variant="outlined" color={confidenceColor[item.confidence]} label={`Confianca ${item.confidence}`} />
        <Chip size="small" variant="outlined" label={item.sourceDocument} />
      </Stack>
      <Typography variant="body2" fontWeight={600}>
        {item.requirement}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
        {item.reasoning}
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.75, fontStyle: "italic" }}>
        "{item.evidenceExcerpt}"
      </Typography>
    </Paper>
  );
}

function groupRequirements(items: ParticipationRequirement[]): RequirementGroup[] {
  const grouped = new Map<ParticipationRequirement["category"], ParticipationRequirement[]>();

  items.forEach((item) => {
    const current = grouped.get(item.category) ?? [];
    current.push(item);
    grouped.set(item.category, current);
  });

  return [...grouped.entries()].map(([category, groupedItems]) => ({
    category,
    items: groupedItems,
  }));
}

function groupInferences(items: ParticipationInference[]): InferenceGroup[] {
  const grouped = new Map<ParticipationInference["category"], ParticipationInference[]>();

  items.forEach((item) => {
    const current = grouped.get(item.category) ?? [];
    current.push(item);
    grouped.set(item.category, current);
  });

  return [...grouped.entries()].map(([category, groupedItems]) => ({
    category,
    items: groupedItems,
  }));
}

const accordionSx = {
  border: "1px solid",
  borderColor: "divider",
  borderRadius: "12px !important",
  "&:before": { display: "none" },
  bgcolor: "background.paper",
};

const itemPaperSx = {
  p: 1.25,
  borderRadius: 2,
  bgcolor: "grey.50",
};
