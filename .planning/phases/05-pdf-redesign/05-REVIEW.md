---
phase: 05-pdf-redesign
reviewed: 2026-05-07T00:00:00Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - src/components/AmbienteCard.tsx
  - src/components/Step3Revisao.tsx
  - src/lib/gerarPdfHtml.ts
  - src/lib/pdfFonts.ts
  - src/lib/pdfImages.ts
  - src/lib/pdfTemplates/v2.ts
  - src/pages/OrcamentoDetalhe.tsx
  - src/types/orcamento.ts
findings:
  critical: 0
  warning: 3
  info: 5
  total: 8
status: issues_found
---

# Phase 5: Code Review Report

**Reviewed:** 2026-05-07
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Summary

A redesign do PDF (v1/v2 router + helpers de fonte/imagem + template editorial v2 + campo `local` opcional) está bem estruturada: API pública preservada, escaping de HTML defensivo no template novo, dedup de URLs e lazy-loading dos assets pesados (html2pdf, fontsource). Não foram detectadas vulnerabilidades de segurança nem bugs de quebra de retro-compatibilidade — orçamentos antigos com `pdf_template_version` NULL caem corretamente no v1 via coalesce em `OrcamentoDetalhe`.

Foram identificados **3 warnings** (race condition real em `urlToBase64` quando o fetch falha; possível race entre injeção de CSS via dynamic import e `document.fonts.ready`; bump silencioso de v1→v2 ao re-salvar um orçamento legacy) e **5 itens informativos** (escape inconsistente do `logoBase64`, tipagem larga do `templateVersion`, data sempre "hoje" no re-emitir, corner cases de mensagens de toast e duplicação leve do bloco de PDF entre as duas páginas).

Nenhum impacto bloqueante para subir Phase 5 — os warnings são edge cases de produção que vale endereçar antes do próximo lote de UAT em campo, mas não derrubam o caminho feliz já validado.

## Warnings

### WR-01: `urlToBase64` pode resolver com `null` em vez de rejeitar quando FileReader falha

**File:** `src/lib/pdfImages.ts:18-22`
**Issue:** O `FileReader` dispara `onloadend` **sempre** ao terminar (sucesso, abort ou erro), e `onerror` em caso de falha. Como ambos os handlers estão definidos, há corrida: se `onerror` disparar primeiro e a Promise já estiver rejeitada, ok — mas se `onloadend` disparar primeiro num cenário onde `reader.result` é `null` (ex: blob inválido), ele faz `resolve(reader.result as string)` resolvendo a Promise como `null` cast para string. O `try/catch` externo retorna esse `null` (line 24), e o resto do pipeline trata como "imagem não convertida" — funcional, mas o cast (`as string`) mascara o tipo real. Em html2canvas, um `data:` URL `null` ou `"null"` aparece como `<img src="null">` e quebra silenciosamente.
**Fix:**
```ts
return await new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => {
    if (typeof reader.result === "string") resolve(reader.result);
    else reject(new Error("FileReader produced non-string result"));
  };
  reader.onerror = () => reject(reader.error ?? new Error("FileReader error"));
  reader.readAsDataURL(blob);
});
```
Usar `onload` em vez de `onloadend` evita o disparo na branch de erro.

---

### WR-02: Race entre injeção de CSS via dynamic import e `document.fonts.ready`

**File:** `src/components/Step3Revisao.tsx:260-267`, `src/pages/OrcamentoDetalhe.tsx:169-172`, `src/lib/pdfFonts.ts:8-15,22-25`
**Issue:** `pdfFonts.ts` é importado dinamicamente no momento de gerar o PDF. Os `import "@fontsource/..."` são side-effect imports que injetam `<style>` com `@font-face` no document. O navegador só **começa** a carregar a fonte quando ela é referenciada por um elemento renderizado — e `document.fonts.ready` resolve a Promise se nenhuma fonte estiver "loading" no instante da chamada. Se `ensureFontsReady()` for chamado imediatamente após o `import` (mesmo tick), as fontes podem ainda nem ter sido descobertas pelo loader e `document.fonts.ready` resolve instantaneamente — antes de o html2canvas começar a renderizar e disparar o load real. Na prática, o `Promise.all` no Step3 (line 262-266) já dá tempo às fontes parsearem (rede + base64 demoram), mas no `OrcamentoDetalhe` o caminho é sequencial e mais rápido — o risco é maior lá.
**Fix:**
Forçar o load explicitamente em `ensureFontsReady`, listando os pesos críticos:
```ts
export async function ensureFontsReady(): Promise<void> {
  if (typeof document === "undefined" || !document.fonts) return;
  // Força o browser a baixar as faces que o template v2 usa, em vez de esperar render.
  await Promise.all([
    document.fonts.load("400 12px Inter"),
    document.fonts.load("500 12px Inter"),
    document.fonts.load("600 11px Inter"),
    document.fonts.load("700 11px Inter"),
    document.fonts.load("400 32px 'Playfair Display'"),
    document.fonts.load("italic 400 18px 'Playfair Display'"),
  ]);
  await document.fonts.ready;
}
```

---

### WR-03: Re-salvar um orçamento v1 (legacy) força `pdf_template_version: 2` silenciosamente

**File:** `src/components/Step3Revisao.tsx:209,225`
**Issue:** O `update`/`insert` em `persistirOrcamento` sempre grava `pdf_template_version: 2`, inclusive quando `orcamentoId` já existe (re-save). Se um orçamento criado pré-Phase 5 (NULL na coluna, lê como v1 em `OrcamentoDetalhe`) for editado pelo wizard e salvo, o registro pula para v2 sem aviso. Isso pode ser intencional (toda re-edição passa a usar o layout novo) — mas a regra não está documentada na UI nem no comentário do código, e `OrcamentoDetalhe` e Step3Revisao passam a usar templates diferentes para o mesmo `orcamento_id` em momentos distintos, quebrando o "PDF re-emitido idêntico ao original" que muitos clientes esperam.
**Fix:** Decidir e documentar:
- (A) Se a intenção é sempre migrar pra v2 ao salvar → manter como está e adicionar comentário em `persistirOrcamento` explicando o trade-off + linha curta no banner do Step3 ("este orçamento usará o novo template ao salvar").
- (B) Se quiser preservar v1 quando o registro já era v1 → ler `pdf_template_version` antes do update e só atualizar pra 2 quando insert ou quando o usuário explicitamente trocar. Ex:
```ts
const versionParaPersistir = orcamentoId ? undefined : 2;
const payload = { tipo: ..., ambientes: ..., valor: ..., ...(versionParaPersistir && { pdf_template_version: versionParaPersistir }) };
```

## Info

### IN-01: `logoBase64` interpolado sem `esc()` no template v2

**File:** `src/lib/pdfTemplates/v2.ts:316`
**Issue:** Em todo o template v2 a string `esc()` é aplicada disciplinadamente — exceto na linha `<img src="${logoBase64}" alt="Aura" class="logo" />`. Como `logoBase64` é gerado localmente via `imageToBase64()` (canvas.toDataURL), a chance de injeção é zero na prática, mas a inconsistência abre porta pro próximo dev passar uma URL externa sem perceber.
**Fix:** Usar `esc(logoBase64)` para manter o invariante "todo `${...}` em `src=` ou texto passa por `esc`":
```ts
const logoHtml = logoBase64
  ? `<img src="${esc(logoBase64)}" alt="Aura" class="logo" />`
  : `<span class="logo-text">AURA</span>`;
```

---

### IN-02: `templateVersion: number` é tipagem larga demais

**File:** `src/lib/gerarPdfHtml.ts:35,39`
**Issue:** `templateVersion?: number` aceita qualquer inteiro/float (`1.5`, `99`, `NaN`). A regra de roteamento é `>= 2 → v2, else v1`, então valores estranhos não quebram, mas ficam silenciosos. `OrcamentoDetalhe` passa `orc.pdf_template_version ?? 1` que vem do banco como `number | null` — pode ser qualquer coisa em rows manualmente editados.
**Fix:** Estreitar o tipo e centralizar a constante:
```ts
export type PdfTemplateVersion = 1 | 2;
export interface PdfParams {
  // ...
  templateVersion?: PdfTemplateVersion;
}
```
Em `OrcamentoDetalhe`, fazer `templateVersion: (orc.pdf_template_version === 2 ? 2 : 1)`.

---

### IN-03: PDF re-emitido sempre estampa a data de **hoje** em vez da data original

**File:** `src/lib/pdfTemplates/v2.ts:37-39,410`, `src/pages/OrcamentoDetalhe.tsx:174-185`
**Issue:** `formatarData()` é `new Date().toLocaleDateString(...)` — sem parâmetro. Quando o admin abre um orçamento de 3 meses atrás e clica "Re-emitir PDF", o documento sai com a data de hoje. Pode ser intencional ("data da emissão"), mas o cliente vai estranhar receber um "Proposta Comercial" datada de hoje quando o pedido é antigo.
**Fix:** Aceitar `dataEmissao?: string` em `PdfParams` e passar `orc.data` (ou `orc.created_at`) lá do `OrcamentoDetalhe`:
```ts
function formatarData(iso?: string | null): string {
  const d = iso ? new Date(iso) : new Date();
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}
```

---

### IN-04: `imageToBase64` duplicado entre Step3Revisao e helper centralizado

**File:** `src/components/Step3Revisao.tsx:45-59` vs `src/pages/OrcamentoDetalhe.tsx:144-153`
**Issue:** Duas implementações distintas de "URL → base64" para o logo coexistem: a de Step3 usa `Image + canvas`, a de OrcamentoDetalhe usa `fetch + FileReader`. Ambas atingem o mesmo asset (`@/assets/logo.png`). Já existe `pdfImages.urlToBase64` que faz exatamente o segundo padrão — só está marcado como `async function` privada do módulo.
**Fix:** Exportar `urlToBase64` de `pdfImages.ts` (renomear pra `fetchAsBase64` se quiser deixar a API consistente) e ter um único helper `carregarLogoBase64()` em `pdfFonts.ts` ou `pdfImages.ts`. Reduz a chance de uma das implementações divergir (ex: ter CORS handling diferente).

---

### IN-05: Toast de sucesso no Step3 quando `persistirOrcamento` falhou silenciosamente

**File:** `src/components/Step3Revisao.tsx:262-302`
**Issue:** Se `persistirOrcamento` retornar `null` (cliente sem id, colaborador sem id, ou erro do Supabase), o `Promise.all` continua, o PDF é gerado e o usuário vê `toast.success("PDF baixado!")` — mesmo sem o orçamento ter sido salvo no histórico. Existe um `toast.warning` antes em `persistirOrcamento`, mas o fluxo soma dois toasts contraditórios na tela em sequência rápida ("não foi salvo" + "PDF baixado").
**Fix:** Não é bug funcional (o PDF saiu mesmo, conforme intenção documentada na linha 234), mas vale reordenar os toasts ou usar um único toast composto: `toast.warning("PDF baixado, mas não foi salvo no histórico — peça ao admin pra criar seu colaborador")`.

---

_Reviewed: 2026-05-07_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
