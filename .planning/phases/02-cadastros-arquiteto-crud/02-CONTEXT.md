# Phase 2: Cadastros & Arquiteto CRUD - Context

**Gathered:** 2026-04-27
**Status:** Ready for planning
**Source:** Claude decidiu por delegação do usuário ("quero que você decida por mim baseado na situação atual do projeto")

<domain>
## Phase Boundary

Esta fase entrega:
1. **Signup expandido** — novos colaboradores entram com CPF/telefone/setor preenchidos e validados (USR-01, USR-02, USR-03).
2. **Backfill colaboradores antigos** — quem já tem conta consegue completar os 3 campos novos sem ser bloqueado (USR-04).
3. **Cliente form expandido** — formulário de cliente aceita contato, CPF/CNPJ e seletor de arquiteto, todos opcionais (CLI-01, CLI-02, CLI-03).
4. **Arquiteto CRUD** — admin tem nova aba "Arquitetos" com listar/criar/editar/excluir (ARQ-02).
5. **Produto editável com arquiteto** — admin pode atribuir/alterar arquiteto em produtos existentes (PROD-03, PROD-04).

**Não entrega** (out of scope):
- UI de cadastro manual de produto novo (PROD-01 — Phase 3)
- Cadastro dos 16 produtos do Lenny (PROD-02 — Phase 3)
- Validação semântica de CPF/CNPJ no cliente (locked: requirement diz "sem validação semântica neste marco")
- Importação CSV de produtos (Phase 3)

</domain>

<decisions>
## Implementation Decisions

### Backfill Colaborador Antigo (USR-04)

- **D-01:** Banner sticky no topo do app (`Index.tsx` + `Admin.tsx`) com CTA "Completar cadastro" — aparece quando o `colaborador` logado tem `cpf IS NULL OR telefone IS NULL OR setor IS NULL`.
  - **Por quê:** Requirement diz "sem ser bloqueado" — modal forçado violaria isso. Banner é proativo mas não interrompe o fluxo de quem precisa fechar um orçamento agora.
- **D-02:** CTA do banner navega pra rota nova `/perfil/completar` (página única e dedicada) com form dos 3 campos. Submit faz UPDATE em `colaboradores` e redireciona pra origem (ou `/`).
  - **Por quê:** Página dedicada é mais clara que modal pra preenchimento sério (CPF precisa de cuidado). Reusa máscaras + validador do signup.
- **D-03:** Banner some quando os 3 campos estão preenchidos. Sem persistência de "dispensei" — esconder seria perda de dado.

### Signup Expandido (USR-01, USR-02, USR-03)

- **D-04:** Ordem dos campos no form de signup: `[Nome*, Email*, Confirmar email*, CPF*, Telefone*, Setor*, Cargo, Departamento, Senha*, Confirmar senha*]`.
  - **Por quê:** Mantém os campos pessoais (CPF/telefone/setor) agrupados logo após identificação (nome/email). Cargo/Departamento ficam opcionais como já estão hoje.
- **D-05:** Validação inline (red text + border vermelha sob o campo). Não usar toast pra erro de campo individual — toast só pra erro de submit (network/auth).
  - **Por quê:** Padrão do app já é toast pra erro geral; validação inline é UX melhor pra form.
- **D-06:** Campo "Setor" é `<Select>` shadcn com 4 opções fixas: `comercial`, `projetos`, `logistica`, `financeiro` (mesmas do CHECK constraint do Phase 1). Label exibida em PT-BR ("Comercial", "Projetos", "Logística", "Financeiro").
- **D-07:** CPF e Telefone passam pelas máscaras durante a digitação (não só no blur). Submit envia o valor SEM máscara (apenas dígitos) pro Supabase.

### Validação e Máscaras (USR-01, USR-02 — base reusável)

- **D-08:** Máscaras implementadas em `src/lib/masks.ts` (helpers puros, sem dependência externa):
  - `formatCPF(value: string): string` — aplica `000.000.000-00`
  - `formatTelefone(value: string): string` — aplica `(00) 00000-0000` (celular BR, 11 dígitos)
  - `formatCpfCnpj(value: string): string` — auto-detect: 11 dígitos = CPF, 14+ = CNPJ
  - `unmask(value: string): string` — remove máscara antes de salvar
- **D-09:** Validador de CPF em `src/lib/validators.ts`:
  - `validateCPF(cpf: string): boolean` — implementa o algoritmo brasileiro (2 dígitos verificadores).
  - Rejeita CPFs com todos os dígitos iguais (`111.111.111-11` etc.) — caso conhecido que passa nos dígitos verificadores mas é inválido.
- **D-10:** Validador de telefone em `src/lib/validators.ts`:
  - `validateTelefone(tel: string): boolean` — verifica que tem 11 dígitos após desmascarar e que começa com DDD válido (11-99). Não valida operadora.
- **D-11:** **Sem dependência externa** (`react-input-mask`, `react-imask`, `brazilian-values`).
  - **Por quê:** O codebase é minimalista. Máscaras de CPF/telefone são ~30 linhas total e validador CPF é ~20 linhas. Adicionar dep não compensa.
- **D-12:** CPF/CNPJ no cliente (CLI-02) usa `formatCpfCnpj` (auto-detect) mas **não valida** — requirement explicitamente diz "sem validação semântica neste marco". Submit envia desmascarado.

### Cliente Form Expandido (CLI-01, CLI-02, CLI-03)

- **D-13:** Form de criar/editar cliente ganha 3 campos opcionais: `Contato` (text livre), `CPF/CNPJ` (mascarado, sem validação), `Arquiteto` (autocomplete).
  - Localização do form: o atual de criar cliente (Dialog "Nome do cliente"). Vamos expandir esse Dialog.
- **D-14:** Ordem dos campos no Dialog: `[Nome*, Contato, CPF/CNPJ, Arquiteto]`. Tudo abaixo de "Nome" é opcional.
- **D-15:** Editar cliente existente também precisa expor esses 3 campos. Se a UI atual não tem "editar cliente", adicionar (Dialog idêntico ao de criar, populated com dados).
  - **Nota pra planner:** verificar se já existe editar cliente. Se não, criar.

### Arquiteto Autocomplete (CLI-03 + PROD-04)

- **D-16:** Criar componente `src/components/ArquitetoAutocomplete.tsx` espelhando o `ProdutoAutocomplete.tsx` existente (mesmo padrão Command/Combobox da shadcn).
  - **Por quê:** Consistência com pattern já validado no codebase. Usuário aprende uma vez, usa em N lugares.
- **D-17:** Comportamento do autocomplete:
  - Busca por `ilike '%termo%'` em `arquitetos.nome` (case-insensitive).
  - Limita 10 resultados visuais.
  - Opção "Nenhum arquiteto" no topo da lista pra desvincular (deixar `arquiteto_id = NULL`).
  - **Não** permite criar arquiteto inline pelo autocomplete — pra criar novo, usuário vai no Admin > Arquitetos. Foco do form de cliente é selecionar.

### Arquiteto CRUD Admin (ARQ-02)

- **D-18:** Nova aba "**Arquitetos**" no Admin (8ª tab, depois de "Clientes"). URL: `/admin?tab=arquitetos`. Reusa o pattern de URL search param já implementado pelo hotfix `b8dfc40`.
- **D-19:** Layout da aba: idêntico ao da aba "Clientes" — header com botão "+ Novo Arquiteto" + `<Table>` shadcn com colunas `[Nome, Contato, Ações]`.
- **D-20:** Criar e Editar usam **mesmo** `<Dialog>` (componente `ArquitetoDialog`) — distinguidos por prop `mode: 'create' | 'edit'`. Form: `[Nome*, Contato]`. Submit insere ou atualiza em `arquitetos`.
- **D-21:** Excluir usa `<AlertDialog>` com confirm. Mensagem: "Tem certeza? Clientes/produtos vinculados ficarão sem arquiteto (não serão deletados)."
  - **Por quê:** As FKs em clientes/produtos têm `ON DELETE SET NULL` (Phase 1), então excluir não cascata. Mensagem deixa claro o efeito.
- **D-22:** Ordem da listagem: `ORDER BY nome ASC` (alfabética). Sem paginação por enquanto — lista de arquitetos provavelmente fica pequena (<200 itens). Phase 6 (Filtros) pode adicionar busca se virar gargalo.

### Produto Editável com Arquiteto (PROD-03, PROD-04)

- **D-23:** Adicionar `<Dialog>` de **edição** de produto na aba Admin > Produtos (se ainda não existe). Form de edição inclui o campo `Arquiteto` (usa `ArquitetoAutocomplete`).
  - **Nota pra planner:** verificar Admin.tsx aba Produtos. Se já tiver dialog de edição, só adicionar o campo. Se não, criar dialog completo (campos: nome, descrição, preço, preço mínimo, arquiteto — não escopo de cadastro novo, só edição).
- **D-24:** PROD-03 (vincular arquiteto a produtos existentes): **manual via UI**, não migração automática. Usuário (Lenny) vai produto a produto e atribui arquiteto. Plan deve documentar como fazer em massa via SQL Editor caso ele prefira (alternativa).
  - **Por quê:** Produtos atuais ainda não têm metadado claro de arquiteto. Decisão manual evita assumir errado.

### Cross-cutting

- **D-25:** Todas as queries Supabase ficam diretas (cliente Supabase JS), sem TanStack Query — segue padrão atual do codebase. Toast de erro/sucesso via `sonner`.
- **D-26:** Tratamento de erro Supabase: destructuring `{ data, error }`, `if (error) toast.error("Erro ao ...")`, `return` cedo. Padrão atual.
- **D-27:** Migrations adicionais não esperadas neste plano — schema necessário já está em prod via Phase 1. Se planner detectar gap, levantar como question.

### Claude's Discretion

- Estilização exata dos campos (paddings, ícones específicos do Lucide) — segue Tailwind tokens já em uso.
- Mensagens de erro específicas — Claude escreve, mantendo PT-BR e tom do app.
- Estrutura interna dos hooks reusáveis (ex: `useArquitetos()` retorna lista cached em state local) — Claude decide se vale criar hook ou só call direto.

### Folded Todos

Nenhum. Os 2 todos pendentes (orçamento não-clicável, PDF zuado) **não são folded** — ambos são out-of-scope desta phase (Phase 2 = Cadastros, não visualização de orçamento ou PDF).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project anchors
- `.planning/PROJECT.md` — visão, princípios, constraints (stack congelada, schema aditivo, compatibilidade com dados antigos)
- `.planning/REQUIREMENTS.md` — requirements USR-01..04, CLI-01..03, ARQ-02, PROD-03, PROD-04 (texto exato)
- `.planning/ROADMAP.md` §"Phase 2" — success criteria que vão virar `must_haves` no plan
- `CLAUDE.md` (root) — convenções de código, naming patterns, error handling, language convention

### Phase 1 outputs (schema base)
- `supabase/migrations/20260423000004_colaboradores_cpf_telefone_setor.sql` — schema dos campos USR-01..03 (incluindo CHECK constraint do `setor`)
- `supabase/migrations/20260423000002_clientes_arquiteto_contato_cpf.sql` — schema dos campos CLI-01/02/03
- `supabase/migrations/20260423000001_create_arquitetos.sql` — tabela `arquitetos` com RLS (admin escreve, qualquer autenticado lê)
- `src/integrations/supabase/types.ts` — types regenerados; **NÃO regenerar nesta phase a menos que rode migration nova**
- `.planning/phases/01-schema-prep/01-02-SUMMARY.md` — schema reference table (colunas, FKs, indexes)
- `.planning/phases/01-schema-prep/01-03-SUMMARY.md` — bugs pré-existentes capturados (gap 3: create-colaborador 401 fora do signup; gap 4: request-access 409 UX) — **não resolver nesta phase, mas considerar se signup novo expõe esses gaps**

### Patterns existentes a reusar
- `src/components/ProdutoAutocomplete.tsx` — pattern do Combobox/Command pra `ArquitetoAutocomplete.tsx` espelhar
- `src/pages/Auth.tsx` — form de signup atual (nome, email, cargo, departamento, password); ponto onde CPF/telefone/setor entram
- `src/pages/Admin.tsx` — estrutura de tabs com URL search param (já com hotfix `b8dfc40`); aba Clientes/Colaboradores como template pro Arquitetos
- `src/hooks/useColaborador.ts` — hook que carrega o colaborador logado; usado pra detectar se precisa banner USR-04
- `src/components/ClienteList.tsx` — UI atual de cliente, ponto de extensão pra CLI-01/02/03

### Convenções
- `src/lib/utils.ts` — `cn()` pra merge de className (Tailwind)
- `src/components/ui/` — usar shadcn primitives (Card, Dialog, Table, AlertDialog, Select, Input, Label) — nunca importar Radix direto
- Tailwind tokens (`bg-card`, `text-foreground`, `text-destructive`) — não cores hard-coded onde tiver token

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`ProdutoAutocomplete.tsx`** — padrão completo de Combobox shadcn pra busca async com Supabase. `ArquitetoAutocomplete.tsx` deve copiar a estrutura (props, hooks internos, debounce de search).
- **`useColaborador.ts`** — já carrega o colaborador logado e expõe `{ colaborador, loading }`. Banner de USR-04 lê esse hook pra detectar campos faltando.
- **shadcn primitives já em uso:** `Dialog`, `AlertDialog`, `Table`, `Select`, `Command`, `Input`, `Label`, `Button`, `Card`. Tudo o que Phase 2 precisa já existe — não importar nada novo.
- **`sonner` toasts** — `toast.success("...")` / `toast.error("...")` é o padrão. Sem nada custom.

### Established Patterns

- **Direct Supabase calls** (sem API layer, sem TanStack Query). Pattern: `const { data, error } = await supabase.from("...").select/insert/update/delete()`.
- **Local React state** com `useState`/`useEffect` — sem Redux/Zustand.
- **Error handling:** destructure `{ data, error }`, check `if (error)`, toast + return.
- **Form submission:** `handleSubmit` async, `setLoading(true)` antes, `setLoading(false)` no `finally`. Pattern do Auth.tsx.
- **Naming:** Portuguese pra entidades/funções de domínio (`colaborador`, `arquiteto`, `criarArquiteto`); English pra infra (`loading`, `error`, `user`, `session`).
- **URL search params pra abas do Admin** — pattern recém-introduzido em `b8dfc40`. Usar `useSearchParams` + `setSearchParams({ tab })`.
- **Validação inline** no Auth.tsx atual já usa estado de campo + render condicional. Reusar essa abordagem nos novos campos.

### Integration Points

- **Auth.tsx (signup):** adicionar 3 campos novos antes de cargo/departamento. `signUp` vai pra `supabase.auth.signUp` + edge function `create-colaborador` (já existe; passa todos os campos novos no body).
- **`create-colaborador` edge function:** atualmente aceita `{ nome, cargo, departamento, user_id }` e insere em `colaboradores`. **Precisa expandir** pra aceitar `cpf`, `telefone`, `setor` no body e gravar nas colunas novas.
- **App.tsx:** rota nova `/perfil/completar` (ProtectedRoute, sem AdminRoute) — página de backfill USR-04.
- **Admin.tsx:** adicionar TabsTrigger "Arquitetos" + TabsContent que renderiza nova `AdminArquitetos.tsx` (ou inline na própria Admin.tsx — planner decide com base no tamanho).
- **ClienteList.tsx (ou onde criar/editar cliente vive):** expandir Dialog com 3 campos novos.
- **Admin.tsx aba Produtos:** adicionar/expandir Dialog de edição com campo Arquiteto.

</code_context>

<specifics>
## Specific Ideas

- **Banner USR-04** estilo: amber/yellow background (Tailwind `bg-amber-500/10 border-amber-500/30 text-amber-700`), texto curto "Complete seu cadastro com CPF, telefone e setor", botão "Completar agora" alinhado à direita.
- **Validador de CPF** rejeita os 10 casos conhecidos (`000.000.000-00`, `111.111.111-11`, ... `999.999.999-99`) por serem inválidos no algoritmo brasileiro mesmo passando nos dígitos verificadores.
- **Máscara de telefone** suporta apenas celular BR (11 dígitos com DDD). Não suporta fixo de 10 dígitos pra simplificar — caso raro pra colaborador comercial.
- **Aba "Arquitetos"** ordem alfabética. Sem paginação. Sem busca neste marco — Phase 6 (Filtros & Smoke) pode adicionar se virar gargalo.

</specifics>

<deferred>
## Deferred Ideas

- **Validação semântica de CPF/CNPJ no cliente (CLI-02):** explicitamente locked como "sem validação" neste marco. Se virar requirement, abre phase futura.
- **Importar arquitetos via CSV:** Phase 6 ou marco futuro — não é prioridade.
- **Comissões por arquiteto:** já vetado pelo PROJECT.md ("Margem adiada para Marco 2 — Depende de tabela de custos que Lenny vai receber").
- **Editar arquiteto inline (sem modal):** considerado e descartado — modal mantém consistência com Clientes/Colaboradores.
- **Validador de telefone fixo (10 dígitos):** descartado pra simplificar — refinar em phase futura se algum colaborador precisar.

### Reviewed Todos (not folded)

- **`2026-04-27-admin-orcamentos-row-nao-clicavel.md`** — orçamento existente não-clicável. Out of scope da Phase 2 (que é cadastros, não visualização de orçamento). Belongs em phase futura ou backlog.
- **`2026-04-27-pdf-zuado-input-para-phase-5.md`** — PDF zuado. Já é Phase 5 (PDF Redesign) explicitamente.

</deferred>

---

*Phase: 02-cadastros-arquiteto-crud*
*Context gathered: 2026-04-27 (Claude decidiu por delegação)*
