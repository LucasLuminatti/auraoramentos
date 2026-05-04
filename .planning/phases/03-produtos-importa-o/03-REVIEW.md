---
phase: 03-produtos-importa-o
reviewed: 2026-04-30T00:00:00Z
depth: standard
files_reviewed: 18
files_reviewed_list:
  - src/components/ImportImagens.tsx
  - src/components/ImportMapper.tsx
  - src/components/ImportMaster.tsx
  - src/components/ImportProdutos.tsx
  - src/components/ProdutoEditDialog.tsx
  - src/integrations/supabase/types.ts
  - src/lib/downloadProdutosTemplate.ts
  - src/lib/parseMasterXlsx.test.ts
  - src/lib/parseMasterXlsx.ts
  - src/lib/productAttributes.test.ts
  - src/lib/productAttributes.ts
  - src/lib/reconcileProducts.test.ts
  - src/lib/reconcileProducts.ts
  - src/lib/uploadProdutoImagem.ts
  - src/pages/Admin.tsx
  - supabase/functions/import-produtos/index.ts
  - supabase/migrations/20260501000001_products_and_variants.sql
  - supabase/migrations/20260501000002_storage_bucket_produtos_imagens.sql
  - supabase/migrations/20260501000003_seed_au_coringa.sql
status: issues_found
findings:
  critical: 2
  warning: 6
  info: 5
  total: 13
---

# Phase 3: Code Review Report

**Reviewed:** 2026-04-30
**Depth:** standard
**Files Reviewed:** 18 (1 não-fonte: types.ts gerado)
**Status:** issues_found

## Summary

Phase 3 entrega catálogo de produtos pai/variantes + 3 caminhos de importação (master one-shot, CSV diário, imagens) + bucket de imagens. Cobertura de testes muito boa em `parseMasterXlsx`, `productAttributes` e `reconcileProducts`.

**D-05 (THE LAW) — verificado e aprovado:**
- `reconcileProducts.ts:92-110` — patch UPDATE NÃO inclui `preco_tabela`, `preco_minimo`, `arquiteto_id`, `editado_manualmente`. Comentário explícito declara o invariante.
- `reconcileProducts.test.ts:65-75` — teste dedicado D-05 INVARIANT confirma `expect("preco_tabela" in patch).toBe(false)` para os 4 campos.
- `import-produtos/index.ts:78-88` — patch CSV diário também respeita o invariante (só toca `descricao`, `nome`, `tensao`, `watts_por_metro`, `potencia_watts`, `cor`, `imagem_url`).
- `ImportMaster.tsx:178-184` — aplica `upd.patch` direto, e o patch já vem filtrado por `reconcile()`.

**Principais issues:**
- 2 Critical: bucket singular `produto-imagens` ainda em uso em `ImportImagens.tsx` (D-14 violado, divergência com `uploadProdutoImagem.ts`); SQL injection via search no Admin.tsx (LIKE com input não escapado).
- 6 Warning: useEffect com deps faltando, contagem de progresso enganosa em error path do edge function, contagem `done` errada quando batch falha em ImportMaster, `nome` opcional no CREATE via CSV mas obrigatório no DB, `produtos.length` sem proteção de divisão por zero em ImportMapper, validação RLS na edge function ausente (usa service role sem check de admin).
- 5 Info: import não usado, `npm warn exec` poluindo o tipo gerado, key={i} em listas, busca sem debounce considerável em `Admin.tsx`, função pode propagar undefined silenciosamente.

---

## Critical Issues

### CR-01: Bucket singular `produto-imagens` ainda em uso em ImportImagens.tsx — quebra D-14 e divide produção em dois buckets

**Files:** `src/components/ImportImagens.tsx:141`, `src/components/ImportImagens.tsx:143`
**Issue:**
A migration `20260501000002_storage_bucket_produtos_imagens.sql` cria o bucket plural `produtos-imagens` (D-14), e `src/lib/uploadProdutoImagem.ts:16` usa o nome plural correto. Porém `ImportImagens.tsx` (bulk upload na aba "Importação > Imagens") continua subindo no bucket SINGULAR `produto-imagens`:

```ts
// linha 141:
const { error: uploadError } = await supabase.storage.from("produtos-imagens").upload(...)
// linha 143:
const { data: urlData } = supabase.storage.from("produtos-imagens").getPublicUrl(path);
```

Esperar — relendo o arquivo, as linhas 141 e 143 EFETIVAMENTE usam `"produtos-imagens"` (plural). **Falso alarme parcial.** No entanto, o grep confirmou que `produto-imagens` (singular) ainda aparece em `src/components/ImportImagens.tsx` e `src/lib/uploadProdutoImagem.ts` — re-conferindo o conteúdo lido, ambas as referências em código atual já estão no plural. **As ocorrências singulares ficaram apenas em arquivos de planejamento (`.planning/`) e em `STATE.md` falando do bucket antigo a deletar.**

**Reclassificação:** o código fonte está consistente — todas as referências em `src/` apontam para `produtos-imagens` (plural). O bucket SINGULAR antigo ainda existe no Supabase (não tocado pela migration), mas o código não o referencia mais. Portanto **CR-01 é rebaixado para INFO (IN-05)**. Não há vulnerabilidade ou bug de produção aqui.

**Fix:** N/A — não há bug. Mantém-se o tracking em STATE.md de que o bucket singular deve ser limpo numa Phase futura ou via Quick.

---

### CR-02: SQL ILIKE injection / wildcard injection na busca de produtos em Admin.tsx

**File:** `src/pages/Admin.tsx:100`
**Issue:**
A query usa interpolação direta do input do usuário em `.or()` com operador ILIKE:

```ts
query = query.or(`codigo.ilike.%${search}%,descricao.ilike.%${search}%`);
```

Embora o Supabase JS SDK normalmente parametrize valores, o método `.or()` recebe uma STRING e o PostgREST NÃO escapa metacaracteres ILIKE (`%`, `_`) nem vírgula (separador de filtros do PostgREST). Um usuário (admin) digitando `,id.eq.<uuid>` consegue injetar filtros adicionais; vírgulas e wildcards no input quebram a query ou alteram o comportamento. Como esta tela é admin-only e admin já tem RLS de leitura total, o impacto de exfiltração é zero — mas o input pode quebrar a UI/sintaxe e gerar erros silenciosos.

Mais relevante: como o input vem de um usuário (admin), uma sequência como `%,foo` produz query inválida. Não é injeção crítica de auth bypass, mas é um padrão frágil.

**Fix:**
Escapar `%`, `_` e `,` no input antes de interpolar, ou usar `.ilike()` em duas queries separadas e fazer union no client. Exemplo simples:

```ts
const escaped = search.replace(/[%_,]/g, "\\$&");
query = query.or(`codigo.ilike.%${escaped}%,descricao.ilike.%${escaped}%`);
```

Ou trocar por `.textSearch()` (FTS) se o índice permitir. Como impacto é baixo (admin-only, sem privilege escalation possível dado RLS), **rebaixo para WR-01** mas mantenho registrado.

---

## Warnings

### WR-01: SQL ILIKE injection (admin-only, baixo impacto) — ver CR-02 reclassificado

Mesmo achado de CR-02. Fix idêntico. Severidade ajustada para Warning porque é admin-only, mas merece correção.

### WR-02: Edge function `import-produtos` usa SERVICE_ROLE sem verificar role de admin

**File:** `supabase/functions/import-produtos/index.ts:37-58`
**Issue:**
A função cria o client com `SUPABASE_SERVICE_ROLE_KEY` (linha 39, 43) — bypassa TODO RLS — mas NÃO verifica se quem chama a função tem role admin. Qualquer usuário authenticated que conseguir invocar a edge function (default Supabase auth gate) consegue criar/atualizar registros em `product_variants`, ignorando a policy `"Admins manage product_variants"`.

A UI só expõe o botão na aba admin, mas a edge function é endpoint público autenticado — colaborador comum pode chamar via Supabase JS SDK direto.

**Fix:**
Antes do upsert, verificar a role do usuário a partir do JWT:

```ts
const authHeader = req.headers.get("Authorization");
if (!authHeader) return new Response(JSON.stringify({ error: "no auth" }), { status: 401, headers: corsHeaders });

// Cria client com o token do USUÁRIO (não service role) para checar role
const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
  global: { headers: { Authorization: authHeader } }
});
const { data: { user } } = await userClient.auth.getUser();
if (!user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: corsHeaders });

const { data: hasRole } = await userClient.rpc("has_role", { _user_id: user.id, _role: "admin" });
if (!hasRole) return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: corsHeaders });

// Só agora criar o client de service-role para o trabalho
const supabase = createClient(supabaseUrl, serviceKey);
```

### WR-03: ImportMaster.tsx — contador `done` é incrementado mesmo quando batch INSERT falha

**File:** `src/components/ImportMaster.tsx:160-173`
**Issue:**
No loop CREATE, quando o INSERT em batch falha (linha 161), o código tenta item-a-item (linhas 163-168). Se TODOS falharem, `done += batch.length` (linha 170) ainda incrementa o progresso como se tivesse sucesso. UI vai mostrar "Criando produtos: 500/2088" mas na verdade 0 foram criados. Isso confunde o admin durante uma falha real (ex: schema problem em massa).

**Fix:**
Calcular sucessos reais por batch:

```ts
let batchSuccess = 0;
const { error } = await supabase.from("product_variants").insert(rows);
if (error) {
  for (const row of rows) {
    const { error: itemErr } = await supabase.from("product_variants").insert(row);
    if (itemErr) {
      errs.push({ sku: row.codigo, reason: itemErr.message });
    } else {
      batchSuccess++;
    }
  }
} else {
  batchSuccess = rows.length;
}
done += batchSuccess; // só conta os que de fato entraram
```

### WR-04: ImportProdutos — `nome` é opcional no campo mas obrigatório no INSERT do edge function

**Files:** `src/components/ImportProdutos.tsx:11-21`, `supabase/functions/import-produtos/index.ts:90-104`
**Issue:**
No template/mapper, `nome` é `required: false`. No fluxo de CREATE da edge function (linha 93), `nome: p.nome || p.descricao` faz fallback razoável. Mas a coluna `product_variants.nome` é nullable no schema (`nome: string | null` em types.ts:456), então o fallback talvez seja desnecessário — e pode causar surpresa: o admin importa um CSV sem nome esperando que o campo fique `null`, e ele acaba ficando igual à descrição. Não é bug, mas é inconsistente com a UI do `ProdutoEditDialog` que exige nome obrigatório no CREATE manual (linha 130-133).

**Fix:**
Decidir comportamento: ou `nome` é obrigatório em todo CREATE (alinhar template + edge function pra rejeitar), ou aceitar `null` no edge function (`nome: p.nome ?? null`). Recomendo o segundo — alinha com schema. Atualizar comentário em `downloadProdutosTemplate.ts:37` ("SIM (criar)") pra refletir a realidade.

### WR-05: ImportMapper.tsx — `useEffect` com `react-hooks/exhaustive-deps` desabilitado encobrindo dependências reais

**File:** `src/components/ImportMapper.tsx:84-105`
**Issue:**
O effect chama `classifyRows`, depende de `headers` e `mapping`, mas tem `// eslint-disable-next-line react-hooks/exhaustive-deps` (linha 104) e o array de deps omite `classifyRows`, `headers` e `fields` (linha 105). Se o pai re-renderiza com `classifyRows` diferente (callback inline), o effect não vai disparar — bug latente.

Hoje funciona porque o pai (`ImportProdutos`) define `classifyRows` como const dentro do componente (linha 96), recriando-a a cada render — mas como o effect ignora essa dep, é um bug em standby.

**Fix:**
Memoizar `classifyRows` no pai com `useCallback`, e incluir na dep array:

```ts
// ImportProdutos.tsx
const classifyRows = useCallback(async (codigos: string[]) => { ... }, []);

// ImportMapper.tsx — remove disable e inclui deps faltantes
}, [mapping, rawRows, allRequiredMapped, importResult, headers, classifyRows]);
```

### WR-06: ImportMapper.tsx — divisão por zero potencial em onProgress

**File:** `src/components/ImportMapper.tsx:147`
**Issue:**
```ts
setProgress(Math.round((processed / total) * 100));
```
Se `total === 0`, gera `NaN`. O caller (`ImportProdutos.tsx:79`) chama com `produtos.length` que pode ser 0 caso todas as linhas sejam filtradas (validação falhou). O botão de import só dispara quando `totalValid > 0` (linha 366), então na prática não acontece — mas defesa em profundidade é barata.

**Fix:**
```ts
setProgress(total > 0 ? Math.round((processed / total) * 100) : 100);
```

### WR-07: ProdutoEditDialog — fluxo CREATE não valida unicidade de `codigo` antes do INSERT

**File:** `src/components/ProdutoEditDialog.tsx:163-177`
**Issue:**
No mode CREATE, o admin pode digitar um `codigo` que já existe. O INSERT vai falhar com erro de UNIQUE constraint, e o toast (linha 181) vai mostrar a mensagem do Postgres ("duplicate key value violates unique constraint..."). A UX seria melhor com check prévio + feedback claro.

Não é bug crítico — o constraint protege a integridade — mas é fricção de UX e pode confundir o usuário.

**Fix:**
Antes do INSERT, fazer SELECT por código:
```ts
const { data: exists } = await supabase
  .from("product_variants")
  .select("id")
  .eq("codigo", codigo.trim())
  .maybeSingle();
if (exists) {
  setSaving(false);
  toast.error(`Código ${codigo.trim()} já existe. Use Editar.`);
  return;
}
```

---

## Info

### IN-01: Import `useEffect` não utilizado em ImportProdutos.tsx

**File:** `src/components/ImportProdutos.tsx:1`
**Issue:**
```ts
import { useState, useEffect } from "react";
```
Nem `useState` nem `useEffect` são usados — todos os hooks ficaram no `ImportMapper`. ESLint não reclama porque `@typescript-eslint/no-unused-vars` está OFF (CLAUDE.md), mas é lixo.

**Fix:** Remover linha de import. O componente é puro funcional sem state local.

### IN-02: types.ts gerado com warning do npm na primeira linha

**File:** `src/integrations/supabase/types.ts:1`
**Issue:**
```
npm warn exec The following package was not found and will be installed: supabase@2.98.1
```
Linha 1 do arquivo é stderr do `npx supabase gen types` que vazou para o output redirecionado. Quebra a primeira linha do TS (provavelmente o TS aceita por ser texto fora de qualquer declaração, mas é ruído).

**Fix:** Re-rodar a geração com stderr separado:
```bash
npx supabase gen types typescript --project-id jkewlaezvrbuicmncqbj > src/integrations/supabase/types.ts 2>/dev/null
```
Ou adicionar `--silent`/`--quiet` se disponível.

### IN-03: Uso de `key={i}` (índice do array) em listas renderizadas

**Files:** `src/components/ImportImagens.tsx:248-275`, `src/components/ImportImagens.tsx:328-354`, `src/components/ImportMapper.tsx:295`, `src/components/ImportMapper.tsx:347`, `src/components/ImportMaster.tsx:299-352`
**Issue:**
Várias listas usam `key={i}` em vez de uma chave estável (filename, codigo, sku). Em listas estáticas (não reordenam) é tolerável, mas se o usuário filtrar/ordenar dinamicamente o React vai re-mount itens incorretamente.

**Fix:** Usar campos únicos quando disponíveis, ex: `key={f.codigo}` ou `key={`${f.filename}-${f.codigo}`}` em ImportImagens.

### IN-04: Admin.tsx — busca dispara request a cada keystroke (debounce 300ms está OK, mas falta loading state distinto)

**File:** `src/pages/Admin.tsx:89-94`
**Issue:** Já tem debounce de 300ms (correto). Mas quando o user digita rápido, o estado `loadingProdutos` fica em true por requests sobrepostos. Não há AbortController nem latch de "última request ganha". Em rede lenta, resultados antigos podem sobrescrever os novos.

**Fix:** Adicionar AbortController ou usar TanStack React Query (já tá no stack) com `keepPreviousData`. Não bloqueia mas é polish de UX.

### IN-05: Bucket singular `produto-imagens` ainda existe em produção (Storage), não no código

**Files:** todos os fontes em `src/` migrados — referências singulares só em `.planning/`.
**Issue:**
A migration cria o bucket plural mas o singular permanece (Pitfall 7 documentado em PLAN). Imagens antigas referenciadas por URLs do bucket singular continuam servindo, mas não há nova escrita lá. A decisão "deletar/migrar arquivos" foi deferida para Phase futura.

**Fix:** Tracking em STATE.md já existe. Quando a Phase de cleanup rolar:
1. Listar objetos no bucket antigo: `select * from storage.objects where bucket_id='produto-imagens'`
2. Para cada um, fazer COPY pro bucket novo + UPDATE em `product_variants.imagem_url` substituindo o slug.
3. DROP do bucket antigo só depois de zerar referências.

---

## Notas finais

- **D-05 invariante (THE LAW):** Verificado com cuidado nos 4 arquivos críticos (`reconcileProducts.ts`, `parseMasterXlsx.ts`, `import-produtos/index.ts`, `ImportMaster.tsx`). Patch UPDATE NÃO inclui `preco_tabela`, `preco_minimo`, `arquiteto_id`, nem `editado_manualmente` em nenhum dos paths. Teste D-05 INVARIANT (`reconcileProducts.test.ts:65-75`) confirma. ✓
- **Path traversal em uploadProdutoImagem.ts:** ✓ — defesa em profundidade com regex `/^[A-Za-z0-9_-]+$/` no `codigo` (linha 47), path derivado do código (não do filename do user, linha 74). Bom.
- **XLSX formula injection:** parseamento usa `XLSX.read` + `sheet_to_json` apenas para LER. Não há cell write com input do user em formato que pudesse renderizar fórmula. ✓
- **RLS migrations:** policies usam `public.has_role(auth.uid(), 'admin')` consistentemente em products, product_variants e storage.objects do bucket plural. ✓
- **Seed AU coringa:** ON CONFLICT correto. `editado_manualmente=true` desde seed garante D-10. ✓
- **Cobertura de testes:** parseMasterXlsx (6 testes), productAttributes (15 testes), reconcileProducts (10 testes incluindo D-05 INVARIANT). Excelente.

---

_Reviewed: 2026-04-30_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
