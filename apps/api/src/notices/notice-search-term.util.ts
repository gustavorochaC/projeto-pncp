import {
  DEFAULT_NOTICE_MULTI_TERM_MODE,
  parseSearchTerms,
  type NoticeMultiTermMode,
  type NoticeSearchTermGroup,
} from "@pncp/types";
import type { NoticeQueryDto } from "./dto/notice-query.dto";
import type { NoticeListRow } from "./notice-search.mapper";

const SIMPLE_TERM_SEPARATOR = /\s/;
const ACCENT_MARKS_REGEX = /[\u0300-\u036f]/g;

type SearchableNoticeRow = Pick<
  NoticeListRow,
  | "objetoCompra"
  | "nomeOrgao"
  | "municipioNome"
  | "modalidadeNome"
  | "pncpId"
  | "numeroCompra"
>;

export interface NoticeSearchTermContext {
  terms: string[];
  mode: NoticeMultiTermMode;
  activeTerm: string | null;
  hasTerms: boolean;
}

export interface NoticeSearchRowEvaluation {
  row: NoticeListRow;
  matchedTerms: string[];
}

export function createNoticeSearchTermContext(
  query: Pick<NoticeQueryDto, "query" | "multiTermMode" | "activeTerm">,
): NoticeSearchTermContext {
  const terms = parseSearchTerms(query.query);
  const mode = resolveNoticeMultiTermMode(query.multiTermMode);
  const activeTerm =
    mode === "any" && terms.length > 1
      ? resolveActiveTerm(query.activeTerm, terms)
      : null;

  return {
    terms,
    mode,
    activeTerm,
    hasTerms: terms.length > 0,
  };
}

export function evaluateNoticeSearchRows(
  rows: NoticeListRow[],
  context: NoticeSearchTermContext,
): NoticeSearchRowEvaluation[] {
  if (!context.hasTerms) {
    return rows.map((row) => ({ row, matchedTerms: [] }));
  }

  const normalizedFieldsCache = new Map<string, string[]>();
  const variantsCache = new Map<string, string[]>();

  return rows.map((row) => ({
    row,
    matchedTerms: context.terms.filter((term) =>
      matchesNoticeSearchTerm(row, term, normalizedFieldsCache, variantsCache),
    ),
  }));
}

export function filterEvaluationsByContext(
  evaluations: NoticeSearchRowEvaluation[],
  context: NoticeSearchTermContext,
): NoticeSearchRowEvaluation[] {
  if (!context.hasTerms) {
    return evaluations;
  }

  if (context.activeTerm) {
    return evaluations.filter((evaluation) =>
      evaluation.matchedTerms.includes(context.activeTerm!),
    );
  }

  if (context.mode === "same_notice") {
    return evaluations.filter(
      (evaluation) => evaluation.matchedTerms.length === context.terms.length,
    );
  }

  return evaluations.filter((evaluation) => evaluation.matchedTerms.length > 0);
}

export function buildNoticeSearchTermGroups(
  evaluations: NoticeSearchRowEvaluation[],
  terms: string[],
): NoticeSearchTermGroup[] {
  if (terms.length <= 1) {
    return [];
  }

  return terms.map((term) => ({
    term,
    total: evaluations.filter((evaluation) =>
      evaluation.matchedTerms.includes(term),
    ).length,
  }));
}

export function buildNormalizedTermVariants(term: string): string[] {
  const normalized = normalizeSearchText(term);
  if (!normalized) {
    return [];
  }

  const variants = new Set<string>([normalized]);
  if (!SIMPLE_TERM_SEPARATOR.test(term)) {
    if (normalized.endsWith("s") && normalized.length > 1) {
      variants.add(normalized.slice(0, -1));
    } else {
      variants.add(`${normalized}s`);
    }
  }

  return Array.from(variants).filter((value) => value.length > 0);
}

export function matchesNoticeSearchTerm(
  row: SearchableNoticeRow,
  term: string,
  normalizedFieldsCache?: Map<string, string[]>,
  variantsCache?: Map<string, string[]>,
): boolean {
  const normalizedFields =
    normalizedFieldsCache?.get(buildRowCacheKey(row)) ??
    getNormalizedSearchableFields(row);
  const variants =
    variantsCache?.get(term) ?? buildNormalizedTermVariants(term);

  if (normalizedFieldsCache && !normalizedFieldsCache.has(buildRowCacheKey(row))) {
    normalizedFieldsCache.set(buildRowCacheKey(row), normalizedFields);
  }

  if (variantsCache && !variantsCache.has(term)) {
    variantsCache.set(term, variants);
  }

  return normalizedFields.some((field) =>
    variants.some((variant) => field.includes(variant)),
  );
}

function getNormalizedSearchableFields(row: SearchableNoticeRow): string[] {
  return [
    row.objetoCompra,
    row.nomeOrgao,
    row.municipioNome,
    row.modalidadeNome,
    row.pncpId,
    row.numeroCompra,
  ]
    .map((value) => normalizeSearchText(value))
    .filter((value): value is string => value.length > 0);
}

function resolveNoticeMultiTermMode(
  value?: string | null,
): NoticeMultiTermMode {
  return value === "same_notice"
    ? "same_notice"
    : DEFAULT_NOTICE_MULTI_TERM_MODE;
}

function resolveActiveTerm(
  activeTerm: string | undefined,
  terms: string[],
): string | null {
  const normalizedActiveTerm = normalizeSearchText(activeTerm);
  if (!normalizedActiveTerm) {
    return null;
  }

  return (
    terms.find(
      (term) => normalizeSearchText(term) === normalizedActiveTerm,
    ) ?? null
  );
}

function normalizeSearchText(value?: string | null): string {
  if (!value) {
    return "";
  }

  return value
    .trim()
    .normalize("NFD")
    .replace(ACCENT_MARKS_REGEX, "")
    .toLowerCase();
}

function buildRowCacheKey(row: SearchableNoticeRow): string {
  return [
    row.objetoCompra ?? "",
    row.nomeOrgao ?? "",
    row.municipioNome ?? "",
    row.modalidadeNome ?? "",
    row.pncpId ?? "",
    row.numeroCompra ?? "",
  ].join("|");
}
