---
phase: 05
slug: pdf-redesign
created: 2026-05-07
status: context-gathered
---

# Phase 5 — PDF Redesign — Context

## Objetivo

Reescrever o PDF de orçamento do zero. O atual (`src/lib/gerarPdfHtml.ts`) é
funcional mas visualmente quebrado — Lenny descreveu como "horrível" durante o
UAT da Phase 4. PDF é o entregável final do colaborador para o arquiteto/cliente,
então hoje a gente entrega bem o orçamento como dado estruturado e mal como
documento apresentável.

## Requisitos vinculados

- **PDF-01** — Layout tipográfico limpo, não estilo print HTML
- **PDF-02** — TOTAL GERAL card mantido ou redesenhado (não eliminado)
- **PDF-03** — Remover as 4 caixas (Prazo / Garantia / Pagamento / Observações)
- **PDF-04** — Conteúdo dessas caixas vira bloco de texto formatado
- **PDF-05** — Snapshot antigo precisa continuar renderizando (compat)

## Decisões de discussão (Lenny, 2026-05-07)

### Área A — Direção visual + tipografia

| Item | Decisão | Notas |
|---|---|---|
| Estilo de referência | **Editorial / Apple-like** | Hierarquia tipográfica forte, contraste de tamanho, respiro generoso, peso de fonte como hierarquia |
| Paleta | **Neutro + laranja Luminatti como acento** | Preto/branco/cinza dominante; laranja `#E68601` em detalhes (linha header, total, badges). Identidade preservada |
| Tipografia | **Playfair Display (títulos) + Inter (corpo)** | Serif elegante nos títulos, sans-serif moderna no corpo. Vibe editorial/premium, contraste forte |
| Hierarquia | **5 níveis efetivos** (revisado da resposta da Área B) | Doc → Ambiente → Local/sub-ambiente → Sistema → Componentes |

### Área B — Estrutura de tabelas e itens

| Item | Decisão | Notas |
|---|---|---|
| Layout dos itens | **Híbrido (tabela + chips)** | Tabela enxuta com colunas essenciais + chips/badges abaixo de cada linha pra specs (W, V, IP etc) |
| Imagens | **Thumbnail por item (40x40 ou 60x60)** | Cada item com foto pequena à esquerda. Aceita custo de PDF mais pesado |
| Colunas essenciais | Quantidade + unidade • Potência (W) e tensão (V) • Preço unitário • Código/SKU | 4 campos não-negociáveis por item |
| Agrupamento de sistemas | **Estrutura aninhada hierárquica explícita** | Ambiente (SALA) → Local (Sanca, Rasgo) → Sistema 1, 2… → Fita / Driver / Perfil. Agrupamento visual deixa claro qual fita pertence a qual sistema |

### Estrutura visual exemplo (decisão Lenny)

```
[SALA]
 → Sanca
   ┌ Sistema 1 ┐
     Fita  Driver  Perfil
   ┌ Sistema 2 ┐
     Fita  Driver  Perfil
 → Rasgo
   ┌ Sistema 1 ┐
     Fita  Driver  Perfil
```

Esse é o output desejado de hierarquia visual no PDF — diferente do agrupamento
flat atual.

## Áreas NÃO discutidas (decisões pendentes na fase de planning)

- **C — Bloco de texto final** (substituir as 4 caixas por texto contínuo formatado).
  Decidir tom, tamanho, ordem. Default sugerido pelo planner.
- **D — TOTAL GERAL e referências visuais finais** (card mantido ou redesenhado;
  posição; uso do laranja).
  Default sugerido pelo planner.

## Restrições técnicas

- **html2pdf.js** continua sendo o pipeline (cliente-side, sem backend novo).
- Compat de snapshot antigo (PDF-05): orçamentos salvos antes da Phase 5
  precisam continuar renderizando. Estratégia provável: novo template é
  default; orçamentos com `pdf_template_version` ausente ou `< 2` caem no
  template antigo.
- Sub-ambiente (Sanca / Rasgo) não existe no schema hoje — `Ambiente`
  contém luminárias e sistemas direto. **Pode** virar requisito de schema
  aditivo no planning (campo `local` em sistema/luminária, opcional, não
  quebra orçamentos antigos).

## Files que vão mudar

- `src/lib/gerarPdfHtml.ts` — reescrita do template (mantida como entry point).
- Possível novo: `src/lib/pdfTemplates/v2.ts` com o novo layout, mantendo
  `gerarPdfHtml.ts` como router entre v1 (legacy) e v2 (novo).
- Possível schema aditivo se "Local/sub-ambiente" virar campo persistido
  (a definir no planning).

## Próximo passo

`/gsd-plan-phase 5` — pegar este CONTEXT.md e produzir PLAN.md com:
- pesquisa de fontes (Inter via system / @fontsource, Playfair via @fontsource)
- estratégia de compat (PDF-05)
- decisão sobre sub-ambiente (campo opcional novo vs. virar string num campo
  existente)
- defaults pra Áreas C e D
- divisão em waves executáveis
