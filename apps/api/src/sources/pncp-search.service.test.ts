import { describe, expect, it } from "vitest";
import type { NoticeQueryDto } from "../notices/dto/notice-query.dto";
import { mapNoticeQueryToPncpSearchParams, mapNoticeSortToPncp } from "./pncp-search.service";

describe("mapNoticeSortToPncp", () => {
  it("maps known sort options to PNCP values", () => {
    expect(mapNoticeSortToPncp("relevance")).toBe("relevancia");
    expect(mapNoticeSortToPncp("publishedAt:desc")).toBe("-data");
    expect(mapNoticeSortToPncp("closingAt:asc")).toBe("data");
    expect(mapNoticeSortToPncp("estimatedValue:desc")).toBe("valor");
    expect(mapNoticeSortToPncp("estimatedValue:asc")).toBe("-valor");
  });
});

describe("mapNoticeQueryToPncpSearchParams", () => {
  it("uses defaults expected by PNCP search", () => {
    const query = {
      page: 1,
      pageSize: 20,
      sort: "publishedAt:desc"
    } as NoticeQueryDto;

    const params = mapNoticeQueryToPncpSearchParams(query);

    expect(params.get("tipos_documento")).toBe("edital");
    expect(params.get("pagina")).toBe("1");
    expect(params.get("tam_pagina")).toBe("20");
    expect(params.get("ordenacao")).toBe("-data");
    expect(params.get("status")).toBe("recebendo_proposta");
  });

  it("maps explicit filters and ids", () => {
    const query = {
      query: "cadeiras",
      status: "ENCERRADAS",
      state: "sp",
      agencyId: "123|456",
      modalityId: "6",
      municipioId: "3550308",
      page: 2,
      pageSize: 50,
      sort: "relevance"
    } as NoticeQueryDto;

    const params = mapNoticeQueryToPncpSearchParams(query);

    expect(params.get("q")).toBe("cadeiras");
    expect(params.get("status")).toBe("encerradas");
    expect(params.get("ufs")).toBe("SP");
    expect(params.get("orgaos")).toBe("123|456");
    expect(params.get("modalidades")).toBe("6");
    expect(params.get("municipios")).toBe("3550308");
    expect(params.get("pagina")).toBe("2");
    expect(params.get("tam_pagina")).toBe("50");
    expect(params.get("ordenacao")).toBe("relevancia");
  });

  it("keeps textual filters in q when id filters are not available", () => {
    const query = {
      query: "cadeiras",
      agency: "prefeitura",
      city: "salvador",
      modality: "pregao",
      page: 1,
      pageSize: 20,
      sort: "publishedAt:desc"
    } as NoticeQueryDto;

    const params = mapNoticeQueryToPncpSearchParams(query);

    expect(params.get("q")).toBe("cadeiras prefeitura salvador pregao");
    expect(params.get("orgaos")).toBeNull();
    expect(params.get("municipios")).toBeNull();
    expect(params.get("modalidades")).toBeNull();
  });
});
