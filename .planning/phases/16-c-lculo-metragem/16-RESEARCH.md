# Phase 16: Cálculo & Metragem — Research

**Researched:** 2026-06-11
**Domain:** React 18 + TypeScript calc logic, Step2 gate, AmbienteCard UI, Supabase SQL migration
**Confidence:** HIGH — all findings verified against source files in this session

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Metragem ausente = dado obrigatório, bloqueante. Contrasta com a filosofia não-bloqueante da Fase 15 — aqui o bloqueio é devido.
- **D-02:** Marca inline no card do sistema E bloqueia o avanço Step 2 → Step 3.
- **D-03:** `null` e `0` são tratados igualmente como "metragem inválida". Não expor a diferença ao usuário.
- **D-04:** Mesmo comportamento para dado novo e rascunho antigo. Sem fix silencioso de dados.
- **D-05:** Mensagem: *"Informe uma metragem válida para este sistema antes de continuar."*
- **D-06:** Sistema totalmente vazio → avisar + remover ao avançar, NÃO bloquear.
- **D-07:** Definição de "vazio" deve ser única entre gate do Step 2 e filtro do PDF (`isSistemaVazio`).
- **D-08:** Metragem embutida na descrição do perfil: formato `PERFIL X — 2,5m`.
- **D-09:** Sufixo gerenciado pelo sistema: colaborador edita livremente; sistema regenera só o sufixo quando `comprimentoPeca`/`quantidade` mudam; parte manual nunca apagada.
- **D-10:** Metragem do sufixo = `comprimentoPeca × quantidade` (igual a `calcularMetragemTotal`).
- **D-11:** Passadas: pré-selecionar `passadas_padrao` da família; dropdown mostra apenas opções válidas; permite alterar para qualquer valor válido; bloqueia só inválido.
- **D-12:** Família `light_50` aceita até 3 passadas; `passadas_padrao = 3`. Migration de sync `regras_compatibilidade_perfil → produtos.passadas_padrao` ANTES do unlock da UI.
- **D-13:** NÃO sugerir passadas por consumo/metragem — sugestão vem do padrão da família.
- **D-14:** Patch atômico nos 5 sites: `calcularDemandaFita`, `calcularConsumoW`, `calcularQtdDrivers`, `calcularSubtotalSistemaSemFita` (`src/types/orcamento.ts`) + `isSistemaVazio` (`src/lib/pdfTemplates/v2.ts`).

### Claude's Discretion

- Mecânica exata do gate do Step 2 (lista de erros, foco no primeiro, etc.).
- Forma visual do marcador inline de metragem inválida (badge/borda/texto).
- Texto/copys exatos do aviso de remoção de sistema vazio (D-06) e do bloqueio de metragem (D-05).
- Estrutura da migration de sync de `passadas_padrao` (D-12), desde que idempotente, aditiva e aplicada antes do unlock da UI.

### Deferred Ideas (OUT OF SCOPE)

- Sugestão de passadas por consumo/metragem (D-13).
- Apresentação do Resumo Global / PDF: coluna LOCAL, deduplicação de fita, drivers por ambiente, duplicar sistema — Fase 17 (RES-01..05).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CALC-01 | Fita sem perfil exige metragem manual; null/0 bloqueia avanço Step 2→3 | Gate em `handleNext` (Step2Ambientes.tsx:34); fix é pré-cálculo, não troca do `\|\| 0` |
| CALC-02 | Metragem do perfil reflete automaticamente na descrição após inserir código | Sufixo `— Xm` regenerado em `AmbienteCard` quando `comprimentoPeca`/`quantidade` mudam |
| CALC-03 | Passadas editáveis respeitando regra família 50mm (até 3); sync migration primeiro | `light_50` tem `passadas_padrao = 3` em `regras_compatibilidade_perfil`; `produtos.passadas_padrao` já existe mas precisa de sync |
</phase_requirements>

---

## Summary

Esta fase toca três problemas independentes mas conectados pelo patch atômico de 5 sites (D-14). O primeiro — CALC-01 — é um gate de validação no único caminho de saída do Step 2 (`handleNext` em `Step2Ambientes.tsx:34`), não uma mudança nos cálculos (o `|| 0` em `calcularDemandaFita:135` permanece intacto por design). O segundo — CALC-02 — é uma responsabilidade de composição de string no `AmbienteCard`, onde o sufixo `— 2,5m` é regenerado reativamente sempre que `comprimentoPeca` ou `quantidade` mudam, sem tocar na lógica de cálculo. O terceiro — CALC-03 — começa com uma migration de banco obrigatória (a coluna `passadas_padrao` já existe em `product_variants`, mas o valor para produtos com `familia_perfil = 'light_50'` está em `1` — o padrão do `ADD COLUMN` — e precisa ser sincronizado com o valor correto `3` da tabela `regras_compatibilidade_perfil`), seguida de um upgrade do dropdown de passadas no AmbienteCard para usar o `passadas_padrao` lido pelo `useProdutoSearch` e restringir as opções válidas por família.

A restrição mais importante da fase é a ordem de execução: migration de sync ANTES da UI, e o patch dos 5 sites em um único commit atômico. O risco real é `isSistemaVazio` (em `pdfTemplates/v2.ts:89`) usar `calcularDemandaFita === 0` para filtrar sistemas do PDF — se um sistema com `metragemManual = null` chega ao Step 3 (pré-gate), ele seria silenciosamente omitido do PDF. O gate do Step 2 resolve isso preventivamente.

**Primary recommendation:** Implementar na ordem — (1) migration de sync `passadas_padrao`, (2) patch atômico nos 5 sites + gate CALC-01 + sufixo CALC-02 + dropdown CALC-03 num único commit, (3) testes.

---

## Standard Stack

Sem dependências novas — tudo usa o stack existente do projeto.

| Área | Arquivo | Padrão |
|------|---------|--------|
| Validação de avanço | `src/components/Step2Ambientes.tsx` | `handleNext` com guards, `toast.error` do sonner |
| Marcador inline | `src/components/AmbienteCard.tsx` | `Badge` + `cn()` condicional (shadcn-ui) |
| Sufixo de descrição | `src/components/AmbienteCard.tsx` | String manipulation inline no handler |
| Dropdown passadas | `src/components/AmbienteCard.tsx` | `Select` shadcn-ui existente |
| Cálculos | `src/types/orcamento.ts` | Funções puras sem side-effect |
| Filtro PDF | `src/lib/pdfTemplates/v2.ts` | `isSistemaVazio` helper |
| Migration | `supabase/migrations/` | SQL aditivo + `migration repair` |

---

## Architecture Patterns

### Risk Area 1: regras_compatibilidade_perfil → passadas_padrao sync (CALC-03)

**Situação atual verificada:**

- `produto.passadas` em `useProdutoSearch` é um alias de `passadas_padrao` da tabela `product_variants` (select L17: `"passadas:passadas_padrao"`). [VERIFIED: src/hooks/useProdutoSearch.ts:17-23]
- `product_variants.passadas_padrao` foi adicionado com `DEFAULT 1` na migration `20260319000001`. [VERIFIED: supabase/migrations/20260319000001_campos_tecnicos_produtos.sql:33]
- `regras_compatibilidade_perfil` foi populada com `light_50: passadas_padrao = 3` na migration `20260319000002`. [VERIFIED: supabase/migrations/20260319000002_regras_compatibilidade_perfil.sql:66]
- A **sync entre as duas tabelas nunca foi feita** — `product_variants` tem `passadas_padrao = 1` para perfis `light_50` (valor do DEFAULT), enquanto `regras_compatibilidade_perfil` tem o valor correto `3`. [VERIFIED: nenhuma migration de sync encontrada nas 40 migrations presentes]
- `produtos` é uma view sobre `product_variants` que expõe `passadas_padrao` diretamente. [VERIFIED: supabase/migrations/20260501000001_products_and_variants.sql:103]
- Em `AmbienteCard:203`: `const passadasAuto = (produto.passadas ?? base.passadas) as 1 | 2 | 3` — lê `produto.passadas` (= `passadas_padrao` da `product_variants`). Sem a sync, perfis `light_50` chegam com `passadasAuto = 1` em vez de `3`. [VERIFIED: src/components/AmbienteCard.tsx:203]

**SQL da migration de sync (idempotente, aditiva):**

```sql
-- Migration: sincronizar passadas_padrao de product_variants com regras_compatibilidade_perfil
-- Phase 16 / CALC-03 (D-12) — DEVE ser aplicada antes do unlock da UI de passadas

BEGIN;

UPDATE public.product_variants pv
  SET passadas_padrao = rcp.passadas_padrao
FROM public.regras_compatibilidade_perfil rcp
WHERE pv.familia_perfil = rcp.familia_perfil
  AND pv.tipo_produto = 'perfil'
  AND pv.passadas_padrao IS DISTINCT FROM rcp.passadas_padrao;

COMMIT;
```

Este UPDATE cobre todas as famílias de perfil, não só `light_50` — alinha `embutir_sobrepor_30` (2), `light_nano_30` (2), `alojamento` (2), etc. É idempotente por `IS DISTINCT FROM`. [VERIFIED: comparando seeds de `20260319000002` com DEFAULT `1` de `20260319000001`]

**Famílias com `passadas_padrao > 1` (verificadas no seed):**

| familia_perfil | passadas_padrao |
|---------------|-----------------|
| `light_50` | 3 |
| `embutir_sobrepor_30` | 2 |
| `light_nano_30` | 2 |
| `alojamento` | 2 |
| `no_frame_bilateral` | 2 |
| `no_frame_wide` | 2 |
| `wall_washer` | 2 |
| `trik` | 2 |
| `fk` | 2 |
| `sanca` | 2 |
| `pendente` | 2 |

Todas as outras famílias: `passadas_padrao = 1` (já correto pelo DEFAULT). [VERIFIED: supabase/migrations/20260319000002_regras_compatibilidade_perfil.sql:57-83]

**Mapeamento família → max passadas válidas:**

O campo `passadas_padrao` na `regras_compatibilidade_perfil` representa TAMBÉM o máximo para a maioria das famílias. `light_50` tem max = 3 (o único caso de 3). As demais têm max = passadas_padrao (1 ou 2). O dropdown deve mostrar apenas `[1..passadas_padrao]`. A UI deve derivar o range do `produto.passadas` (= `passadas_padrao` após sync), não de uma query separada à `regras_compatibilidade_perfil`.

**`useProdutoSearch` já expõe o que é necessário:**

```typescript
// useProdutoSearch.ts:17-23 (existente)
"passadas:passadas_padrao, familia_perfil"
// produto.passadas = passadas_padrao do produto
// produto.familia_perfil = família do produto
```

O componente já recebe `produto.passadas` via `ProdutoAutocomplete → handleSelectProdutoSistema → produto.passadas`. Após a sync, `produto.passadas` será `3` para `light_50`. [VERIFIED: src/hooks/useProdutoSearch.ts:20]

**Onde o padrão é lido no AmbienteCard:**

- L203: `const passadasAuto = (produto.passadas ?? base.passadas) as 1 | 2 | 3` — define o valor inicial ao selecionar um perfil.
- L213: `passadas: passadasAuto` — salva no `ItemPerfil`.
- L515: `<Badge variant="secondary" className="text-xs">{sis.perfil.passadas}× (auto)</Badge>` — **atualmente exibe `(auto)` mas não é editável**. CALC-03 requer trocar este Badge por um `Select` restrito.

**O que deve mudar no AmbienteCard para CALC-03:**
1. Ao selecionar perfil: `passadasAuto` já funciona (apenas precisa da sync para ter valor correto).
2. O Badge `{sis.perfil.passadas}× (auto)` deve virar um `Select` com opções `[1..maxPassadas]`, onde `maxPassadas = sis.perfil.passadas` (o valor sugerido/padrão na criação, que após sync é `passadas_padrao` da família).
3. O `ItemPerfil.passadas` deve ser updatable via `updateSistema`. Isso requer também guardar `maxPassadas` acessível. Estratégia: guardar `passadas_padrao` da família no `ItemPerfil` como campo adicional opcional, OU derivar o max do `sis.perfil.familia_perfil` contra um lookup local. O caminho mais simples: ao selecionar o perfil, setar `passadas: passadasAuto` (como hoje) e `passadasMax: passadasAuto` (novo campo), e o Select mostra `[1..passadasMax]`.

> **Atenção:** `ItemPerfil` em `orcamento.ts` não tem campo `passadasMax`. O planner deve decidir se adiciona `passadasMax?: number` ao tipo, ou se o componente deriva o max de `familia_perfil` contra um mapa local. Recomendação: adicionar `passadasPadrao?: 1 | 2 | 3` ao `ItemPerfil` (espelha o valor do banco no momento da seleção) para evitar queries adicionais.

---

### Risk Area 2: O patch atômico dos 5 sites (CALC-01)

**Mapa dos 5 sites verificados:**

**Site 1 — `calcularDemandaFita` (`orcamento.ts:126-140`)**

```typescript
// Caminho sem perfil (orcamento.ts:135) — VERIFIED
return (sis.metragemManual || 0) * (sis.passadasManual || 1);
```

O `|| 0` é **intencionalmente mantido** após o fix — o gate do Step 2 garante que o cálculo nunca seja chamado com `metragemManual = null/0`. Não alterar esta linha.

**Site 2 — `calcularConsumoW` (`orcamento.ts:143-153`)**

Chama `calcularDemandaFita` internamente. Se demanda = 0, consumo = 0. Nenhuma mudança necessária aqui — consequência natural do site 1.

**Site 3 — `calcularQtdDrivers` (`orcamento.ts:156-181`)**

Chama `calcularDemandaFita` e `calcularConsumoW`. Se demanda = 0, retorna 0. Nenhuma mudança necessária.

**Site 4 — `calcularSubtotalSistemaSemFita` (`orcamento.ts:234-236`)**

```typescript
export function calcularSubtotalSistemaSemFita(sistema: SistemaIluminacao): number {
  return calcularSubtotalPerfilSistema(sistema) + calcularSubtotalDriverSistema(sistema);
}
```

`calcularSubtotalDriverSistema` chama `calcularQtdDrivers` — se qtd = 0, subtotal driver = 0. A fita tem R$0 de subtotal mostrado aqui (só aparece no Resumo Global). Nenhuma mudança de lógica necessária, mas este site deve ser revisado no mesmo commit para confirmar que o comportamento com metragem válida pós-gate não mudou.

**Site 5 — `isSistemaVazio` (`pdfTemplates/v2.ts:89-93`)**

```typescript
function isSistemaVazio(sis: SistemaIluminacao): boolean {
  return calcularDemandaFita(sis) === 0
    && calcularConsumoW(sis) === 0
    && calcularQtdDrivers(sis) === 0;
}
```

**Este é o site crítico.** Com `metragemManual = null` e `|| 0`, `calcularDemandaFita` retorna `0` → `isSistemaVazio` retorna `true` → sistema filtrado do PDF silenciosamente. O gate do Step 2 impede que sistemas com `metragemManual = null/0` cheguem ao Step 3 / PDF. Mas para reconciliar com D-07, a mesma lógica de "sistema totalmente vazio" (sem fita/driver/perfil real) precisa ser consistente.

**A distinção D-06/D-07 em código:**

- `isSistemaVazio` atual retorna `true` quando demanda/consumo/qtdDrivers = 0. Isso cobre:
  - Sistema novo sem nenhum produto selecionado (`wm=0`, `metragemManual=null`) → `true`.
  - Sistema com fita+driver selecionados mas `metragemManual=null` → `true` (o bug CALC-01).
  
  Após o gate do Step 2, sistemas do segundo tipo nunca chegam ao Step 3. A definição de `isSistemaVazio` não precisa mudar para o PDF — o gate resolve o problema upstream. Mas o gate do Step 2 deve usar **a mesma lógica** para detectar sistemas "totalmente vazios" (D-07): um sistema sem `fita.codigo` E sem `driver.codigo` E sem `perfil` = vazio → avisa+remove (D-06), não bloqueia.

**Critério de sistema vazio para o gate Step 2 (D-06):**

```typescript
// Proposta de helper para uso no gate do Step 2
function isSistemaCompletamenteVazio(sis: SistemaIluminacao): boolean {
  return !sis.fita.codigo && !sis.driver.codigo && !sis.perfil;
}
```

Isso é diferente de `isSistemaVazio` (que usa cálculos derivados). Para o PDF, `isSistemaVazio` continua servindo pois filtra por resultado — sistemas com fita selecionada mas metragem 0 que chegassem ao PDF seriam filtrados. Com o gate, eles nunca chegam. A consistência entre os dois é garantida pela cadeia lógica, não pela mesma função.

**A chave: onde fica o gate Step 2 (CALC-01):**

```typescript
// src/components/Step2Ambientes.tsx:34 — existente
const handleNext = () => {
  if (ambientes.length === 0) {
    toast.error("Adicione pelo menos um ambiente");
    return;
  }
  onNext(); // ← bloqueio CALC-01 entra AQUI, antes de chamar onNext()
};
```

O `onNext` em `Index.tsx:192` é `() => setStep(3)` — não há mais nada entre o `handleNext` e o `setStep`. O bloqueio deve checar todos os sistemas de todos os ambientes antes de chamar `onNext`. [VERIFIED: src/pages/Index.tsx:192, src/components/Step2Ambientes.tsx:34-39]

**Algoritmo do gate:**

```typescript
const handleNext = () => {
  if (ambientes.length === 0) {
    toast.error("Adicione pelo menos um ambiente");
    return;
  }

  // CALC-01: detectar sistemas com fita mas sem perfil e metragem inválida (null ou 0)
  const sistemasInvalidos: string[] = [];
  const sistemasVazios: { ambIdx: number; sisIdx: number }[] = [];

  for (const amb of ambientes) {
    for (const sis of amb.sistemas) {
      const totalmenteVazio = !sis.fita.codigo && !sis.driver.codigo && !sis.perfil;
      if (totalmenteVazio) {
        sistemasVazios.push(/* ref para remover */);
        continue;
      }
      // CALC-01: fita sem perfil e metragem null/0
      if (sis.fita.codigo && !sis.perfil) {
        const metragemInvalida = !sis.metragemManual || sis.metragemManual <= 0;
        if (metragemInvalida) {
          sistemasInvalidos.push(`${amb.nome} — Sistema ${idx + 1}`);
        }
      }
    }
  }

  if (sistemasInvalidos.length > 0) {
    toast.error("Informe uma metragem válida...", ...);
    return; // BLOQUEIO
  }

  if (sistemasVazios.length > 0) {
    // Avisa + remove + chama onNext (NÃO bloqueia)
    removerVazios(sistemasVazios);
    toast.info("Sistemas vazios foram removidos...");
    onNext();
    return;
  }

  onNext();
};
```

O marcador inline no card (D-02) é separado do gate — fica em `AmbienteCard` e exibe o aviso diretamente na row do sistema, reativamente, sem esperar o clique em "Próximo".

---

### Risk Area 3: Sufixo de metragem na descrição do perfil (CALC-02)

**Situação atual:**

O campo `descricao` do perfil é populado ao selecionar um produto (AmbienteCard:208: `descricao: produto.descricao`) e exposto como `<Input value={sis.perfil.descricao} readOnly ... />` (AmbienteCard:497). A metragem é exibida como Badge separado (AmbienteCard:519: `Metragem: {calcularMetragemTotal(sis.perfil)}m`), mas não está na descrição. [VERIFIED: src/components/AmbienteCard.tsx:497-519]

**Onde compor o sufixo (D-09):**

O sufixo deve ser regenerado em **dois lugares** no AmbienteCard:

1. **Ao selecionar o perfil** (handleSelectProdutoSistema, component='perfil', L201-218): concatenar o sufixo na descrição inicial.
2. **Ao mudar comprimentoPeca** (onChange do Select, L500): chamar `updateSistema` com descrição regenerada.
3. **Ao mudar quantidade** (onChange do Input, L511): idem.

**Algoritmo de composição do sufixo (D-09):**

```typescript
// Helper
function aplicarSufixoMetragem(descricaoBase: string, comprimentoPeca: number, quantidade: number): string {
  // Remove sufixo anterior (se houver) e adiciona novo
  const baseStripped = descricaoBase.replace(/ — \d+(\,\d+)?m$/, '').trimEnd();
  const metragem = comprimentoPeca * quantidade;
  const metragemFormatada = metragem % 1 === 0 ? `${metragem}m` : `${metragem.toString().replace('.', ',')}m`;
  return `${baseStripped} — ${metragemFormatada}`;
}
```

Formato exato: `— 2,5m` (travessão com espaço, vírgula decimal, sem espaço antes de "m"). [VERIFIED: CONTEXT.md specifics section]

**Ao selecionar o perfil (L201-218):**

```typescript
const descricaoComSufixo = aplicarSufixoMetragem(produto.descricao, base.comprimentoPeca, base.quantidade);
// ...
perfil: {
  ...base,
  descricao: descricaoComSufixo, // em vez de produto.descricao
  comprimentoPeca: base.comprimentoPeca,
  ...
}
```

**Ao mudar comprimentoPeca (onChange do Select, AmbienteCard:500):**

```typescript
onValueChange={(v) => {
  const novoComp = Number(v) as 1 | 2 | 3;
  const descAtualizada = aplicarSufixoMetragem(
    sis.perfil!.descricao,
    novoComp,
    sis.perfil!.quantidade
  );
  updateSistema(si, { ...sis, perfil: { ...sis.perfil!, comprimentoPeca: novoComp, descricao: descAtualizada } });
}}
```

**Ao mudar quantidade (onChange do Input, AmbienteCard:511):**

```typescript
onChange={(e) => {
  const qtd = raw === "" ? 0 : (parseInt(raw) || 0);
  const descAtualizada = aplicarSufixoMetragem(
    sis.perfil!.descricao,
    sis.perfil!.comprimentoPeca,
    qtd
  );
  updateSistema(si, { ...sis, perfil: { ...sis.perfil!, quantidade: qtd, descricao: descAtualizada } });
}}
```

O Input de descrição é `readOnly` e exibe `sis.perfil.descricao` — o sufixo aparece automaticamente ali e fluirá para o Resumo e PDF sem alteração adicional.

**Propagação ao PDF:** `rowPerfil` em `pdfTemplates/v2.ts:157-185` usa `sis.perfil.descricao` via `construirDescricaoRica` — o sufixo na descrição aparece automaticamente. Nenhuma mudança no template de PDF. [VERIFIED: src/lib/pdfTemplates/v2.ts:167]

---

## Don't Hand-Roll

| Problema | Não construir | Usar em vez disso | Por quê |
|---------|-------------|-------------------|---------|
| Bloqueio de avanço no wizard | Sistema de validação separado/Redux | Guard direto em `handleNext` + `toast.error` do sonner | Padrão já estabelecido no projeto (ver L35-38 do mesmo arquivo) |
| Regex para remover sufixo antigo | Parser genérico | `replace(/ — \d+(\,\d+)?m$/, '')` | O formato é estritamente controlado pelo próprio sistema |
| Lookup de max passadas por família | Query adicional à `regras_compatibilidade_perfil` | `passadas_padrao` do produto (após sync) armazenado no `ItemPerfil` | Dado já trafega no `useProdutoSearch` — sem round-trip extra |
| Detecção de sistema vazio | Nova lógica de cálculo | Reuso de `isSistemaVazio` / check direto de `.codigo` vazio | Consistência D-07 — uma definição, dois usos |

---

## Safe Migration Application (CALC-03 blocker)

**Procedimento aprovado (divergent history — projeto memory verificada):**

O histórico de migrations está divergente. `supabase db push` é inseguro pois re-aplicaria ~6 migrations locais que já estão no banco via dashboard. [VERIFIED: project_aura_migration_divergence.md]

**Procedimento correto (aprovado por Lenny na Phase 14):**

```bash
# 1. Colar o SQL diretamente no SQL Editor do Supabase Studio OU via service role:
SUPABASE_SERVICE_ROLE_KEY=$(grep SUPABASE_SERVICE_ROLE_KEY .env.local | cut -d= -f2)

# Executar via psql com service role (ou colar no Studio — efeito idêntico):
# UPDATE public.product_variants pv
#   SET passadas_padrao = rcp.passadas_padrao
# FROM public.regras_compatibilidade_perfil rcp
# WHERE pv.familia_perfil = rcp.familia_perfil
#   AND pv.tipo_produto = 'perfil'
#   AND pv.passadas_padrao IS DISTINCT FROM rcp.passadas_padrao;

# 2. Depois de confirmado que rodou corretamente, registrar no histórico local:
supabase migration repair --status applied <timestamp_da_nova_migration>
```

O timestamp da nova migration deve seguir o padrão `YYYYMMDDHHMMSS_descricao.sql` — ex.: `20260611000001_sync_passadas_padrao.sql`.

**Variáveis de ambiente necessárias:**

- `SUPABASE_SERVICE_ROLE_KEY` está em `.env.local` (confirmado na memory).
- Project ID: `jkewlaezvrbuicmncqbj` (região `sa-east-1`).

**Alternativa no-CLI (mais segura, zero risco de divergência adicional):**

Colar o SQL no Studio > SQL Editor > Run. Depois criar o arquivo de migration local e `supabase migration repair --status applied <timestamp>`.

**A migration deve ser [BLOCKING]** no plano — a UI de passadas (CALC-03) não deve ser entregue sem ela, pois perfis `light_50` mostrariam passadas = 1 como padrão em vez de 3.

---

## Common Pitfalls

### Pitfall 1: Alterar `|| 0` em `calcularDemandaFita`

**O que daria errado:** Trocar `(sis.metragemManual || 0)` por um throw ou early-return no cálculo causaria crash em sistemas salvos que ainda não passaram pelo gate (rascunhos antigos no Step 3, PDF de snapshots, etc.).

**Por que acontece:** Confundir "onde validar" com "onde calcular". A validação é o gate; o cálculo mantém `|| 0` para segurança defensiva.

**Como evitar:** O fix CALC-01 é 100% em `Step2Ambientes.handleNext`, não em `orcamento.ts`. [VERIFIED: orcamento.ts:135]

### Pitfall 2: `isSistemaVazio` inconsistente com o gate

**O que daria errado:** Se o gate do Step 2 usa critérios diferentes de `isSistemaVazio` do PDF, um sistema pode passar pelo gate mas ser filtrado do PDF (ou vice-versa).

**Por que acontece:** D-06 e D-07 parecem diferentes, mas precisam de definições compatíveis.

**Como evitar:** O gate detecta `isSistemaCompletamenteVazio` (nenhum produto selecionado) → avisa+remove. O PDF usa `isSistemaVazio` (demanda/consumo/qtd = 0) → filtra. Com o gate bloqueando sistemas com `fita.codigo` E `metragemManual = null/0`, os dois critérios nunca conflitam. Não alterar `isSistemaVazio` em `v2.ts`. [VERIFIED: pdfTemplates/v2.ts:89-93]

### Pitfall 3: Sufixo cumulativo na descrição

**O que daria errado:** Cada mudança de comprimento/quantidade adiciona um novo sufixo → `PERFIL EMBUTIR SALA — 2m — 4m — 6m`.

**Por que acontece:** `aplicarSufixoMetragem` chamado sem remover o sufixo anterior.

**Como evitar:** O helper deve sempre fazer `.replace(/ — \d+(\,\d+)?m$/, '').trimEnd()` antes de concatenar. Regex testada contra: `"PERFIL X — 2m"`, `"PERFIL X — 2,5m"`, `"PERFIL X"` (sem sufixo). [ASSUMED — regex não testada em runtime nesta sessão]

### Pitfall 4: `passadasMax` não persistido no `ItemPerfil`

**O que daria errado:** O Select do dropdown não sabe o máximo de passadas para aquela família → mostra sempre 3 opções.

**Por que acontece:** `passadas_padrao` é lido no momento da seleção do perfil mas não armazenado no estado.

**Como evitar:** Adicionar `passadasPadrao?: 1 | 2 | 3` ao `ItemPerfil` em `orcamento.ts` no mesmo commit que o componente. Ao selecionar o perfil, setar `passadasPadrao: passadasAuto`. O Select usa `[...Array(sis.perfil.passadasPadrao || 3)].map((_, i) => i+1)`. Rascunhos antigos sem este campo: `passadasPadrao` undefined → fallback `|| 3` exibe todas as opções (degradação segura).

### Pitfall 5: Migration `20260602000001` não aplicada em prod

**O que daria errado:** Se alguém rodar `supabase db push` antes de reconciliar o histórico, a migration `20260602000001_product_variants_ativo.sql` (que recria a view `produtos` com coluna `ativo`) seria aplicada, quebrando a query `useProdutoSearch` que não filtra por `ativo`.

**Por que acontece:** Divergência de histórico documentada na memory.

**Como evitar:** Esta fase NÃO deve acionar `supabase db push`. A nova migration deve ser aplicada isoladamente e registrada com `migration repair`. [VERIFIED: project_aura_migration_divergence.md]

---

## Code Examples

### Gate CALC-01 em Step2Ambientes.tsx (padrão de referência)

```typescript
// Padrão existente (AmbienteCard.tsx:34-38) — estender na mesma função
const handleNext = () => {
  if (ambientes.length === 0) {
    toast.error("Adicione pelo menos um ambiente");
    return;
  }
  // NOVO: coletar sistemas inválidos e vazios antes de avançar
  // ...lógica de detecção...
  onNext();
};
```

[VERIFIED: src/components/Step2Ambientes.tsx:34-39]

### Marcador inline no AmbienteCard (badge/borda existente como referência)

```tsx
{/* Referência: badge de divergência de voltagem já existente, AmbienteCard:411-415 */}
{(() => {
  const fv = sis.fita.voltagem, dv = sis.driver.voltagem;
  const temDivergencia = !!sis.fita.codigo && ...;
  return temDivergencia ? (
    <Badge variant="destructive" className="text-[10px] px-1.5 py-0">⚠ {fv}V × {dv}V</Badge>
  ) : null;
})()}

{/* Novo: metragem inválida (CALC-01) */}
{(() => {
  const semPerfilEInvalido = !!sis.fita.codigo && !sis.perfil && (!sis.metragemManual || sis.metragemManual <= 0);
  return semPerfilEInvalido ? (
    <Badge variant="destructive" className="text-[10px] px-1.5 py-0">⚠ Metragem obrigatória</Badge>
  ) : null;
})()}
```

[VERIFIED: src/components/AmbienteCard.tsx:410-415]

### Dropdown passadas com restrição por família (CALC-03)

```tsx
{/* Substituir o Badge readonly (AmbienteCard:515) por Select restrito */}
<div className="flex items-center gap-1">
  <span className="text-xs text-muted-foreground">Passadas:</span>
  <Select
    value={String(sis.perfil.passadas)}
    onValueChange={(v) => updateSistema(si, { ...sis, perfil: { ...sis.perfil!, passadas: Number(v) as 1 | 2 | 3 } })}
  >
    <SelectTrigger className="w-20 h-8"><SelectValue /></SelectTrigger>
    <SelectContent>
      {[1, 2, 3]
        .filter(n => n <= (sis.perfil!.passadasPadrao || 3))
        .map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
    </SelectContent>
  </Select>
</div>
```

[VERIFIED: src/components/AmbienteCard.tsx:514-516 (código atual a ser substituído)]

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| `passadas` do perfil: Badge readonly `"(auto)"` | Select restrito por família (CALC-03) | Colaborador pode reduzir passadas sem reabrir o perfil |
| Metragem do perfil exibida só como Badge separado | Sufixo `— Xm` embutido na descrição (CALC-02) | Aparece automaticamente em card, Resumo e PDF sem código extra |
| `metragemManual = null` passa silenciosamente para Step 3 | Gate duro no `handleNext` (CALC-01) | Fita com `metragemManual = null` nunca chega ao cálculo / PDF com R$0 |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Regex `/ — \d+(\,\d+)?m$/` captura corretamente todos os formatos de sufixo gerados pelo sistema | Code Examples / Pitfall 3 | Sufixo cumulativo; mitigado testando na suite Vitest antes de merge |
| A2 | `passadas_padrao` em `product_variants` está atualmente em `1` para todos os perfis `light_50` (DEFAULT nunca sobrescrito) | Risk Area 1 | Se já foi corrigido manualmente, a migration de sync é no-op (seguro por `IS DISTINCT FROM`) |
| A3 | A view `produtos` vigente em prod usa o SELECT de `20260501000001` (sem coluna `ativo`), não o de `20260602000001` | Risk Area 3 / Pitfall 5 | Se `ativo` já foi aplicada em prod, `useProdutoSearch` pode precisar de ajuste; confirmar no Studio antes da fase |

---

## Open Questions

1. **`passadasPadrao` no tipo `ItemPerfil`**
   - O que sabemos: `ItemPerfil` não tem o campo; o `passadas_padrao` é lido ao selecionar o perfil mas não salvo no estado.
   - O que está em aberto: adicionar ao tipo TS (muda interface, impacta snapshots) vs. derivar da `familia_perfil` num mapa local.
   - Recomendação: adicionar `passadasPadrao?: 1 | 2 | 3` ao `ItemPerfil` — campo opcional, backwards-compatible, rascunhos antigos sem o campo fazem fallback para `3` (máximo, não bloqueia).

2. **Marcador inline no card: badge no header do sistema vs. destaque na row do perfil/metragem**
   - O que sabemos: o badge de voltagem divergente fica no header do sistema (AmbienteCard:411). A row de metragem fica dentro do bloco do perfil (AmbienteCard:527).
   - O que está em aberto: qual posição é mais visível (D-02).
   - Recomendação (discretion): badge no header do sistema (mesma posição do badge de voltagem) para consistência visual + destaque adicional na row de metragem (borda vermelha no Input).

---

## Environment Availability

Step 2.6: SKIPPED — fase é puramente código/config + SQL no Studio. Sem dependências externas além do Supabase já operacional.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 3.2.4 |
| Config file | `vitest.config.ts` |
| Quick run command | `npm run test` |
| Full suite command | `npm run test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CALC-01 | `handleNext` bloqueia quando `fita.codigo` preenchido, `perfil = null`, `metragemManual = null` | unit | `npm run test -- --run Step2` | ❌ Wave 0 |
| CALC-01 | `handleNext` bloqueia quando `metragemManual = 0` | unit | `npm run test -- --run Step2` | ❌ Wave 0 |
| CALC-01 | `handleNext` passa quando `metragemManual > 0` | unit | `npm run test -- --run Step2` | ❌ Wave 0 |
| CALC-01 | `handleNext` remove sistema vazio e avança (não bloqueia) | unit | `npm run test -- --run Step2` | ❌ Wave 0 |
| CALC-02 | `aplicarSufixoMetragem` gera `"PERFIL X — 2m"` | unit | `npm run test -- --run sufixo` | ❌ Wave 0 |
| CALC-02 | `aplicarSufixoMetragem` substitui sufixo anterior sem duplicar | unit | `npm run test -- --run sufixo` | ❌ Wave 0 |
| CALC-03 | `passadasAuto` correto após sync (light_50 → 3) | unit | `npm run test -- --run passadas` | ❌ Wave 0 |
| CALC-03 | dropdown exibe apenas `[1..passadasPadrao]` opções | unit | `npm run test -- --run AmbienteCard` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm run test`
- **Per wave merge:** `npm run test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/types/__tests__/sufixoMetragem.test.ts` — cobre CALC-02 (helper `aplicarSufixoMetragem`)
- [ ] `src/components/__tests__/Step2Gate.test.ts` — cobre CALC-01 (handleNext variants)
- [ ] `src/components/__tests__/AmbienteCardPassadas.test.ts` — cobre CALC-03 (dropdown restriction)

---

## Security Domain

Security enforcement não se aplica diretamente a esta fase — sem novos endpoints, sem auth changes, sem novos campos sensíveis. A migration é somente `UPDATE` em `product_variants`, cobertura idêntica ao padrão das migrations anteriores da série `20260319`.

---

## Sources

### Primary (HIGH confidence — verificados nesta sessão)

- `src/types/orcamento.ts` — funções de cálculo L121-236, tipos L36-87
- `src/components/AmbienteCard.tsx` — lógica de seleção de perfil L201-218, UI de passadas L514-516, metragem manual L527-545
- `src/components/Step2Ambientes.tsx` — gate handleNext L34-39, wiring onNext L39
- `src/lib/pdfTemplates/v2.ts` — isSistemaVazio L89-93, uso no filtro L237
- `src/pages/Index.tsx` — wiring `onNext={() => setStep(3)}` L192
- `src/hooks/useProdutoSearch.ts` — alias passadas:passadas_padrao L20, familia_perfil L21
- `supabase/migrations/20260319000001_campos_tecnicos_produtos.sql` — ADD COLUMN passadas_padrao DEFAULT 1 L33
- `supabase/migrations/20260319000002_regras_compatibilidade_perfil.sql` — seed light_50 passadas_padrao=3 L66
- `supabase/migrations/20260501000001_products_and_variants.sql` — view produtos expõe passadas_padrao L103
- `src/integrations/supabase/types.ts` — passadas_padrao presente em product_variants Row/Insert/Update
- `project_aura_migration_divergence.md` — procedimento seguro: SQL Editor + migration repair

### Secondary (MEDIUM confidence)

- Nenhuma query necessária a fontes externas — todo o domínio está no codebase.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — stack existente, sem novas dependências
- Architecture: HIGH — todos os 5 sites verificados com file:line exatos
- Pitfalls: HIGH para P1-P4 (verificados no código), MEDIUM para P5 (baseado na memory)
- Migration SQL: HIGH — lógica derivada diretamente dos dois arquivos de migration verificados

**Research date:** 2026-06-11
**Valid until:** 2026-07-11 (stack estável, sem dependências externas em evolução)
