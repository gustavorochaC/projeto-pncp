import { afterEach, describe, expect, it, vi } from "vitest";
import { PncpConsultaService } from "./pncp-consulta.service";

describe("PncpConsultaService", () => {
  const originalTimeout = process.env.PNCP_CONSULTA_TIMEOUT_MS;
  const originalRetries = process.env.PNCP_CONSULTA_MAX_RETRIES;

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    restoreEnv("PNCP_CONSULTA_TIMEOUT_MS", originalTimeout);
    restoreEnv("PNCP_CONSULTA_MAX_RETRIES", originalRetries);
  });

  it("does not retry when PNCP returns 404", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);

    const service = new PncpConsultaService();
    const result = await service.getCompra({
      cnpjOrgao: "13891536000196",
      anoCompra: 2026,
      sequencialCompra: 11
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.kind).toBe("not_found");
  });

  it("retries transient HTTP failures and returns payload when successful", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("temporario", { status: 500 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            numeroControlePNCP: "13891536000196-1-000011/2026"
          }),
          { status: 200 }
        )
      );
    vi.stubGlobal("fetch", fetchMock);

    const service = new PncpConsultaService();
    const promise = service.getCompra({
      cnpjOrgao: "13891536000196",
      anoCompra: 2026,
      sequencialCompra: 11
    });

    await vi.runAllTimersAsync();
    const result = await promise;

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.kind).toBe("ok");
  });

  it("returns transient_failure after retrying network errors", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockRejectedValue(new Error("network down"));
    vi.stubGlobal("fetch", fetchMock);

    const service = new PncpConsultaService();
    const promise = service.getCompra({
      cnpjOrgao: "13891536000196",
      anoCompra: 2026,
      sequencialCompra: 11
    });

    await vi.runAllTimersAsync();
    const result = await promise;

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.kind).toBe("transient_failure");
  });

  it("respects retry configuration from environment", async () => {
    process.env.PNCP_CONSULTA_MAX_RETRIES = "2";
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockRejectedValue(new Error("network down"));
    vi.stubGlobal("fetch", fetchMock);

    const service = new PncpConsultaService();
    const promise = service.getCompra({
      cnpjOrgao: "13891536000196",
      anoCompra: 2026,
      sequencialCompra: 11
    });

    await vi.runAllTimersAsync();
    const result = await promise;

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result.kind).toBe("transient_failure");
  });

  it("fetches all item pages using pagina and tamanhoPagina", async () => {
    const buildItems = (start: number, count: number) =>
      Array.from({ length: count }, (_, index) => ({
        numeroItem: start + index,
        descricao: `Item ${start + index}`,
        materialOuServico: "M",
        materialOuServicoNome: "Material",
        valorUnitarioEstimado: null,
        valorTotal: null,
        quantidade: null,
        unidadeMedida: null,
        criterioJulgamentoNome: null,
        situacaoCompraItemNome: null,
        temResultado: false
      }));

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(buildItems(1, 50)), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(buildItems(51, 7)), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const service = new PncpConsultaService();
    const result = await service.getItens({
      cnpjOrgao: "13891536000196",
      anoCompra: 2026,
      sequencialCompra: 11
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("pagina=1");
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("tamanhoPagina=50");
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("pagina=2");
    expect(result).toHaveLength(57);
    expect(result[0]?.numeroItem).toBe(1);
    expect(result[56]?.numeroItem).toBe(57);
  });
});

function restoreEnv(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}
