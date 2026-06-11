# Phase 17: Resumo & Apresentação - Research

**Researched:** 2026-06-11
**Domain:** Step3Revisao UI + pdfTemplates/v2 + GrupoFita data shape + Step2 gate RES-05
**Confidence:** HIGH

## Summary

Phase 17 reorganiza a apresentação do Step 3 e do PDF v2 sem tocar em cálculos: adiciona breakdown por LOCAL em `GrupoFita`, foto da fita no `blocoResumoFitas` do PDF, rebaixa o bloco global de drivers a análise colapsável, e pendurar quatro gatilhos de aviso advisory no gate do Step 2.

`GrupoFita` é um valor **computado em runtime** — não serializado em `orcamentos.ambientes` (que contém apenas `Ambiente[]`). Extender `GrupoFita` com campos novos é 100% seguro para snapshots antigos, pois o tipo nunca entra no banco. A única função a tocar é `calcularRolosPorGrupo` em `src/types/orcamento.ts:380`.

O gatilho D-15 ("peça sem lâmpada esperada") tem dados concretos no codebase: a Regra #24 em `AmbienteCard.tsx:105` já implementa detecção por regex de base de lâmpada (`GU10|E27|MR11|MR16|AR70|AR111|PAR20|PAR30|DICROICA|DICRO`) e exclusão por `LED INTEGRADO|COM LED`. Há também a tabela `vinculos_spot_lampada` no banco com colunas `codigo_spot`, `codigo_lampada`, `led_integrado`. A detecção no gate pode reutilizar exatamente o mesmo predicado da Regra #24, aplicado a `ItemLuminaria.descricao` de cada luminária do ambiente.

**Recomendação principal:** Estruturar a fase em 4 tasks: (1) extender `GrupoFita` + `calcularRolosPorGrupo` com breakdown por local e `imagemUrl`; (2) atualizar `blocoResumoFitas` no PDF v2 com foto e LOCAL; (3) atualizar `Step3Revisao` — LOCAL no Resumo de Fitas, rótulo referência na linha de fita inline, e colapso do bloco global de drivers; (4) adicionar aviso advisory no gate `handleNext` do Step 2.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01:** Resumo Global de Fitas = fonte oficial de compra. A linha de fita no card do ambiente é referência contextual explícita com rótulo "incluída no Resumo de Fitas".

**D-02:** A interface responde sem ambiguidade: (1) em quais ambientes/locais a fita está sendo usada; (2) onde é contabilizada.

**D-03:** Manter otimização global de rolos — não quebrar agrupamento por código.

**D-04:** Coluna/área LOCAL com breakdown por local dentro da linha agrupada por código. Formato: `SANCA 12m · MARCENARIA 8m → Total 20m → rolos otimizados`.

**D-05:** LOCAL exibido como "Ambiente — Local" quando `sistema.local` existe (ex: `Sala — Sanca`); só nome do ambiente quando `local` vazio (ex: `Sala`).

**D-06:** Mudança em `calcularRolosPorGrupo` (orcamento.ts:380). Tipo `GrupoFita` estendido de forma aditiva. Não quebrar snapshots nem PDF v1/v2.

**D-07:** LOCAL breakdown + foto da fita no `blocoResumoFitas` do PDF v2. Manter fita inline por sistema como está.

**D-08:** Incluir foto/thumbnail da fita no Resumo de Fitas do PDF (fold do TODO `2026-06-10-foto-da-fita-no-resumo-de-fitas-pdf.md`). `GrupoFita` carrega `imagemUrl`.

**D-09:** Dedup mais agressivo no PDF (remover preço da fita inline) adiado — só reabrir se confusão visual persistir.

**D-10:** Drivers por ambiente são fonte oficial de compra/apresentação. PDF já não tem bloco global — RES-03 ok no PDF.

**D-11:** "Resumo Global de Drivers" (Step3Revisao.tsx:755) rebaixado a análise interna colapsável. Não remover — o insight de economia tem valor; não levar ao PDF.

**D-12:** Advisory não-bloqueante ao avançar Step 2 → Step 3 para sistemas/itens suspeitos.

**D-13:** Comportamento do aviso: listar claramente os sistemas/itens suspeitos, explicar o que falta, permitir revisar ou continuar conscientemente, registrar visualmente que prosseguiu mesmo com o aviso.

**D-14:** Gatilhos do advisory (todos selecionados): (1) fita sem driver; (2) driver sem fita; (3) perfil sem fita; (4) peça/luminária sem lâmpada esperada.

**D-15 (CHECKPOINT):** Gatilho "peça sem lâmpada" requer investigação do modelo de dados antes de implementar. Pesquisa deve apresentar a regra concreta.

**D-16:** Reutilizar o mesmo ponto de saída do gate da Phase 16 (`Step2Ambientes.handleNext`). Ordem: bloqueio de metragem (Phase 16) → remoção de vazio (Phase 16) → aviso advisory RES-05.

### Claude's Discretion

- Forma visual exata do rótulo "incluída no Resumo de Fitas" na fita do card do ambiente e do breakdown por local na tabela.
- Mecânica de colapso/rotulagem do bloco global de drivers (D-11).
- Copy exato do aviso advisory e do registro visual de "prosseguiu mesmo assim".
- Estrutura aditiva exata do tipo `GrupoFita` para carregar breakdown por local + `imagemUrl`.

### Deferred Ideas (OUT OF SCOPE)

- RES-04 — Duplicar/reusar sistema em outro ambiente: movido para Phase 18.
- Dedup mais agressivo no PDF (remover preço da fita inline): adiado (D-09).
- Redesign estético do PDF: deferido perpetuamente.
- UX-05 (checklist visual pré-PDF completo): Phase 18.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RES-01 | Resumo Global de Fitas/Drivers mostra LOCAL de cada item (ex: SANCA, MARCENARIA) | Investigação de `calcularRolosPorGrupo` + `GrupoFita` confirma que é o único ponto de mudança; breakdown por "Ambiente — Local" via `sis.local` + `amb.nome` |
| RES-02 | Fita não aparece duplicada/confusa — apresentação coerente | Confirmado que a fita inline no card (Step3:638-656) mostra "Global →" hoje; mudança é só rótulo. Resumo Global = fonte oficial. Não exige remoção do PDF v2 rowFita |
| RES-03 | Drivers aparecem no respectivo ambiente, não apenas em bloco global | PDF já não tem bloco global de drivers (confirmado em v2.ts — sem `blocoResumoDrivers`). O problema é só na tela: bloco L755-802 deve se tornar colapsável e secundário |
| RES-05 | Sistema avisa quando peça ficou sem lâmpada/item esperado ao avançar | Regra #24 em AmbienteCard.tsx:105 já implementa a detecção por regex. Gate deve reutilizar esse predicado em `handleNext` |
</phase_requirements>

---

## Standard Stack

### Core (já presente no projeto — sem instalação)

| Library | Version | Purpose | Confirmed |
|---------|---------|---------|-----------|
| React 18 + TypeScript | 18.3.1 | UI + tipos | VERIFIED: package.json |
| shadcn-ui Collapsible | já instalado | Colapso do bloco global de drivers (D-11) | VERIFIED: src/components/ui/collapsible.tsx |
| shadcn-ui AlertDialog | já instalado | Dialog advisory RES-05 (padrão usado em DriveExplorer) | VERIFIED: src/components/DriveExplorer.tsx:27-34 |
| shadcn-ui Dialog | já instalado | Alternativa ao AlertDialog para o advisory | VERIFIED: src/components/ui/ |
| sonner (toast) | 1.7.4 | Notificações; padrão já usado no gate do Step 2 | VERIFIED: package.json |

**Instalação:** nenhuma dependência nova é necessária. Todos os componentes UI já existem.

---

## Architecture Patterns

### GrupoFita — extensão aditiva (D-06/D-08)

**Achado crítico:** `GrupoFita` é um tipo **computado em tempo de execução** — não entra em `orcamentos.ambientes` (que armazena apenas `Ambiente[]` como JSON). Estender `GrupoFita` com novos campos opcionais é zero-risco para snapshots antigos e para o PDF v1/v2.

[VERIFIED: src/types/orcamento.ts:368, src/components/Step3Revisao.tsx:129]

```typescript
// Extensão aditiva proposta para GrupoFita (src/types/orcamento.ts:368)
// Campos novos: localBreakdown e imagemUrl — ambos opcionais para backward-compat

export interface LocalBreakdown {
  /** Identificador: "Ambiente — Local" (com local) OU "Ambiente" (sem local) */
  label: string;
  demanda: number;
}

export interface GrupoFita {
  codigo: string;
  descricao: string;
  demandaTotal: number;
  metragemRolo: 5 | 10 | 15;
  precoUnitario: number;
  precoMinimo: number;
  rolos: { tamanho: number; quantidade: number }[];
  qtdRolosTotal: number;
  subtotal: number;
  /** NOVO (Phase 17 / RES-01 D-04/D-05): breakdown por "Ambiente — Local" */
  localBreakdown?: LocalBreakdown[];
  /** NOVO (Phase 17 / RES-01 D-08): URL da imagem/thumbnail da fita */
  imagemUrl?: string;
}
```

**calcularRolosPorGrupo precisa de `ambientes: Ambiente[]` com `amb.nome`** — já tem, o argumento é exatamente `Ambiente[]`. O loop interno já itera `amb.sistemas` mas não usa `amb.nome`. Adicionar `amb.nome` ao contexto interno do loop é a única mudança no algoritmo.

[VERIFIED: src/types/orcamento.ts:380-441]

```typescript
// Trecho do loop interno que precisa ser estendido (src/types/orcamento.ts:383-400)
// Hoje: só accumula demanda por codigo de fita
// Novo: também acumula por label "Ambiente — Local"

// Label (D-05):
const label = (sis.local && sis.local.trim())
  ? `${amb.nome} — ${sis.local.trim()}`
  : amb.nome;

// No bloco existing/new do Map: acumular em breakdownAcc
```

### Step3Revisao — três mudanças distintas

**Mudança 1: Resumo Global de Fitas — coluna LOCAL (L712-753)**

A tabela atual tem colunas: Código | Descrição | Demanda (m) | Rolos Sugeridos | Preço Un. | Subtotal.

A coluna LOCAL breakdown entra como linha(s) expandida(s) abaixo da linha principal, OU como um cell expandido na coluna Descrição. Recomendação (Claude's Discretion): expandir a célula de Descrição com o breakdown como texto secundário em `text-muted-foreground`, evitando adicionar coluna e quebrar o layout em mobile.

**Mudança 2: Fita inline no card do ambiente — rótulo referência (L638-656)**

Hoje: `<TableCell className="text-right text-xs text-muted-foreground italic">Global →</TableCell>` em L655.

Novo rótulo: "Incluída no Resumo de Fitas" (ou variante mais curta). Manter a célula como text-muted-foreground italic — só mudar o texto.

[VERIFIED: src/components/Step3Revisao.tsx:655]

**Mudança 3: Resumo Global de Drivers — colapso (L755-802)**

O `<Collapsible>` de shadcn-ui (já instalado, src/components/ui/collapsible.tsx) é o mecanismo correto. O header do bloco (hoje L757-761) vira `<CollapsibleTrigger>`. O conteúdo (tabela) vira `<CollapsibleContent>`.

Estado inicial: recolhido (`defaultOpen={false}`). Label do trigger: "Análise de Otimização de Drivers" + badge secundário "interno", com ícone ChevronDown/Up.

[VERIFIED: src/components/ui/collapsible.tsx, src/components/Step3Revisao.tsx:755-802]

### blocoResumoFitas do PDF v2 — foto + LOCAL (v2.ts:265-296)

**Foto:** o helper `thumb(url)` já existe em `v2.ts:65`. O `blocoResumoFitas` hoje usa `<div class="thumb-empty"></div>` explícito em L275. Substituir pelo `thumb(g.imagemUrl)` quando `imagemUrl` está presente em `GrupoFita`.

[VERIFIED: src/lib/pdfTemplates/v2.ts:65, 275]

**LOCAL breakdown:** cada row de fita no Resumo deve expandir os chips para mostrar as localBreakdowns. Exemplo de chip extra: `chip("Sala — Sanca · 12m")` para cada entrada em `g.localBreakdown`. Inserir após o chip de demanda total.

**Constraint:** não tocar `rowFita` (D-07). A fita inline por sistema fica como está no PDF.

### Gate Step 2 — advisory RES-05 (D-12 a D-16)

**Ponto de inserção:** `Step2Ambientes.tsx:handleNext` — após as checagens Phase 16 (CALC-01 bloqueio + remoção de vazios), antes de `onNext()`.

[VERIFIED: src/components/Step2Ambientes.tsx:34-83]

**Fluxo atual do gate (após Phase 16):**
```
handleNext:
  1. ambientes.length === 0 → toast.error, return           [bloqueio]
  2. CALC-01: sistemas inválidos → toast.error, return       [bloqueio]
  3. D-06: sistemas vazios → remove + toast.info            [remoção, não bloqueia]
  4. onNext()
```

**Novo fluxo com RES-05 (D-16):**
```
handleNext:
  1. ambientes.length === 0 → toast.error, return           [bloqueio - sem mudança]
  2. CALC-01: sistemas inválidos → toast.error, return       [bloqueio - sem mudança]
  3. D-06: sistemas vazios → remove + toast.info            [remoção - sem mudança]
  4. RES-05: detectar itens incompletos → se há, mostrar
             modal advisory com lista; aguardar "Continuar"
             ou "Revisar"; se "Continuar" → onNext()
  5. onNext()  (se sem alertas, segue direto)
```

**Mecanismo de UI para o advisory:** `AlertDialog` (shadcn-ui, já usado em DriveExplorer.tsx). O `AlertDialog` tem dois botões nativos: `AlertDialogCancel` ("Revisar") e `AlertDialogAction` ("Continuar mesmo assim"). Não requer `useState` extra além de `open: boolean`.

---

## D-15 CHECKPOINT — Regra de detecção "peça sem lâmpada"

**Este é o item mais sensível da fase. Investigação realizada com base no código real.**

### O que existe no codebase

**Regra #24 em AmbienteCard.tsx:104-108 [VERIFIED]:**
```typescript
// ── REGRA #24: Spot sem LED integrado → lâmpada separada ──
const temBaseLampada = /\b(GU10|E27|MR11|MR16|AR70|AR111|PAR20|PAR30|DICROICA|DICRO)\b/.test(d);
const temLedIntegrado = /LED\s+INTEGRADO|COM\s+LED/.test(d);
if (temBaseLampada && !temLedIntegrado) {
  toast.info(`💡 Este produto não possui LED integrado — lembre-se de incluir a lâmpada separadamente no orçamento.`, { duration: 8000 });
}
```

Esta regra é aplicada ao `produto.descricao` no momento em que o colaborador seleciona uma luminária. Ela já é a lógica de negócio oficial para "esta peça espera lâmpada".

**Tabela `vinculos_spot_lampada` [VERIFIED: src/integrations/supabase/types.ts:700-754]:**

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `codigo_spot` | string | Código do spot/peça |
| `codigo_lampada` | string | Código da lâmpada correspondente |
| `led_integrado` | boolean | Se tem LED integrado (= não precisa lâmpada) |
| `tipo_lampada` | string? | Tipo da lâmpada esperada |

Esta tabela mapeia spots para lâmpadas. Um spot com `led_integrado = false` nesta tabela "espera lâmpada". Porém: a tabela requer uma query assíncrona ao Supabase — o gate do Step 2 é síncrono por natureza.

### Dois caminhos possíveis para D-15

**Caminho A (RECOMENDADO): Regex puro — mesmo predicado da Regra #24**

Aplicar o mesmo teste regex à `descricao` de cada `ItemLuminaria` nas `luminarias[]` do ambiente:

```typescript
// Predicado derivado da Regra #24 (AmbienteCard.tsx:105-106)
function luminariaPrecisaLampada(lum: ItemLuminaria): boolean {
  const d = lum.descricao.toUpperCase();
  const temBaseLampada = /\b(GU10|E27|MR11|MR16|AR70|AR111|PAR20|PAR30|DICROICA|DICRO)\b/.test(d);
  const temLedIntegrado = /LED\s+INTEGRADO|COM\s+LED/.test(d);
  return temBaseLampada && !temLedIntegrado;
}

// No gate: para cada ambiente, verificar se alguma luminária que "espera lâmpada"
// não tem uma outra luminária de tipo 'lampada' no mesmo ambiente
function ambientePrecisaLampada(amb: Ambiente): ItemLuminaria[] {
  const candidatos = amb.luminarias.filter(luminariaPrecisaLampada);
  if (!candidatos.length) return [];
  const temLampada = amb.luminarias.some(l => /\b(lampada|lâmpada)\b/i.test(l.descricao) || l.tipo_produto === 'lampada');
  return temLampada ? [] : candidatos;
}
```

**Prós:** completamente síncrono, reutiliza lógica já testada pela Regra #24, sem query adicional ao Supabase no momento crítico do gate.

**Contras:** regex pode ser incompleto — depende da descrição do produto estar padronizada. Não captura casos onde a base não aparece no nome (ex: produto novo com formato diferente).

**Caminho B: `vinculos_spot_lampada` — query assíncrona**

Fazer query para verificar se algum `codigo` de `luminarias[]` do orçamento está em `vinculos_spot_lampada` com `led_integrado = false` e sem a lâmpada correspondente no mesmo ambiente.

**Prós:** dado estruturado, mais confiável a longo prazo.

**Contras:** exige tornar `handleNext` assíncrono (atualmente síncrono), adicionar loading state, e a tabela pode não ter todos os produtos mapeados (cobertura incerta).

### Recomendação para D-15

**Usar Caminho A (regex) como implementação principal.** Razões:

1. É exatamente o mesmo predicado que o sistema já usa (Regra #24) — consistência total.
2. O gate do Step 2 permanece síncrono.
3. O aviso RES-05 é advisory/não-bloqueante — falsos negativos são aceitáveis (o colaborador viu o toast da Regra #24 no momento da seleção).
4. O colaborador que esqueceu a lâmpada provavelmente já viu o aviso inline; o advisory no gate é uma segunda camada de segurança, não a única.

**Verificação adicional no ambiente:** além de detectar "peça que espera lâmpada", verificar se há algum item com `tipo_produto = 'lampada'` ou descricao matching `/lâmpada|lampada/i` no mesmo `Ambiente.luminarias[]` — se já tem, não avisar.

**[ASSUMED]:** A cobertura do regex para `temBaseLampada` é suficiente para a maioria dos produtos do catálogo Luminatti. Se existirem produtos com base de lâmpada cuja descrição não segue o padrão `GU10|E27|...`, eles serão falsos negativos (não avisados). Risco: baixo, dado que o advisory é não-bloqueante.

---

## Don't Hand-Roll

| Problema | Não construir | Usar em vez disso | Por que |
|----------|--------------|-------------------|---------|
| Dialog advisory com dois botões (Revisar / Continuar) | Dialog customizado | `AlertDialog` do shadcn-ui (DriveExplorer.tsx:27-34) | Já instalado, acessível, pattern estabelecido |
| Colapso do bloco de drivers | accordion manual | `Collapsible` do shadcn-ui (src/components/ui/collapsible.tsx) | Já instalado |
| Thumbnail no PDF | `<img>` com fallback manual | `thumb()` helper em v2.ts:65 | Já existe e tem fallback para URL ausente |
| Agrupamento por LOCAL | nova estrutura de dados | Estender `calcularRolosPorGrupo` — mesmo padrão de `agruparPorLocal` em v2.ts:71 | Reutilizar o Map pattern já estabelecido |

---

## Common Pitfalls

### Pitfall 1: Serialização de GrupoFita

**O que vai errado:** Assumir que `GrupoFita` precisa ser extensão retrocompatível no banco.
**Por que acontece:** Confundir o tipo computado com dado persistido.
**Como evitar:** `GrupoFita` nunca entra em `orcamentos.ambientes`. Apenas `Ambiente[]` é serializado. A extensão é zero-risco para snapshots antigos.
**Confirmação:** `src/integrations/supabase/types.ts:351` — campo `ambientes: Json` armazena `Ambiente[]`, não `GrupoFita[]`.

### Pitfall 2: Quebrar rowFita no PDF v2

**O que vai errado:** Alterar a função `rowFita` (v2.ts:127) para mostrar LOCAL ou foto no lugar errado.
**Por que acontece:** Confundir `rowFita` (fita inline por sistema) com `blocoResumoFitas` (resumo de compra).
**Como evitar:** Só tocar `blocoResumoFitas` (v2.ts:265). `rowFita` permanece intocado (D-07).

### Pitfall 3: handleNext assíncrono sem feedback visual

**O que vai errado:** Tornar `handleNext` assíncrono para query de `vinculos_spot_lampada` sem estado de loading, causando duplo clique ou UI travada.
**Por que acontece:** Gate atualmente é síncrono — adicionar async muda o contrato.
**Como evitar:** Usar Caminho A (regex síncrono) para D-15. Evita o problema completamente.

### Pitfall 4: Local breakdown com ambientes de mesmo nome

**O que vai errado:** Dois ambientes chamados "Sala" com Sanca gerarem label "Sala — Sanca" duplicado no breakdown.
**Por que acontece:** `amb.nome` não é único globalmente.
**Como evitar:** O breakdown é display-only — itens com mesmo label são somados ou listados separados. Decisão: listar separados (preserva contexto). Não é necessário UUID no label — o colaborador sabe que há duas Salas.

### Pitfall 5: Ordem de severidades no gate (D-16)

**O que vai errado:** Mostrar o advisory RES-05 antes de detectar/remover sistemas vazios, fazendo o aviso citar sistemas que serão removidos.
**Por que acontece:** Advisory inserido antes da lógica de remoção de vazios.
**Como evitar:** Ordem estrita: (1) bloqueio metragem → (2) remoção de vazios → (3) advisory RES-05. O advisory opera sobre os `ambientesLimpos` (pós-remoção de vazios).

### Pitfall 6: imagemUrl ausente em fitas de orçamentos antigos

**O que vai errado:** `thumb()` no PDF quebra em orçamentos antigos onde `sis.fita.imagemUrl` não estava preenchido.
**Por que acontece:** Campo `imagemUrl` em `ItemFitaLED` é opcional (`imagemUrl?: string`).
**Como evitar:** `thumb()` já tem fallback para URL ausente: `if (!url) return '<div class="thumb-empty"></div>'`. Passar `g.imagemUrl` — se undefined, `thumb()` renderiza o placeholder. Nenhuma guard adicional necessária.
**Verificação:** `src/lib/pdfTemplates/v2.ts:65-68` — thumb() já lida com undefined.

---

## Code Examples

### calcularRolosPorGrupo — estrutura interna com breakdown

[VERIFIED: src/types/orcamento.ts:380-441, padrão de Map preserva ordem de inserção]

```typescript
// Estrutura interna do Map a estender (orcamento.ts:381)
// Hoje:
const grupos = new Map<string, {
  descricao: string;
  demanda: number;
  metragemRolo: 5 | 10 | 15;
  precoUnitario: number;
  precoMinimo: number;
}>();

// Após extensão (Phase 17):
const grupos = new Map<string, {
  descricao: string;
  demanda: number;
  metragemRolo: 5 | 10 | 15;
  precoUnitario: number;
  precoMinimo: number;
  imagemUrl?: string;
  localAcc: Map<string, number>; // label → demanda
}>();

// No loop (orcamento.ts:383-401), adicionar:
for (const amb of ambientes) {
  for (const sis of amb.sistemas) {
    const key = sis.fita.codigo;
    if (!key) continue;
    const demanda = calcularDemandaFita(sis);
    const label = (sis.local && sis.local.trim())
      ? `${amb.nome} — ${sis.local.trim()}`
      : amb.nome;
    const existing = grupos.get(key);
    if (existing) {
      existing.demanda += demanda;
      existing.localAcc.set(label, (existing.localAcc.get(label) ?? 0) + demanda);
    } else {
      const localAcc = new Map([[label, demanda]]);
      grupos.set(key, {
        descricao: sis.fita.descricao,
        demanda,
        metragemRolo: sis.fita.metragemRolo,
        precoUnitario: sis.fita.precoUnitario,
        precoMinimo: sis.fita.precoMinimo,
        imagemUrl: sis.fita.imagemUrl,
        localAcc,
      });
    }
  }
}

// Na geração do resultado, converter localAcc → localBreakdown array:
localBreakdown: Array.from(g.localAcc.entries()).map(([label, demanda]) => ({ label, demanda })),
imagemUrl: g.imagemUrl,
```

### Step3Revisao — Collapsible para bloco de drivers

[VERIFIED: src/components/ui/collapsible.tsx, padrão Radix UI]

```tsx
// Substituir o div wrapper atual (Step3Revisao.tsx:755-802):
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";

{resumoDrivers.length > 0 && (
  <Collapsible defaultOpen={false}>
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <CollapsibleTrigger className="w-full text-left">
        <div className="bg-muted/50 px-5 py-3 border-b flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground">
              Análise de Otimização de Drivers
              <Badge variant="outline" className="ml-2 text-xs">interno</Badge>
            </h3>
            <p className="text-xs text-muted-foreground">Não incluído no PDF do cliente</p>
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        {/* tabela atual de resumoDrivers — sem mudanças no conteúdo */}
      </CollapsibleContent>
    </div>
  </Collapsible>
)}
```

### Step3Revisao — linha de fita inline com rótulo referência

[VERIFIED: Step3Revisao.tsx:655 — hoje é "Global →"]

```tsx
// Linha 655 hoje:
<TableCell className="text-right text-xs text-muted-foreground italic">Global →</TableCell>

// Após mudança (D-01):
<TableCell className="text-right text-xs text-muted-foreground italic">
  ↗ Resumo de Fitas
</TableCell>
```

### Advisory RES-05 — AlertDialog no gate do Step 2

[VERIFIED: DriveExplorer.tsx:566-579 — padrão AlertDialog já em uso]

```tsx
// Em Step2Ambientes.tsx — adicionar estado e AlertDialog:
const [advisoryItems, setAdvisoryItems] = useState<AdvisoryItem[]>([]);
const [advisoryOpen, setAdvisoryOpen] = useState(false);

interface AdvisoryItem {
  ambienteNome: string;
  tipo: 'fita-sem-driver' | 'driver-sem-fita' | 'perfil-sem-fita' | 'peca-sem-lampada';
  descricao: string;
}

// Na função handleNext, após remoção de vazios:
const itensIncompletos: AdvisoryItem[] = [];

for (const amb of ambientesLimpos) {
  for (const sis of amb.sistemas) {
    if (sis.fita.codigo && !sis.driver.codigo) {
      itensIncompletos.push({ ambienteNome: amb.nome, tipo: 'fita-sem-driver', descricao: sis.fita.descricao });
    }
    if (sis.driver.codigo && !sis.fita.codigo) {
      itensIncompletos.push({ ambienteNome: amb.nome, tipo: 'driver-sem-fita', descricao: sis.driver.descricao });
    }
    if (sis.perfil && !sis.fita.codigo) {
      itensIncompletos.push({ ambienteNome: amb.nome, tipo: 'perfil-sem-fita', descricao: sis.perfil.descricao });
    }
  }
  for (const lum of amb.luminarias) {
    if (luminariaPrecisaLampada(lum) && !ambienteTemLampada(amb)) {
      itensIncompletos.push({ ambienteNome: amb.nome, tipo: 'peca-sem-lampada', descricao: lum.descricao });
    }
  }
}

if (itensIncompletos.length > 0) {
  setAdvisoryItems(itensIncompletos);
  setAdvisoryOpen(true);
  return; // aguarda decisão do usuário no AlertDialog
}

onNext();

// No AlertDialog:
// AlertDialogCancel → "Revisar" (fecha, volta ao Step 2)
// AlertDialogAction → "Continuar mesmo assim" → onNext()
```

### blocoResumoFitas no PDF v2 — foto + LOCAL

[VERIFIED: src/lib/pdfTemplates/v2.ts:265-296, thumb() em v2.ts:65]

```typescript
// Em blocoResumoFitas (v2.ts:270-285), substituir a row de cada grupo:
const rows = grupos.map(g => {
  const rolosStr = g.rolos.map(r => `${r.quantidade}×${r.tamanho}m`).join(" + ");
  
  // LOCAL breakdown chips (RES-01):
  const localChips = (g.localBreakdown ?? [])
    .map(lb => chip(`${esc(lb.label)} · ${lb.demanda}m`))
    .join("");
  
  const chipsHtml = [
    chip(`${g.demandaTotal}m demanda`, "orange"),
    chip(rolosStr),
    chip(`${g.qtdRolosTotal} rolos`),
    localChips,
  ].filter(Boolean).join("");
  
  return `
    <tr class="item-row">
      <td class="thumb-cell">${thumb(g.imagemUrl)}</td>  <!-- D-08: foto da fita -->
      <td class="desc-cell">
        <div class="desc-name">${esc(g.descricao)}</div>
        <div class="chips">${chipsHtml}</div>
      </td>
      ...
    </tr>`;
});
```

---

## State of the Art

| Elemento | Estado atual | Estado após Phase 17 | Impacto |
|----------|-------------|----------------------|---------|
| `GrupoFita` | 8 campos, sem LOCAL, sem imagemUrl | +`localBreakdown?` +`imagemUrl?` (aditivo) | Tela e PDF propagam LOCAL automaticamente |
| Fita inline no card (Step3:655) | "Global →" | "↗ Resumo de Fitas" | Dedup UAT #17 resolvido |
| Bloco Global de Drivers (Step3:755) | Visualmente igual ao Resumo de Fitas — confunde | Collapsible, recolhido por padrão, rótulo "interno" | UAT #18 resolvido |
| blocoResumoFitas PDF (v2.ts:265) | `thumb-empty` fixo, sem LOCAL | `thumb(g.imagemUrl)`, chips de LOCAL | TODO 2026-06-10 folded |
| Gate Step2 handleNext | Bloqueio CALC-01 + remoção de vazios | +Advisory RES-05 (AlertDialog, não-bloqueante) | UAT #4 resolvido |

---

## Runtime State Inventory

Step 3.5 (rename/refactor check): fase não é rename — omitido.

---

## Environment Availability

Fase é código front-end puro (TypeScript/React). Sem dependências externas além do stack já em uso.

| Dependência | Requerida por | Disponível | Fallback |
|-------------|--------------|-----------|----------|
| Node.js + npm | build/dev | Sim (projeto em uso) | — |
| Supabase (banco) | Advisory D-15 caminho B | Sim | Usar Caminho A (regex) — recomendado |
| shadcn-ui Collapsible | Bloco drivers (D-11) | Sim (src/components/ui/collapsible.tsx) | — |
| shadcn-ui AlertDialog | Advisory RES-05 | Sim (DriveExplorer.tsx) | Dialog simples |

**Nenhuma dependência faltante.**

---

## Assumptions Log

| # | Claim | Section | Risk se errado |
|---|-------|---------|----------------|
| A1 | Regex `GU10\|E27\|MR11\|...\|DICRO` cobre a maioria dos produtos do catálogo Luminatti que "esperam lâmpada" | D-15 Checkpoint | Falsos negativos (peças não detectadas) — aceitável pois o advisory é não-bloqueante e a Regra #24 já existia com o mesmo regex |
| A2 | Todos os spots que "esperam lâmpada" têm a base no campo `descricao` do produto | D-15 Checkpoint | Como A1 — impacto baixo dado o caráter advisory |
| A3 | A verificação de "ambiente já tem lâmpada" por `/lâmpada\|lampada/i` em `lum.descricao` ou `tipo_produto === 'lampada'` é suficiente para suprimir o aviso | Advisory RES-05 | Pode suprimir aviso em caso de lâmpada para outro spot — aceitável dado que o advisory é não-bloqueante |

---

## Open Questions

1. **"Prosseguiu mesmo assim" — registro visual**
   - O que sabemos: D-13 pede que o colaborador veja claramente que avançou com itens incompletos.
   - O que está indefinido: se esse registro deve aparecer no Step 3 (ex: badge/aviso persistente no topo) ou se o AlertDialog "Continuar" já é suficiente.
   - Recomendação: o AlertDialog confirmatório já atende D-13. Um badge opcional no Step 3 ("Avançou com X item(ns) incompleto(s)") pode ser adicionado se o usuário quiser visibilidade extra — marcar como Claude's Discretion.

2. **LOCAL breakdown — coluna nova vs expansão da célula Descrição**
   - O que sabemos: adicionar coluna quebra o layout em mobile; expandir a célula Descrição é mais seguro.
   - O que está indefinido: tolerância visual do usuário para o breakdown inline na célula.
   - Recomendação: expandir a célula Descrição (chips `text-xs text-muted-foreground` abaixo da descrição principal). Claude's Discretion conforme CONTEXT.md.

3. **Verificação de `luminariaPrecisaLampada` — suprimir por ambiente ou por luminária?**
   - Se um ambiente tem 2 spots GU10 e 1 lâmpada GU10 → avisar pelos 2 spots ou suprimir por "tem lâmpada no ambiente"?
   - Recomendação: suprimir por ambiente (se `amb.luminarias` tem qualquer item que parece ser lâmpada, não avisar). Mais conservador, menos ruído.

---

## Sources

### Primary (HIGH confidence)
- `src/types/orcamento.ts` — tipos `GrupoFita`, `SistemaIluminacao`, `Ambiente`; funções `calcularRolosPorGrupo`, `calcularDriversPorProjeto`
- `src/components/Step3Revisao.tsx` — L655 (fita inline "Global →"), L712-753 (Resumo Global Fitas), L755-802 (Resumo Global Drivers)
- `src/lib/pdfTemplates/v2.ts` — L65 `thumb()`, L71 `agruparPorLocal`, L89 `isSistemaVazio`, L265 `blocoResumoFitas`, L127 `rowFita`
- `src/components/Step2Ambientes.tsx` — `handleNext` L34-83 (gate atual após Phase 16)
- `src/components/AmbienteCard.tsx:104-108` — Regra #24, predicado `temBaseLampada`
- `src/integrations/supabase/types.ts:700-754` — tabela `vinculos_spot_lampada`
- `src/components/ui/collapsible.tsx` — Collapsible disponível
- `src/components/DriveExplorer.tsx:27-34, 566-579` — padrão AlertDialog em uso
- `.planning/phases/17-resumo-apresenta-o/17-CONTEXT.md` — todas as decisões D-01..D-16

### Secondary (MEDIUM confidence)
- `.planning/phases/15-tens-o-valida-o/15-CONTEXT.md` — D-08 grouping key codigo+voltagem (Phase 15, confirmado implementado)
- `.planning/phases/16-c-lculo-metragem/16-CONTEXT.md` — gate Step 2 D-01..D-16, `isSistemaVazio`
- `.planning/STATE.md` — nota M-1 "RES-02 fix não pode tocar rowFita em pdfTemplates/v2.ts — code paths separados"

---

## Metadata

**Confidence breakdown:**
- GrupoFita extension: HIGH — tipo verificado como computed-only, nunca serializado
- Step3Revisao changes: HIGH — lines verified in source
- PDF v2 blocoResumoFitas: HIGH — thumb() helper confirmed present
- D-15 lamp detection: MEDIUM — regex verified in AmbienteCard, coverage [ASSUMED]
- Advisory AlertDialog pattern: HIGH — pattern confirmed in DriveExplorer

**Research date:** 2026-06-11
**Valid until:** 2026-07-11 (stack estável)
