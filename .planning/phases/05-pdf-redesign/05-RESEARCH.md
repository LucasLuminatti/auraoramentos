---
phase: 05
slug: pdf-redesign
created: 2026-05-07
type: research
domain: client-side PDF generation (html2pdf.js + html2canvas + jsPDF)
confidence: HIGH
---

# Phase 5 — PDF Redesign — Research

**Researched:** 2026-05-07
**Domain:** PDF gerado client-side (html2pdf.js → html2canvas rasteriza HTML → jsPDF embute como imagem)
**Confidence:** HIGH em itens técnicos verificados; MEDIUM em recomendações de design (subjetivas)

## Summary

O PDF da AURA é gerado **client-side** rasterizando um `<div>` HTML offscreen via `html2canvas` (scale 2) e empacotando o canvas resultante em A4 via `jsPDF`. Toda a estética que aparece no documento final tem que sobreviver a esse pipeline — nada de SVG vivo, nada de fonte que carrega "talvez", nada de quebra de página dependente de JS de impressão.

Três riscos técnicos importam mais que o resto:

1. **Fontes via Google Fonts CDN são frágeis** com html2canvas — o template atual já usa esse padrão e isso é parte do motivo do PDF estar inconsistente. Embedar Playfair + Inter via `@fontsource` + esperar `document.fonts.ready` é o caminho seguro.
2. **`pagebreak.mode: ["avoid-all", "css", "legacy"]`** (config atual) é hostil a uma tabela longa — empurra o bloco inteiro pra próxima página e em docs longos chega a falhar. Precisa virar `["css", "legacy"]` + classes utilitárias `html2pdf__page-break-before/avoid` em pontos cirúrgicos (ex: header de Ambiente).
3. **html2canvas captura o que está pintado** — qualquer imagem com CORS quebrado vira espaço em branco sem aviso. Thumbnails de produto (40×40) precisam vir já em base64 ou de uma origem com `useCORS: true` confiável (mesma rota dos signed URLs do Drive já em produção).

**Primary recommendation:** Criar `src/lib/pdfTemplates/v2.ts` com novo HTML/CSS editorial; manter `gerarPdfHtml.ts` como router que dispatcha v1 vs v2 baseado em `pdf_template_version` no orçamento (default `2` para novos, `1` quando ausente em snapshots antigos). Embedar fontes via `@fontsource`. Adicionar `local` (text, opcional) em `SistemaIluminacao` no snapshot — sem migration de schema, porque `ambientes` é jsonb. Pre-converter thumbnails para base64 antes de `html2pdf()` (mesmo padrão do `imageToBase64` da logo já existente).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Área A — Direção visual + tipografia**

| Item | Decisão | Notas |
|---|---|---|
| Estilo de referência | **Editorial / Apple-like** | Hierarquia tipográfica forte, contraste de tamanho, respiro generoso, peso de fonte como hierarquia |
| Paleta | **Neutro + laranja Luminatti como acento** | Preto/branco/cinza dominante; laranja `#E68601` em detalhes (linha header, total, badges). Identidade preservada |
| Tipografia | **Playfair Display (títulos) + Inter (corpo)** | Serif elegante nos títulos, sans-serif moderna no corpo. Vibe editorial/premium, contraste forte |
| Hierarquia | **5 níveis efetivos** | Doc → Ambiente → Local/sub-ambiente → Sistema → Componentes |

**Área B — Estrutura de tabelas e itens**

| Item | Decisão | Notas |
|---|---|---|
| Layout dos itens | **Híbrido (tabela + chips)** | Tabela enxuta + chips/badges abaixo de cada linha pra specs (W, V, IP etc) |
| Imagens | **Thumbnail por item (40×40 ou 60×60)** | Cada item com foto pequena à esquerda. Lenny aceita custo de PDF mais pesado |
| Colunas essenciais | Quantidade + unidade • Potência (W) e tensão (V) • Preço unitário • Código/SKU | 4 campos não-negociáveis por item |
| Agrupamento de sistemas | **Estrutura aninhada hierárquica explícita** | Ambiente (SALA) → Local (Sanca, Rasgo) → Sistema 1, 2… → Fita / Driver / Perfil |

**Compat**

- html2pdf.js continua como pipeline (não trocar lib).
- Schema só pode mudar de forma aditiva (jsonb dentro de `orcamentos.ambientes` aceita campos novos sem migration; tabelas relacionais não estão envolvidas).
- Snapshots antigos têm que continuar renderizando — estratégia: `pdf_template_version` (default `2` em novos, `1` para snapshots sem o campo).

### Claude's Discretion

| Área | Liberdade do planner |
|---|---|
| **C — Bloco de texto final** | Substituir as 4 caixas (Prazo / Garantia / Pagamento / Observações) por bloco de texto contínuo formatado. Definir tom, tamanho, ordem. |
| **D — TOTAL GERAL e refs visuais finais** | Card mantido ou redesenhado, posição, uso do laranja. |
| **Persistência do "Local"** | Opção entre adicionar campo `local` em `SistemaIluminacao` (recomendação preliminar do CONTEXT) vs. reusar nome do sistema vs. derivar UI-only. |
| **Empacotamento de fontes** | `@fontsource` (bundle) vs CDN vs system fallback — recomendação do RESEARCH abaixo é `@fontsource`. |

### Deferred Ideas (OUT OF SCOPE)

- Trocar `html2pdf.js` por outro pipeline (react-pdf, jspdf+autotable, server-side via Puppeteer). Levantado no todo `2026-05-06-pdf-orcamento-estetica-ruim.md` como possibilidade futura, **não nesta fase**.
- Validação completa de UAT em prod (vai junto com Phase 6 — WRAP-01).
- Refatoração dos cálculos que alimentam o PDF (Marco 3, CALC-01..03).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PDF-01 | Layout tipográfico limpo, não estilo print HTML | Ver `## Architecture Patterns` (estrutura editorial), `## Standard Stack` (Playfair + Inter + @fontsource), `## Code Examples` (tipografia em CSS). |
| PDF-02 | TOTAL GERAL card mantido ou redesenhado (não eliminado) | Ver `## Architecture Patterns` → padrão "card editorial" + recomendação default Área D. |
| PDF-03 | Remover as 4 caixas | Trivial — basta não emitir o bloco `.info-grid` em `gerarPdfHtml.ts:334-352`. |
| PDF-04 | Conteúdo das 4 caixas vira bloco de texto formatado | Ver `## Architecture Patterns` → padrão "prose block" + default Área C abaixo. |
| PDF-05 | Snapshot antigo continua renderizando | Ver `## Architecture Patterns` → estratégia `pdf_template_version` (router v1/v2) e `## Code Examples` → router pattern. |
</phase_requirements>

## Standard Stack

### Core (já em produção)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `html2pdf.js` | 0.14.0 | Wrapper que orquestra html2canvas → jsPDF | [VERIFIED: npm view 2026-01-12] É a versão mais recente. Já em produção. Decisão de manter está locked. |
| `html2canvas` (transitivo) | dep de html2pdf.js | Rasteriza HTML em canvas | [VERIFIED: package-lock.json] Engine de render real — é onde os bugs de fonte/imagem moram. |
| `jsPDF` (transitivo) | dep de html2pdf.js | Empacota canvas em PDF A4 | [VERIFIED] Saída final é uma imagem dentro de um PDF — não há texto selecionável. |

### Recomendação para Phase 5
| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| `@fontsource/inter` | 5.2.8 | Inter via npm bundle | [VERIFIED: npm view 2026-05-07] Embeda fonte no bundle Vite, evita race com Google CDN dentro de html2canvas. |
| `@fontsource/playfair-display` | 5.2.8 | Playfair Display via npm bundle | [VERIFIED: npm view 2026-05-07] Mesmo motivo. Ambos pacotes mantidos pela Fontsource (ex-Fontsource-org). |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@fontsource/*` (bundle) | Google Fonts CDN `<link>` (atual) | [VERIFIED: GitHub issues #1666, #1940, #490 do html2canvas] CDN sofre de race condition: se a fonte não está no `document.fonts.ready` no momento que html2canvas dispara, o PDF sai com fallback (geralmente Times/Helvetica). É exatamente o que o template atual faz (linha 193 de `gerarPdfHtml.ts`). Não usar. |
| `@fontsource/*` (bundle) | Base64 inline `@font-face` em `<style>` | Funciona mas explode o HTML que o html2canvas precisa processar. `@fontsource` resolve via Vite e fica em chunk separado — melhor performance. |
| html2pdf.js | jspdf + jspdf-autotable (server-side ou client) | OUT OF SCOPE — locked decision do user é manter html2pdf.js. |
| html2pdf.js | Puppeteer / Chromium server-side | OUT OF SCOPE — exigiria edge function/server novo. CONTEXT diz "sem backend novo". |

**Installation:**

```bash
npm install @fontsource/inter @fontsource/playfair-display
```

**Version verification:** Ambos `@fontsource/inter` e `@fontsource/playfair-display` em `5.2.8` (npm view, 2026-05-07). `html2pdf.js@0.14.0` é a última publicada (modificada 2026-01-12). `html2pdf.js` não recebeu update significativo recentemente — tratado como software estável-que-não-mexe.

## Architecture Patterns

### Recommended Project Structure

```
src/lib/
├── gerarPdfHtml.ts           # Router: dispatch v1 vs v2 por pdf_template_version
└── pdfTemplates/
    ├── v1.ts                 # Template legacy (rename do conteúdo atual de gerarPdfHtml.ts)
    └── v2.ts                 # Novo template editorial (Phase 5)
```

`gerarPdfHtml.ts` mantém a mesma assinatura pública (`gerarOrcamentoHtml(params)`) — Step3Revisao e OrcamentoDetalhe não precisam mudar. A única mudança nos call sites é importar fontes globalmente em algum entry (provavelmente `src/main.tsx` ou um `src/lib/pdfFonts.ts` carregado por demanda).

### Pattern 1: Template Versioning (PDF-05 compat)

**What:** Cada orçamento ganha um campo `pdf_template_version: number` no snapshot (jsonb, sem migration). Default `2` em snapshots novos. Ausência ou `< 2` cai no template legacy.

**When to use:** Sempre que existem snapshots persistidos e o renderizador muda de forma incompatível com o snapshot antigo.

**Example:**

```typescript
// src/lib/gerarPdfHtml.ts (router)
import { gerarOrcamentoHtmlV1 } from "./pdfTemplates/v1";
import { gerarOrcamentoHtmlV2 } from "./pdfTemplates/v2";

export interface PdfParams {
  // ... campos existentes
  templateVersion?: number; // 1 = legacy, 2 = editorial. Default 2 em novos.
}

export function gerarOrcamentoHtml(params: PdfParams): string {
  const v = params.templateVersion ?? 2;
  if (v >= 2) return gerarOrcamentoHtmlV2(params);
  return gerarOrcamentoHtmlV1(params);
}
```

**Onde o version vem:** O snapshot persistido em `orcamentos.ambientes` (jsonb) **não tem** um wrapper hoje — é um array `Ambiente[]` direto (ver `migrations/20260416000001_orcamentos_ambientes_tipo.sql:6`). Duas opções:

a) **Coluna nova** `pdf_template_version int default 2` em `orcamentos` (migration aditiva, default safe — snapshots antigos pegam `2` mas se isso quebrar render, voltamos pra `1` via `coalesce(pdf_template_version, 1)`).

b) **Embutido no jsonb** — empacotar `ambientes` como `{ pdf_template_version: 2, ambientes: [...] }`. Quebra todas as queries que leem `orc.ambientes` esperando array (Step3Revisao linhas 198/205/219, OrcamentoDetalhe linha 172). **Não recomendado.**

**Recomendação:** Opção (a). Migration aditiva, query existing fica intocada, default `2` em novos rows, `coalesce(pdf_template_version, 1)` no leitor para tratar rows antigas como v1.

[Cited: `supabase/migrations/20260416000001_orcamentos_ambientes_tipo.sql`, `src/components/Step3Revisao.tsx:198`, `src/pages/OrcamentoDetalhe.tsx:172`]

### Pattern 2: Hierarquia 5-níveis com tipografia (PDF-01)

**What:** Em PDFs editoriais Apple-like, hierarquia vem de **escala + peso + cor + espaçamento**, não de bordas/caixas.

**Mapping para o domínio AURA:**

| Nível | Exemplo | Estilo recomendado |
|---|---|---|
| 1. Doc | "Proposta Comercial" | Playfair Display, 32px, weight 400, letter-spacing tight, cor `#1a1f2e` |
| 2. Ambiente | "SALA" | Inter, 11px, weight 700, letter-spacing 0.3em, uppercase, cor laranja `#E68601` + linha horizontal fina sob o texto |
| 3. Local | "Sanca" / "Rasgo" | Playfair Display italic, 18px, weight 400, cor cinza médio `#5a6475`, recuo de 12px |
| 4. Sistema | "Sistema 1" | Inter, 9px, weight 600, letter-spacing 0.18em, uppercase, cor cinza `#9aa3b0`, antes de cada bloco de componentes |
| 5. Componente (Fita / Driver / Perfil) | linha de tabela | Inter 12px regular, peso 400; código em chip pequeno |

**Anti-pattern:** repetir borda/caixa em cada nível. Editorial = ar entre níveis, não molduras.

### Pattern 3: Híbrido tabela + chips (Área B, locked)

**What:** Cada item é uma `<tr>` com colunas essenciais; specs secundárias (W, V, IP, voltagem) viram chips em uma linha imediatamente abaixo, dentro da mesma `<tr>` ou usando uma segunda `<tr>` "spec-row" sem borda superior.

**Why not tudo na mesma linha:** com 4 colunas obrigatórias (Qty/un, W+V, Preço un, SKU) + thumb + descrição + chips, a linha estoura. Quebrar em 2 linhas (uma de números, uma de chips) preserva escaneabilidade.

**Example:**

```html
<tr class="item-row">
  <td class="thumb"><img src="..." style="width:40px;height:40px;border-radius:6px"/></td>
  <td class="desc">
    <div class="desc-name">Fita LED 24V 14.4W/m IRC90</div>
    <div class="chips">
      <span class="chip">14.4W/m</span>
      <span class="chip">24V</span>
      <span class="chip">IP20</span>
      <span class="chip">IRC≥90</span>
    </div>
  </td>
  <td class="sku"><span class="code-tag">RV12345</span></td>
  <td class="qty">5×10m</td>
  <td class="price">R$ 1.250,00</td>
</tr>
```

CSS chip:

```css
.chip{display:inline-flex;align-items:center;font-family:Inter;font-size:9px;
  font-weight:500;letter-spacing:.04em;color:#5a6475;background:#f4f6f8;
  border-radius:10px;padding:2px 8px;margin:2px 4px 2px 0}
```

### Pattern 4: Bloco de texto contínuo (PDF-04, Área C — default)

**What:** As 4 caixas atuais viram um bloco "prose" no final do PDF, com headers em Playfair Display small-caps e parágrafos em Inter 11px line-height 1.65.

**Default proposto** (planner pode ajustar com Lenny):

```
┌─ TERMOS E CONDIÇÕES ─

Prazo de entrega
A consultar conforme disponibilidade de estoque. Pedidos confirmados após
aprovação da proposta.

Garantia
Produtos com garantia de fábrica de 1 ano conforme especificações do
fabricante. Aplicável ao funcionamento e desempenho — não ao efeito
luminotécnico desejado.

Condições de pagamento
A definir em negociação comercial.

Observações
Valores sujeitos a alteração sem aviso prévio. Proposta válida por 15 dias
a partir da data de emissão. Levando em consideração que a iluminação faz
parte da arte e tem aspecto decorativo e funcional simultâneos, gerando
variedade infinita de efeitos e usos, nossa proposta é uma sugestão
particular que deve ser validada com arquiteto ou especialista.
```

A `terms-section` atual (`gerarPdfHtml.ts:355-376`) já tem a maior parte desse texto em forma de lista bullet. Phase 5 pode reorganizar essa lista em parágrafos por tema, mantendo o conteúdo (Lenny não mencionou querer trocar palavras).

### Pattern 5: Total Geral redesenhado (PDF-02, Área D — default)

**What:** Manter o card destaque mas em estilo editorial:

- Fundo branco (não preto como hoje)
- Faixa laranja vertical sutil de 4px à esquerda (`#E68601`)
- Label "TOTAL GERAL" em Inter 9px uppercase tracking 0.3em cinza
- Valor em Playfair Display 36px weight 400, cor `#1a1f2e`
- Sem sombra pesada — máximo `box-shadow: 0 1px 0 #e8ecf0` (linha hairline inferior)
- Alinhado à direita, com 40px de margin-top em relação à última tabela

### Anti-Patterns to Avoid

- **Múltiplas borders aninhadas pra mostrar hierarquia:** já é o erro do template atual (`section-header` + `table-container` border + `info-card` border). Editorial = espaço, não molduras.
- **Emojis como ícones em headers** (📦 🛡 💳 📋 ⚡ no template atual): destoa de tipografia editorial. Usar lucide-react SVGs serializados ou — preferível — só tipografia.
- **Cores de fundo em headers** (azul/laranja sólidos): substituir por hairline rules e color-on-text.
- **Mistura de Outfit + Playfair** (template atual): trocar Outfit por Inter integralmente — Lenny pediu Inter no corpo.
- **`pagebreak.mode: ["avoid-all", ...]`** (config atual): força tabelas longas pra próxima página inteira. Trocar para `["css", "legacy"]` + classes utilitárias seletivas.

## Don't Hand-Roll

| Problema | Don't Build | Use Instead | Why |
|---|---|---|---|
| Aguardar fontes carregarem antes do html2canvas | Setar `setTimeout(..., 500)` antes de gerar | `await document.fonts.ready` | [Cited: html2canvas issues #1666 #1940] É a API web-standard, espera `@font-face` real, sem race. |
| Embutir thumbnail PNG no PDF | Inserir `<img src="https://supabase.../signed-url">` direto no HTML | Pre-converter para base64 com `imageToBase64()` (já existe no codebase) antes do `gerarOrcamentoHtml` | html2canvas + signed URL com expiração curta = espaço em branco silencioso. Logo já é convertido (Step3Revisao linhas 237-244) — replicar pra thumbnails. |
| Dimensionar página A4 manualmente | Calcular pixels de altura, dividir, etc. | `jsPDF: { unit: 'mm', format: 'a4' }` + classes CSS `html2pdf__page-break-before` | Lib já faz a divisão. Não tentar reimplementar. |
| Versionar template via if/else inline | Vários `if (orcamento.created_at < X)` espalhados | Campo explícito `pdf_template_version` + router em `gerarPdfHtml.ts` | Data de criação não é decisão de template — uma coluna `int` torna a regra explícita e auditável. |
| Marcar item de fita como "pertence ao Sistema X" via heurística | Parsear nome do sistema, comparar strings | Campo dedicado `local` no `SistemaIluminacao` (opcional) | Heurística vai falhar quando o usuário escrever "Sanca de Cima" vs "sanca de cima" — campo persistido elimina ambiguidade. |

**Key insight:** O ecossistema do html2pdf é frágil em duas áreas — fontes e imagens externas. Toda gambiarra que economiza linhas de código nessas áreas vira bug em produção. Pre-resolver tudo (fonte ready, imagem em base64) antes de chamar `html2pdf()` é regra de ouro.

## Common Pitfalls

### Pitfall 1: Google Fonts CDN race condition no html2canvas

**What goes wrong:** PDF sai renderizado com fallback (Helvetica/Times) em vez de Playfair/Inter. Aparece "às vezes" — em conexões rápidas funciona, em lentas falha.

**Why it happens:** [Cited: niklasvh/html2canvas#1666, #1940, #490] html2canvas snapshota o DOM antes do navegador terminar de baixar e aplicar a fonte. Como o canvas é uma imagem rasterizada, fallback congela ali — não tem como "atualizar" depois.

**How to avoid:**

1. Usar `@fontsource/*` (bundle Vite, fontes viram chunks locais — não passam pela rede).
2. Antes do `html2pdf()`, aguardar: `await document.fonts.ready`.
3. Como rede de segurança, fazer um pre-warm: criar um `<span>` invisível com cada fonte+peso usado uma vez no app load.

**Warning signs:** Texto sai com largura/spacing diferentes do que aparece no preview HTML; cliente reporta "PDF saiu com letra estranha"; problema acontece em prod (Vercel) e não em dev local.

### Pitfall 2: html2canvas + imagem com CORS quebrado = espaço em branco

**What goes wrong:** Thumbnail do produto não aparece. Não trava — deixa o `<td>` vazio sem erro visível.

**Why it happens:** [Cited: html2canvas docs] Para `useCORS: true` funcionar, o servidor da imagem precisa retornar `Access-Control-Allow-Origin`. Signed URL do Supabase Storage funciona, mas se a URL expira durante o processamento (TTL curto + delay do html2canvas), o canvas tainted falha silenciosamente.

**How to avoid:** Pre-converter todas as imagens (logo + thumbnails de todos os itens) para base64 antes de chamar `gerarOrcamentoHtml`. Fazer em paralelo com `Promise.all` para evitar serializar 50+ requests. Já tem um helper (`imageToBase64`) usado para a logo — generalizar.

**Warning signs:** Thumbnail aparece em alguns itens mas não em outros; PDF gerado em sequência rápida tem mais imagens faltando que o gerado isoladamente.

### Pitfall 3: `pagebreak.mode: avoid-all` quebra em docs longos

**What goes wrong:** [Cited: eKoopmans/html2pdf.js#227] Em PDFs com muitas páginas (ex: orçamento com 8+ ambientes), `avoid-all` começa a falhar — bloco é cortado no meio mesmo assim, ou — pior — empurra um bloco grande pra uma página em branco e deixa metade da página anterior vazia.

**Why it happens:** O algoritmo de avoid-all calcula altura disponível por página, mas perde precisão quando acumula erro de medida ao longo do doc. `avoid-all` também é hostil pra tabela com 30 linhas — empurra tudo pra próxima página.

**How to avoid:**

```typescript
pagebreak: {
  mode: ["css", "legacy"],                    // sem avoid-all global
  before: ".pdf-pagebreak-before",            // forçar quebra antes
  avoid: [".item-row", ".system-block"],      // só item individual e bloco de sistema
}
```

E no CSS:

```css
.section-header,                              /* "[SALA]" não fica órfã no fim da página */
.system-block { break-inside: avoid; }
.terms-section { break-before: page; }        /* termos sempre em página própria */
```

**Warning signs:** Páginas com metade vazia; tabela aparece toda na próxima página deixando o título do ambiente sozinho na anterior.

### Pitfall 4: Snapshot antigo não tem campo `local` — render quebra

**What goes wrong:** Orçamento criado antes da Phase 5 não tem `sistema.local`. V2 tenta render `Ambiente → Local → Sistema` e quebra (ou agrupa errado todos os sistemas em "(sem local)").

**Why it happens:** Schema só foi aditivo no nível físico (jsonb aceita campos novos), mas o **template v2 assume** o campo existe.

**How to avoid:**

1. Em v2, tratar `sistema.local` ausente como string vazia — agrupar todos sob um pseudo-local "Geral" ou simplesmente sem header de Local (só Sistema 1, 2, 3 direto sob Ambiente).
2. Decisão de produto: snapshot antigo cai no template v1 de propósito (router por `pdf_template_version`). v2 só vê snapshots que **podem** ter `local` (mas tratar `null` graciosamente mesmo assim).

**Warning signs:** PDF de orçamento antigo crasha ao gerar; ou todos os sistemas aparecem agrupados sob "undefined" / "(null)".

### Pitfall 5: html2pdf rasteriza — texto vira imagem, não é selecionável

**What goes wrong:** Cliente tenta copiar SKU do PDF e não consegue (porque é raster). Acessibilidade zero.

**Why it happens:** Pipeline é `HTML → canvas (raster) → jsPDF.addImage`. Não é texto vetorial.

**How to avoid:** Aceitar a limitação — Lenny já topou (decision locked). Se um dia virar problema, é decisão de migrar pra Puppeteer ou react-pdf (deferido, fora de escopo).

**Warning signs:** Não há — limitação conhecida e aceita.

## Code Examples

### Embedar fontes via @fontsource

```typescript
// src/lib/pdfFonts.ts (novo arquivo)
// Carrega Playfair Display + Inter via @fontsource — cada import roda os
// @font-face uma vez no document. Fica em chunk lazy do Vite.

import "@fontsource/inter/300.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/playfair-display/400.css";
import "@fontsource/playfair-display/500.css";
import "@fontsource/playfair-display/400-italic.css";

/** Garante que todas as fontes declaradas estão prontas antes de rasterizar. */
export async function ensureFontsReady(): Promise<void> {
  // document.fonts.ready resolve quando todos os @font-face do document
  // foram carregados ou falharam. Cobertura cross-browser desde 2018.
  await document.fonts.ready;
}
```

E nos call sites (`Step3Revisao.tsx`, `OrcamentoDetalhe.tsx`):

```typescript
// Carregar fontes lazy + esperar prontas antes de html2pdf
await import("@/lib/pdfFonts").then((m) => m.ensureFontsReady());
const html = gerarOrcamentoHtml({ /* ... */ });
// ... resto do fluxo html2pdf
```

### Pre-converter thumbnails para base64

```typescript
// src/lib/pdfImages.ts (novo)
async function urlToBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { credentials: "omit" });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** Pre-resolve todos os thumbnails de um snapshot em paralelo. */
export async function inlineImagensSnapshot(ambientes: Ambiente[]): Promise<Ambiente[]> {
  const urls = new Map<string, Promise<string | null>>();
  const seen = (url?: string) => {
    if (!url || url.startsWith("data:")) return;
    if (!urls.has(url)) urls.set(url, urlToBase64(url));
  };
  for (const amb of ambientes) {
    for (const l of amb.luminarias) seen(l.imagemUrl);
    for (const s of amb.sistemas) {
      seen(s.fita.imagemUrl); seen(s.driver.imagemUrl);
      if (s.perfil) seen(s.perfil.imagemUrl);
    }
  }
  const resolved = new Map<string, string>();
  for (const [url, p] of urls) {
    const v = await p;
    if (v) resolved.set(url, v);
  }
  // Retorna deep clone com imagemUrl trocado por base64 quando disponível
  const swap = (url?: string) => (url && resolved.get(url)) || url;
  return ambientes.map((amb) => ({
    ...amb,
    luminarias: amb.luminarias.map((l) => ({ ...l, imagemUrl: swap(l.imagemUrl) })),
    sistemas: amb.sistemas.map((s) => ({
      ...s,
      fita: { ...s.fita, imagemUrl: swap(s.fita.imagemUrl) },
      driver: { ...s.driver, imagemUrl: swap(s.driver.imagemUrl) },
      perfil: s.perfil ? { ...s.perfil, imagemUrl: swap(s.perfil.imagemUrl) } : null,
    })),
  }));
}
```

### Router v1/v2 em `gerarPdfHtml.ts`

```typescript
// src/lib/gerarPdfHtml.ts (refatorado)
import { gerarOrcamentoHtmlV1 } from "./pdfTemplates/v1";
import { gerarOrcamentoHtmlV2 } from "./pdfTemplates/v2";

export interface PdfParams {
  clienteNome: string;
  projetoNome: string;
  colaborador: string;
  tipo: string;
  ambientes: Ambiente[];
  logoBase64?: string;
  templateVersion?: number; // default 2 quando ausente
}

export function gerarOrcamentoHtml(params: PdfParams): string {
  const v = params.templateVersion ?? 2;
  return v >= 2 ? gerarOrcamentoHtmlV2(params) : gerarOrcamentoHtmlV1(params);
}

// Re-export do tipo pra compatibilidade com call sites existentes
export type { PdfParams };
```

E nos call sites, ler `pdf_template_version` do orçamento:

```typescript
// OrcamentoDetalhe.tsx (Re-emitir PDF)
const params: PdfParams = {
  clienteNome,
  projetoNome,
  colaborador: orc.colaborador?.nome ?? "—",
  tipo: orc.tipo ?? "Orçamento",
  ambientes: orc.ambientes ?? [],
  logoBase64: logoBase64 || undefined,
  templateVersion: orc.pdf_template_version ?? 1,  // antigo = v1
};
```

```typescript
// Step3Revisao.tsx (geração nova) — sempre v2
const params: PdfParams = {
  /* ... */
  templateVersion: 2,
};
// E na hora de persistir:
await supabase.from("orcamentos").insert({
  /* ... */
  pdf_template_version: 2,
});
```

### Hierarquia 5-níveis em CSS (sketch)

```css
/* Nível 2 — Ambiente */
.amb-header {
  display: flex; align-items: baseline; gap: 12px;
  margin: 48px 0 8px 0;
  break-inside: avoid;
}
.amb-name {
  font-family: "Inter", sans-serif;
  font-size: 11px; font-weight: 700;
  letter-spacing: 0.3em; text-transform: uppercase;
  color: #E68601;
}
.amb-rule {
  flex: 1; height: 1px;
  background: linear-gradient(90deg, #E68601 0%, transparent 100%);
}

/* Nível 3 — Local (Sanca, Rasgo) */
.local-name {
  font-family: "Playfair Display", serif;
  font-size: 18px; font-style: italic; font-weight: 400;
  color: #5a6475;
  margin: 24px 0 4px 16px;
}

/* Nível 4 — Sistema */
.system-label {
  font-family: "Inter", sans-serif;
  font-size: 9px; font-weight: 600;
  letter-spacing: 0.18em; text-transform: uppercase;
  color: #9aa3b0;
  margin: 16px 0 4px 32px;
}

/* Nível 5 — Componente: chips */
.chip {
  display: inline-flex; align-items: center;
  font-family: "Inter", sans-serif; font-size: 9px; font-weight: 500;
  letter-spacing: 0.04em; color: #5a6475;
  background: #f4f6f8; border-radius: 10px;
  padding: 2px 8px; margin: 2px 4px 2px 0;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|---|---|---|---|
| Google Fonts CDN `<link>` em PDF gerado por html2canvas | `@fontsource/*` bundle + `document.fonts.ready` | há ~3 anos (estabilização do CSS Font Loading API) | Necessário pra render consistente. CDN funciona mas tem race condition documentada. |
| `pagebreak.mode: ["avoid-all", "css", "legacy"]` | `["css", "legacy"]` + classes seletivas `break-inside: avoid` | recomendação histórica do mantenedor (issue #227, 2019+) | avoid-all degrada em docs longos; controle granular via CSS é mais previsível. |
| Estilo "screenshot de UI" (cards / borders / sombras) | Editorial (tipografia + espaço) | tendência de mercado (Stripe Atlas docs, Apple invoices, Notion exports) | Não é Phase 5 que define isso — Lenny já decidiu Apple-like no CONTEXT. |

**Deprecated/outdated no template atual:**

- Fonte `Outfit` (template usa em conjunto com Playfair). Substituir por Inter conforme decisão locked.
- Emojis como ícones (📦 🛡 💳 📋). Editorial não usa.
- Background azul/cinza em `body` (`background:var(--gray-200)`). Em PDF não aparece — só polui o preview HTML.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|---|---|---|
| A1 | Lenny está OK com snapshot v1 (orçamentos antigos) renderizar com o **template antigo** em vez de tentar re-renderizar com o novo | Architecture Pattern 1 | Se ele quiser que **todo** orçamento renderize no novo template, o planner precisa garantir que v2 lida graciosamente com snapshots sem `local` (já é uma das soluções listadas — fallback "sem header de Local"). Ambas opções são viáveis. |
| A2 | O bloco padrão da Área C ("Termos e Condições") é aceitável tonalmente — Lenny não quer reescrever os textos, só reformatar | Architecture Pattern 4 | Se ele quiser revisão de copy, planner precisa abrir uma sub-decisão antes de implementar (provavelmente `/gsd-discuss-phase` adicional ou inline review com o user). |
| A3 | Card TOTAL GERAL em fundo branco com faixa laranja é o desejado (Área D default) | Architecture Pattern 5 | Se Lenny quiser manter card escuro (atual), só ajustar o CSS. Baixo risco. |
| A4 | Adicionar coluna `pdf_template_version` em `orcamentos` é aceitável (migration aditiva) | Architecture Pattern 1 | Se Lenny preferir não mexer no schema relacional, alternativa é embutir versão dentro do jsonb (pior — quebra leitores existentes). Recomendação migration é mais limpa. |
| A5 | `local` em `SistemaIluminacao` é o lugar certo (não em `Ambiente.locais` como nova entidade) | Open Question 1 | Se vira entidade própria (subgrupo dentro de Ambiente), exige mudança de UI maior em Step2Ambientes. Trade-off real — ver Open Questions abaixo. |
| A6 | `useCORS: true` + base64 inline para thumbnails é suficiente para evitar CORS issues | Pitfall 2 | Não verificado em ambiente real com signed URLs do bucket `produtos-imagens` em Phase 5. Se thumbnails começarem a aparecer em branco no PDF, plano de fallback é gerar todos via base64 fetch (já é a recomendação principal). |

## Open Questions (RESOLVED)

> Todas as 4 perguntas abaixo foram materializadas em decisões nos plans 05-01..05-05. Cada item lista a resolução e qual plan a entrega.

1. **`local` (Sanca/Rasgo) — campo no Sistema ou entidade nova?**
   - **RESOLVED:** campo `local?: string | null` no `SistemaIluminacao` (string livre, opcional). Sem nova entidade. UI ganha input "Local (opcional)" no Step2Ambientes; PDF v2 agrupa por `local` no render (sistemas com `local === null` viram pseudo-grupo "Geral"). — ver Plan 05-02.
   - **What we know:** CONTEXT recomenda preliminarmente "campo opcional em luminária/sistema". Hierarquia desejada: Ambiente → Local → Sistema → Componentes.
   - **What's unclear:**
     - Se um Ambiente pode ter Sistemas que não pertencem a nenhum Local (ex: SALA → Sanca → Sistema 1; mas tem também um Sistema solto direto na SALA sem Local). Provavelmente sim (criação rápida). Resposta afeta UI do Step2Ambientes.
     - Se "Local" precisa ter ordem definida pelo usuário. Provavelmente sim (Sanca antes de Rasgo é decisão estética).
     - Se vai aparecer também na UI do wizard ou só no PDF. Decidir afeta esforço.
   - **Recommendation para o planner:** começar com `SistemaIluminacao.local?: string | null` (string livre, opcional). UI do Step2Ambientes ganha um input "Local (opcional)" no formulário do sistema. PDF v2 agrupa por `local` no render (sistemas com `local === null` ficam num pseudo-grupo "Geral" sem header). Sem nova entidade, sem ordering explícito (alfabético por padrão, mantém ordem de inserção do array). Se Lenny quiser ordering manual depois, vira fase futura.

2. **Tamanho do thumbnail: 40×40 ou 60×60?**
   - **What we know:** CONTEXT diz "40×40 ou 60×60", Lenny aceita PDF mais pesado.
   - **What's unclear:** 60×60 com 50 itens = 50 imagens × ~5KB base64 = +250KB no PDF. 40×40 = ~80KB. Ambos OK na prática (Vercel/email). Default visual não decidido.
   - **Recommendation:** começar com **48×48** (meio-termo) com `border-radius: 6px` e `object-fit: cover`. Lenny valida no UAT, ajusta se necessário (constante CSS).
   - **RESOLVED:** 48×48 default (meio-termo) com `border-radius: 6px` e `object-fit: cover`. Validação visual via UAT no Plan 05-05 (Lenny ajusta constante CSS se necessário). — ver Plan 05-04.

3. **Order de migração: schema → template → call sites?**
   - **What we know:** `pdf_template_version` precisa existir antes do template v2 ser default; thumbnails inline precisam estar prontos antes de v2 confiar neles.
   - **Recommendation:** ordem de waves no plano:
     1. Migration `pdf_template_version int default 2`.
     2. Refator `gerarPdfHtml.ts` em router + extract v1 inalterado.
     3. Helpers `pdfFonts.ts` + `pdfImages.ts`.
     4. Template v2.
     5. Call sites (Step3Revisao + OrcamentoDetalhe) lendo a versão e chamando helpers.
     6. UI do Step2Ambientes ganha campo "Local" (paralelo).
   - **RESOLVED:** Wave 1 paralelo (Plan 05-01 migration + Plan 05-02 schema/UI Local + Plan 05-03 helpers fonts/images), Wave 2 (Plan 05-04 template v2), Wave 3 (Plan 05-05 router + call sites + UAT). — ver plans.

4. **`pdf_template_version` afeta valor persistido ou só render?**
   - **What we know:** Lenny disse "mudança só no render, não na estrutura do snapshot" (PDF-05).
   - **Tension:** se `local` for persistido em `SistemaIluminacao`, o snapshot **muda** (campo opcional novo). Não quebra v1 (campo extra ignorado), mas tecnicamente o snapshot é diferente.
   - **Recommendation:** documentar como "snapshot v2 = v1 + campo opcional `local` em sistemas; renderer v1 ignora; renderer v2 usa". Lenny PDF-05 está mantido — orçamento antigo continua renderizando, só sem o nível Local (que é nível novo).
   - **RESOLVED:** coluna nova `pdf_template_version int` em `orcamentos` com default 2 (NÃO embutida no jsonb — preserva leitores existentes). Rows criadas antes da Phase 5 têm NULL → leitor coage para 1 (v1 legacy). Step3Revisao persiste `pdf_template_version: 2` explicitamente em INSERT/UPDATE. — ver Plan 05-01.

## Project Constraints (from CLAUDE.md)

| Diretiva | Origem | Impacto na Phase 5 |
|---|---|---|
| Stack travada (React 18 + Vite + TS + Supabase + shadcn-ui) | `auraoramentos/CLAUDE.md` | Não trocar html2pdf.js. |
| Schema só aditivo | `auraoramentos/CLAUDE.md` Constraints | `pdf_template_version` como column nullable com default; `local` como campo opcional no jsonb. |
| Snapshots antigos têm que continuar renderizando | `auraoramentos/CLAUDE.md` Constraints | Router v1/v2 obrigatório. PDF-05. |
| Wizard de 3 passos não pode quebrar | `auraoramentos/CLAUDE.md` Constraints | Mudança de `gerarOrcamentoHtml` mantém assinatura. Step3Revisao só ganha um passo de prep (fonts/imagens). |
| Imports usam alias `@/` (nunca `../../`) | `auraoramentos/CLAUDE.md` Conventions | Novos arquivos: `@/lib/pdfTemplates/v2`, `@/lib/pdfFonts`, `@/lib/pdfImages`. |
| ESLint: unused vars OFF, `strict: false` | `auraoramentos/CLAUDE.md` | Sem ajuste especial — lint vai passar. |
| Toast pattern (sonner) — `toast.error/success` | convention | Erros de geração de PDF continuam usando sonner (já é padrão). |
| CSS: design tokens (`text-foreground`, etc) NÃO se aplicam ao HTML do PDF | convention vs realidade | PDF roda offscreen sem o `<head>` do app — Tailwind classes não funcionam ali. CSS inline no template é exceção legítima. |
| Toda mudança de UI passa por code-review + Playwright MCP antes de "concluído" | global CLAUDE.md | Aplicar nas waves que tocam Step2Ambientes (input "Local") e Step3Revisao. PDF rendering em si pode ser testado com snapshot do PDF gerado. |
| GSD workflow obrigatório antes de Edit/Write | project CLAUDE.md | Esta Phase 5 já está em GSD — OK. |

## Validation Architecture

> Workflow.nyquist_validation não está explicitamente desabilitado em `.planning/config.json`. Tratar como enabled.

### Test Framework
| Property | Value |
|---|---|
| Framework | Vitest 3.2.4 |
| Config file | `vitest.config.ts` (existe) |
| Quick run command | `npm run test -- src/lib/pdfTemplates` |
| Full suite command | `npm run test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|---|---|---|---|---|
| PDF-01 | Template v2 produz HTML com classes `.amb-header`, `.local-name`, `.system-label`, `.chip` (estrutura editorial 5-níveis) | unit | `npm run test -- src/lib/pdfTemplates/v2.test.ts` | Wave 0 |
| PDF-02 | Template v2 emite bloco `.total-card-v2` com valor formatado (`R$ X.XXX,XX`) e label "TOTAL GERAL" | unit | `npm run test -- src/lib/pdfTemplates/v2.test.ts` | Wave 0 |
| PDF-03 | Template v2 **não** emite `.info-grid` nem as 4 caixas (Prazo/Garantia/Pagamento/Observações como cards) | unit | `npm run test -- src/lib/pdfTemplates/v2.test.ts` | Wave 0 |
| PDF-04 | Template v2 emite bloco prose com headers de termos (Prazo, Garantia, Pagamento, Observações) como `<h_>` ou small-caps spans | unit | `npm run test -- src/lib/pdfTemplates/v2.test.ts` | Wave 0 |
| PDF-05 | Router em `gerarPdfHtml.ts` com `templateVersion=1` (ou ausente em snapshot antigo) chama v1; com `templateVersion=2` chama v2 | unit | `npm run test -- src/lib/gerarPdfHtml.test.ts` | Wave 0 |
| PDF-05 (regressão) | Snapshot real anterior à Phase 5 (criar fixture com Ambiente[] sem `local`) renderiza sem throw em ambos templates | unit | `npm run test -- src/lib/pdfTemplates/regression.test.ts` | Wave 0 |
| Manual / UAT | PDF gerado em prod com Lenny — visual editorial bate com referência mental Apple-like | manual | UAT em `/admin/orcamento/:id` "Re-emitir PDF" + Step3Revisao em wizard | n/a |
| Smoke | Step3Revisao → gerar PDF → arquivo baixa, fonts são Playfair+Inter (visualmente), sem console errors | e2e (Playwright) | Playwright MCP — ver pipeline em CLAUDE.md global | Manual via Playwright MCP per CLAUDE.md |

### Sampling Rate
- **Per task commit:** `npm run test -- src/lib/pdfTemplates`
- **Per wave merge:** `npm run test`
- **Phase gate:** Full suite green + Playwright MCP smoke do Step3Revisao + Re-emitir PDF de orçamento antigo (compat PDF-05)

### Wave 0 Gaps

Cobertura via UAT manual + Playwright MCP no Plan 05-05 Task 5. Decisão consistente com `nyquist_validation: false` em `.planning/config.json` — fase entrega sem cobertura Vitest, validação fica via UAT visual com Lenny.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|---|---|---|---|---|
| html2pdf.js | Pipeline atual | ✓ | 0.14.0 | — |
| html2canvas (transitiva) | Pipeline atual | ✓ | dep de html2pdf.js | — |
| jsPDF (transitiva) | Pipeline atual | ✓ | dep de html2pdf.js | — |
| Vitest | Tests | ✓ | 3.2.4 | — |
| @fontsource/inter | Phase 5 | ✗ | — | npm install (Wave 1) |
| @fontsource/playfair-display | Phase 5 | ✗ | — | npm install (Wave 1) |
| Supabase CLI (`supabase db push`) | Migration `pdf_template_version` | ✓ (já usado em Phases anteriores) | — | — |
| Playwright MCP | Smoke UAT | ✓ (Lenny global config) | — | — |

**Missing dependencies with no fallback:** nenhum bloqueante.

**Missing dependencies com fallback:** `@fontsource/inter` e `@fontsource/playfair-display` precisam ser instalados — fallback é manter Google Fonts CDN (não recomendado, ver Pitfall 1) mas é viável se algo bloquear o npm install.

## Sources

### Primary (HIGH confidence)
- `auraoramentos/src/lib/gerarPdfHtml.ts` — código atual completo (verificado)
- `auraoramentos/src/types/orcamento.ts` — domain types (verificado)
- `auraoramentos/src/components/Step3Revisao.tsx:170-300` — call site Step 3 (verificado)
- `auraoramentos/src/pages/OrcamentoDetalhe.tsx:160-220` — call site Re-emitir (verificado)
- `auraoramentos/supabase/migrations/20260416000001_orcamentos_ambientes_tipo.sql` — schema do snapshot (jsonb, sem versionamento) (verificado)
- `auraoramentos/src/integrations/supabase/types.ts:320-388` — schema da tabela `orcamentos` (verificado, sem coluna `pdf_template_version`)
- `package.json` + `npm view html2pdf.js` 2026-05-07 — versão 0.14.0 confirmada como atual
- `npm view @fontsource/inter` / `@fontsource/playfair-display` 2026-05-07 — ambos 5.2.8

### Secondary (MEDIUM confidence)
- [niklasvh/html2canvas#1666 — Custom Font Rendering not working everytime](https://github.com/niklasvh/html2canvas/issues/1666) — comportamento de race com fontes
- [niklasvh/html2canvas#1940 — html2canvas isn't using cached fonts causing rendering issues](https://github.com/niklasvh/html2canvas/issues/1940) — confirmação da issue de fonte
- [niklasvh/html2canvas#490 — Fonts not displaying correctly on production website](https://github.com/niklasvh/html2canvas/issues/490) — relato de produção idêntico ao risco AURA
- [eKoopmans/html2pdf.js#227 — Page break avoid-all starts failing in longer documents](https://github.com/eKoopmans/html2pdf.js/issues/227) — degradação documentada do `avoid-all`
- [eKoopmans/html2pdf.js — README oficial](https://ekoopmans.github.io/html2pdf.js/) — opções de pagebreak.mode

### Tertiary (LOW confidence — design subjetivo)
- Recomendações de hierarquia editorial 5-níveis (Pattern 2): baseado em padrões mercado (Stripe Atlas, Apple invoices) — não há "fonte canônica", planner pode ajustar com Lenny no UAT.
- Defaults Áreas C e D: propostos pelo researcher conforme delegação do CONTEXT — Lenny pode revisar no `/gsd-plan-phase` ou no UAT.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versões verificadas via npm; html2pdf.js comportamento confirmado por issues + código existente.
- Architecture (router v1/v2, schema): HIGH — schema atual lido diretamente das migrations; sem ambiguidade.
- Pitfalls (fontes, imagens, pagebreak): HIGH — múltiplas issues do GitHub em concordância.
- Defaults visuais (Áreas C/D, hierarquia 5-níveis): MEDIUM — subjetivo, planner pode ajustar.
- Schema decision (column nova vs jsonb embed): HIGH para preferir column; MEDIUM para confirmar Lenny está OK com migration aditiva (geralmente está, conforme padrão do projeto).

**Research date:** 2026-05-07
**Valid until:** 2026-06-07 (30 dias — html2pdf/html2canvas estáveis, fontes estáveis)
