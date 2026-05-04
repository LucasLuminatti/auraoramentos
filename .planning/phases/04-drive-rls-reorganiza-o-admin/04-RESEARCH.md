# Phase 4: Drive RLS & Reorganização Admin — Research

**Researched:** 2026-04-30
**Domain:** Supabase RLS (tabelas + Storage), schema migration, signed URLs, admin UI reorganização (nested tabs, sub-rotas, inline edit de preços, página de pedido)
**Confidence:** HIGH (todos os achados críticos verificados em código ou migrations físicas do projeto)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Drive RLS — Modelo de Acesso
- **D-01:** Cada colaborador vê apenas seus próprios arquivos e projetos no Drive. Admin vê tudo.
- **D-02:** Tabelas `cliente_arquivos` e `arquivo_pastas` ganham coluna `colaborador_id uuid` (FK → `colaboradores.id`, nullable durante transição, NOT NULL após backfill).
- **D-03:** Policies RLS: SELECT `colaborador_id = auth.uid() OR has_role(auth.uid(), 'admin')`. INSERT `colaborador_id = auth.uid()`. UPDATE/DELETE: dono ou admin.
- **D-04:** Legados → atribuídos ao admin (Lenny) via UPDATE na migration.
- **D-05:** DELETE de colaborador → arquivos reatribuídos ao admin (ON DELETE SET DEFAULT, não cascade).

#### Drive Storage — Privacidade do Bucket
- **D-06:** Bucket `cliente-arquivos` vira privado.
- **D-07:** Acesso via signed URLs 24h.
- **D-08:** URLs públicas antigas vão quebrar — decisão consciente.
- **D-09:** Storage policies: SELECT/INSERT/DELETE por path com prefixo `colaborador_id`.

#### Reorganização Admin (ADM-04)
- **D-10:** 4 grupos com sub-tabs + página "Início": Cadastros (Produtos/Arquitetos/Clientes/Colaboradores), Pedidos, Preços (Atualização batch + Importação), Exceções.
- **D-11:** URL strategy: `?tab=cadastros&sub=produtos` etc.

#### Tela de Atualização de Preços (ADM-02)
- **D-12:** Lista paginada 50/pag com inline edit de `preco_tabela` e `preco_minimo`.
- **D-13:** Filtros: arquiteto, categoria, "sem preço".
- **D-14:** Batch save — um botão "Salvar X alterações".
- **D-15:** Sem bulk ops avançados no v1.
- **D-16:** Edições marcam `editado_manualmente = true`.
- **D-17:** Validação inline: preco_minimo ≤ preco_tabela, bloqueia save se violado.

#### Visualização de Pedido (ADM-01)
- **D-18:** Página `/admin/orcamento/:id` (não modal), URL própria.
- **D-19:** Read-only v1, único botão "Re-emitir PDF".
- **D-20:** Mostra: cliente, arquiteto, colaborador, status, ambientes, totais, histórico de exceções.
- **D-21:** "Voltar" leva para aba Pedidos preservando URL state.

#### Documentação In-App Exceções (ADM-03)
- **D-22:** Bloco de ajuda fixo no topo da aba Exceções.
- **D-23:** Texto inline, não modal.

#### Dashboard (ADM-05)
- **D-24:** Manter 6 KPIs + gráfico Receita Mensal + seletor de período.
- **D-25:** Remover gráfico "Distribuição por Status".
- **D-26:** Dashboard vira página "Início" separada do tab strip.

### Claude's Discretion
- Query param `?tab=X&sub=Y` vs nested route — Claude decide (provavelmente mantém `?tab=` + `&sub=`).
- Estilo visual de `/admin/orcamento/:id` — segue padrão Card + Table.
- Componente de inline edit de preços — novo componente vs reusar ProdutoEditDialog.

### Deferred Ideas (OUT OF SCOPE)
- Bulk ops avançadas em ADM-02 (multiplicar X%, margem mínima).
- Edição inline de pedido em ADM-01.
- Limpeza do bucket `produto-imagens` (singular) da Phase 3.
- Migration de URLs antigas em PDFs já gerados.
- Edge function proxy pro Storage.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ACC-01 | RLS por `colaborador_id` em tabelas do Drive | ALTER TABLE ADD COLUMN + backfill + DROP/CREATE POLICY com has_role |
| ACC-02 | Admin tem policy que lê todos os arquivos | `has_role(auth.uid(), 'admin')` já existe — mesmo padrão das policies de products |
| ACC-03 | UI do Drive filtra por usuário logado | DriveExplorer já filtra por `cliente_id`; após RLS, Supabase filtra automaticamente. Colaborador simplesmente não recebe linhas de outro. |
| ACC-04 | Upload associa automaticamente ao `colaborador_id` do usuário logado | Pegar `colaborador.id` do hook `useColaborador` e incluir no INSERT + path do Storage |
| ADM-01 | Página `/admin/orcamento/:id` read-only com dados completos + Re-emitir PDF | Nova rota no App.tsx, novo componente OrcamentoDetalhe; reusar `gerarPdfHtml` com `PdfParams` |
| ADM-02 | Tela de atualização de preços em batch com inline edit | Novo componente `PrecosInlineEdit`; shadcn Table + Input controlado; Map de pending changes; batch UPDATE |
| ADM-03 | Documentação in-app do fluxo de exceção | Card de texto fixo no topo de AdminExceptions.tsx |
| ADM-04 | Admin reorganizado em 4 grupos + sub-tabs + página Início | Refatorar Admin.tsx com Tabs aninhadas + `?tab=X&sub=Y` via useSearchParams |
| ADM-05 | Dashboard simplificado — remover Distribuição por Status | Editar AdminDashboard.tsx removendo o PieChart; mover para rota `/admin` raiz como página Início |
</phase_requirements>

---

## Summary

Phase 4 é dominada por dois blocos independentes:

**Bloco A (RLS):** As tabelas `cliente_arquivos` e `arquivo_pastas` hoje têm RLS com `USING (true)` — qualquer usuário autenticado vê tudo. A coluna `colaborador_id` simplesmente não existe ainda. O path de upload atual em DriveExplorer.tsx usa `${clienteId}/${timestamp}_${nome}` — sem prefixo de colaborador. Isso gera um problema de migração: para aplicar Storage policies baseadas em path-prefix (`colaborador_id/...`), os objetos existentes no bucket precisam estar nos novos paths. A solução menos arriscada é manter o path atual para uploads existentes e definir a Storage policy de acesso baseada em `colaborador_id` da tabela `cliente_arquivos` (via join ou via tabela auxiliar), não em path-prefix. Alternativamente, o plan pode optar por path-prefix a partir de agora, sem migrar objetos antigos (legados vão para o admin de qualquer forma). **Esta escolha deve ser feita no plan.**

**Bloco B (Admin):** Admin.tsx já usa `useSearchParams` com `?tab=` (verificado em código, linha 36). A adição de `&sub=` é incremental. A reorganização é principalmente JSX — nada de novo no banco. A única nova rota é `/admin/orcamento/:id`.

**Descoberta crítica:** `colaborador_id` em `colaboradores` é o ID da tabela `colaboradores` (UUID da linha), e `user_roles.user_id` é o `auth.uid()`. A RLS policy `colaborador_id = auth.uid()` vai FALHAR porque `colaborador.id != auth.uid()`. A coluna `colaborador_id` nas tabelas do Drive deve guardar o **`colaboradores.user_id`** (= `auth.uid()`) — não o `colaboradores.id`. Isso tem impacto direto na migration e nos INSERTs.

**Recomendação primária:** Implementar em 5 plans — (1) migration RLS tabelas + mapeamento correto user_id, (2) Storage bucket privado + signed URLs, (3) reorganização Admin abas, (4) página de pedido + inline edit preços, (5) dashboard simplificado + documentação exceções.

---

## Standard Stack

### Core
| Biblioteca | Versão | Propósito | Status no Projeto |
|------------|--------|-----------|-------------------|
| Supabase JS SDK | 2.95.3 | RLS, signed URLs, Storage policies | Já instalada |
| React Router DOM | 6.30.1 | Nova rota `/admin/orcamento/:id`, `useSearchParams` | Já instalada |
| shadcn Tabs | (via Radix UI) | Tabs aninhadas Cadastros/Pedidos/Preços/Exceções | Já instalada |
| shadcn Table + Input | (via Radix UI) | Inline edit de preços | Já instalada |
| TanStack React Query | 5.83.0 | Cache de signed URLs | Disponível, raramente usado |

### Nada Novo para Instalar
Toda a Phase 4 roda sobre bibliotecas já presentes. Sem `npm install`.

---

## Architecture Patterns

### Área 1 — Mapeamento Crítico: `colaborador_id` vs `auth.uid()`

**PROBLEMA DESCOBERTO:**

A tabela `colaboradores` tem schema verificado em `types.ts` (linhas 244-278):
```
colaboradores.id           → UUID próprio da linha (NÃO é o auth.uid())
colaboradores.user_id      → FK para auth.users.id (= auth.uid())
```

A RLS policy `colaborador_id = auth.uid()` em `cliente_arquivos` precisa comparar com **`auth.uid()`**. Portanto:

- A coluna nova `colaborador_id` nas tabelas do Drive deve armazenar o valor de `colaboradores.user_id` (= `auth.uid()`), não `colaboradores.id`.
- No INSERT do DriveExplorer, o valor vem de `supabase.auth.getUser().data.user.id` diretamente, ou do `colaborador.user_id` exposto pelo hook `useColaborador`.
- **Alternativa semanticamente mais limpa:** nomear a coluna `user_id` (igual ao padrão de `orcamentos.colaborador_id` que guarda `colaboradores.id`). Mas dado que a RLS precisa comparar com `auth.uid()`, o tipo direto é `user_id uuid REFERENCES auth.users(id)`.

**Impacto no plan:**
```sql
-- Correto:
CREATE POLICY "..." ON cliente_arquivos FOR SELECT TO authenticated
USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'));

-- Errado (confunde dois UUIDs distintos):
-- USING (colaborador_id = auth.uid())
-- se colaborador_id for FK para colaboradores.id
```

A migration deve usar o nome `user_id` para a nova coluna (ou `colaborador_user_id` se quiser ser explícito), e o backfill deve resolver via JOIN:

```sql
-- Backfill: legados → admin
UPDATE cliente_arquivos ca
SET user_id = (
  SELECT c.user_id FROM colaboradores c
  INNER JOIN user_roles ur ON ur.user_id = c.user_id AND ur.role = 'admin'
  LIMIT 1
)
WHERE ca.user_id IS NULL;
```

**Confirmar com Lenny:** Pode haver mais de um admin? Se sim, "o admin" do backfill precisa de critério. Abaixo: `LIMIT 1` ordena por `created_at` — pega o admin mais antigo. Lenny é o único admin hoje, mas o plan deve ser explícito sobre isso. [ASSUMED: único admin em produção hoje]

### Área 2 — Storage Path: Legados vs Novos Uploads

**Estado atual verificado em DriveExplorer.tsx linha 238:**
```typescript
const path = `${clienteId}/${timestamp}_${selectedFile.name}`;
```

O path atual **não tem prefixo de `user_id`/`colaborador_id`**. Isso tem implicações para as Storage policies.

**Duas estratégias possíveis:**

**Estratégia A (path-prefix a partir de agora):**
- Novos uploads: path = `${user.id}/${clienteId}/${timestamp}_${nome}`
- Storage policy SELECT: `(storage.foldername(name))[1] = auth.uid()::text OR has_role(...)`
- Legados: continuam no path `${clienteId}/...` — admin já está no backfill das tabelas, e a policy de tabela cobre o acesso. Mas a Storage policy por path não cobre legados.
- Risco: objetos legados no Storage ficam inacessíveis via policy de path — só acessíveis se policy de tabela e Storage policy forem desacopladas.

**Estratégia B (policy Storage baseada em tabela, não em path):**
- Path permanece `${clienteId}/${timestamp}_${nome}` para todos.
- Storage policy de SELECT: nenhuma (bucket privado serve como proteção de "ninguém lê diretamente sem URL assinada"). A URL assinada é gerada server-side ou pelo SDK autenticado.
- Storage policy de INSERT: `auth.role() = 'authenticated'` (simples — o controle de dono está na tabela RLS).
- Storage policy de DELETE: `auth.role() = 'authenticated'` + validação de dono feita pelo app (já existe em DriveExplorer.tsx linha 294).

**Recomendação da research:** Estratégia B é mais simples e sem risco de objetos legados quebrados. O signed URL (`createSignedUrl`) não requer que o chamador seja dono no Storage — basta que o service_role ou o usuário autenticado com permissão de leitura emita a URL. Para bucket privado, a Supabase Storage valida permissão de leitura no momento da criação da signed URL, não do uso dela. [CITED: docs.supabase.com/docs/guides/storage/serving/downloads]

**Pitfall confirmado:** `getPublicUrl` retorna URL pública e não requer autenticação. Com bucket privado, a URL ainda é gerada mas não funciona para download. Precisa trocar por `createSignedUrl`. [VERIFIED: código atual em DriveExplorer.tsx linha 251 usa `getPublicUrl`]

### Área 3 — `arquivo_pastas` também precisa da coluna

**Verificado em types.ts (linhas 91-137):** `arquivo_pastas` NÃO tem `colaborador_id` / `user_id` ainda. A migration precisa adicionar em AMBAS as tabelas (`cliente_arquivos` e `arquivo_pastas`). O DriveExplorer cria pastas via INSERT sem `colaborador_id` (linha 216-223).

### Área 4 — `has_role` já existe e é estável

**Verificado em `20260218165401_f86d5757.sql`:**
```sql
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
```

A função aceita `app_role` (enum com valores `'admin'` e `'user'`). Uso correto:
```sql
USING (has_role(auth.uid(), 'admin'::app_role))
-- ou simplesmente:
USING (has_role(auth.uid(), 'admin'))
-- Postgres faz cast implícito de text para enum quando único valor correspondente
```

Este pattern está em uso em `products`, `product_variants` e `produtos-imagens`. [VERIFIED: migrations 20260501000001 e 20260501000002]

### Área 5 — Signed URLs: Implementação

**Pattern correto Supabase SDK 2.x:**
```typescript
const { data, error } = await supabase.storage
  .from('cliente-arquivos')
  .createSignedUrl(arquivo.arquivo_path, 86400); // 24h

if (error || !data?.signedUrl) {
  toast.error('Erro ao gerar link de acesso');
  return;
}
window.open(data.signedUrl, '_blank');
```

**Alternativa para listing (N arquivos):**
```typescript
const { data, error } = await supabase.storage
  .from('cliente-arquivos')
  .createSignedUrls(paths, 86400); // aceita array de paths
// Retorna { data: [{ path, signedUrl, error }] }
```

`createSignedUrls` (plural) é a forma batch — evita N round-trips para listar 20+ arquivos. [CITED: supabase.com/docs/reference/javascript/storage-from-createsignedurls]

**Onde trocar no código:**
- DriveExplorer.tsx linha 251: `getPublicUrl` → `createSignedUrl` no momento do download (clique no arquivo), não no listing.
- O `arquivo_url` salvo no DB era URL pública — deixar como está para compatibilidade de snapshot, mas não usar para exibição. A URL é regenerada sob demanda no clique.

**Edge case — download em curso:** Signed URLs são URLs HTTP normais. Uma vez gerada e o download iniciado, o expirar da URL não cancela o download ativo. Seguro para arquivos normais.

**Performance — listing com muitos arquivos:** `createSignedUrls` batch resolve o problema de N round-trips. Recomendado para o listing. Mas dado que DriveExplorer só mostra arquivos de um cliente/projeto por vez, o volume raramente passa de 20-30 itens. Aceitável gerar URLs on-demand no clique, como no Notion/Drive.

### Área 6 — Admin.tsx: Estado Atual das Abas

**Verificado em Admin.tsx linhas 28-37:**
```typescript
const VALID_TABS = ["dashboard", "excecoes", "importacao", "produtos",
                    "colaboradores", "orcamentos", "clientes", "arquitetos"];
// activeTab derivado de searchParams.get("tab")
```

A tab `"dashboard"` já existe como default. A adição de `?sub=` é direta com `useSearchParams`. O estado de sub-tab precisa ser sincronizado com a URL também, ou só o tab externo persiste.

**Mapeamento atual → Phase 4:**
```
dashboard      → vira rota /admin (página Início separada, ou TabsContent permanece)
excecoes       → grupo "Exceções" (sem sub-tab, mantém AdminExceptions)
importacao     → sub-tab de "Preços" → Importação (ImportMaster/Produtos/Imagens)
produtos       → sub-tab de "Cadastros" → Produtos
colaboradores  → sub-tab de "Cadastros" → Colaboradores
orcamentos     → grupo "Pedidos" (sem sub-tab — lista + link pra /admin/orcamento/:id)
clientes       → sub-tab de "Cadastros" → Clientes
arquitetos     → sub-tab de "Cadastros" → Arquitetos
[NOVO]         → sub-tab de "Preços" → Atualização batch (ADM-02)
[NOVO]         → grupo "Início" = AdminDashboard simplificado (D-26)
```

**URL strategy recomendada (Claude's Discretion):** Manter `?tab=X` para o grupo externo e adicionar `&sub=Y` para sub-tab. Implementar com dois `useSearchParams`:
```typescript
const tabParam = searchParams.get("tab") ?? "inicio";
const subParam = searchParams.get("sub") ?? defaultSubForTab(tabParam);

const setTab = (t: string) => setSearchParams({ tab: t, sub: defaultSubForTab(t) }, { replace: true });
const setSub = (s: string) => setSearchParams({ tab: tabParam, sub: s }, { replace: true });
```

Isso preserva compatibilidade com qualquer link `?tab=orcamentos` existente.

**Backward compat:** Tabs antigas como `?tab=produtos` podem ser redirecionadas para `?tab=cadastros&sub=produtos` no useEffect de normalização. Mas dado que Admin só admins acessam e não há links externos para tabs específicas, pode-se simplesmente deixar as antigas tabs caírem no default sem redirect.

### Área 7 — Página /admin/orcamento/:id (ADM-01)

**Nova rota no App.tsx:**
```tsx
<Route path="/admin/orcamento/:id" element={<AdminRoute><OrcamentoDetalhe /></AdminRoute>} />
```

**Fetch necessário (todos os dados disponíveis no schema atual):**
```typescript
supabase
  .from('orcamentos')
  .select(`
    *,
    clientes ( nome, email, telefone, arquiteto_id,
      arquitetos ( nome, contato ) ),
    colaboradores ( nome ),
    projetos ( nome )
  `)
  .eq('id', id)
  .single()
```

**Snapshot `ambientes`:** A coluna `orcamentos.ambientes` é `Json` (verificado em types.ts linha 317). É o snapshot completo — mesma estrutura que `gerarPdfHtml` consome. O componente `OrcamentoDetalhe` pode parsear e exibir sem recalcular preços.

**Re-emitir PDF:** `gerarPdfHtml` aceita `PdfParams` (verificado em gerarPdfHtml.ts linha 15-22):
```typescript
interface PdfParams {
  clienteNome: string;
  projetoNome: string;
  colaborador: string;
  tipo: string;
  ambientes: Ambiente[];
  logoBase64?: string;
}
```

Para Re-emitir: montar `PdfParams` a partir do orcamento carregado + `ambientes` do snapshot. Funciona sem refetch de produtos (dados estão no snapshot).

**Histórico de exceções:** `price_exceptions` tem `orcamento_id` (verificado em types.ts linha 389). Query simples:
```typescript
supabase.from('price_exceptions')
  .select('*')
  .eq('orcamento_id', id)
  .order('created_at', { ascending: true })
```

### Área 8 — Inline Edit de Preços (ADM-02)

**Pattern recomendado:** Novo componente `PrecosInlineEdit` — NÃO reusar `ProdutoEditDialog`. O dialog é modal por linha; o ADM-02 precisa de edição inline em tabela plana (múltiplas linhas simultâneas). São UX patterns diferentes.

**Estado de "pending changes":**
```typescript
const [pendingChanges, setPendingChanges] = useState<Map<string, { preco_tabela: number; preco_minimo: number }>>(new Map());

const handleChange = (id: string, field: 'preco_tabela' | 'preco_minimo', value: string) => {
  const num = parseFloat(value);
  if (isNaN(num)) return;
  setPendingChanges(prev => {
    const next = new Map(prev);
    const existing = next.get(id) ?? { preco_tabela: ..., preco_minimo: ... };
    next.set(id, { ...existing, [field]: num });
    return next;
  });
};
```

**Batch save:**
```typescript
const handleSave = async () => {
  // Validação inline primeiro
  for (const [id, changes] of pendingChanges) {
    if (changes.preco_minimo > changes.preco_tabela) {
      toast.error('Preço mínimo não pode ser maior que preço tabela');
      return;
    }
  }
  // Batch: sem `.bulk()` nativo no Supabase — fazer N updates em Promise.all
  const updates = [...pendingChanges.entries()].map(([id, changes]) =>
    supabase.from('product_variants').update({
      ...changes,
      editado_manualmente: true,   // D-16
    }).eq('id', id)
  );
  await Promise.all(updates);
  setPendingChanges(new Map());
  toast.success(`${pendingChanges.size} produtos atualizados`);
};
```

**Aviso:** Supabase não tem `bulk UPDATE` nativo. `Promise.all` de N updates funciona mas não é atômico. Para ~50 linhas por página isso é aceitável. [VERIFIED: Supabase JS SDK v2 docs — sem bulk update nativo]

**Highlight de linha alterada:** Adicionar classe condicional `bg-yellow-50` na `<TableRow>` se `pendingChanges.has(produto.id)`.

**Paginação:** Usar offset/limit com `supabase.from().range(offset, offset+49)`.

### Área 9 — AdminDashboard Simplificado (ADM-05)

**O que remover (verificado em AdminDashboard.tsx):**
- Linhas 242-259: Card "Distribuição por Status" com `<PieChart>` (statusData). Remover o Card inteiro.
- Pode-se remover também as linhas 152-163 (cálculo de `statusData`) e os imports `PieChart`, `Pie`, `Cell` do recharts se não usados em mais nada.

**O que manter:** 6 KPI cards (linhas 180-187), Receita Mensal BarChart, Motivos de Perda, Top 5 Clientes, seletor de período.

**Tornar página "Início":** O `AdminDashboard` é um componente que já recebe `orcamentos` como prop. A opção mais simples é mantê-lo dentro de um `<TabsContent value="inicio">` como primeira tab (não como rota separada `/admin/inicio`). Rota separada adiciona complexidade sem benefício claro dado que o admin já é `/admin`. Claude pode decidir usar `TabsContent value="inicio"` como tab default.

---

## Don't Hand-Roll

| Problema | Não Construir | Usar | Motivo |
|----------|---------------|------|--------|
| Signed URL Storage | lógica própria de proxy | `supabase.storage.createSignedUrl()` + `createSignedUrls()` | SDK já lida com expiração, auth, região |
| Bulk update | SQL raw ou edge function | `Promise.all` de N updates SDK | Simples para 50 linhas, sem overhead |
| Check de admin na policy | código TypeScript | `has_role(auth.uid(), 'admin')` na policy SQL | Já existente, SECURITY DEFINER, testado |
| Caching de signed URL | localStorage manual | TanStack Query com `staleTime: 23*60*60*1000` | Evita refetch antes de expirar |

---

## Common Pitfalls

### Pitfall 1: Confundir `colaboradores.id` com `auth.uid()`
**O que quebra:** RLS policy `colaborador_id = auth.uid()` onde `colaborador_id` é FK para `colaboradores.id` (UUID da linha de colaborador) vai falhar silenciosamente — nenhuma linha passa no filtro, usuário vê tela vazia sem erro.
**Prevenção:** A nova coluna deve armazenar `auth.uid()` diretamente. Nomear `user_id uuid REFERENCES auth.users(id)`. No INSERT, usar `supabase.auth.getUser()` ou `user.id` do contexto de auth — não `colaborador.id` do hook `useColaborador`.
**Verificar:** Consultar `select * from colaboradores where user_id = auth.uid()` no SQL editor confirma o mapping.

### Pitfall 2: `getPublicUrl` retorna URL mesmo com bucket privado
**O que quebra:** URL é gerada, parece válida, mas retorna 400 no download. Difícil debugar porque não há erro no SDK na geração.
**Prevenção:** Trocar todos os usos de `getPublicUrl` no `cliente-arquivos` por `createSignedUrl`. Há 1 ocorrência em DriveExplorer.tsx linha 251.
**Armadilha extra:** `arquivo_url` já salvo no banco tem URLs públicas antigas. Não podem ser usadas pós-privacidade. O campo deve ser tratado como "path de referência" apenas — a URL real é gerada sob demanda.

### Pitfall 3: Storage policy por path-prefix quebra objetos legados
**O que quebra:** Se policy for `(storage.foldername(name))[1] = auth.uid()::text`, objetos com path `${clienteId}/...` (sem prefixo de user) ficam inacessíveis mesmo para o admin que deveria vê-los.
**Prevenção:** Usar Estratégia B (policy de tabela controla acesso, Storage policy simples de autenticação geral). Ou migrar todos os objetos existentes para o novo path — mais complexo e arriscado em produção.

### Pitfall 4: `?tab=&sub=` sem validação causa tab vazia
**O que quebra:** URL inválida como `?tab=foo&sub=bar` não match nenhuma TabsContent — UI renderiza vazia sem erro visível.
**Prevenção:** Adicionar array `VALID_TABS` e `VALID_SUBS_BY_TAB` como o Admin.tsx já faz para tabs (linha 28). Fallback para tab/sub default se inválido.

### Pitfall 5: `Promise.all` de updates não é atômico
**O que quebra:** Se 3 de 10 updates falharem, os outros 7 já foram aplicados. Estado parcial no banco.
**Prevenção:** Aceitar como tradeoff (explicitado em D-14 que é batch save, não transação). Toast de erro deve indicar quantos falharam. Alternativa avançada (edge function + transação) está fora do escopo D-15.

### Pitfall 6: Backfill de legados sem admin cadastrado na `colaboradores`
**O que quebra:** Se o admin não tem linha na tabela `colaboradores`, o JOIN para descobrir o `user_id` do admin no backfill retorna NULL — todos os legados ficam com `user_id = NULL`, violando o NOT NULL após backfill.
**Prevenção:** O admin (Lenny) tem colaborador criado (verificado: `create-colaborador` edge function cria na primeira sessão). Mas a migration deve ter assert antes do NOT NULL. Verificar via `SELECT COUNT(*) FROM colaboradores c INNER JOIN user_roles ur ON ur.user_id = c.user_id AND ur.role = 'admin'` > 0.

### Pitfall 7: `arquivo_url` no banco fica "podre" após privacidade do bucket
**O que quebra:** Qualquer código que ler `arquivo_url` diretamente (ex: dentro de snapshot de orçamento, ou referência em PDF antigo) vai receber URL que retorna 400.
**Prevenção:** `DriveExplorer` deve gerar signed URL no momento do download, não ao exibir a lista. A coluna `arquivo_url` na tabela deve ser documentada como "legado — não usar pós-Phase4". Novos uploads podem salvar `arquivo_path` e gerar URL on-demand. [Decision D-08 já aceita URLs antigas quebrando]

### Pitfall 8: `orcamentos.ambientes` é Json não tipado
**O que quebra:** `JSON.parse(orcamento.ambientes)` pode retornar estrutura com campos faltando em snapshots antigos — componente OrcamentoDetalhe quebraria ao acessar campos opcionais.
**Prevenção:** Usar optional chaining (`ambiente?.luminarias ?? []`) e defaults em todos os acessos. Mesmo pattern que o PDF generator já usa (gerarPdfHtml.ts usa fallback implícito).

---

## Runtime State Inventory

> Esta phase modifica o bucket `cliente-arquivos` de público para privado. Itens de estado em runtime a verificar:

| Categoria | Itens Encontrados | Ação Necessária |
|-----------|------------------|-----------------|
| Stored data (tabelas) | `cliente_arquivos`: sem coluna `user_id` — 0 a N linhas existentes. `arquivo_pastas`: sem coluna `user_id` — 0 a N linhas existentes. | Migration aditiva + backfill → NOT NULL |
| Objetos no Storage | Bucket `cliente-arquivos` com objetos em path `${clienteId}/${timestamp}_nome`. Nenhum prefixo de user_id. | Sem migração de path (Estratégia B). Bucket muda de `public: true` para `public: false` via UPDATE |
| `arquivo_url` em `cliente_arquivos` | URLs públicas do tipo `https://...supabase.co/storage/v1/object/public/cliente-arquivos/...` | Ficam "podres" após privacidade. Não migrar — accesso via `arquivo_path` + `createSignedUrl` on-demand |
| Snapshots em `orcamentos.ambientes` | Se houver links de arquivo do Drive embutidos em snapshots (não encontrado no código atual — gerarPdfHtml.ts não referencia Drive) | Nenhuma ação — não referenciado |
| Live service config | Nenhum serviço externo (Resend, n8n) usa URLs do bucket `cliente-arquivos` | Nenhuma |
| OS-registered state | Nenhum | Nenhuma |
| Secrets/env vars | Sem variáveis relacionadas ao Drive | Nenhuma |
| Build artifacts | Nenhum | Nenhuma |

---

## Code Examples

### RLS Policy correta para `cliente_arquivos`
```sql
-- [VERIFIED: padrão de has_role já em uso em products/product_variants]
ALTER TABLE public.cliente_arquivos DROP POLICY IF EXISTS "Authenticated users can read cliente_arquivos";
ALTER TABLE public.cliente_arquivos DROP POLICY IF EXISTS "Authenticated users can insert cliente_arquivos";
ALTER TABLE public.cliente_arquivos DROP POLICY IF EXISTS "Authenticated users can delete cliente_arquivos";

CREATE POLICY "Colabs read own, admins read all"
  ON public.cliente_arquivos FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Colabs insert own"
  ON public.cliente_arquivos FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Colabs delete own, admins delete all"
  ON public.cliente_arquivos FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
```

### Tornar bucket privado via migration
```sql
UPDATE storage.buckets SET public = false WHERE id = 'cliente-arquivos';
```

### Storage policies simples (Estratégia B — sem path-prefix)
```sql
DROP POLICY IF EXISTS "Public can read cliente-arquivos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload cliente-arquivos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete cliente-arquivos" ON storage.objects;

-- Leitura via signed URL (privado = sem select policy pública)
-- Insert: qualquer autenticado pode fazer upload (controle de dono está na tabela RLS)
CREATE POLICY "Authenticated upload cliente-arquivos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'cliente-arquivos');

-- Delete: dono ou admin (via path matching não disponível facilmente — delegar ao app)
CREATE POLICY "Authenticated delete cliente-arquivos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'cliente-arquivos');
```

### Signed URL on-demand no DriveExplorer
```typescript
// Substituir o <a href={arq.arquivo_url}> por botão com handler:
const handleDownload = async (arq: Arquivo) => {
  const { data, error } = await supabase.storage
    .from('cliente-arquivos')
    .createSignedUrl(arq.arquivo_path, 86400);
  if (error || !data?.signedUrl) {
    toast.error('Erro ao gerar link de download');
    return;
  }
  window.open(data.signedUrl, '_blank');
};
```

### INSERT com user_id no DriveExplorer (upload)
```typescript
// handleUpload: adicionar user_id no insert da tabela
const { data: { user } } = await supabase.auth.getUser();

const { error: insertError } = await supabase.from('cliente_arquivos').insert({
  cliente_id: clienteId,
  projeto_id: projetoId || null,
  pasta_id: pastaId || null,
  nome: selectedFile.name,
  descricao: uploadDescricao.trim() || null,
  categoria: uploadCategoria,
  arquivo_path: path,
  arquivo_url: urlData.publicUrl, // mantém para compat, mas não usar para acesso
  tamanho: selectedFile.size,
  user_id: user!.id,  // <-- NOVO
});
```

### Nova rota em App.tsx
```tsx
import OrcamentoDetalhe from './pages/OrcamentoDetalhe';

// Dentro de <Routes>:
<Route path="/admin/orcamento/:id" element={<AdminRoute><OrcamentoDetalhe /></AdminRoute>} />
```

### Fetch completo para OrcamentoDetalhe
```typescript
const { id } = useParams<{ id: string }>();

const { data: orc } = useQuery({
  queryKey: ['orcamento-detalhe', id],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('orcamentos')
      .select(`
        *,
        clientes ( nome, email, telefone,
          arquitetos ( nome ) ),
        colaboradores ( nome ),
        projetos ( nome )
      `)
      .eq('id', id!)
      .single();
    if (error) throw error;
    return data;
  },
  enabled: !!id,
});
```

---

## State of the Art

| Abordagem Antiga | Abordagem Phase 4 | Motivo |
|------------------|-------------------|--------|
| `getPublicUrl` — URL permanente | `createSignedUrl(path, 86400)` — URL temporária 24h | Bucket privado, acesso controlado |
| Bucket `public: true` | Bucket `public: false` | Isolamento por colaborador |
| RLS `USING (true)` em cliente_arquivos/arquivo_pastas | RLS `user_id = auth.uid() OR has_role(...)` | Controle real por colaborador |
| 8 tabs flat em Admin.tsx | 4 grupos (Cadastros/Pedidos/Preços/Exceções) + Início | Organização cresceu além de 5 tabs |
| Edição de preço via modal individual | Inline edit em tabela paginada com batch save | Eficiência operacional — atualizar 50 preços de uma vez |

---

## Assumptions Log

| # | Claim | Seção | Risco se Errado |
|---|-------|-------|-----------------|
| A1 | Lenny é o único admin em produção hoje | Área 1 — backfill de legados | Se há múltiplos admins, `LIMIT 1` no backfill pode atribuir ao admin errado. Mitigação: `ORDER BY created_at ASC LIMIT 1` pega o admin mais antigo. |
| A2 | Nenhuma URL de arquivo do Drive está embutida em snapshots de orçamentos | Runtime State Inventory | Se existir, o link quebra em PDF já gerado. Aceito via D-08. |
| A3 | Volume de arquivos por cliente/projeto é < 100 (geração de signed URLs on-demand no clique é aceitável) | Área 5 | Se volume for > 100, usar `createSignedUrls` batch no listing. |

---

## Open Questions

1. **Nome da nova coluna: `user_id` ou `colaborador_id`?**
   - O que sabemos: semanticamente, o campo guarda `auth.uid()` (= `colaboradores.user_id`), não `colaboradores.id`.
   - O que está nebuloso: D-02 do CONTEXT chama de `colaborador_id` (referenciando `colaboradores.id` como FK). Mas para a RLS funcionar com `auth.uid()`, a FK precisa apontar para `auth.users.id`.
   - Recomendação: Usar `user_id uuid REFERENCES auth.users(id)` e documentar claramente no COMMENT da coluna. Alternativamente, aceitar `colaborador_id uuid REFERENCES colaboradores(id)` e modificar a RLS para usar subquery: `EXISTS (SELECT 1 FROM colaboradores c WHERE c.id = colaborador_id AND c.user_id = auth.uid())`. Esta última é mais semântica mas levemente mais custosa.

2. **Estratégia de Storage policy (A vs B)?**
   - Recomendação da research: Estratégia B (policy simples + controle de acesso via tabela RLS). Planner deve confirmar e documentar no plan.

3. **Dashboard como TabsContent `inicio` vs rota `/admin/inicio`?**
   - D-26 diz "página Início separada do tab strip". Mas dado que as 4 abas ficam abaixo do Início, pode ser TabsContent default ou rota própria.
   - Recomendação: TabsContent `value="inicio"` como default — zero nova rota, comportamento esperado com `?tab=inicio`.

---

## Environment Availability

Step 2.6: SKIPPED — phase é puramente code/config/SQL, sem dependências externas além das já instaladas (Supabase, React, shadcn-ui).

---

## Validation Architecture

> `workflow.nyquist_validation` ausente em config.json — tratado como habilitado.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.2.4 |
| Config file | `vitest.config.ts` |
| Quick run command | `npm run test` |
| Full suite command | `npm run test` |

### Phase Requirements → Test Map

| Req ID | Comportamento | Tipo de Teste | Automatizável |
|--------|--------------|---------------|--------------|
| ACC-01 | RLS bloqueia SELECT de outro colaborador | Integration (Supabase RLS) | Manual-only — RLS testável apenas com Supabase real ou pg local |
| ACC-02 | Admin vê todos os arquivos | Integration (Supabase RLS) | Manual-only |
| ACC-03 | UI não mostra arquivos de outro colab | Component test — mock Supabase retornando [] | `npm run test` |
| ACC-04 | Upload seta user_id correto no INSERT | Unit — mock supabase.from().insert() | `npm run test` |
| ADM-01 | OrcamentoDetalhe renderiza sem crash com snapshot antigo | Component test | `npm run test` |
| ADM-02 | Validação preco_minimo > preco_tabela bloqueia save | Unit — testar função de validação | `npm run test` |
| ADM-03 | Bloco de ajuda renderiza | Component test trivial | `npm run test` |
| ADM-04 | Tab URL state funciona corretamente | Component test com MemoryRouter | `npm run test` |
| ADM-05 | AdminDashboard sem PieChart não quebra | Component test | `npm run test` |

### Wave 0 Gaps
- Nenhum arquivo de teste novo é estritamente necessário para funcionalidade básica (a maior parte das verificações é via RLS — não testável em Vitest sem Supabase local).
- Recomendado criar `src/components/__tests__/PrecosInlineEdit.test.tsx` para testar a lógica de validação `preco_minimo ≤ preco_tabela` — único business logic novo com risco real.

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Aplica | Controle Padrão |
|---------------|--------|-----------------|
| V2 Authentication | Não (auth existente) | — |
| V3 Session Management | Não | — |
| V4 Access Control | **Sim** — Core desta phase | RLS Supabase + has_role |
| V5 Input Validation | Sim (precos inline edit) | Validação client-side: preco_min ≤ preco_tabela; parseFloat + isNaN check |
| V6 Cryptography | Não | — |
| Storage Access Control | **Sim** | Bucket privado + signed URLs 24h |

### Known Threat Patterns

| Pattern | STRIDE | Mitigação Padrão |
|---------|--------|-----------------|
| Colaborador lê arquivos de outro colaborador | Information Disclosure | RLS `user_id = auth.uid()` na tabela + bucket privado |
| Upload de arquivo sem user_id (legado) | Elevation of Privilege | Backfill na migration + NOT NULL após backfill |
| URL pública persistida em PDF permite acesso pós-privacidade | Information Disclosure | D-08 — aceito conscientemente. Arquivos legados no Storage ainda acessíveis pelo path mas sem URL pública (bucket privado). Risco residual: baixo (acesso requer conhecer URL hardcoded) |
| Admin edita preços sem marcação de `editado_manualmente` | Tampering | D-16 — todo save via ADM-02 seta `editado_manualmente = true` |
| Batch save parcialmente falho deixa estado inconsistente | Tampering | Aceito como tradeoff (D-15). Toast deve indicar falhas. |

---

## Sources

### Primary (HIGH confidence — verificado em código do projeto)
- `src/components/DriveExplorer.tsx` — lógica atual de path (`${clienteId}/${timestamp}_nome`), `getPublicUrl`, INSERT sem `colaborador_id`
- `src/integrations/supabase/types.ts` — schema completo de `cliente_arquivos`, `arquivo_pastas`, `colaboradores`, `orcamentos`
- `src/hooks/useColaborador.ts` — confirma `colaboradores.user_id` como FK para `auth.users.id`
- `src/pages/Admin.tsx` — 8 tabs atuais, `useSearchParams` já em uso, `importSubTab` local state
- `src/components/AdminDashboard.tsx` — PieChart "Distribuição por Status" identificado nas linhas 242-259
- `src/components/AdminExceptions.tsx` — ponto de inserção do bloco de ajuda (ADM-03)
- `src/lib/gerarPdfHtml.ts` — interface `PdfParams`, confirma que aceita `ambientes: Ambiente[]` do snapshot
- `supabase/migrations/20260218165401_f86d5757.sql` — definição de `has_role()` e enum `app_role`
- `supabase/migrations/20260302192445_503d0a52.sql` — bucket criado com `public: true`, policies abertas
- `supabase/migrations/20260501000001_products_and_variants.sql` — padrão de migration aditiva com backfill + NOT NULL
- `supabase/migrations/20260501000002_storage_bucket_produtos_imagens.sql` — padrão de Storage policy com `has_role`
- `src/App.tsx` — rotas existentes, padrão `AdminRoute`, onde adicionar `/admin/orcamento/:id`

### Secondary (MEDIUM confidence — docs Supabase)
- `createSignedUrl` / `createSignedUrls` batch — Supabase JS v2 Storage API [CITED: supabase.com/docs/reference/javascript/storage-from-createsignedurls]
- Signed URL behavior (expiração não cancela download ativo) — comportamento HTTP padrão [CITED: docs.supabase.com/docs/guides/storage/serving/downloads]

---

## Metadata

**Confidence breakdown:**
- Schema migration: HIGH — verificado no código real (types.ts + migration existente como template)
- RLS patterns: HIGH — has_role e padrão já em uso em 3+ migrations
- Storage signed URLs: HIGH — SDK verificado, padrão documentado
- Admin reorganização: HIGH — Admin.tsx lido integralmente, mapeamento claro
- Inline edit preços: HIGH — pattern Map de pending changes é standard React, sem dependência nova
- OrcamentoDetalhe: HIGH — schema `orcamentos` verificado, `PdfParams` verificado

**Research date:** 2026-04-30
**Valid until:** 2026-06-30 (stack estável, sem mudanças planejadas no Supabase SDK)
