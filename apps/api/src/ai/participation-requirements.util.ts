import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type {
  AICitation,
  ParticipationInference,
  ParticipationMissingEvidence,
  ParticipationRequirement,
  ParticipationRequirementCategory,
  ParticipationRequirementsResult,
} from '@pncp/types';

const SKILL_FILE_NAME = 'participation-requirements.skill.md';
const PROMPT_TEMPLATE_MARKER = '## Template de uso manual no Ollama';

let cachedSkillInstructions: string | null = null;

export const PARTICIPATION_REQUIREMENTS_MODE = 'participation_requirements' as const;
export const PARTICIPATION_REQUIREMENTS_QUESTION =
  'Extrair requisitos de participacao e habilitacao deste edital.';

export function getParticipationRequirementsSkillInstructions(): string {
  if (cachedSkillInstructions) {
    return cachedSkillInstructions;
  }

  const filePath = resolveSkillPath();
  const raw = readFileSync(filePath, 'utf8');
  const withoutFrontmatter = raw.replace(/^---[\s\S]*?---\s*/, '');
  const withoutTemplate = withoutFrontmatter.includes(PROMPT_TEMPLATE_MARKER)
    ? withoutFrontmatter.split(PROMPT_TEMPLATE_MARKER)[0]!.trim()
    : withoutFrontmatter.trim();

  cachedSkillInstructions = withoutTemplate;
  return cachedSkillInstructions;
}

export function parseParticipationRequirementsResult(rawText: string): ParticipationRequirementsResult {
  const jsonPayload = extractJsonPayload(rawText);
  const parsed = JSON.parse(jsonPayload) as unknown;
  const normalized = coerceParticipationRequirementsResult(parsed);

  if (!normalized) {
    throw new Error('A IA retornou um payload de requisitos em formato invalido.');
  }

  return normalized;
}

export function coerceParticipationRequirementsResult(
  value: unknown,
): ParticipationRequirementsResult | null {
  const record = asRecord(value);
  const hasKnownShape =
    record.kind === 'participation_requirements' ||
    'explicitRequirements' in record ||
    'explicit_requirements' in record ||
    'possibleInferences' in record ||
    'possible_inferences' in record ||
    'missingEvidence' in record ||
    'missing_evidence' in record;

  if (!hasKnownShape) {
    return null;
  }

  return {
    kind: 'participation_requirements',
    explicitRequirements: readParticipationRequirements(
      record.explicitRequirements ?? record.explicit_requirements,
    ),
    possibleInferences: readParticipationInferences(
      record.possibleInferences ?? record.possible_inferences,
    ),
    missingEvidence: readMissingEvidence(record.missingEvidence ?? record.missing_evidence),
    documentsReviewed: readStringArray(record.documentsReviewed ?? record.documents_reviewed),
    analysisNotes: readStringArray(record.analysisNotes ?? record.analysis_notes),
  };
}

export function buildParticipationRequirementsChatAnswer(
  result: ParticipationRequirementsResult,
): string {
  const categoryCount = new Set(result.explicitRequirements.map((item) => item.category)).size;
  const explicitCount = result.explicitRequirements.length;
  const inferenceCount = result.possibleInferences.length;
  const missingCount = result.missingEvidence.length;
  const reviewedCount = result.documentsReviewed.length;

  const parts = [
    `Encontrei ${explicitCount} requisito${explicitCount === 1 ? '' : 's'} explicito${explicitCount === 1 ? '' : 's'} de participacao`,
    categoryCount > 0 ? `em ${categoryCount} categoria${categoryCount === 1 ? '' : 's'}` : null,
    reviewedCount > 0 ? `com base em ${reviewedCount} documento${reviewedCount === 1 ? '' : 's'}` : null,
  ].filter(Boolean);

  const suffix: string[] = [];
  if (inferenceCount > 0) {
    suffix.push(`${inferenceCount} inferencia${inferenceCount === 1 ? '' : 's'}`);
  }
  if (missingCount > 0) {
    suffix.push(`${missingCount} lacuna${missingCount === 1 ? '' : 's'} de evidencia`);
  }

  return suffix.length > 0
    ? `${parts.join(' ')}. Tambem destaquei ${suffix.join(' e ')}.`
    : `${parts.join(' ')}.`;
}

export function buildParticipationRequirementsCitations(
  result: ParticipationRequirementsResult,
  documentUrlByName = new Map<string, string>(),
): AICitation[] {
  const citations: AICitation[] = [];
  const seen = new Set<string>();

  const items = [...result.explicitRequirements, ...result.possibleInferences];
  for (const item of items) {
    const excerpt = item.evidenceExcerpt.trim();
    if (!excerpt) {
      continue;
    }

    const key = `${item.sourceDocument}::${excerpt}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    citations.push({
      title: item.sourceDocument,
      excerpt,
      sourceUrl: documentUrlByName.get(item.sourceDocument),
    });

    if (citations.length >= 6) {
      break;
    }
  }

  return citations;
}

function resolveSkillPath(): string {
  const candidates = [
    join(process.cwd(), 'apps', 'api', 'src', 'ai', 'prompts', SKILL_FILE_NAME),
    join(process.cwd(), 'src', 'ai', 'prompts', SKILL_FILE_NAME),
    join(process.cwd(), 'apps', 'api', 'dist', 'apps', 'api', 'src', 'ai', 'prompts', SKILL_FILE_NAME),
    join(process.cwd(), 'dist', 'apps', 'api', 'src', 'ai', 'prompts', SKILL_FILE_NAME),
  ];

  const existing = candidates.find((candidate) => existsSync(candidate));
  if (!existing) {
    throw new Error(`Prompt de requisitos de participacao nao encontrado: ${SKILL_FILE_NAME}`);
  }

  return existing;
}

function extractJsonPayload(rawText: string): string {
  const trimmed = rawText.trim();
  if (!trimmed) {
    throw new Error('A IA retornou uma resposta vazia.');
  }

  try {
    JSON.parse(trimmed);
    return trimmed;
  } catch {
    const firstBrace = trimmed.indexOf('{');
    const lastBrace = trimmed.lastIndexOf('}');

    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
      throw new Error('A IA nao retornou JSON valido.');
    }

    const candidate = trimmed.slice(firstBrace, lastBrace + 1);
    JSON.parse(candidate);
    return candidate;
  }
}

function readParticipationRequirements(value: unknown): ParticipationRequirement[] {
  return readArray(value)
    .map((item) => {
      const record = asRecord(item);
      const category = readCategory(record.category);
      const subcategory = readString(record.subcategory);
      const requirement = readString(record.requirement);
      const normalizedTerm = readString(record.normalizedTerm ?? record.normalized_term);
      const mandatoryLevel = readMandatoryLevel(record.mandatoryLevel ?? record.mandatory_level);
      const appliesTo = readString(record.appliesTo ?? record.applies_to);
      const sourceDocument = readString(record.sourceDocument ?? record.source_document);
      const evidenceExcerpt = readString(record.evidenceExcerpt ?? record.evidence_excerpt);
      const confidence = readConfidence(record.confidence);

      if (
        !category ||
        !subcategory ||
        !requirement ||
        !normalizedTerm ||
        !mandatoryLevel ||
        !appliesTo ||
        !sourceDocument ||
        !evidenceExcerpt ||
        !confidence
      ) {
        return null;
      }

      return {
        category,
        subcategory,
        requirement,
        normalizedTerm,
        mandatoryLevel,
        appliesTo,
        sourceDocument,
        evidenceExcerpt,
        confidence,
      } satisfies ParticipationRequirement;
    })
    .filter((item): item is ParticipationRequirement => item !== null);
}

function readParticipationInferences(value: unknown): ParticipationInference[] {
  return readArray(value)
    .map((item) => {
      const record = asRecord(item);
      const base = readParticipationRequirements([record])[0];
      const reasoning = readString(record.reasoning);

      if (!base || !reasoning) {
        return null;
      }

      return {
        ...base,
        reasoning,
      } satisfies ParticipationInference;
    })
    .filter((item): item is ParticipationInference => item !== null);
}

function readMissingEvidence(value: unknown): ParticipationMissingEvidence[] {
  return readArray(value)
    .map((item) => {
      const record = asRecord(item);
      const topic = readString(record.topic);
      const reason = readString(record.reason);
      const recommendedFollowup = readString(
        record.recommendedFollowup ?? record.recommended_followup,
      );

      if (!topic || !reason || !recommendedFollowup) {
        return null;
      }

      return {
        topic,
        reason,
        recommendedFollowup,
      } satisfies ParticipationMissingEvidence;
    })
    .filter((item): item is ParticipationMissingEvidence => item !== null);
}

function readStringArray(value: unknown): string[] {
  return readArray(value)
    .map(readString)
    .filter((item): item is string => Boolean(item));
}

function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function readString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function readCategory(value: unknown): ParticipationRequirementCategory | null {
  const normalized = readString(value);
  switch (normalized) {
    case 'habilitacao_juridica':
    case 'regularidade_fiscal_trabalhista':
    case 'qualificacao_economico_financeira':
    case 'qualificacao_tecnica':
    case 'certificacao':
    case 'registro_licenca_credenciamento':
    case 'declaracao_obrigatoria':
    case 'outro_requisito_de_participacao':
      return normalized;
    default:
      return null;
  }
}

function readMandatoryLevel(value: unknown): ParticipationRequirement['mandatoryLevel'] | null {
  const normalized = readString(value);
  switch (normalized) {
    case 'mandatory':
    case 'conditional':
    case 'optional':
    case 'unclear':
      return normalized;
    default:
      return null;
  }
}

function readConfidence(value: unknown): ParticipationRequirement['confidence'] | null {
  const normalized = readString(value);
  switch (normalized) {
    case 'high':
    case 'medium':
    case 'low':
      return normalized;
    default:
      return null;
  }
}
