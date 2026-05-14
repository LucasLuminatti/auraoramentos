# Phase 10: Wizard — Edição + Status + Descrição Rica — Research

**Researched:** 2026-05-14
**Domain:** React wizard state management, Supabase RLS, TypeScript type sync, JSONB atributos
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**A) Edição preço/qtd no Step 3 (WIZ-01, WIZ-02)**
- D-01: Input inline na tabela. Dois inputs por linha: `quantidade` (integer) e `preco_unitario` (decimal). Sem dialog, sem toggle.
- D-02: Recalc on-blur + Enter. Enter no input força blur via keydown handler.
- D-03: Mantém fluxo ExceptionChat existente. Editor inline gera `precoUnitario` novo; detector de violação já compara contra `precoMinimo`.
- D-04: Persistência só no snapshot. Edit altera `ambientes` em memória → UPDATE `orcamentos.ambientes` no salvarOrcamento. `product_variants` não muda.
- D-05: Quantidade aceita inteiros >= 1. Preço aceita decimais >= 0 (zero permitido). Input `type="number"` + clamp no onChange.
- D-06: Edits no Step 3 NÃO propagam de volta pro Step 2. Se user volta ao Step 2 e muda produto, Step 3 reseta os valores editados daquele item.

**B) Reabrir rascunho (WIZ-03)**
- D-07: Entry point único = card de orçamento na tab Pedidos (Admin.tsx). Card com `status='rascunho'` ganha cursor pointer + tooltip "Continuar este rascunho".
- D-08: Sempre reabre no Step 1 com prefill completo (`cliente_id`, `colaborador_id`, `tipo`, `ambientes`). Sem heurística de "último step".
- D-09: Reutiliza `<Index>` existente. Via `navigate("/", { state: { orcamentoId } })`. Index detecta o state, faz fetch, popula.
- D-10: Snapshot órfã — cliente deletado: toast + redirect para Pedidos, sem abrir wizard. Produto removido do master: badge amarelo "Produto removido do catálogo", não bloqueia.
- D-11: Save do rascunho-editado mantém mesmo `orcamentoId` (UPDATE, não INSERT — já implementado em `Step3Revisao.tsx:202-213`).
- D-12: Sem tracking de "último step" — não precisa de migration.

**C) Marcar status pós-PDF (WIZ-04)**
- D-13: Dropdown shadcn `<Select>` no card de Pedidos. Status atual como badge colorido + dropdown ao lado.
- D-14: Sempre disponível (não exige PDF gerado).
- D-15: Permissões: colab dono + admin podem mudar. RLS UPDATE em `orcamentos` precisa verificar — ver análise abaixo.
- D-16: Só `aprovado` é one-way. AlertDialog de confirmação ao escolher 'aprovado'. UPDATE policy server-side deve bloquear `WHERE status='aprovado'` UPDATEs.
- D-17: Badges: `rascunho` (cinza), `pendente` (âmbar), `aprovado` (verde), `perdido` (vermelho). Paleta exata = Claude's Discretion.
- D-18: Status change dispara `toast.success`. Sem alterar PDF já gerado.

**D) Descrição rica (WIZ-05)**
- D-19: Formato `Nome | <temperatura_k>K | <potencia_watts>W | IRC <irc> | <nicho>`. Builder pure function em `src/lib/produtoDescricao.ts`.
- D-20: Atributo ausente suprimido (não mostra `—`). Snapshot sem atributos → nome cru.
- D-21: Renderiza em Step 3 + PDF v2. AmbienteCard (Step 2) e PDF v1 mantêm descrição crua.
- D-22: Snapshots antigos: re-resolver pelo código via `SELECT atributos, potencia_watts FROM product_variants WHERE codigo = item.codigo LIMIT 1`. Se produto sumiu → snapshot puro. Sem reescrever o snapshot.
- D-23: Re-resolution = read-time, cache no client (TanStack Query por código). Batch `WHERE codigo IN (...)`.
- D-24: Atributos: `atributos->>'temperatura_k'` → `${v}K`; `potencia_watts` (coluna typed) → `${v}W`; `atributos->>'irc'` → `IRC ${v}`; `atributos->>'nicho'` → valor cru. Phase 10 não consome outros campos.

**E) Sync TypeScript types (corolário Phase 7 D-13)**
- D-25: `StatusOrcamento` em `src/types/orcamento.ts:109` muda de `'rascunho' | 'fechado' | 'perdido'` para `'rascunho' | 'aprovado' | 'perdido' | 'pendente'`.
- D-26: Regenerar `src/integrations/supabase/types.ts` via `supabase gen types typescript --project-id jkewlaezvrbuicmncqbj`.
- D-27: Buscar/atualizar todos os usos hardcoded de `'fechado'` no client (`grep -rn "fechado" src/`).

**F) Cross-cutting**
- D-28: Design tokens existentes. Sem hard-coded colors fora das exceções já no projeto.
- D-29: Texto em português brasileiro.
- D-30: Smoke esperado cobrindo 5 fluxos.

### Claude's Discretion
- Naming exato de variáveis/funções
- Quantidade exata de plans (estimativa: 4-5 plans)
- Cores exatas dos badges de status (dentro dos tokens shadcn)
- Estrutura do novo arquivo `produtoDescricao.ts`
- Toast text exato
- Tradução das mensagens de erro
- Implementação do re-lookup com TanStack Query (chave, staleTime)

### Deferred Ideas (OUT OF SCOPE)
- Tracking de "último step" do rascunho
- Edit propagando back pra Step 2
- Re-resolver descrição + reescrever snapshot
- Status workflow mais rico
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WIZ-01 | Colaborador pode editar preço unitário de item no Step 3 antes de gerar PDF, com floor mínimo no `preco_minimo` | Input inline na tabela Step3Revisao.tsx; padrão PrecosBatch.tsx já usa `type="number"` + onChange handler; violação já detectada em l.83-95 |
| WIZ-02 | Colaborador pode editar quantidade de item no Step 3 antes de gerar PDF | Mesmo padrão WIZ-01; recalc via `onUpdateAmbientes` prop já exposta em Step3Props |
| WIZ-03 | Colaborador pode reabrir orçamento com `status='rascunho'` clicando no card de Pedidos | Admin.tsx já lista orcamentos com todos os joins; Index.tsx não lê `location.state` ainda (gap a preencher); `useLocation` disponível em outros componentes do projeto |
| WIZ-04 | Colaborador ou admin pode marcar status do orçamento (aprovado/perdido/pendente) | `<Select>` shadcn já importado em Admin.tsx; RLS UPDATE atual é `USING (true)` — precisa de nova migration para one-way `aprovado` e filtro por colab_dono |
| WIZ-05 | Descrição rica puxando nome + temperatura(K) + potência + IRC + nicho | `atributos` JSONB em `product_variants` cobre temperatura_k/irc/nicho (confirmado em `src/lib/productAttributes.ts`); `potencia_watts` é coluna typed; builder novo em `src/lib/produtoDescricao.ts` |
</phase_requirements>

---

## Summary

A Phase 10 é inteiramente de UI + lógica de negócio — sem migration de schema. O banco já está pronto (Phase 7: CHECK constraint com os 4 status, Phase 9: RLS por colaborador). O trabalho está concentrado em três arquivos existentes (`Step3Revisao.tsx`, `Admin.tsx`, `Index.tsx`) e um arquivo novo (`src/lib/produtoDescricao.ts`).

O maior gap de implementação é a ausência de RLS adequada para o UPDATE de status: a policy atual `"Authenticated users can update orcamentos" USING (true)` não distingue colab dono vs outros colabs, e não bloqueia UPDATE em `status='aprovado'`. Isso precisa de uma migration nova — a única migration da Phase 10 (sem tocar em colunas ou dados, só policies). Além disso, o `src/types/orcamento.ts:109` ainda tem `'rascunho' | 'fechado' | 'perdido'` desatualizado desde a Phase 7, e há 11 usos hardcoded de `"fechado"` espalhados em 5 arquivos.

A feature de descrição rica usa TanStack Query, que está instalado no projeto (`@tanstack/react-query: 5.83.0`) mas **não está sendo usado** nas queries do wizard hoje — todas são chamadas Supabase diretas. Para WIZ-05, usá-lo para cache de lookup de `product_variants` por código é a primeira vez que TanStack Query vai aparecer no caminho crítico do wizard.

**Primary recommendation:** Implementar em 5 plans — (1) inline edit qty/preço Step3, (2) reabrir rascunho via Index.tsx + Admin.tsx, (3) status dropdown + migration RLS one-way, (4) produtoDescricao.ts builder + integração Step3 + PDF v2, (5) TS sync + cleanup `fechado` hardcoded + smoke.

---

## Standard Stack

### Core (já instalado — sem npm install necessário)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React 18 + shadcn `<Input>` | 18.3.1 / shadcn 1.x | Input inline na tabela Step3 | Padrão do projeto; PrecosBatch já usa este padrão exato |
| shadcn `<Select>` | 1.x | Dropdown de status no card Pedidos | Já importado em Admin.tsx (linha 30); já existe no projeto |
| shadcn `<AlertDialog>` | 1.x | Confirmação one-way para `aprovado` | Já importado em Admin.tsx (linha 28) |
| shadcn `<Badge>` | 1.x | Badges de status coloridos | Já usado em Step3Revisao.tsx e ClienteList.tsx |
| TanStack React Query | 5.83.0 | Cache de lookup `product_variants` por código (WIZ-05 D-23) | Instalado, QueryClient configurado em App.tsx, mas não usado no wizard ainda |
| `useNavigate` + `useLocation` (React Router DOM 6) | 6.30.1 | Passar `orcamentoId` via `location.state` para reabrir rascunho | `useLocation` já usado em `CompletarCadastroBanner.tsx`; `useNavigate` já em Index.tsx |
| Supabase JS SDK | 2.95.3 | UPDATE status + RLS | Já em uso em toda a aplicação |

### Nova Migration (única de Phase 10)

| Migration | Propósito | Conteúdo |
|-----------|-----------|----------|
| `20260514000002_orcamentos_status_rls.sql` | RLS UPDATE por colab dono + block aprovado | DROP policy antiga `USING (true)`, CREATE 2 novas policies (colab dono / admin), trigger ou policy WITH CHECK para bloquear UPDATE de `status='aprovado'` |

**Installation:** Nenhuma nova dependência de npm. Tudo já instalado.

---

## Architecture Patterns

### Pattern 1: Input Inline na Tabela (WIZ-01, WIZ-02) — baseado em PrecosBatch.tsx

**What:** Substituir a célula estática `{item.quantidade}` e `{formatarMoeda(item.precoUnitario)}` por `<Input type="number">` dentro da `<TableCell>`. Mudança de valor chama `onUpdateAmbientes` com o array de ambientes atualizado.

**Prior art no projeto:** `PrecosBatch.tsx` linhas 309-333 já faz exatamente isso — `<Input type="number" step="0.01" min="0" value={valorTabela} onChange={...} className="w-28 text-right ml-auto" />`. Reutilizar o mesmo pattern.

**Quando usar:** Células de `quantidade` e `precoUnitario` nas TableRows de luminárias e sistemas (fita, perfil, driver) na tabela do Step 3.

**Consideração de scope:** O Step3Revisao já tem `onUpdateAmbientes` como prop e já o usa em `handleAjustarPreco` (l.148-165). O handler de edição inline segue o mesmo padrão imutável — mapear sobre `ambientes`, localizar pelo `ambienteId` + `itemId`, retornar novo objeto com valor atualizado.

```typescript
// Source: padrão PrecosBatch.tsx + Step3Revisao.tsx handleAjustarPreco
const handleEditQuantidade = (ambienteId: string, tipo: TipoItem, itemId: string, valor: string) => {
  const qtd = Math.max(1, parseInt(valor, 10) || 1);
  const updated = ambientes.map((amb) => {
    if (amb.id !== ambienteId) return amb;
    if (tipo === 'luminaria') {
      return { ...amb, luminarias: amb.luminarias.map((l) =>
        l.id === itemId ? { ...l, quantidade: qtd } : l
      )};
    }
    // ... sistemas (perfil.quantidade)
    return amb;
  });
  onUpdateAmbientes(updated);
};
```

**on-blur + Enter:** `onBlur={handleEdit...}` + `onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}` — padrão simples sem estado local por célula.

**PITFALL:** Não usar `onChange` para recalc (dispara a cada keystroke, roda `calcularRolosPorGrupo` + `calcularDriversPorProjeto` por cada char). Usar estado local de string no input (`useState<string>`) e só chamar `onUpdateAmbientes` no blur.

```typescript
// [VERIFIED: codebase inspection] Pattern correto para input controlado com flush no blur:
const [localValue, setLocalValue] = useState(String(item.quantidade));
// onChange → setLocalValue (só string local)
// onBlur → clamp + onUpdateAmbientes
```

### Pattern 2: Reabrir Rascunho via location.state (WIZ-03)

**What:** Admin.tsx faz `navigate("/", { state: { orcamentoId } })` ao clicar no card rascunho. Index.tsx lê `useLocation().state`, detecta `orcamentoId`, faz fetch do orçamento e popula o state do wizard.

**Prior art:** `CompletarCadastroBanner.tsx` já usa `useLocation()` para detectar contexto. Index.tsx já tem `useNavigate` importado mas não usa `useLocation` ainda.

```typescript
// Index.tsx — adicionar após os hooks existentes
const location = useLocation();
const orcamentoParaReabrir = (location.state as { orcamentoId?: string } | null)?.orcamentoId;

useEffect(() => {
  if (!orcamentoParaReabrir) return;
  // fetch + popula state do wizard
}, [orcamentoParaReabrir]);
```

**Por que não query param:** Dados sensíveis (orcamentoId) não deveriam aparecer na URL pública. State via navigate é efêmero (some no refresh), o que é correto — rascunho reabre da fonte (banco), não do URL.

**Prefill completo no Step 1:** O fetch traz `{ cliente_id, colaborador_id, tipo, ambientes, projeto_id, projetos: { nome }, clientes: { nome } }`. Setar:
- `setDados({ colaborador: colaborador.nome, tipo: orc.tipo })`
- `setAmbientes(orc.ambientes as Ambiente[])`
- `setCurrentClienteId(orc.cliente_id)`
- `setCurrentProjetoId(orc.projeto_id)`
- `setCurrentClienteNome(orc.clientes.nome)`
- `setCurrentProjetoNome(orc.projetos.nome)`
- `setMode("create")` — mantém o wizard ativo

**Step3 precisa saber o orcamentoId:** O `orcamentoId` precisa ser passado para Step3Revisao para que o `persistirOrcamento` faça UPDATE (não INSERT). Hoje o `orcamentoId` é state interno do Step3 (`useState<string | null>(null)`). Para rascunho reaberto, precisamos inicializá-lo com o ID existente. Abordagem: adicionar prop opcional `initialOrcamentoId?: string` em `Step3Props` e setar o state interno com `useEffect(() => { if (initialOrcamentoId) setOrcamentoId(initialOrcamentoId); }, [])`.

### Pattern 3: Status Dropdown no Card de Pedidos (WIZ-04)

**What:** Na TableRow de orçamento em Admin.tsx (l.999-1030), substituir o badge estático de status por `Badge + Select` inline. UPDATE direto via Supabase SDK, otimisticamente atualizar o state local.

**Shadcn Select já disponível:** Importado em Admin.tsx linha 30. `<Select onValueChange={handleStatusChange} value={o.status}>`.

**AlertDialog para aprovado:** Já importado em Admin.tsx linha 28. Ao selecionar 'aprovado' no Select, abrir AlertDialog antes de confirmar o UPDATE.

**State local para evitar refetch completo:** Ao confirmar o UPDATE, atualizar `orcamentos` state via `setOrcamentos(prev => prev.map(o => o.id === id ? {...o, status: novoStatus} : o))`. Refetch completo só em erro.

**Onde renderizar:** A tabela atual tem colunas [Data, Cliente, Projeto, Colaborador, Valor, Status, Ações]. Substituir a coluna "Status" pelo componente composto `StatusBadgeSelect`. A coluna "Ações" já existe — manter.

### Pattern 4: RLS one-way para `aprovado` (corolário D-16)

**Opção A — UPDATE Policy com CHECK:** A policy de UPDATE em `orcamentos` pode incluir `USING (status != 'aprovado')` — impede UPDATE em rows onde status já é 'aprovado'. Complementar com `WITH CHECK (...)` para restringir quem pode atualizar.

**Opção B — Trigger BEFORE UPDATE:** `CREATE OR REPLACE FUNCTION block_aprovado_revert()` que faz `RAISE EXCEPTION` se `OLD.status = 'aprovado' AND NEW.status != 'aprovado'`.

**Recomendação:** Opção A (policy) — mais idiomática no Supabase, sem função PL/pgSQL extra. A policy atual `"Authenticated users can update orcamentos" USING (true)` precisa ser DROPADA e substituída por:
```sql
-- Policy para colab dono
CREATE POLICY "Colab can update own orcamentos (non-aprovado)"
  ON public.orcamentos FOR UPDATE TO authenticated
  USING (colaborador_id = (SELECT id FROM colaboradores WHERE user_id = auth.uid())
         AND status != 'aprovado')
  WITH CHECK (status IN ('rascunho', 'aprovado', 'perdido', 'pendente'));

-- Policy para admin (pode qualquer update exceto reverter aprovado)
CREATE POLICY "Admin can update orcamentos (non-aprovado)"
  ON public.orcamentos FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') AND status != 'aprovado')
  WITH CHECK (status IN ('rascunho', 'aprovado', 'perdido', 'pendente'));
```

**PITFALL:** A policy `WITH CHECK` se aplica à row resultante, não à row atual. O `USING` é quem filtra as rows que podem sofrer UPDATE. Então `USING (status != 'aprovado')` impede edição de rows já aprovadas — correto.

**Caveat:** A column `colaboradores.user_id` existe desde Phase 7. O subquery `SELECT id FROM colaboradores WHERE user_id = auth.uid()` é o padrão já validado em Phase 9 para `arquitetos`/`clientes`.

### Pattern 5: Builder `produtoDescricao.ts` (WIZ-05)

**What:** Função pura `construirDescricaoRica({ nome, atributos, potenciaWatts })` que retorna string.

**Atributos confirmados no codebase:** `src/lib/productAttributes.ts` confirma que `temperatura_k`, `irc` e `nicho` são chaves do JSONB `atributos` (linhas 78, 81, 90). `potencia_watts` é coluna typed em `product_variants`.

```typescript
// src/lib/produtoDescricao.ts
interface AtributosRicos {
  nome: string;
  atributos?: Record<string, unknown> | null;
  potenciaWatts?: number | null;
}

export function construirDescricaoRica({ nome, atributos, potenciaWatts }: AtributosRicos): string {
  const partes: string[] = [nome];
  const tempK = atributos?.temperatura_k;
  if (tempK != null && tempK !== "") partes.push(`${tempK}K`);
  if (potenciaWatts != null) partes.push(`${potenciaWatts}W`);
  const irc = atributos?.irc;
  if (irc != null && irc !== "") partes.push(`IRC ${irc}`);
  const nicho = atributos?.nicho;
  if (nicho != null && nicho !== "") partes.push(String(nicho));
  return partes.join(" | ");
}
```

**Testável como função pura — pode ganhar teste Vitest.**

### Pattern 6: Re-lookup com TanStack Query (WIZ-05 D-23)

**What:** No Step3Revisao, ao montar/renderizar, coletar todos os `codigo` distintos dos items (luminarias + fita/perfil/driver de sistemas). Fazer 1 query batch `WHERE codigo IN (...)`. Cache por array de códigos com staleTime = 5 minutos.

**TanStack Query 5.x no projeto:** `QueryClient` configurado em `App.tsx` — todos os componentes dentro do Provider têm acesso ao `useQuery`.

```typescript
// [ASSUMED: TanStack Query v5 API — baseado em conhecimento de treinamento]
const allCodigos = useMemo(() =>
  [...new Set([
    ...ambientes.flatMap(a => a.luminarias.map(l => l.codigo)),
    ...ambientes.flatMap(a => a.sistemas.flatMap(s =>
      [s.fita.codigo, s.driver.codigo, s.perfil?.codigo].filter(Boolean)
    )),
  ])], [ambientes]);

const { data: atributosMap } = useQuery({
  queryKey: ['produtoAtributos', allCodigos],
  queryFn: async () => {
    if (!allCodigos.length) return {};
    const { data } = await supabase
      .from('product_variants')
      .select('codigo, atributos, potencia_watts')
      .in('codigo', allCodigos);
    return Object.fromEntries((data ?? []).map(p => [p.codigo, p]));
  },
  staleTime: 5 * 60 * 1000, // 5 minutos
  enabled: allCodigos.length > 0,
});
```

**PITFALL:** `queryKey: ['produtoAtributos', allCodigos]` — o array `allCodigos` como parte da chave precisa ser estável (useMemo). Se `allCodigos` recriar a referência a cada render, vai invalidar o cache desnecessariamente.

### Recommended Project Structure para novos arquivos

```
src/
├── lib/
│   └── produtoDescricao.ts          # NEW — builder puro WIZ-05
├── lib/__tests__/
│   └── produtoDescricao.test.ts     # NEW — testes da função pura
└── components/
    └── Step3Revisao.tsx             # MODIFIED — inputs inline + re-lookup
src/pages/
├── Admin.tsx                         # MODIFIED — status dropdown + reabrir rascunho
└── Index.tsx                         # MODIFIED — location.state para reabrir
src/types/
└── orcamento.ts                      # MODIFIED — StatusOrcamento D-25
src/integrations/supabase/
└── types.ts                          # REGENERATED — supabase gen types
supabase/migrations/
└── 20260514000002_orcamentos_status_rls.sql  # NEW — RLS UPDATE one-way
```

### Anti-Patterns a Evitar

- **onChange direto chamando onUpdateAmbientes:** Dispara recalc em cada keystroke — causa jank visível com 3+ ambientes. Usar estado local de string + flush no blur.
- **INSERT novo ao reabrir rascunho:** O `orcamentoId` no state do Step3 controla o caminho UPDATE vs INSERT. Garantir que `initialOrcamentoId` seja propagado corretamente ou o Step3 vai criar um orçamento duplicado.
- **Reverter aprovado via SQL direto no dashboard:** A policy RLS é a linha de defesa server-side. A UI deve mostrar o dropdown como disabled após `status='aprovado'`, mas a policy garante o invariante mesmo se a UI vazar.
- **Reescrever snapshot com nova descrição:** D-22 é explícito: NÃO reescrever o JSONB `orcamentos.ambientes` com os atributos ricos. O snapshot histórico fica intacto.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Input numérico em tabela | Custom component de edição | shadcn `<Input type="number">` (padrão PrecosBatch.tsx) | Já validado no projeto, tem className `text-right`, responsivo |
| Dialog de confirmação | Custom modal React | shadcn `<AlertDialog>` (já importado em Admin.tsx l.28) | Pronto, acessível, segue os tokens do projeto |
| Dropdown de seleção | Custom select | shadcn `<Select>` (já importado em Admin.tsx l.30) | Pronto, ARIA compliant, tem o mesmo visual que outros dropdowns da UI |
| Cache de queries | `useState` + `useRef` manual | TanStack Query `useQuery` com staleTime | Evita re-fetch desnecessário, já configurado no projeto |
| Proteção one-way de status | Validação só no frontend | Supabase RLS `USING (status != 'aprovado')` | Server-side garante invariante mesmo com acesso direto ao banco |

---

## Runtime State Inventory

Fase 10 não é rename/refactor. Esta seção não se aplica.

---

## Common Pitfalls

### Pitfall 1: Input controlado perde foco ao digitar
**What goes wrong:** Se o Input é controlado por `value={item.quantidade}` e dispara `onUpdateAmbientes` no onChange, cada keystroke re-renderiza o componente e o input perde o foco.
**Why it happens:** `onUpdateAmbientes` atualiza o estado pai (`ambientes`), causando re-render de toda a tabela de ambientes.
**How to avoid:** Usar estado local `const [localVal, setLocalVal] = useState(String(item.quantidade))`. O `value` do Input é `localVal`. Só no `onBlur` (e no `onKeyDown Enter`) flush para `onUpdateAmbientes`.
**Warning signs:** Input volta ao valor original ao digitar o segundo caractere.

### Pitfall 2: Duplicate INSERT ao reabrir rascunho
**What goes wrong:** Step3Revisao cria orçamento novo (INSERT) mesmo quando está editando um rascunho existente.
**Why it happens:** O `orcamentoId` no Step3Revisao é inicializado como `null`. Se a prop `initialOrcamentoId` não for passada ou não for setada no `useEffect`, o `persistirOrcamento` entra no branch INSERT.
**How to avoid:** Prop `initialOrcamentoId?: string` em Step3Props + `useEffect(() => { if (initialOrcamentoId) setOrcamentoId(initialOrcamentoId); }, [initialOrcamentoId])` no início do componente.
**Warning signs:** Aparece um novo orçamento no Pedidos após salvar rascunho editado.

### Pitfall 3: `queryKey` instável invalida cache do TanStack Query
**What goes wrong:** A query de atributos refaz o fetch a cada render porque `allCodigos` recria o array.
**Why it happens:** `allCodigos` sem `useMemo` recria referência a cada render. TanStack Query compara a queryKey por valor profundo mas arrays de strings mudam referência.
**How to avoid:** Envolver `allCodigos` em `useMemo(() => [...new Set([...])], [ambientes])`. A chave de query deve ser estável enquanto os ambientes não mudam.
**Warning signs:** Network tab mostra repeated requests para `/rest/v1/product_variants` ao interagir com a UI.

### Pitfall 4: `STATUS_OPTIONS` desatualizado em Admin.tsx
**What goes wrong:** O filtro de status no Pedidos exibe opções obsoletas (`enviado`, `fechado`) que não existem mais no banco.
**Why it happens:** `STATUS_OPTIONS` (l.51-58) foi definido antes da Phase 7 e ainda tem `enviado` e `fechado`. O banco tem CHECK constraint com `{rascunho, aprovado, perdido, pendente}`.
**How to avoid:** Atualizar `STATUS_OPTIONS` para os 4 valores atuais ao sincronizar os status (Plan do cleanup D-27).
**Warning signs:** Filtrar por "Fechado" retorna sempre vazio; filtrar por "Enviado" também — valores nunca mais existirão no banco.

### Pitfall 5: `statusClass` e `statusLabel` desatualizados em múltiplos arquivos
**What goes wrong:** Badge de status aparece sem cor (cai no `default`) para `pendente` e `aprovado`.
**Why it happens:** `statusClass` em Admin.tsx (l.436-443), ClienteList.tsx (l.151-158) e OrcamentoDetalhe.tsx (l.77) ainda mapeiam `fechado` para verde e não têm `pendente`. Com a Phase 10 criando o dropdown, `pendente` vai aparecer nas listas e ficar sem cor.
**How to avoid:** No mesmo Plan do cleanup, atualizar todos os `statusClass` e `statusLabel` switches para os 4 valores atuais. Verificar também `EncerrarNegociacaoModal.tsx:46` que hardcoda `"fechado"`.
**Warning signs:** Badge cinza/padrão para orçamentos com status `pendente`.

### Pitfall 6: `canEncerrar` function e `EncerrarNegociacaoModal` gravam `fechado`
**What goes wrong:** `EncerrarNegociacaoModal.tsx:46` faz `status: resultado === "ganho" ? "fechado" : "perdido"`. Isso vai falhar na CHECK constraint que não permite `fechado` mais.
**Why it happens:** Phase 7 fez UPDATE in-place dos dados, mas o código que gravava `fechado` não foi atualizado (D-13 deferido para Phase 10).
**How to avoid:** Atualizar `EncerrarNegociacaoModal.tsx:46` para `"aprovado"` no Plan de cleanup (D-27).
**Warning signs:** Supabase retorna erro 400 ao tentar "encerrar negociação como ganha" em prod.

### Pitfall 7: RLS UPDATE scope insuficiente para status change
**What goes wrong:** Um colaborador consegue mudar status de orçamento de outro colaborador.
**Why it happens:** A policy atual `"Authenticated users can update orcamentos" USING (true)` permite UPDATE por qualquer usuário autenticado em qualquer orçamento.
**How to avoid:** A migration da Phase 10 deve substituir a policy atual por policies com `USING (colaborador_id = ... OR has_role(...,'admin'))`.
**Warning signs:** Colab B consegue mudar status de orçamento de colab A (smoke test bilateral).

---

## Code Examples

### Células editáveis na tabela Step3 (padrão PrecosBatch.tsx)

```typescript
// Source: src/components/PrecosBatch.tsx linhas 309-333 [VERIFIED: codebase]
<TableCell className="text-right">
  <Input
    type="number"
    step="0.01"
    min="0"
    value={localPreco}
    onChange={(e) => setLocalPreco(e.target.value)}
    onBlur={() => {
      const v = parseFloat(localPreco) || 0;
      const clamped = Math.max(0, v);
      handleEditPreco(ambienteId, tipo, itemId, clamped);
    }}
    onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
    className="w-24 text-right ml-auto"
  />
</TableCell>
```

### Navigate para reabrir rascunho (Admin.tsx → Index.tsx)

```typescript
// Source: React Router DOM 6 docs / useLocation já em CompletarCadastroBanner.tsx [VERIFIED: codebase]

// Em Admin.tsx — ao clicar no card rascunho:
navigate("/", { state: { orcamentoId: o.id } });

// Em Index.tsx — detectar o state:
const location = useLocation();
const orcamentoParaReabrir = (location.state as { orcamentoId?: string })?.orcamentoId;
useEffect(() => {
  if (!orcamentoParaReabrir) return;
  // fetch + populate + setMode("create")
}, [orcamentoParaReabrir]);
```

### AlertDialog para confirmação de `aprovado`

```typescript
// Source: shadcn AlertDialog já importado em Admin.tsx l.28 [VERIFIED: codebase]
<AlertDialog open={confirmAprovarOpen} onOpenChange={setConfirmAprovarOpen}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Marcar como aprovado?</AlertDialogTitle>
      <AlertDialogDescription>
        Marcar como aprovado é irreversível. Confirma?
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancelar</AlertDialogCancel>
      <AlertDialogAction onClick={confirmarAprovado}>Confirmar</AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

### RLS migration para one-way aprovado

```sql
-- Source: padrão Phase 9 migration + Supabase RLS docs [VERIFIED: supabase/migrations/]
BEGIN;

-- Drop policy permissiva atual
DROP POLICY "Authenticated users can update orcamentos" ON public.orcamentos;

-- Policy: colab dono pode atualizar seus orçamentos, mas não reverter aprovado
CREATE POLICY "Colab update own orcamentos non-aprovado"
  ON public.orcamentos FOR UPDATE TO authenticated
  USING (
    colaborador_id = (SELECT id FROM public.colaboradores WHERE user_id = auth.uid())
    AND status != 'aprovado'
  )
  WITH CHECK (status IN ('rascunho', 'aprovado', 'perdido', 'pendente'));

-- Policy: admin pode atualizar qualquer orçamento, mas não reverter aprovado
CREATE POLICY "Admin update orcamentos non-aprovado"
  ON public.orcamentos FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    AND status != 'aprovado'
  )
  WITH CHECK (status IN ('rascunho', 'aprovado', 'perdido', 'pendente'));

COMMIT;
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `StatusOrcamento = 'rascunho' \| 'fechado' \| 'perdido'` | `'rascunho' \| 'aprovado' \| 'perdido' \| 'pendente'` | Phase 7 (banco) — Phase 10 (tipo TS) | Tipo TS desatualizado desde Phase 7; Phase 10 sincroniza |
| UPDATE policy `USING (true)` em orcamentos | Policy por colab dono + admin + block aprovado | Phase 10 (nova migration) | Sem a migration, qualquer colab pode mudar qualquer orçamento |
| Descrição como `produto.descricao` plano | `Nome \| TK \| WW \| IRC X \| Nicho` (apenas Step3 + PDF v2) | Phase 10 (novo builder) | Step2 e PDF v1 não mudam |

**Deprecated/outdated para remover na Phase 10:**
- `STATUS_OPTIONS` em Admin.tsx linha 51-58: tem `enviado` e `fechado` — não existem mais no CHECK
- `statusClass`/`statusLabel` em Admin.tsx, ClienteList.tsx, OrcamentoDetalhe.tsx: mapeiam `fechado`, ignoram `pendente`
- `EncerrarNegociacaoModal.tsx:46`: grava `"fechado"` (vai falhar na CHECK constraint)
- `canEncerrar` em Admin.tsx e ClienteList.tsx: ainda verifica `"enviado"` e `"aprovado"` — `enviado` não existe mais

---

## Análise Detalhada dos Arquivos Afetados

### Step3Revisao.tsx — gaps para Phase 10

| Linha | Estado Atual | O que muda |
|-------|-------------|-----------|
| l.1 imports | Sem `useQuery` | Adicionar `useQuery` do TanStack Query |
| l.61 props | `Step3Props` sem `initialOrcamentoId` | Adicionar `initialOrcamentoId?: string` |
| l.70 state | `orcamentoId` inicia `null` | Adicionar `useEffect` para setar de `initialOrcamentoId` |
| l.381-398 TableCell Luminárias | `{item.quantidade}` e `{formatarMoeda(item.precoUnitario)}` estáticos | Substituir por `<Input>` inline com estado local |
| l.427-431 Fita | `{sis.fita.precoUnitario}` estático | `<Input>` inline para preço da fita |
| l.438-440 Perfil | `{sis.perfil.precoUnitario}` estático + `{sis.perfil.quantidade}` | `<Input>` para qty e preço |
| l.448-450 Driver | `{sis.driver.precoUnitario}` estático | `<Input>` inline para preço |
| l.388 `item.descricao` | Descrição crua | `construirDescricaoRica(...)` usando atributosMap |
| l.427 `sis.fita.descricao` | Descrição crua | `construirDescricaoRica(...)` |
| l.439 `sis.perfil.descricao` | Descrição crua | `construirDescricaoRica(...)` |
| l.448 `sis.driver.descricao` | Descrição crua | `construirDescricaoRica(...)` |

### Admin.tsx — gaps para Phase 10

| Área | Estado Atual | O que muda |
|------|-------------|-----------|
| `STATUS_OPTIONS` l.51-58 | Tem `enviado` e `fechado` inválidos | Substituir pelos 4 valores do CHECK |
| `statusClass` l.436-443 | Não tem `pendente`, mapeia `fechado` para verde | Adicionar `pendente` (âmbar), trocar `fechado` por `aprovado` (verde) |
| `statusLabel` l.425-434 | Não tem `pendente` corretamente | Adicionar `pendente` |
| `canEncerrar` l.446 | Verifica `enviado` (não existe mais) | Remover ou ajustar — `EncerrarNegociacaoModal` vai para `aprovado` direto |
| TableRow de orçamento l.999-1030 | Badge estático + `navigate` ao clicar | Adicionar conditional: se `status='rascunho'` → `navigate("/", { state: { orcamentoId } })`; coluna Status → Status + dropdown |
| Imports | Sem `useNavigate` para Index | Já tem `useNavigate` |

### Index.tsx — gaps para Phase 10

| Área | Estado Atual | O que muda |
|------|-------------|-----------|
| Imports | Sem `useLocation` | Adicionar import |
| State | Sem `orcamentoParaReabrir` | Adicionar detection via `useLocation().state` |
| `handleNovoOrcamento` | Reseta state e entra no wizard | Manter para fluxo novo; nova `handleReopenRascunho(orcamento)` para reabrir |
| Step3Revisao render (l.134) | Sem `initialOrcamentoId` | Passar `initialOrcamentoId={currentOrcamentoId}` |

### Arquivos a atualizar no cleanup (D-27)

| Arquivo | Linha | Mudança |
|---------|-------|---------|
| `src/components/ClienteList.tsx` | l.145, l.155 | Remover case `fechado`, adicionar `pendente` |
| `src/components/EncerrarNegociacaoModal.tsx` | l.46 | `"fechado"` → `"aprovado"` |
| `src/pages/OrcamentoDetalhe.tsx` | l.67, l.77 | Remover case `fechado`, adicionar `pendente` |
| `src/components/AdminDashboard.tsx` | l.60, l.109, l.138, l.210, l.211, l.213 | Trocar `"fechado"` por `"aprovado"` nos filtros e labels do gráfico |

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase CLI (`supabase gen types`) | D-26 regen tipos | ✓ (projeto já usa) | N/A — CLI instalado (migrations já aplicadas via CLI em phases anteriores) | — |
| TanStack React Query | WIZ-05 re-lookup | ✓ | 5.83.0 (no package.json) | — |
| shadcn `<Select>` + `<AlertDialog>` | WIZ-04 | ✓ | Já importados em Admin.tsx | — |
| `useLocation` React Router DOM 6 | WIZ-03 | ✓ | 6.30.1 | — |

Nenhuma dependência faltando. Phase 10 não requer `npm install`.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 3.2.4 |
| Config file | `vitest.config.ts` (raiz) |
| Quick run command | `npm run test` |
| Full suite command | `npm run test` |
| Env | jsdom |
| Aliases | `@` → `src/` configurado em vitest.config.ts |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WIZ-01 | `construirDescricaoRica` com atributos completos retorna formato correto | unit | `npm run test -- --reporter=verbose src/lib/__tests__/produtoDescricao.test.ts` | ❌ Wave 0 |
| WIZ-01 | `construirDescricaoRica` com atributo ausente suprime o campo | unit | idem | ❌ Wave 0 |
| WIZ-01 | `construirDescricaoRica` com snapshot antigo (sem atributos) retorna nome cru | unit | idem | ❌ Wave 0 |
| WIZ-02 | Mutação de quantidade dispara recalc correto (calcularSubtotalLuminaria) | unit (calc existente) | `npm run test` | ✓ (cálculos cobertos indiretamente via orcamento.ts) |
| WIZ-04 | `validarPendingChanges` — reutilizar padrão PrecosBatch | unit | `npm run test src/components/__tests__/PrecosBatch.test.tsx` | ✓ |
| WIZ-03, WIZ-04 | Fluxo de reabrir rascunho + mudar status no browser | smoke manual / Playwright | smoke manual (Phase 13) | N/A |

### Sampling Rate
- **Por task commit:** `npm run test`
- **Por wave merge:** `npm run test`
- **Phase gate:** Full suite green antes de `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/lib/__tests__/produtoDescricao.test.ts` — cobre WIZ-05 (função pura, sem mock)
- [ ] `src/lib/produtoDescricao.ts` — o arquivo a testar (novo)

*(Infraestrutura de teste existente cobre o resto. Sem necessidade de `conftest.py` — projeto é TypeScript/Vitest.)*

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Não direto | Supabase Auth já ativo |
| V3 Session Management | Não | Supabase JWT |
| V4 Access Control | **SIM — crítico** | RLS UPDATE policy por colab_dono + admin; one-way aprovado via USING clause |
| V5 Input Validation | Sim (inputs numéricos) | `type="number"` + clamp no handler; CHECK constraint no banco |
| V6 Cryptography | Não | — |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Colab B atualiza status de orçamento de Colab A | Elevation of Privilege | RLS UPDATE `USING (colaborador_id = auth.uid() subquery)` |
| Reverter `status='aprovado'` via SQL direto / API REST | Tampering | RLS `USING (status != 'aprovado')` bloqueia server-side |
| Injetar preço negativo via input inline | Tampering | `min="0"` + `Math.max(0, v)` no handler; violação já detectada pelo fluxo ExceptionChat existente |
| Reabrir rascunho de outro colaborador via URL state manipulation | Information Disclosure | Supabase SDK query já filtrada por RLS SELECT (`colaborador_id` via RLS — verificar se há RLS SELECT em orcamentos) |

**Nota sobre RLS SELECT em `orcamentos`:** A policy atual é `"Anyone can read orcamentos" USING (true)`. Isso significa que qualquer usuário autenticado pode ler qualquer orçamento pelo ID. WIZ-03 fetch via `orcamentoId` do location.state não tem proteção de leitura além da autenticação. **Isso é uma questão de segurança pré-existente, não introduzida pela Phase 10.** A D-15 do CONTEXT.md menciona "colab dono + admin podem mudar" para UPDATE — para SELECT não há restrição no escopo desta phase. Registrar como observação mas não bloquear a phase (fora do escopo de Phase 10 per CONTEXT.md).

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | TanStack Query v5 usa `queryKey` com comparação por valor profundo; arrays como chave são estáveis se o conteúdo não mudar | Architecture Patterns — Pattern 6 | Se a comparação for por referência, o cache nunca hit → múltiplos fetches. Mitigação: usar `JSON.stringify(allCodigos)` como chave ou sort fixo |
| A2 | `supabase gen types typescript --project-id jkewlaezvrbuicmncqbj` funciona sem token extra (CLI autenticado via Phase 7) | Standard Stack | Se CLI precisar de login novo, D-26 vai falhar. Mitigação: `supabase login` antes |
| A3 | `colaboradores.user_id` existe e tem DEFAULT `auth.uid()` (confirmado Phase 7 + Phase 9) — subquery na RLS policy vai resolver | Architecture Patterns — Pattern 4 | Se a coluna não existir, a policy não pode ser criada. Verificado via 07-CONTEXT.md D-01 e 09-VERIFICATION.md |
| A4 | `EncerrarNegociacaoModal` grava `"fechado"` (l.46) e isso QUEBRA em prod com a CHECK constraint Phase 7 | Common Pitfalls 6 | Se a migration Phase 7 não foi aplicada, não quebra ainda. Mas 09-VERIFICATION.md confirma que Phase 7 foi aplicada. O bug já existe em prod. |

**Nota sobre A4:** O bug de `EncerrarNegociacaoModal.tsx:46` gravando `"fechado"` é ativo em produção hoje. Phase 7 aplicou a CHECK constraint que bloqueia `"fechado"`. Isso significa que a feature "Encerrar negociação como ganha" está quebrando silenciosamente em prod. O Plan de cleanup (D-27) DEVE incluir o fix deste arquivo como prioridade, não apenas como cleanup cosmético.

---

## Open Questions

1. **RLS SELECT em `orcamentos` — scope da Phase 10?**
   - O que sabemos: Policy atual `USING (true)` — qualquer autenticado lê qualquer orçamento.
   - O que está unclear: D-15 do CONTEXT.md fala apenas de permissões de UPDATE. A restrição de SELECT não está no escopo explicitado.
   - Recomendação: Não implementar RLS SELECT na Phase 10 (fora do escopo locked). Registrar como Technical Debt para Phase futura.

2. **`canEncerrar` e `EncerrarNegociacaoModal` — O modal de "encerrar negociação" ainda faz sentido com o novo dropdown de status?**
   - O que sabemos: O modal chama Supabase UPDATE com `status: "fechado"` (quebrado) e fecha a negociação como "ganha" ou "perdida". O novo dropdown de WIZ-04 vai cobrir `aprovado` e `perdido` diretamente.
   - O que está unclear: Se o modal deve ser mantido (feature duplicada) ou removido.
   - Recomendação: Fix mínimo em D-27 — trocar `"fechado"` por `"aprovado"` e manter o modal por ora. Remoção é refactoring de escopo maior.

3. **Fita LED no input inline: preço é por metro ou por rolo?**
   - O que sabemos: `gruposFita` (linha global de fitas) já tem `precoUnitario` separado dos sistemas. A fita no sistema tem `sis.fita.precoUnitario`. As tabelas mostram a fita com "Subtotal → Global" (price-per-meter, não per-rolo).
   - O que está unclear: Se editar `sis.fita.precoUnitario` no sistema afeta corretamente o `gruposFita` (que é calculado em `calcularRolosPorGrupo` a partir dos sistemas). Provavelmente sim — `calcularRolosPorGrupo` usa `amb.sistemas[].fita.precoUnitario` diretamente.
   - Recomendação: Verificar `calcularRolosPorGrupo` em `src/types/orcamento.ts` antes de implementar o input de preço da fita. O recalc precisa refletir no Resumo Global de Fitas quando o preço é editado.

---

## Sources

### Primary (HIGH confidence)
- `src/components/Step3Revisao.tsx` — flow completo verificado, linhas exatas documentadas
- `src/components/PrecosBatch.tsx` — padrão de input inline na tabela verificado (linhas 309-333)
- `src/pages/Admin.tsx` — estrutura do Pedidos tab verificada (linhas 794-1043)
- `src/pages/Index.tsx` — estado atual do wizard verificado, sem useLocation
- `src/types/orcamento.ts` — `StatusOrcamento` confirmado desatualizado (l.109)
- `src/lib/gerarPdfHtml.ts` — router v1/v2 verificado; v2 despacha para `pdfTemplates/v2.ts`
- `src/lib/pdfTemplates/v2.ts` — pontos de inserção de descrição rica verificados (l.91, l.115, l.140, l.163)
- `src/lib/productAttributes.ts` — confirma `temperatura_k`, `irc`, `nicho` como chaves do JSONB `atributos` (linhas 78-91)
- `supabase/migrations/20260511000003_orcamentos_status_enum.sql` — CHECK constraint verificada
- `supabase/migrations/20260213151338_...sql` — policy atual `USING (true)` verificada
- `.planning/phases/07-schema-prep-v1-1/07-CONTEXT.md` — D-10..D-18 confirmados
- `.planning/phases/09-multi-tenancy-rls/09-VERIFICATION.md` — RLS em arquitetos/clientes confirmada

### Secondary (MEDIUM confidence)
- Grep de `"fechado"` no codebase — 11 ocorrências em 5 arquivos confirmadas

### Tertiary (LOW confidence)
- `[ASSUMED]` TanStack Query v5 queryKey comparison semantics (A1)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — tudo já instalado, verificado no package.json e codebase
- Architecture: HIGH — baseado em análise direta do código existente (não em suposições)
- Pitfalls: HIGH — pitfalls 4-6 verificados diretamente via grep do codebase
- RLS pattern: HIGH — baseado em migrations existentes das Phases 7 e 9

**Research date:** 2026-05-14
**Valid until:** 2026-06-14 (stack estável, sem dependências externas voláteis)
