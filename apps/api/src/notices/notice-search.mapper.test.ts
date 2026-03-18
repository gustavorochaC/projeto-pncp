import { describe, expect, it } from "vitest";
import { PncpEditalStatus } from "@prisma/client";
import {
  mapPncpEditalRowToNoticeListItem,
  mapPncpSearchItemToPersistableEdital,
  type NoticeListRow
} from "./notice-search.mapper";

describe("mapPncpSearchItemToPersistableEdital", () => {
  it("maps PNCP search item to upsert payload", () => {
    const mapped = mapPncpSearchItemToPersistableEdital(
      {
        numero_controle_pncp: "13891536000196-1-000011/2026",
        orgao_cnpj: "13891536000196",
        orgao_nome: "MUNICIPIO DE AMERICA DOURADA",
        modalidade_licitacao_id: "6",
        modalidade_licitacao_nome: "Pregao - Eletronico",
        situacao_id: "1",
        situacao_nome: "Divulgada no PNCP",
        data_publicacao_pncp: "2026-03-16T16:29:07.577355416",
        data_atualizacao_pncp: "2026-03-16T16:29:07.577355416",
        data_inicio_vigencia: "2026-03-16T16:40:00",
        data_fim_vigencia: "2026-03-26T14:00:00",
        description: "Descricao do edital",
        title: "Edital no 010/2026",
        item_url: "/compras/13891536000196/2026/11",
        ano: "2026",
        numero: "010",
        numero_sequencial: "11"
      },
      new Date("2026-03-16T18:00:00.000Z")
    );

    expect(mapped).not.toBeNull();
    expect(mapped?.create.pncpId).toBe("13891536000196-1-000011/2026");
    expect(mapped?.create.cnpjOrgao).toBe("13891536000196");
    expect(mapped?.create.codigoModalidade).toBe("6");
    expect(mapped?.create.status).toBe(PncpEditalStatus.PUBLICADO);
    expect(mapped?.create.linkEdital).toBeNull();
    expect(mapped?.create.portalUrl).toBeNull();
    expect(mapped?.create.isPublishedOnPncp).toBeNull();
    expect(mapped?.create.anoCompra).toBe(2026);
    expect(mapped?.update.numeroCompra).toBe("010");
  });

  it("returns null when required identifier is missing", () => {
    const mapped = mapPncpSearchItemToPersistableEdital(
      {
        description: "Sem identificador"
      },
      new Date()
    );

    expect(mapped).toBeNull();
  });
});

describe("mapPncpEditalRowToNoticeListItem", () => {
  it("maps persisted row to API list item shape", () => {
    const row = {
      id: "d6f6ca29-bcfd-4ea7-a2dc-c4f2acc0e99e",
      pncpId: "13891536000196-1-000011/2026",
      nomeOrgao: "MUNICIPIO DE AMERICA DOURADA",
      objetoCompra: "Descricao do edital",
      modalidadeNome: "Pregao - Eletronico",
      status: PncpEditalStatus.PUBLICADO,
      situacaoNome: "Divulgada no PNCP",
      uf: "BA",
      municipioNome: "America Dourada",
      dataPublicacaoPncp: new Date("2026-03-16T16:29:07.577Z"),
      dataAberturaProposta: new Date("2026-03-16T16:40:00.000Z"),
      dataEncerramentoProposta: new Date("2026-03-26T14:00:00.000Z"),
      valorTotalEstimado: null,
      linkEdital: "https://pncp.gov.br/api/consulta/v1/orgaos/13891536000196/compras/2026/11/arquivo",
      portalUrl: "https://pncp.gov.br/app/compras/13891536000196/2026/11",
      isPublishedOnPncp: true,
      validatedAt: new Date("2026-03-16T18:00:00.000Z"),
      numeroCompra: "010",
      anoCompra: 2026,
      dataUltimaAtualizacao: new Date("2026-03-16T16:29:07.577Z")
    } as NoticeListRow;

    const listItem = mapPncpEditalRowToNoticeListItem(row);

    expect(listItem.id).toBe("d6f6ca29-bcfd-4ea7-a2dc-c4f2acc0e99e");
    expect(listItem.externalId).toBe("13891536000196-1-000011/2026");
    expect(listItem.noticeNumber).toBe("010/2026");
    expect(listItem.hasAttachments).toBe(true);
    expect(listItem.status).toBe("Divulgada no PNCP");
    expect(listItem.state).toBe("BA");
  });
});
