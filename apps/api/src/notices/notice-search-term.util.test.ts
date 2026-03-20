import { describe, expect, it } from "vitest";
import {
  buildNormalizedTermVariants,
  matchesNoticeSearchTerm,
} from "./notice-search-term.util";

function buildSearchableRow(overrides?: Partial<Parameters<typeof matchesNoticeSearchTerm>[0]>) {
  return {
    objetoCompra: null,
    nomeOrgao: null,
    municipioNome: null,
    modalidadeNome: null,
    pncpId: "",
    numeroCompra: null,
    ...overrides,
  };
}

describe("buildNormalizedTermVariants", () => {
  it("adds the singular variant for simple plural terms", () => {
    expect(buildNormalizedTermVariants("mesas")).toEqual(["mesas", "mesa"]);
  });

  it("keeps phrases as a single normalized term", () => {
    expect(buildNormalizedTermVariants("mesa escolar")).toEqual([
      "mesa escolar",
    ]);
  });
});

describe("matchesNoticeSearchTerm", () => {
  it("matches text ignoring accents", () => {
    const row = buildSearchableRow({
      objetoCompra: "Contratacao para licitacao eletronica",
    });

    expect(matchesNoticeSearchTerm(row, "licitação")).toBe(true);
  });

  it("matches simple singular and plural variations", () => {
    const row = buildSearchableRow({
      objetoCompra: "Aquisicao de mesa em madeira",
    });

    expect(matchesNoticeSearchTerm(row, "mesas")).toBe(true);
  });

  it("treats phrase terms as a single expression", () => {
    const matchingRow = buildSearchableRow({
      objetoCompra: "Aquisicao de mesa escolar infantil",
    });
    const nonMatchingRow = buildSearchableRow({
      objetoCompra: "Aquisicao de mesa",
      nomeOrgao: "Escolar Municipal",
    });

    expect(matchesNoticeSearchTerm(matchingRow, "mesa escolar")).toBe(true);
    expect(matchesNoticeSearchTerm(nonMatchingRow, "mesa escolar")).toBe(
      false,
    );
  });
});
