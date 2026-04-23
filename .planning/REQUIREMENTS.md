# Requirements: AURA — Marco 1 (Melhorias v1)

**Defined:** 2026-04-23
**Core Value:** Um colaborador monta orçamento do zero ao PDF com dados organizados por arquiteto; admin controla preços, pedidos e filtragem sem planilha paralela.

> **Contexto:** AURA em produção. Marco 1 = bloco estruturado de melhorias cobrindo cadastro, produtos, importação, acesso, admin, PDF e filtros. **Fora**: margem, refatoração de cálculos, comissões (ficam pra marcos futuros).

## v1 Requirements

### Cadastro — Usuário e Cliente

- [ ] **USR-01**: Signup pede CPF (obrigatório, validado pelo algoritmo brasileiro) além do email/senha atual
- [ ] **USR-02**: Signup pede telefone (obrigatório, formato BR com máscara)
- [ ] **USR-03**: Signup pede setor (enum: `comercial`, `projetos`, `logistica`, `financeiro`), obrigatório
- [ ] **USR-04**: Colaborador existente consegue preencher os 3 campos (CPF/telefone/setor) após login caso ainda não tenha — sem bloquear os antigos
- [ ] **CLI-01**: Formulário de criar cliente ganha campo **contato** (opcional, texto livre)
- [ ] **CLI-02**: Formulário de criar cliente ganha campo **CPF/CNPJ** (opcional, sem validação semântica neste marco)
- [ ] **CLI-03**: Formulário de criar cliente ganha seletor de **arquiteto** (opcional, autocomplete contra tabela `arquitetos`)

### Arquiteto (entidade nova)

- [ ] **ARQ-01**: Tabela `arquitetos` criada no Supabase com campos: `id`, `nome`, `contato` (nullable), `created_at`
- [ ] **ARQ-02**: CRUD de arquitetos no admin (nova aba ou seção): listar, criar, editar, excluir
- [ ] **ARQ-03**: FK `arquiteto_id` (nullable) adicionada a `clientes`
- [ ] **ARQ-04**: FK `arquiteto_id` (nullable) adicionada a `produtos`
- [ ] **ARQ-05**: Orçamentos/pedidos expõem arquiteto via relação (cliente → arquiteto) — não precisa FK direta

### Produtos

- [ ] **PROD-01**: UI de cadastro manual de produto no admin — formulário com nome, descrição, imagem (upload), preço, preço mínimo, arquiteto (seletor)
- [ ] **PROD-02**: 16 produtos da base atual sem descrição/foto/preço são cadastrados via UI do admin (ação do Lenny, não automação)
- [ ] **PROD-03**: Produtos existentes no banco são vinculados a arquiteto (migração one-shot ou edição manual via admin — o que for mais pragmático)
- [ ] **PROD-04**: Edição de produto existente no admin permite alterar arquiteto

### Importação

- [ ] **IMP-01**: Importação CSV no admin suporta **criação** de produtos novos (não só atualização)
- [ ] **IMP-02**: Importação CSV aceita coluna de **preço** (e preço mínimo) e atualiza o produto pela chave de correlação
- [ ] **IMP-03**: Importação CSV aceita coluna de **imagem** (URL pública ou caminho de arquivo) e associa ao produto correto automaticamente
- [ ] **IMP-04**: Tela de importação tem **instruções claras em tela**: formato esperado, nome das colunas obrigatórias, chave de correlação (SKU ou código), exemplo baixável
- [ ] **IMP-05**: Tela de importação mostra **preview** antes de confirmar: quantos produtos serão criados vs atualizados, quantas imagens casaram, quais linhas têm erro
- [ ] **IMP-06**: Importação trata erros linha a linha — falha em 1 linha não aborta o batch inteiro; usuário vê relatório pós-import

### Acesso / Visibilidade

- [ ] **ACC-01**: Supabase Storage/tabela do Drive aplica RLS por `colaborador_id`: colaborador autenticado lê e grava apenas arquivos onde `colaborador_id = auth.uid()` (ou equivalente)
- [ ] **ACC-02**: Admin tem policy que lê **todos** os arquivos do Drive (bypass de RLS ou policy ampla por role)
- [ ] **ACC-03**: UI do Drive filtra a listagem conforme o usuário — colab não vê nem sombra de outro colab
- [ ] **ACC-04**: Upload de arquivo associa automaticamente ao `colaborador_id` do usuário logado

### Painel Admin

- [ ] **ADM-01**: Visualização detalhada de pedido/orçamento no admin — dados do cliente, arquiteto, ambientes, sistemas de iluminação, itens, totais
- [ ] **ADM-02**: Tela dedicada de **atualização de preços** — lista de produtos com edição inline de preço/preço mínimo, salvar em batch
- [ ] **ADM-03**: Documentação in-app (texto em tela, tooltip ou bloco de ajuda) explicando como funciona o fluxo de exceção de preço (quem solicita, quem aprova, o que acontece)
- [ ] **ADM-04**: Estrutura do admin reorganizada: abas/seções mais claras, agrupamento lógico (Cadastros: produtos/arquitetos/clientes/colaboradores; Pedidos; Preços; Exceções)
- [ ] **ADM-05**: Dashboard inicial do admin avaliada — se existir e não agregar valor, remover; se for útil, simplificar

### PDF

- [ ] **PDF-01**: Novo design do PDF — layout tipográfico limpo e profissional, não estilo print HTML
- [ ] **PDF-02**: Card escuro "TOTAL GERAL" mantido ou redesenhado (não é o foco de remoção — mas visual revisto)
- [ ] **PDF-03**: Remover as **4 caixas** abaixo do Total geral: Prazo de entrega, Garantia, Condições de pagamento, Observações (ver referência no PROJECT.md)
- [ ] **PDF-04**: Conteúdo dessas 4 caixas reapresentado como **bloco de texto formatado** ao final do PDF (parágrafos ou lista enxuta, tipografia legível, margens adequadas)
- [ ] **PDF-05**: Snapshot persistido em `orcamentos` continua compatível com PDFs antigos (mudança só no render, não na estrutura do snapshot)

### Filtros e Organização

- [ ] **FIL-01**: Lista de clientes no admin filtrável por arquiteto
- [ ] **FIL-02**: Lista de produtos no admin filtrável por arquiteto
- [ ] **FIL-03**: Lista de orçamentos/pedidos no admin filtrável por arquiteto
- [ ] **FIL-04**: Filtros combináveis onde fizer sentido (arquiteto + cliente, arquiteto + período, etc.)

### Preparação e Finalização

- [ ] **PREP-01**: Mudanças não-commitadas no início do marco (edge functions `request-access`/`review-access`, `supabase/config.toml`) revisadas e decididas: commitadas ou revertidas
- [ ] **WRAP-01**: Smoke test manual em prod cobrindo: signup novo, criar cliente com arquiteto, criar orçamento, gerar PDF novo, importar CSV, Drive isolado por colaborador — sem bug visível

## v2 Requirements

Ficam pra marcos futuros, já previstos.

### Margem e Precificação (marco 2)

- **MARG-01**: Custo dos produtos entra no banco (campo `custo` em `produtos`)
- **MARG-02**: Margem exibida no detalhamento de pedido (admin) = (venda − custo) / venda
- **MARG-03**: Margem agregada por arquiteto, por período, por colaborador

### Cálculos (marco 3)

- **CALC-01**: Documentação das fórmulas atuais de fita/driver/perfil/agrupamento de rolos
- **CALC-02**: Testes unitários sobre todas as fórmulas
- **CALC-03**: Revisão das regras com a Luminatti antes de qualquer refatoração

### Comissões (marco 4)

- **COM-01**: Regras de comissão configuráveis por setor/tier
- **COM-02**: Cálculo automático por pedido fechado
- **COM-03**: Visualização: colaborador vê a sua; admin vê todas

### Qualidade

- **QA-01**: Testes automatizados (Vitest + Playwright)
- **QA-02**: CI/CD com checks obrigatórios
- **QA-03**: Error tracking em produção

## Out of Scope

| Feature | Reason |
|---------|--------|
| Margem no pedido | Marco 2 — depende de tabela de preços/custos que Lenny ainda vai receber |
| Refatoração de cálculos | Marco 3 — fórmulas só são mexidas depois de documentadas e revisadas |
| Módulo de comissões | Marco 4 — feature nova complexa, não cabe com as outras mudanças |
| Role nova "representante" | Representante = colaborador; não inflacionar roles |
| Validação de CPF/CNPJ no cliente | Campos opcionais neste marco; validação fica pra quando virar obrigatório |
| Integração com ERP | Sem necessidade imediata; CSV manual resolve |
| Redesign geral de UI | Ajustes pontuais sim (PDF, admin), redesign não |
| Testes automatizados | Marco de qualidade próprio |
| Setup de domínio próprio de Resend | Infra separada |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| USR-01 | Phase 2 | Pending |
| USR-02 | Phase 2 | Pending |
| USR-03 | Phase 2 | Pending |
| USR-04 | Phase 2 | Pending |
| CLI-01 | Phase 2 | Pending |
| CLI-02 | Phase 2 | Pending |
| CLI-03 | Phase 2 | Pending |
| ARQ-01 | Phase 1 | Pending |
| ARQ-02 | Phase 2 | Pending |
| ARQ-03 | Phase 1 | Pending |
| ARQ-04 | Phase 1 | Pending |
| ARQ-05 | Phase 1 | Pending |
| PROD-01 | Phase 3 | Pending |
| PROD-02 | Phase 3 | Pending |
| PROD-03 | Phase 2 | Pending |
| PROD-04 | Phase 2 | Pending |
| IMP-01 | Phase 3 | Pending |
| IMP-02 | Phase 3 | Pending |
| IMP-03 | Phase 3 | Pending |
| IMP-04 | Phase 3 | Pending |
| IMP-05 | Phase 3 | Pending |
| IMP-06 | Phase 3 | Pending |
| ACC-01 | Phase 4 | Pending |
| ACC-02 | Phase 4 | Pending |
| ACC-03 | Phase 4 | Pending |
| ACC-04 | Phase 4 | Pending |
| ADM-01 | Phase 4 | Pending |
| ADM-02 | Phase 4 | Pending |
| ADM-03 | Phase 4 | Pending |
| ADM-04 | Phase 4 | Pending |
| ADM-05 | Phase 4 | Pending |
| PDF-01 | Phase 5 | Pending |
| PDF-02 | Phase 5 | Pending |
| PDF-03 | Phase 5 | Pending |
| PDF-04 | Phase 5 | Pending |
| PDF-05 | Phase 5 | Pending |
| FIL-01 | Phase 6 | Pending |
| FIL-02 | Phase 6 | Pending |
| FIL-03 | Phase 6 | Pending |
| FIL-04 | Phase 6 | Pending |
| PREP-01 | Phase 1 | Pending |
| WRAP-01 | Phase 6 | Pending |

**Coverage:**
- v1 requirements: 42 total
- Mapped to phases: 42 (100%)
- Unmapped: 0

**Distribution:**
- Phase 1 (Schema & Prep): 5 requirements
- Phase 2 (Cadastros & Arquiteto CRUD): 10 requirements
- Phase 3 (Produtos & Importação): 8 requirements
- Phase 4 (Drive RLS & Reorganização Admin): 9 requirements
- Phase 5 (PDF Redesign): 5 requirements
- Phase 6 (Filtros & Smoke): 5 requirements

---
*Requirements defined: 2026-04-23*
*Last updated: 2026-04-23 after roadmap creation (42/42 mapped to 6 phases)*
