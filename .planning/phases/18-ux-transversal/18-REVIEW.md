---
phase: 18-ux-transversal
reviewed: 2026-06-12T00:00:00Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - src/types/orcamento.ts
  - src/hooks/useProdutoSearch.ts
  - src/components/ProdutoAutocomplete.tsx
  - src/components/AmbienteCard.tsx
  - src/components/Step2Ambientes.tsx
  - src/components/Step3Revisao.tsx
  - src/types/__tests__/clonagem.test.ts
  - src/types/__tests__/checklistDetectors.test.ts
findings:
  critical: 0
  warning: 3
  info: 4
  total: 7
status: issues_found
---

# Phase 18: Code Review Report

**Reviewed:** 2026-06-12
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Summary

Revisei as mudanças da Phase 18 (UX Transversal): helpers de clonagem (`clonarSistema`/`clonarSistemaParaAmbiente`/`clonarAmbiente`), detectores de checklist (`detectarChecklistIssues`), redirect de busca de luminária, `Tabs` controlado no `AmbienteCard`, duplicar sistema/ambiente, e o painel checklist pré-PDF com gate do botão "Gerar PDF".

Avaliação geral: a implementação está sólida. A regeneração de UUIDs nas árvores de clone é correta e bem testada (todos os níveis recebem `crypto.randomUUID()`, nenhum id do original é reutilizado, conforme `clonagem.test.ts`). As mutações de estado React usam cópia imutável (`splice` em array clonado via `[...arr]`), seguras. O gate do PDF bloqueia corretamente fita 0m (`temErroBloqueante`) e deixa avisos passarem. A compatibilidade aditiva com snapshots antigos é respeitada (campos novos opcionais, fallbacks `?? null` / `?? 3`).

Não encontrei issues críticos. Os achados abaixo são pontos de robustez e consistência, nenhum bloqueante para deploy.

## Warnings

### WR-01: Loop advisory em Step2 itera sobre `ambientes` (pré-limpeza) em vez de `ambientesLimpos` no cálculo de `removidos` quando há sistema inválido pendente

**File:** `src/components/Step2Ambientes.tsx:79-96`
**Issue:** `ambientesLimpos` é construído com `ambientes.map(...)`, mas o callback usa `amb.sistemas.forEach(...)` para **acumular** `sistemasInvalidos` (efeito colateral) ao mesmo tempo que produz o objeto de retorno. Misturar coleta de erros (push em array externo) dentro de um `.map` puro é frágil: se um dia o `.map` for memoizado ou reordenado, o efeito colateral some. Além disso, se `sistemasInvalidos.length > 0` o `return` acontece **antes** de aplicar `onChange(ambientesLimpos)` — ou seja, os sistemas vazios detectados nessa mesma passada não são removidos até o usuário corrigir a metragem e clicar de novo. Comportamento aceitável, mas o acoplamento dos dois propósitos no mesmo loop dificulta manutenção.
**Fix:** Separar em duas passadas explícitas — uma pura para detectar inválidos, outra para filtrar vazios:
```ts
const sistemasInvalidos: string[] = [];
for (const amb of ambientes) {
  amb.sistemas.forEach((sis, idx) => {
    const totalmenteVazio = !sis.fita.codigo && !sis.driver.codigo && !sis.perfil;
    if (totalmenteVazio) return;
    if (sis.fita.codigo && !sis.perfil && (!sis.metragemManual || sis.metragemManual <= 0)) {
      sistemasInvalidos.push(`${amb.nome} — Sistema ${idx + 1}`);
    }
  });
}
const ambientesLimpos = ambientes.map((amb) => ({
  ...amb,
  sistemas: amb.sistemas.filter((sis) => !(!sis.fita.codigo && !sis.driver.codigo && !sis.perfil)),
}));
```

### WR-02: Duplicar sistema/ambiente não revalida o gate de metragem nem dispara o checklist advisory

**File:** `src/components/AmbienteCard.tsx:85-90` e `src/components/Step2Ambientes.tsx:63-68`
**Issue:** `duplicarSistema` clona via `clonarSistema`, que preserva `metragemManual`/`perfil`. Se o sistema original tem fita sem perfil e metragem 0/null (estado de erro), o clone herda o mesmo estado inválido. Isso está coberto pelo gate em `handleNext`/PDF, então não é bug funcional — mas o usuário pode duplicar vários sistemas inválidos sem feedback imediato no Step2 (o checklist `detectarChecklistIssues` só aparece no Step3). É um gap de UX advisory, não de correção. Vale confirmar que era intencional (o checklist é "pré-PDF", então a detecção tardia pode ser by-design).
**Fix:** Se quiser feedback antecipado, pode-se rodar `detectarChecklistIssues([ambiente])` após `duplicarSistema` e mostrar um `toast.warning` quando o clone introduzir erro. Opcional — não bloqueante.

### WR-03: `useProdutoSearch` ignora erro do fallback de redirect silenciosamente e pode interferir com debounce

**File:** `src/hooks/useProdutoSearch.ts:50-60`
**Issue:** O fallback de detecção de tipo (UX-01) faz uma **segunda** query Supabase dentro do mesmo `setTimeout` quando a busca de luminária retorna vazio. Essa query não tem o filtro de erro tratado separadamente (`{ data: fb }` descarta o `error`), então uma falha de rede silenciosamente resulta em `redirect = null` sem distinção de "não achou" vs "falhou". Além disso, ela roda **após** o primeiro `setResults`, adicionando latência serial à digitação de luminárias que não casam. Como o cleanup (`clearTimeout`) só cancela o timer, não a query em andamento, uma resposta tardia ainda pode chamar `setRedirectTipo` após o componente ter mudado de query (race benigna, mas presente). Em produção provavelmente imperceptível, mas é uma chamada de rede extra por keystroke sem resultado.
**Fix:** Considerar (a) guardar um flag `cancelled` no cleanup para ignorar respostas tardias, e (b) só disparar o fallback após o debounce estabilizar. Exemplo do guard:
```ts
useEffect(() => {
  let cancelled = false;
  setRedirectTipo(null);
  const timer = setTimeout(async () => {
    // ...
    if (!cancelled) { setResults(data || []); setRedirectTipo(redirect); }
  }, ...);
  return () => { cancelled = true; clearTimeout(timer); };
}, [query, filtro, filtroVoltagem]);
```

## Info

### IN-01: `subtipo` é selecionado duas vezes na mesma query (alias + bruto)

**File:** `src/hooks/useProdutoSearch.ts:22,25`
**Issue:** O select inclui `driver_tipo:subtipo` (linha 22) e `subtipo` (linha 25) — a mesma coluna `subtipo` mapeada para dois campos de saída (`driver_tipo` e `subtipo`). O PostgREST aceita isso, mas é redundante e pode confundir leitura. O `Produto` define ambos (`driver_tipo?` e `subtipo?`), então funciona; apenas registre que carregam o mesmo valor de origem.
**Fix:** Se ambos os campos são realmente usados como o mesmo dado, manter um só. Se têm semânticas diferentes esperadas, verificar se `subtipo` deveria vir de outra coluna.

### IN-02: `ambienteTemLampada` usa `(l as any).tipo_produto` — campo não existe em `ItemLuminaria`

**File:** `src/types/orcamento.ts:540`
**Issue:** `ambienteTemLampada` checa `(l as any).tipo_produto === 'lampada'`, mas a interface `ItemLuminaria` não tem `tipo_produto` (linhas 23-34). O cast `as any` mascara isso. Em snapshots/clones esse campo nunca estará preenchido, então a detecção depende apenas do regex `/l[âa]mpada/i` na descrição. Funciona, mas o ramo `tipo_produto === 'lampada'` é efetivamente dead code no fluxo atual (a luminária nunca persiste `tipo_produto`).
**Fix:** Ou adicionar `tipo_produto?: string | null` em `ItemLuminaria` e popular no `handleSelectProdutoLuminaria`, ou remover o ramo `as any` e confiar só no regex. Atualmente é tolerado pelo `strict: false`, mas é uma inconsistência de tipo.

### IN-03: `clonarSistema` aplica sufixo "(cópia)" no `local`, mas o sufixo se acumula em clones de clones

**File:** `src/types/orcamento.ts:496-505`
**Issue:** `clonarSistema` faz `local: sis.local ? \`${sis.local} (cópia)\` : '(cópia)'`. Duplicar um sistema já duplicado gera `"Sanca (cópia) (cópia)"`, e assim por diante. Comportamento previsível e provavelmente aceitável (idêntico ao padrão de "Arquivo (cópia) (cópia)" de SOs), apenas registrando. O mesmo vale para `clonarAmbiente` no `nome` (linha 521).
**Fix:** Nenhum necessário se o acúmulo é aceitável. Se quiser evitar, detectar sufixo existente e numerar (`(cópia 2)`) — mas é over-engineering para o caso de uso.

### IN-04: IDs do checklist combinam `amb.id`/`sis.id`/`lum.id` com sufixo fixo — colisão teórica se dois detectores gerassem o mesmo sufixo

**File:** `src/types/orcamento.ts:563-613`
**Issue:** Cada `ChecklistIssue.id` é `\`${amb.id}-${sis.id}-<sufixo>\``. Os sufixos são distintos por tipo (`fita0m`, `semdriver`, `driversemfita`, `perfilsemfita`, `voltagem`, `semlampada`), então não há colisão real dentro de um mesmo sistema. Como `amb.id`/`sis.id` são UUIDs, as keys do React (`key={issue.id}` em Step3Revisao:543) são únicas. Apenas confirmando que está correto — nenhuma ação necessária.
**Fix:** N/A — registro de verificação positiva.

---

_Reviewed: 2026-06-12_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
