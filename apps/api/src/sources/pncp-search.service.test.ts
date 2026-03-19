import { describe, expect, it } from "vitest";
import { PNCP_PORTAL_MAX_PAGES, PNCP_PORTAL_PAGE_SIZE } from "@pncp/types";
import type { NoticeQueryDto } from "../notices/dto/notice-query.dto";
import {
  mapNoticeQueryToPncpSearchParams,
  mapNoticeSortToPncp,
  normalizePortalSearchPage,
  resolvePncpSearchStatus
} from "./pncp-search.service";

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
      sort: "publishedAt:desc"
    } as NoticeQueryDto;

    const params = mapNoticeQueryToPncpSearchParams(query);

    expect(params.get("tipos_documento")).toBe("edital");
    expect(params.get("pagina")).toBe("1");
    expect(params.get("tam_pagina")).toBe(String(PNCP_PORTAL_PAGE_SIZE));
    expect(params.get("ordenacao")).toBe("-data");
    expect(params.get("status")).toBe("todos");
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

  it("maps onlyOpen to the open notices status", () => {
    const query = {
      onlyOpen: true,
      page: 1,
      pageSize: 20,
      sort: "publishedAt:desc"
    } as NoticeQueryDto;

    const params = mapNoticeQueryToPncpSearchParams(query);

    expect(params.get("status")).toBe("recebendo_proposta");
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

  it("sends the raw query as-is to PNCP q param for single-term input", () => {
    const query = {
      query: "cadeiras",
      page: 1,
      pageSize: 20,
      sort: "publishedAt:desc"
    } as NoticeQueryDto;

    const params = mapNoticeQueryToPncpSearchParams(query);

    expect(params.get("q")).toBe("cadeiras");
  });

  it("sends comma-separated query verbatim to PNCP q param (no client-side split)", () => {
    const query = {
      query: "cadeiras, mesas",
      page: 1,
      pageSize: 20,
      sort: "publishedAt:desc"
    } as NoticeQueryDto;

    const params = mapNoticeQueryToPncpSearchParams(query);

    expect(params.get("q")).toBe("cadeiras, mesas");
  });
});

describe("resolvePncpSearchStatus", () => {
  it("maps common local status labels to PNCP search tokens", () => {
    expect(resolvePncpSearchStatus({} as NoticeQueryDto)).toBe("todos");
    expect(resolvePncpSearchStatus({ onlyOpen: true } as NoticeQueryDto)).toBe(
      "recebendo_proposta"
    );
    expect(resolvePncpSearchStatus({ status: "aberto" } as NoticeQueryDto)).toBe(
      "recebendo_proposta"
    );
    expect(resolvePncpSearchStatus({ status: "encerrado" } as NoticeQueryDto)).toBe(
      "encerradas"
    );
  });

  it("returns null when the requested status cannot be represented remotely", () => {
    expect(resolvePncpSearchStatus({ status: "revogado" } as NoticeQueryDto)).toBeNull();
    expect(
      resolvePncpSearchStatus({ status: "encerrado", onlyOpen: true } as NoticeQueryDto)
    ).toBeNull();
  });
});

describe("normalizePortalSearchPage", () => {
  it("clamps pages to the same max page accepted by the PNCP portal", () => {
    expect(normalizePortalSearchPage(undefined)).toBe(1);
    expect(normalizePortalSearchPage(0)).toBe(1);
    expect(normalizePortalSearchPage(10)).toBe(10);
    expect(normalizePortalSearchPage(1005)).toBe(PNCP_PORTAL_MAX_PAGES);
  });
});
