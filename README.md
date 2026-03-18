# Projeto PNCP

Plataforma de inteligencia para acompanhamento, busca e analise de editais do PNCP. O projeto esta organizado em monorepo e combina frontend em Next.js, API em NestJS, persistencia em Postgres/Supabase, cache/filas com Redis e inferencia local com Ollama.

## O que o projeto entrega hoje

- busca de editais com filtros por texto, UF, municipio, modalidade e status
- detalhe do edital com abas de detalhes, itens, anexos e historico
- analista de licitacoes com geracao de resumo, riscos, precos e documentos via IA
- chat com IA sobre o edital selecionado
- area de treinamento de IA para regras customizadas
- API REST com documentacao Swagger

## Estrutura do monorepo

- `apps/web`: frontend em Next.js 15
- `apps/api`: backend em NestJS 11
- `packages/types`: contratos compartilhados
- `packages/sdk`: cliente tipado da API
- `packages/ui`: componentes compartilhados
- `packages/config`: configuracoes compartilhadas
- `infra/supabase/migrations`: SQL versionado para o banco
- `docs/architecture.md`: visao de arquitetura

## Stack principal

- Next.js App Router + React 19
- NestJS + Prisma
- Supabase/Postgres
- Redis
- Ollama
- Turbo Repo

## Pre-requisitos

Antes de subir o projeto na sua maquina, garanta que voce tem:

- Node.js 24.x recomendado
- npm 10.x
- Docker Desktop instalado e em execucao
- um banco Postgres ou Supabase acessivel pelas variaveis `DATABASE_URL` e `DIRECT_URL`
- acesso de rede aos endpoints do PNCP

O Ollama pode rodar de duas formas:

- localmente na sua maquina
- em container via `docker compose`

O script `npm run dev:full` detecta uma instancia local do Ollama e, se nao encontrar, sobe `redis` e `ollama` via Docker automaticamente.

## Variaveis de ambiente

Crie seu arquivo local a partir do exemplo:

```powershell
Copy-Item .env.example .env
```

Preencha pelo menos estas variaveis antes de iniciar:

| Variavel | Obrigatoria | Uso |
| --- | --- | --- |
| `DATABASE_URL` | Sim | conexao principal do Prisma com Postgres/Supabase |
| `DIRECT_URL` | Recomendado | conexao direta para operacoes administrativas do Prisma |
| `NEXT_PUBLIC_API_URL` | Sim | URL base consumida pelo frontend |
| `NEXT_PUBLIC_SUPABASE_URL` | Sim | URL do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Sim | chave publica do Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Depende do fluxo | operacoes server-side no Supabase |
| `REDIS_URL` | Sim | conexao do Redis |
| `OLLAMA_BASE_URL` | Sim | endereco do Ollama |
| `OLLAMA_GENERATION_MODEL` | Sim | modelo de geracao de texto |
| `OLLAMA_EMBEDDING_MODEL` | Sim | modelo de embeddings |

O arquivo `.env.example` ja traz os valores base de URLs locais e dos endpoints do PNCP. Nao versione o `.env` com segredos reais.

## Banco de dados

O backend depende de banco logo na inicializacao. Sem `DATABASE_URL`, a API nao sobe.

Se voce estiver preparando um ambiente do zero, aplique os SQLs da pasta `infra/supabase/migrations` na ordem abaixo:

1. `infra/supabase/migrations/20260313_pncp_saas_core.sql`
2. `infra/supabase/migrations/20260317_pncp_publication_validation.sql`

Resumo do que cada migration faz:

- `20260313_pncp_saas_core.sql`: cria tabelas auxiliares da aplicacao, politicas RLS e registros iniciais
- `20260317_pncp_publication_validation.sql`: complementa a tabela `public.pncp_editais`, usada como base/cache dos editais

Voce pode aplicar esses arquivos pelo SQL Editor do Supabase ou por qualquer cliente SQL conectado ao banco.

## Como rodar na propria maquina

### Fluxo mais simples

Depois de configurar o `.env` e o banco:

```powershell
npm run bootstrap
```

No Windows, tambem existe o atalho:

```powershell
.\bootstrap.cmd
```

Esse comando:

- valida se as portas `3000` e `3001` estao livres
- instala dependencias se necessario
- garante a geracao do Prisma Client
- inicia o frontend e o backend

### Fluxo completo com dependencias locais

Se quiser deixar o ambiente todo pronto com Redis e Ollama:

```powershell
npm run dev:full
```

No Windows, tambem existe:

```powershell
.\dev-full.cmd
```

Esse fluxo:

- reutiliza o Ollama local se ele ja estiver ativo
- sobe `redis` e `ollama` com Docker quando necessario
- garante os modelos configurados no `.env`
- sobe frontend e backend em paralelo

### Subida manual

Se preferir controlar cada passo:

```powershell
docker compose up -d redis ollama
npm install
npm run dev
```

Se o Ollama estiver rodando fora do Docker, confirme que os modelos configurados existem:

```powershell
ollama pull qwen2.5:7b
ollama pull qwen3-embedding
```

## Enderecos locais

Com o projeto em execucao, os acessos padrao sao:

- frontend: `http://localhost:3000`
- API: `http://localhost:3001/api`
- Swagger: `http://localhost:3001/api/docs`
- Ollama: `http://localhost:11434`
- Redis: `redis://localhost:6379`

## Scripts uteis

```bash
npm run setup
npm run bootstrap
npm run dev
npm run dev:full
npm run build
npm run lint
npm run typecheck
npm run test
```

## O que vale testar primeiro

1. abrir o frontend em `http://localhost:3000`
2. acessar o dashboard e buscar editais
3. abrir um edital para validar detalhes, itens e anexos
4. abrir a area de analise para gerar secoes com IA
5. acessar `http://localhost:3001/api/docs` para validar a API

## Observacoes importantes

- a busca consulta o PNCP e persiste os resultados localmente no banco
- paginas como favoritos, alertas e historico ja existem na interface, mas ainda dependem do amadurecimento da camada de persistencia para ficarem completas
- o projeto foi preparado para rodar em dev, test e prod via variaveis de ambiente
- se as portas `3000` ou `3001` estiverem ocupadas, os scripts de bootstrap falham para evitar conflito silencioso

## Clonando este repositorio

Depois que o repositorio estiver publicado no GitHub, o fluxo de teste para outra pessoa sera:

```powershell
git clone https://github.com/gustavorochaC/projeto-pncp.git
cd projeto-pncp
Copy-Item .env.example .env
# ajustar variaveis do .env
npm run bootstrap
```
