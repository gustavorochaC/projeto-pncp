type StructuredNoticeSnapshot = {
  pncpId?: string | null;
  numeroControlePncp?: string | null;
  objetoCompra?: string | null;
  nomeOrgao?: string | null;
  cnpjOrgao?: string | null;
  modalidadeNome?: string | null;
  codigoModalidade?: string | null;
  situacaoNome?: string | null;
  status?: string | null;
  municipioNome?: string | null;
  uf?: string | null;
  valorTotalEstimado?: unknown;
  dataAberturaProposta?: Date | null;
  dataEncerramentoProposta?: Date | null;
  informacaoComplementar?: string | null;
  justificativa?: string | null;
  linkEdital?: string | null;
  linkSistemaOrigem?: string | null;
};

type StructuredAnswerReason = 'summary' | 'timeout' | 'generation_error';

const SUMMARY_HINTS = [
  'sobre o que',
  'quais informacoes',
  'que informacoes',
  'o que voce tem',
  'o que vc tem',
  'resuma',
  'resumo',
  'me fale desse edital',
  'me diga desse edital',
  'explique esse edital',
  'explica esse edital',
  'fale sobre esse edital',
  'o que esse edital pede',
  'qual o objeto',
];

export function shouldUseStructuredNoticeAnswer(question: string): boolean {
  const normalizedQuestion = normalizeQuestion(question);
  return SUMMARY_HINTS.some((hint) => normalizedQuestion.includes(hint));
}

export function buildStructuredNoticeAnswer(
  notice: StructuredNoticeSnapshot,
  options: {
    documentsProcessed: boolean;
    reason: StructuredAnswerReason;
  },
): string {
  const intro =
    options.reason === 'timeout'
      ? 'Nao consegui consultar o modelo de IA dentro do tempo esperado, mas com os dados oficiais deste edital eu ja consigo te dizer o seguinte:'
      : options.reason === 'generation_error'
        ? 'O modelo de IA nao respondeu como esperado, entao vou te ajudar com os dados oficiais que ja tenho deste edital:'
        : 'Com os dados oficiais que ja tenho deste edital, consigo te dizer o seguinte:';

  const lines = [intro];

  lines.push(`- Objeto: ${notice.objetoCompra ?? 'nao informado'}`);
  lines.push(`- Orgao responsavel: ${notice.nomeOrgao ?? notice.cnpjOrgao ?? 'nao informado'}`);
  lines.push(`- Modalidade: ${notice.modalidadeNome ?? notice.codigoModalidade ?? 'nao informada'}`);
  lines.push(`- Situacao: ${notice.situacaoNome ?? notice.status ?? 'nao informada'}`);
  lines.push(`- Localidade: ${formatLocality(notice.municipioNome, notice.uf)}`);

  const estimatedValue = formatCurrency(notice.valorTotalEstimado);
  if (estimatedValue) {
    lines.push(`- Valor estimado: ${estimatedValue}`);
  }

  const openingDate = formatDate(notice.dataAberturaProposta);
  if (openingDate) {
    lines.push(`- Abertura da proposta: ${openingDate}`);
  }

  const closingDate = formatDate(notice.dataEncerramentoProposta);
  if (closingDate) {
    lines.push(`- Prazo final: ${closingDate}`);
  }

  const pncpCode = notice.numeroControlePncp ?? notice.pncpId;
  if (pncpCode) {
    lines.push(`- Identificacao PNCP: ${pncpCode}`);
  }

  if (notice.informacaoComplementar) {
    lines.push(`- Informacao complementar: ${notice.informacaoComplementar}`);
  }

  if (notice.justificativa) {
    lines.push(`- Justificativa: ${notice.justificativa}`);
  }

  if (notice.linkEdital) {
    lines.push(`- Link do edital: ${notice.linkEdital}`);
  }

  if (notice.linkSistemaOrigem) {
    lines.push(`- Sistema de origem: ${notice.linkSistemaOrigem}`);
  }

  if (!options.documentsProcessed) {
    lines.push('');
    lines.push('Os documentos completos ainda estao sendo enriquecidos, entao por enquanto esta resposta usa os dados estruturados do PNCP.');
  }

  lines.push('');
  lines.push('Se quiser, eu posso detalhar os prazos, o objeto, os links oficiais ou resumir isso em linguagem mais simples.');

  return lines.join('\n');
}

function normalizeQuestion(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function formatCurrency(value: unknown): string | null {
  if (value == null) {
    return null;
  }

  const parsedValue =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value)
        : typeof value === 'object' &&
            value !== null &&
            'toNumber' in value &&
            typeof value.toNumber === 'function'
          ? value.toNumber()
          : Number(value);
  if (!Number.isFinite(parsedValue)) {
    return null;
  }

  return parsedValue.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function formatDate(value: Date | null | undefined): string | null {
  if (!value) {
    return null;
  }

  return value.toLocaleString('pt-BR');
}

function formatLocality(city: string | null | undefined, state: string | null | undefined): string {
  if (city && state) {
    return `${city} - ${state}`;
  }

  if (city) {
    return city;
  }

  if (state) {
    return state;
  }

  return 'nao informada';
}
