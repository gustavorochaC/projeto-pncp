---
name: participation-requirements
description: Extrair requisitos de participacao e habilitacao de editais do PNCP e seus anexos, com foco em documentacao obrigatoria, certidoes, atestados, qualificacao tecnica, qualificacao economico-financeira, registros em conselho, licencas e certificacoes como ISO. Usar quando receber dados estruturados do edital e textos de documentos para devolver somente as exigencias relevantes em JSON, com evidencias explicitas separadas de inferencias.
---

# Participation Requirements Extractor

Executar a tarefa abaixo sempre que receber dados estruturados do edital e textos extraidos dos documentos.

## Objetivo

Extrair somente requisitos de participacao e habilitacao que possam impactar a capacidade do licitante de participar da disputa ou comprovar sua aptidao documental, tecnica, juridica, fiscal, trabalhista ou economico-financeira.

Responder somente com JSON valido.
Nao usar markdown.
Nao usar cercas de codigo.
Nao inventar campos fora do schema definido.

## Escopo da extracao

Considerar como requisito elegivel:

- habilitacao_juridica
- regularidade_fiscal_trabalhista
- qualificacao_economico_financeira
- qualificacao_tecnica
- certificacao
- registro_licenca_credenciamento
- declaracao_obrigatoria
- outro_requisito_de_participacao

Buscar explicitamente sinais como:

- habilitacao
- documentacao de habilitacao
- certidao
- regularidade fiscal
- regularidade trabalhista
- balanco patrimonial
- indices contabeis
- capital social minimo
- patrimonio liquido minimo
- atestado de capacidade tecnica
- acervo tecnico
- CAT
- CREA
- CAU
- CRQ
- CRM
- conselho profissional
- alvara
- licenca
- autorizacao
- credenciamento
- SICAF
- ISO
- certificacao tecnica
- declaracao obrigatoria
- visita tecnica quando for condicao de participacao
- amostra quando for exigencia de habilitacao ou aceitacao obrigatoria para seguir no certame

## O que nao extrair

Nao listar como requisito de participacao:

- SLA, metas operacionais ou obrigacoes de execucao que nao afetem a habilitacao
- multas, penalidades e regras gerais contratuais
- cronograma de entrega ou execucao sem relacao com participacao
- condicoes comerciais ou precificacao
- obrigacoes pos-contratuais sem impacto direto na habilitacao
- caracteristicas do objeto que nao configurem exigencia documental ou tecnica ao licitante

## Regras de evidencia

- Extrair como fato apenas o que estiver explicitamente suportado por texto recebido.
- Cada item em explicit_requirements deve conter um evidence_excerpt literal e curto.
- Se houver forte indicio, mas nao prova textual suficiente, registrar em possible_inferences.
- Quando faltar base documental para uma categoria relevante, registrar em missing_evidence.
- Se o mesmo requisito aparecer em mais de um documento, consolidar em um unico item e manter como source_document o documento com a evidencia mais completa.
- Priorizar o texto dos documentos. Usar dados estruturados do edital apenas como apoio de contexto.
- Se um requisito estiver condicionado a lote, item, grupo, funcao tecnica ou tipo de participante, registrar isso em applies_to.
- Se a obrigatoriedade nao estiver clara, usar mandatory_level = "unclear".
- Nunca presumir ISO, licenca, conselho ou certidao apenas pelo objeto da contratacao.

## Processo interno

Seguir esta ordem:

1. Ler edital_structured para entender objeto, modalidade, orgao e contexto.
2. Ler document_catalog para saber quais documentos foram fornecidos.
3. Ler cada item de document_texts separadamente e identificar exigencias por documento.
4. Consolidar duplicidades entre edital principal e anexos.
5. Classificar cada exigencia na taxonomia definida.
6. Separar fatos explicitos de inferencias.
7. Retornar somente o JSON final.

## Formato de entrada esperado

Receber a entrada com tres blocos:

1. edital_structured
2. document_catalog
3. document_texts

Usar o seguinte formato logico:

{
  "edital_structured": {
    "pncp_id": "string",
    "numero_controle_pncp": "string|null",
    "objeto_compra": "string|null",
    "orgao": "string|null",
    "modalidade": "string|null",
    "situacao": "string|null",
    "municipio": "string|null",
    "uf": "string|null",
    "valor_estimado": "number|null",
    "data_abertura_proposta": "string|null",
    "data_encerramento_proposta": "string|null",
    "informacao_complementar": "string|null",
    "justificativa": "string|null"
  },
  "document_catalog": [
    {
      "source_document": "string",
      "document_type": "string|null"
    }
  ],
  "document_texts": [
    {
      "source_document": "string",
      "content": "string"
    }
  ]
}

Pode haver varios itens em document_texts com o mesmo source_document quando um documento longo for enviado em partes.

## Formato de saida obrigatorio

Retornar exatamente um objeto JSON com estas chaves:

{
  "explicit_requirements": [
    {
      "category": "qualificacao_tecnica",
      "subcategory": "atestado_capacidade_tecnica",
      "requirement": "Apresentar atestado de capacidade tecnica compativel com o objeto.",
      "normalized_term": "atestado_capacidade_tecnica",
      "mandatory_level": "mandatory",
      "applies_to": "todos_licitantes",
      "source_document": "Edital Principal.pdf",
      "evidence_excerpt": "Comprovacao mediante apresentacao de atestado de capacidade tecnica...",
      "confidence": "high"
    }
  ],
  "possible_inferences": [
    {
      "category": "certificacao",
      "subcategory": "iso_9001",
      "requirement": "Pode haver exigencia de certificacao de qualidade relacionada ao escopo tecnico.",
      "normalized_term": "iso_9001",
      "mandatory_level": "unclear",
      "applies_to": "nao_claro",
      "source_document": "Termo de Referencia.pdf",
      "evidence_excerpt": "A contratada devera observar padroes de qualidade reconhecidos...",
      "reasoning": "Ha linguagem de conformidade tecnica, mas nao ha exigencia explicita de certificacao no trecho recebido.",
      "confidence": "low"
    }
  ],
  "missing_evidence": [
    {
      "topic": "qualificacao_economico_financeira",
      "reason": "Nao foi encontrada clausula clara sobre balanco, indices contabeis, patrimonio liquido ou capital social minimo no material recebido.",
      "recommended_followup": "Verificar se existe secao de habilitacao economico-financeira em anexo nao enviado ou em paginas nao extraidas."
    }
  ],
  "documents_reviewed": [
    "Edital Principal.pdf",
    "Anexo I - Termo de Referencia.pdf"
  ],
  "analysis_notes": [
    "Consolidar duplicidades entre edital e anexos antes de responder.",
    "Ignorar exigencias de execucao que nao sejam requisito de participacao."
  ]
}

## Restricoes do schema

- category deve usar uma categoria valida da taxonomia.
- subcategory deve ser curta, descritiva e em snake_case.
- normalized_term deve representar o conceito principal em snake_case.
- mandatory_level deve ser um de: "mandatory", "conditional", "optional", "unclear".
- applies_to deve ser objetivo. Exemplos validos: "todos_licitantes", "consorcio", "profissional_tecnico", "empresa", "item_especifico", "lote_especifico", "nao_claro".
- confidence deve ser um de: "high", "medium", "low".
- documents_reviewed deve listar somente documentos realmente analisados.
- Se nao houver itens para alguma lista, retornar [].

## Regras de normalizacao

- Unificar termos equivalentes quando representarem o mesmo requisito.
- Preferir linguagem objetiva e curta em requirement.
- Preservar o sentido juridico da exigencia.
- Se um trecho mencionar varias exigencias distintas, quebrar em multiplos itens.
- Se o trecho indicar excecao, condicao ou aplicacao parcial, refletir isso em mandatory_level ou applies_to.

## Comportamento em falta de informacao

- Se os documentos forem insuficientes, nao preencher com suposicoes.
- Se houver apenas dados estruturados e nenhum texto documental, retornar explicit_requirements vazio e registrar a limitacao em missing_evidence e analysis_notes.
- Se houver conflito entre documentos, preferir o texto mais especifico e mencionar o conflito em analysis_notes.

## Template de uso manual no Ollama

Substituir os placeholders abaixo e enviar este conteudo junto com os dados reais:

[TASK]
Extrair somente requisitos de participacao e habilitacao do edital e dos anexos recebidos, seguindo todas as regras desta skill e retornando somente JSON valido.

[INPUT]
{
  "edital_structured": {
    "pncp_id": {{pncp_id_json}},
    "numero_controle_pncp": {{numero_controle_pncp_json}},
    "objeto_compra": {{objeto_compra_json}},
    "orgao": {{orgao_json}},
    "modalidade": {{modalidade_json}},
    "situacao": {{situacao_json}},
    "municipio": {{municipio_json}},
    "uf": {{uf_json}},
    "valor_estimado": {{valor_estimado_ou_null}},
    "data_abertura_proposta": {{data_abertura_json}},
    "data_encerramento_proposta": {{data_encerramento_json}},
    "informacao_complementar": {{informacao_complementar_json}},
    "justificativa": {{justificativa_json}}
  },
  "document_catalog": [
    {
      "source_document": {{nome_do_documento_json}},
      "document_type": {{tipo_do_documento_json}}
    }
  ],
  "document_texts": [
    {
      "source_document": {{nome_do_documento_json}},
      "content": {{texto_extraido_do_documento_json}}
    }
  ]
}

[OUTPUT]
Retornar somente o objeto JSON final.
