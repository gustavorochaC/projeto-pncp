const PNCP_PORTAL_BASE_URL = "https://pncp.gov.br/app/compras";
const PNCP_LEGACY_PORTAL_BASE_URL = "https://pncp.gov.br/compras/";

export interface PncpPortalPathParams {
  cnpjOrgao: string;
  anoCompra: number;
  sequencialCompra: number;
}

export function buildPncpPortalUrl(params: PncpPortalPathParams): string | null {
  const cnpjOrgao = sanitizeCnpj(params.cnpjOrgao);
  const anoCompra = Number.isFinite(params.anoCompra) ? Math.trunc(params.anoCompra) : NaN;
  const sequencialCompra = Number.isFinite(params.sequencialCompra)
    ? Math.trunc(params.sequencialCompra)
    : NaN;

  if (!cnpjOrgao || cnpjOrgao.length !== 14 || anoCompra < 1 || sequencialCompra < 1) {
    return null;
  }

  return `${PNCP_PORTAL_BASE_URL}/${cnpjOrgao}/${anoCompra}/${sequencialCompra}`;
}

export function isLegacyPncpPortalUrl(url?: string | null): boolean {
  if (!url) {
    return false;
  }

  return url.startsWith(PNCP_LEGACY_PORTAL_BASE_URL);
}

export function sanitizeCnpj(value?: string | null): string | null {
  if (!value) {
    return null;
  }

  const digits = value.replace(/\D/g, "");
  if (digits.length < 14) {
    return null;
  }

  return digits.slice(0, 14);
}
