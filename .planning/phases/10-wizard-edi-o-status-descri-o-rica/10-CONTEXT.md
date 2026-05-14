# Phase 10: Wizard — Edição + Status + Descrição rica — Context

**Gathered:** 2026-05-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Tornar o wizard "round-trip" e enriquecer a descrição dos produtos no review/PDF — **sem mexer em schema** (Phase 7 já preparou) e **sem regressão visual** em PDF v1 / wizard existente:

1. **Step 3 edita preço e quantidade inline** (WIZ-01/02) — inputs numéricos diretos na tabela, recalc on-blur/Enter, floor `preco_minimo` continua sendo coberto pelo fluxo ExceptionChat existente. Edit altera só o snapshot `orcamentos.ambientes`, nunca o master `product_variants`.
2. **Reabrir rascunho** (WIZ-03) — card de orçamento na tab Pedidos vira clicável quando `status='rascunho'`; abre o wizard sempre no Step 1 com dados/ambientes pré-preenchidos. Snapshots órfãs (cliente removido / produto sumiu do master) renderizam com aviso visual, sem bloquear.
3. **Marcar status pós-PDF** (WIZ-04) — dropdown direto no card de Pedidos (rascunho/aprovado/perdido/pendente). Sempre disponível (não exige PDF gerado). Colab dono + admin podem mudar. Só `aprovado` é one-way (dialog de confirmação ao escolher); resto é livre.
4. **Descrição rica** (WIZ-05) — `produto.descricao` no Step 3 e PDF v2 vira `Nome | temperatura_k K | potencia_watts W | IRC <irc> | <nicho>`, lendo de `product_variants.atributos`. Step 2/AmbienteCard e PDF v1 continuam com nome cru. Atributo ausente é suprimido (não mostra `—`). Snapshots antigos: re-lookup pelo código → fallback ao snapshot se produto sumiu.

**Out of scope da Phase 10 (mas presente no marco):** PDF v2 ajustes "Sistemas vazio" + "Prazo 20 dias" (Phase 11), Dashboard tab Início único card (Phase 11), Automação aniversário (Phase 12). Phase 10 só toca wizard + Pedidos card + descrição produto.

</domain>

<decisions>
## Implementation Decisions

### A) Edição preço/qtd no Step 3 (WIZ-01, WIZ-02)

- **D-01:** Edição via **input inline na tabela** do Step 3. Cada linha mostra dois inputs numéricos pequenos: `quantidade` (integer) e `preco_unitario` (decimal). Sem dialog, sem toggle. Mental model: a tabela do Step 3 sempre foi pra revisar; agora também pra ajustar.
- **D-02:** Recalc **on-blur + Enter**. Disparar recalc a cada keystroke faz `analisarMagneto48V`/agrupamento de rolos rodar em N×ambientes×items — perceptível em forms grandes. On-blur garante feedback rápido sem jank. Enter no input força o blur (handler de keydown).
- **D-03:** **Mantém fluxo ExceptionChat existente.** Editor inline gera um `precoUnitario` novo; o detector de violação (`Step3Revisao.tsx:83-95`) já compara contra `precoMinimo` e dispara `ExceptionChat` quando abaixo. Zero quebra do fluxo de exception. Se exception aprovada via Realtime, violação some.
- **D-04:** **Persistência só no snapshot.** Edit altera `ambientes` em memória → quando user clica "Gerar PDF", o `salvarOrcamento` faz UPDATE em `orcamentos.ambientes` (jsonb). `product_variants` (master) **não muda**. Cada orçamento é congelado; preço-padrão do produto fica intacto pra próximos.
- **D-05:** Quantidade aceita inteiros >= 1. Preço aceita decimais >= 0 (zero é permitido — colab decide se um item é "cortesia"; price-min violation cuida do floor real). Input HTML `type="number"` + clamp no onChange.
- **D-06:** Edits no Step 3 NÃO propagam back pro Step 2 (AmbienteCard). Step 2 continua sendo "estrutura" (qual produto/sistema); Step 3 é "negociação" (qty + preço final). Se user volta pro Step 2 e muda o produto, Step 3 reset os valores editados desse item (comportamento existente).

### B) Reabrir rascunho (WIZ-03)

- **D-07:** Entry point **único: card de orçamento na tab Pedidos**. Já existe em `Admin.tsx` com filtros (cliente/arquiteto/data/status). Card com `status='rascunho'` ganha cursor pointer + tooltip "Continuar este rascunho" + clique inteiro. RLS já garante que colab só vê os próprios.
- **D-08:** **Sempre reabre no Step 1 com prefill completo.** Carrega `orcamento.cliente_id`, `colaborador_id`, `tipo`, `ambientes` (jsonb) → seta no state do wizard → renderiza Step 1. User confirma cliente/tipo e clica "Próximo" até o ponto que quer mexer. Sem heurística de "último step" (frequentemente erra).
- **D-09:** Reabrir reutiliza o componente `<Index>` existente (mesmo wizard de criação). Diferenciação: query param ou state via `useNavigate`: `navigate("/", { state: { orcamentoId } })`. `Index` detecta o state, faz fetch do orçamento, popula. Sem rota nova.
- **D-10:** **Snapshot órfã:**
  - **Cliente deletado** (`cliente_id` aponta pra row inexistente — bloqueado por FK RESTRICT em prod, mas defesa em camadas): mostra dialog/toast "Este orçamento referencia cliente removido — não é possível continuar" + redireciona pra Pedidos. Não abre o wizard.
  - **Produto removido do master** (item no snapshot tem `codigo` que não existe mais em `product_variants`): linha renderiza com snapshot (nome/qtd/preço congelados) + badge amarelo "Produto removido do catálogo". User pode deletar a linha manualmente ou prosseguir. Não bloqueia.
  - **Sistema com fita/driver/perfil parcialmente órfão:** mesmo tratamento — badge no item específico, demais linhas funcionam.
- **D-11:** Save do rascunho-editado **mantém o mesmo `orcamentoId`** (UPDATE, não INSERT — `Step3Revisao.tsx:202-213` já faz isso). Status permanece `rascunho` até user mudar via dropdown (Wave C).
- **D-12:** Nenhum tracking de "último step" é adicionado (não precisa de migration de schema). Out of scope: se virar pedido frequente do colab depois, vira phase futura.

### C) Marcar status pós-PDF (WIZ-04)

- **D-13:** Controle = **dropdown shadcn `<Select>` no card de Pedidos**. Cada card mostra status atual como badge colorido + dropdown ao lado. Edit instantâneo (não tem step de confirmação) **exceto** para "aprovado".
- **D-14:** **Sempre disponível** (não exige PDF gerado). Rascunho criado às 14h pode virar "perdido" às 14h05 se cliente recuar. Forcing function de "só após PDF" trava demais o dia-a-dia do colab.
- **D-15:** Permissões: **colab dono + admin** podem mudar. RLS UPDATE em `orcamentos` já filtra por `colaborador_id`/admin (verificar policies atuais — se não cobrirem, adicionar nas RLS policies como hotfix integrado ao plano). Admin vê todos os cards via `has_role`.
- **D-16:** **Só `aprovado` é one-way.** Ao escolher 'aprovado' no dropdown, abre `AlertDialog`: "Marcar como aprovado é irreversível. Tem certeza?" → confirma → UPDATE. Outras transições (rascunho ↔ pendente ↔ perdido) são free. UPDATE policy server-side **deve bloquear `WHERE status='aprovado'` UPDATEs** para garantir invariante mesmo se UI vazar (camada de defesa).
- **D-17:** Visual: badge por status — `rascunho` (cinza), `pendente` (amarelo/âmbar), `aprovado` (verde), `perdido` (vermelho discreto). Reaproveitar tokens shadcn (`bg-muted`, `bg-yellow-100`, `bg-emerald-100`, `bg-red-100`) — Claude's Discretion na paleta exata.
- **D-18:** Status change dispara `toast.success` ("Status atualizado para aprovado"). Sem alterar comportamento do PDF — PDF já gerado fica imutável. Status muda metadado do orçamento, não regera PDF.

### D) Descrição rica (WIZ-05)

- **D-19:** **Formato:** `Nome | <temperatura_k>K | <potencia_watts>W | IRC <irc> | <nicho>` (separador pipe). Ordem fixa. Builder pure function em `src/lib/produtoDescricao.ts` (novo arquivo) recebendo `{ nome, atributos, potencia_watts }` e retorna a string final.
- **D-20:** **Atributo ausente é suprimido** (não mostra `—` nem placeholder). Se só `nome + temperatura_k` existem: `Plafon X | 4000K`. Se nada existe além do nome (snapshots antigos, coringa, legado): `Plafon X` (nome cru). Casa com WIZ-05 success criterion #5.
- **D-21:** **Onde renderiza:** `Step 3 (review)` + `PDF v2`. Mantém **descrição crua** em `AmbienteCard` (Step 2) e `PDF v1` (legacy). Justificativa: Step 2 é fase de montagem (clareza > completude); Step 3 e PDF v2 são revisão/entrega (completude > densidade). PDF v1 não é mais default mas snapshots antigos podem cair nele — manter sem mudança evita re-render diferente do que cliente viu.
- **D-22:** **Snapshots antigos** (`orcamento.ambientes` sem os campos): ao re-renderizar (no PDF de re-export ou no Step 3 ao reabrir rascunho), **re-resolver pelo código do produto** → `SELECT atributos, potencia_watts FROM product_variants WHERE codigo = item.codigo LIMIT 1`. Se produto sumiu, usa o snapshot puro (`item.descricao` cru). **Sem reescrever o snapshot** com os campos novos — orçamento histórico fica honesto ao que foi salvo.
- **D-23:** Re-resolution é **read-time, cache no client** (TanStack Query por código). Lookup de N códigos no Step 3 vira `SELECT ... WHERE codigo IN (...)` único — não 1 query por linha. Cache por código com staleTime razoável (5min) já que master muda raro.
- **D-24:** **Atributos lidos:**
  - `atributos->>'temperatura_k'` → renderiza `${v}K` (sem espaço entre número e K)
  - `potencia_watts` (coluna typed) → renderiza `${v}W`
  - `atributos->>'irc'` → renderiza `IRC ${v}`
  - `atributos->>'nicho'` → renderiza valor cru (string já formatada na master)
  - **Não consome** outros campos (cor_iluminacao, etc.) na Phase 10 — escopo travado nos 4 atributos.

### E) Sync TypeScript types (corolário Phase 7 D-13)

- **D-25:** Atualizar `src/types/orcamento.ts:109` — `StatusOrcamento` muda de `'rascunho' | 'fechado' | 'perdido'` para `'rascunho' | 'aprovado' | 'perdido' | 'pendente'`. Phase 7 já fez UPDATE in-place `fechado → aprovado` em prod; tipo TS finalmente reflete a realidade.
- **D-26:** Regenerar `src/integrations/supabase/types.ts` via Supabase CLI (`supabase gen types typescript --project-id jkewlaezvrbuicmncqbj`) — types atuais ainda podem ter o CHECK antigo. Reabsorve sem perder edits manuais (arquivo é auto-gerado por convenção).
- **D-27:** Buscar/atualizar todos os usos hardcoded de `'fechado'` no client (`grep -rn "fechado" src/`). Phase 6 (filtros Pedidos) e Step3 já usam vars typed, mas Admin/dashboard podem ter strings literais.

### F) Cross-cutting

- **D-28:** Toda mudança de UI **respeita o design tokens existente** (`bg-card`, `text-muted-foreground`, etc.) — sem hard-coded colors fora do que já é exceção (badges de status). Segue convenção do projeto (ver CLAUDE.md "Styling").
- **D-29:** Texto em português brasileiro (PROJECT.md). Botões: "Continuar rascunho", "Marcar como aprovado", "Editar quantidade", etc. Toasts em pt-BR.
- **D-30:** Smoke esperado pós-execução: (a) criar rascunho novo → Step3 edita qty/preço → gera PDF; (b) marca status do rascunho recém-criado pra "perdido"; (c) cria outro rascunho mas não gera PDF, depois reabre via Pedidos → confirma prefill; (d) abre orçamento antigo (snapshot pré-v1.1) → confirma que renderiza nome cru sem crash; (e) marca um rascunho novo pra "aprovado" → confirma dialog + irreversibilidade.

### Claude's Discretion

- Naming exato de variáveis/funções (segue `camelCase` português pra domain, inglês pra infra — CLAUDE.md)
- Quantidade exata de plans (planner decide, mas estimativa: 4-5 plans — 1 edit qty/preço, 1 reabrir rascunho, 1 status dropdown, 1 descrição rica builder + integração, 1 cleanup/smoke)
- Cores exatas dos badges de status (dentro dos tokens shadcn)
- Estrutura do novo arquivo `produtoDescricao.ts` (helper + tests)
- Toast text exato
- Tradução das mensagens de erro
- Implementação do re-lookup com TanStack Query (chave, staleTime)

### G) Adendos pós-research (2026-05-14)

- **D-31:** **Remover `EncerrarNegociacaoModal`** completamente. Componente está bugado em prod (grava `status='fechado'` que o CHECK constraint da Phase 7 rejeita) e vira redundante com o dropdown novo de status no card de Pedidos (D-13). Plan de cleanup deleta o arquivo + remove imports/usos. Bug-fix oportunístico via deleção.
- **D-32:** **RLS SELECT em `orcamentos` fica fora do escopo da Phase 10.** A migration da Phase 10 só toca UPDATE policies (`colab dono | admin` + bloqueio de `WHERE status='aprovado'`). SELECT continua `USING (true)` por enquanto — Phase 9 fechou RLS de arquitetos+clientes; orçamentos seria phase futura se vier no v1.2. Não adicionar todo no backlog agora — fica como observação na VERIFICATION quando Phase 10 fechar.
- **D-33:** **11 ocorrências hardcoded de `"fechado"`** em 5 arquivos (`AdminDashboard.tsx` ×6, `ClienteList.tsx` ×2, `EncerrarNegociacaoModal.tsx` ×1 — fica obsoleto via D-31, `OrcamentoDetalhe.tsx` ×2, `Admin.tsx` ×3 em STATUS_OPTIONS) precisam virar `"aprovado"`. Plan E (TS sync) cobre todas via search-replace + ajuste de STATUS_OPTIONS + sync de `StatusOrcamento` (D-25).
- **D-34:** **Padrão de input inline = espelhar `PrecosBatch.tsx`** — estado local `string` no input + flush para o domain state (`onUpdateAmbientes`) só no blur/Enter. Justificativa: `onChange` direto chama `calcularRolosPorGrupo` + `calcularDriversPorProjeto` a cada keystroke, causando jank perceptível em forms grandes. Pattern já validado em prod.

### Folded Todos

[Nenhum todo folded — todos pendentes pertencem a Phase 11 (PDF) ou Phase 12 (automação).]

</decisions>

<canonical_refs>
## Canonical References

**Roadmap & Requirements:**
- `.planning/ROADMAP.md` (Phase 10 section, success criteria 1-5)
- `.planning/REQUIREMENTS.md` (WIZ-01 through WIZ-05)
- `.planning/PROJECT.md` (core value, evolution rules)

**Upstream phase context (decisions locked):**
- `.planning/phases/07-schema-prep-v1-1/07-CONTEXT.md` — D-10..D-18 (status enum + descrição rica schema + auditoria atributos JSONB)
- `.planning/phases/09-multi-tenancy-rls/09-VERIFICATION.md` — RLS policies que cobrem visibility (colab dono / admin via has_role)

**Files to read at planning time:**
- `src/components/Step3Revisao.tsx` — current flow: violation detection (l.83-95), salvarOrcamento (l.198-239), ExceptionChat hook (l.580+), status hardcoded "rascunho" (l.224)
- `src/components/AmbienteCard.tsx` — current produto.descricao usage (l.120, 187, 204, 234, 311, 380, 429, 487) — Phase 10 mantém estes inalterados (D-21)
- `src/lib/gerarPdfHtml.ts` — PDF v2 builder, ponto onde a descrição é renderizada (Phase 10 troca aqui)
- `src/types/orcamento.ts` — `StatusOrcamento` type (l.109) que precisa update D-25
- `src/integrations/supabase/types.ts` — auto-gen, regenerar pós Phase 7 status enum
- `src/pages/Admin.tsx` — Pedidos tab (l.146+) onde o card de orçamento mora + filtros já existentes
- `src/pages/Index.tsx` — entry point do wizard que vai detectar reopened-draft state (D-09)
- `supabase/migrations/20260511000003_orcamentos_status_enum.sql` — CHECK constraint em vigor

**Pattern reference (Drive v1.0):**
- `src/components/DriveExplorer.tsx` + `src/components/DriveSidebar.tsx` — pattern de RLS-aware UI listing já validado (referência pra como mostrar cards do colab dono na tab Pedidos)

**Out-of-scope (Phase 11/12):**
- PDF v2 ajustes restantes (sistemas vazio, prazo 20 dias) — não tocar em `gerarPdfHtml.ts` além da descrição rica
- Dashboard tab Início (DASH-01) — não tocar em `AdminDashboard.tsx`

</canonical_refs>

<deferred_ideas>
- **Tracking de "último step" do rascunho** — adicionar `orcamentos.ultimo_step` + heurística de reabertura. Out of Phase 10 (D-12). Pode entrar em v1.2 se colab pedir.
- **Edit propagando back pra Step 2** — Phase 10 mantém Step 2 = estrutura, Step 3 = negociação (D-06). Se UX pedir consistência total depois, vira phase futura.
- **Re-resolver descrição + reescrever snapshot** — opção rejeitada em D-22 pra preservar historicidade. Se virar requisito (ex: relatório retroativo de descrição completa), vira phase nova com migration de backfill.
- **Status workflow mais rico (pendente → aprovado → faturado → entregue)** — fora do escopo v1.1. Out of Scope explicitamente no REQUIREMENTS.md.

</deferred_ideas>

<success_criteria>
Plans gerados pelo planner devem cobrir os 5 success criteria do ROADMAP (Phase 10):

1. Step 3 edita preço com floor preco_minimo → integração com ExceptionChat existente
2. Step 3 edita quantidade com recalc on-blur/Enter → todos os totais (subtotal, total geral, agrupamento de rolos) atualizam
3. Reabrir rascunho do card de Pedidos abre wizard no Step 1 com prefill completo + tratamento de órfã
4. Dropdown de status no card de Pedidos com permissões colab dono / admin + `aprovado` one-way via AlertDialog
5. Descrição rica `Nome | TK | WW | IRC X | Nicho` no Step 3 + PDF v2 com suppress-on-missing e fallback ao snapshot

Verificação Phase 10:
- Smoke manual em prod (Lenny ou Playwright via Phase 13) cobrindo os 5 fluxos
- Snapshots pré-v1.1 ainda renderizam (não crash)
- Status `aprovado` realmente irreversível (tentativa via SQL direto retorna 0 rows updated se UPDATE policy bloquear)

</success_criteria>
