# Phase 18: UX Transversal - Context

**Gathered:** 2026-06-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Deixar o wizard de orçamentos difícil de usar errado, sem alterar o fluxo de 3 passos nem o modelo de dados. Cinco capacidades, todas incrementais sobre componentes já existentes:

- **UX-01** — Redirecionamento na busca de Luminária quando o código é perfil/fita/driver.
- **UX-03** — Microcopy inline explicando o que entra em "Luminárias" vs "Sistemas de Iluminação".
- **RES-04** — Duplicar um sistema já montado (movido da Phase 17).
- **UX-04** — Duplicar um ambiente inteiro.
- **UX-05** — Checklist visual de itens suspeitos antes de gerar o PDF (Step 3).

Fora de escopo: montagem de sistemas compostos (v1.3), motor de cálculo v1 (Marco 3), PDF v3, qualquer mudança de schema. Tudo é UI/lógica client-side aditiva.

</domain>

<decisions>
## Implementation Decisions

### UX-01 — Redirecionamento na busca de Luminária
- **D-01:** Quando a busca filtrada por Luminária (`filtro` = tipos spot/lampada/acessorio/etc.) não retorna nada MAS o código existe como `perfil`/`fita`/`driver`, substituir o empty-state "Nenhum produto encontrado" por uma mensagem de redirecionamento: **"Este produto é um {tipo} — adicione em Sistemas de Iluminação"**.
- **D-02:** Além da mensagem, exibir um botão **"Ir para Sistemas de Iluminação"** que troca a aba do `AmbienteCard` de `luminarias` para `sistemas` (e idealmente já foca/abre a busca lá). Comportamento guiado, não automático.
- **D-03:** NÃO adicionar o item automaticamente — o risco de adicionar item errado/no ambiente errado foi explicitamente rejeitado. O colaborador conclui a adição manualmente na aba certa.
- **D-04:** A detecção do "tipo real" do código precisa de uma consulta de fallback ao catálogo SEM o `filtro` de tipo (a busca atual já filtra por `tipo_produto`, então o produto perfil/fita/driver nunca chega ao componente). Resolver no plano: segunda query, ou relaxar o filtro só para detectar e sinalizar.

### RES-04 / UX-04 — Duplicação (mesmo lugar + editar depois)
- **D-05:** **Duplicar sistema** (RES-04): clona o `SistemaIluminacao` no MESMO ambiente, com **novo UUID** em todos os itens (fita/driver/perfil) e no próprio sistema, e sufixo no local — ex.: `"Sanca"` → `"Sanca (cópia)"`. O colaborador renomeia/ajusta depois. Botão fica na seção de Sistemas do `AmbienteCard`.
- **D-06:** **Duplicar ambiente** (UX-04): clona o `Ambiente` inteiro (todas as luminárias E sistemas) logo abaixo do original, com novos UUIDs em tudo e nome `"Cozinha"` → `"Cozinha (cópia)"`. O botão mora em `Step2Ambientes` (pai que possui o array de ambientes), ao lado do controle de remover.
- **D-07:** SEM dialog de escolha de destino — a opção de "escolher em qual ambiente/local cair" foi rejeitada por adicionar cliques. Duplica-se em sequência/no mesmo lugar e edita-se depois.
- **D-08:** Garantir UUIDs novos em TODA a árvore clonada (não reusar nenhum id) para não colidir com o original em re-renders, edição e snapshot/PDF.

### UX-05 — Checklist pré-PDF (painel visível + híbrido bloqueante)
- **D-09:** Checklist **sempre visível no topo do Step 3** (não dialog escondido), dando feedback contínuo durante a revisão.
- **D-10:** Classificação visual em dois níveis:
  - 🔴 **Erro (bloqueia):** fita LED sem metragem (0m) — é o gate CALC-01 da Phase 16, mantido como erro real.
  - 🟡 **Aviso (não bloqueia):** sistema sem driver, peça/luminária sem lâmpada, voltagem divergente.
- **D-11:** Cada item do checklist tem **link/ação para corrigir** (navegar até o ambiente/item correspondente).
- **D-12:** Ao clicar **"Gerar PDF"**: se existir fita com 0m → impedir geração e direcionar para correção; se houver apenas avisos → PDF gera normalmente. Reaproveitar/consolidar os triggers já criados no advisory da Phase 17 (`AdvisoryItem` no gate Step2→Step3) — mesma família de detecção, agora apresentada como painel no Step 3.

### UX-03 — Microcopy inline (sempre visível)
- **D-13:** Texto auxiliar **sempre visível** (não tooltip/ícone) abaixo de cada aba/seção, em fonte discreta (`text-muted-foreground`), 1 linha curta, sem ocupar muito espaço vertical, no padrão shadcn/Tailwind:
  - **Luminárias:** "Spots, pendentes, plafons, trilhos e luminárias individuais."
  - **Sistemas de Iluminação:** "Fitas LED, perfis, drivers e componentes que formam um sistema."
- **D-14:** Tooltip-only e "Claude decide" foram rejeitados: quem mais precisa da explicação é justamente quem não abre tooltip; a orientação tem de estar à vista no momento da decisão.

### Claude's Discretion
- Forma exata de focar/abrir a busca na aba Sistemas após o redirect (D-02) — desde que troque a aba.
- Estrutura interna do helper de clonagem com novos UUIDs (função utilitária em `orcamento.ts` vs inline) — desde que cubra a árvore toda.
- Componente exato do painel de checklist (Card + lista, Alert, etc.) seguindo shadcn.
- Texto/ícone exatos dos botões "Duplicar" (lucide `Copy`/`CopyPlus`).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requisitos & Roadmap
- `.planning/REQUIREMENTS.md` — RES-04, UX-01, UX-03, UX-04, UX-05 (definições e cobertura dos 19 comentários do UAT).
- `.planning/ROADMAP.md` §"Phase 18: UX Transversal" — goal e 4 success criteria.

### Domínio & tipos (núcleo)
- `src/types/orcamento.ts` — `SistemaIluminacao`, `Ambiente`, `Orcamento`, `ItemFitaLED`/`ItemDriver`/`ItemPerfil`, `GrupoFita`, e funções de cálculo. Ponto de inserção do helper de clonagem (novos UUIDs) e da lógica de detecção de itens suspeitos.

### Componentes que esta fase modifica
- `src/components/ProdutoAutocomplete.tsx` — empty-state "Nenhum produto encontrado" (linha ~52) e prop `filtro`; alvo do redirect UX-01.
- `src/hooks/useProdutoSearch.ts` — filtro por `tipo_produto` (linhas ~27-29); fonte da limitação que exige fallback de detecção (D-04).
- `src/components/AmbienteCard.tsx` — Tabs Luminárias/Sistemas (linhas ~347-348), seção de sistemas (~399), `onRemove`; alvo do microcopy (UX-03), do botão Duplicar sistema (RES-04) e do botão de redirect (UX-01).
- `src/components/Step2Ambientes.tsx` — possui o array de ambientes e o advisory gate da Phase 17 (`AdvisoryItem`, triggers fita-sem-driver/driver-sem-fita/perfil-sem-fita/peca-sem-lampada); alvo do botão Duplicar ambiente (UX-04) e fonte da lógica de detecção reusada no checklist.
- `src/components/Step3Revisao.tsx` — Step de revisão + geração de PDF; alvo do checklist pré-PDF (UX-05) e do gate CALC-01 (fita 0m bloqueia).

### Phase 17 (base do checklist)
- `.planning/phases/17-resumo-apresenta-o/17-04-SUMMARY.md` — advisory não-bloqueante Step2→Step3 (4 triggers, dialog Revisar/Continuar). UX-05 é a evolução desses triggers para painel no Step 3.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Advisory triggers da Phase 17** (`Step2Ambientes.tsx`): `AdvisoryItem` + 4 detecções (fita-sem-driver, driver-sem-fita, perfil-sem-fita, peca-sem-lampada) já cobrem a maior parte dos "avisos" do checklist UX-05 — reaproveitar a mesma lógica em vez de duplicar.
- **Gate CALC-01** (Phase 16): bloqueio de fita sem metragem com `toast.error` — base do 🔴 erro bloqueante do checklist.
- **Tabs do AmbienteCard**: `luminarias`/`sistemas` controladas por estado — o botão de redirect (D-02) troca esse estado.
- **`crypto.randomUUID`** (padrão já usado para ids de ambiente/sistema/item) — usar no clone para gerar novos UUIDs.

### Established Patterns
- Estado local React + prop drilling (`onChange`/`onRemove`); duplicação segue o mesmo: `Step2Ambientes` muta o array e passa para baixo.
- shadcn-ui (Card, Tabs, Alert, Button, Dialog) + `text-muted-foreground` para texto secundário; `cn()` para classes condicionais; ícones lucide-react.
- Schema/snapshots aditivos: nada de mudança de tipo obrigatória — clones e checklist operam sobre os tipos atuais.

### Integration Points
- Redirect: `ProdutoAutocomplete` (empty-state) ↔ `AmbienteCard` (troca de aba) — precisa de canal (callback) entre eles.
- Detecção de tipo real (D-04): `useProdutoSearch` / consulta Supabase ao catálogo sem `filtro`.
- Checklist: `Step3Revisao` lê os ambientes e roda os mesmos detectores; o botão Gerar PDF passa a checar o erro bloqueante.

</code_context>

<specifics>
## Specific Ideas

- Mensagem de redirect: "Este produto é um {tipo} — adicione em Sistemas de Iluminação" + botão "Ir para Sistemas de Iluminação".
- Microcopy Luminárias: "Spots, pendentes, plafons, trilhos e luminárias individuais."
- Microcopy Sistemas: "Fitas LED, perfis, drivers e componentes que formam um sistema."
- Sufixo de clone: "(cópia)" no local do sistema e no nome do ambiente.
- Níveis do checklist: 🔴 fita 0m (bloqueia) · 🟡 sistema sem driver · 🟡 peça sem lâmpada · 🟡 voltagem divergente.

</specifics>

<deferred>
## Deferred Ideas

- Montagem de sistemas compostos (MAGNETO/TINY/MODULAR) — v1.3 (SIST-01/02/03).
- Auto-preenchimento de driver compatível ao escolher fita (UX-02) — já entregue na Phase 15.

### Reviewed Todos (not folded)
- `todos/2026-04-27-pdf-zuado-input-para-phase-5.md` — estética do PDF; pertence ao redesign de PDF (Phase 5 / Marco de PDF), não à UX do wizard.
- `todos/2026-06-10-foto-da-fita-no-resumo-de-fitas-pdf.md` — já endereçado na Phase 17 (foto da fita no Resumo de Fitas do PDF v2).
- `todos/2026-05-06-pdf-orcamento-estetica-ruim.md` — estética do PDF; fora do escopo desta fase.

</deferred>

---

*Phase: 18-ux-transversal*
*Context gathered: 2026-06-12*
