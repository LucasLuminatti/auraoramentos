# Phase 17: Resumo & Apresentação - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisões são capturadas em CONTEXT.md — este log preserva as alternativas consideradas.

**Date:** 2026-06-11
**Phase:** 17-resumo-apresenta-o
**Areas discussed:** Fita LOCAL + dedup (RES-01/02), Escopo PDF, Drivers por ambiente (RES-03), Aviso item faltando (RES-05), Destino RES-04

---

## Seleção de áreas

| Opção | Selecionada |
|-------|-------------|
| Fita: LOCAL + dedup (RES-01/02) | ✓ |
| Drivers por ambiente (RES-03) | ✓ |
| Aviso item faltando (RES-05) | ✓ |
| Duplicar sistema (RES-04) | ✗ (deferido → Phase 18) |

**Nota:** usuário priorizou apresentação/clareza; RES-04 visto como fluxo funcional, fora do foco da fase.

---

## Fita — onde "vive" no Step 3 (RES-02)

| Opção | Descrição | Selecionada |
|-------|-----------|-------------|
| Global = compra, ambiente = referência | Resumo Global = fonte de preço/rolos; ambiente vira referência explícita | ✓ |
| Só no Resumo Global | Remover linha de fita dos cards de ambiente | |
| Só no ambiente | Fita por ambiente, remover resumo global (perde otimização de rolos) | |

**User's choice:** Global = compra, ambiente = referência.
**Notes:** Preservar otimização global de rolos; interface deve responder "em quais ambientes a fita é usada" e "onde é contabilizada".

## Fita — LOCAL no resumo global (RES-01)

| Opção | Descrição | Selecionada |
|-------|-----------|-------------|
| Coluna LOCAL com breakdown por local | Mantém agrupamento por código + detalha metragem por local | ✓ |
| Coluna LOCAL = lista simples | Só lista locais, sem metragem por local | |
| Quebrar agrupamento por código+local | Uma linha por local (perde otimização cross-local) | |

**User's choice:** Breakdown por local (SANCA 12m · MARCENARIA 8m → 20m → rolos).

## Fita — fonte do LOCAL

| Opção | Descrição | Selecionada |
|-------|-----------|-------------|
| Ambiente · Local combinados | "Ambiente — Local" quando há local; só ambiente quando vazio | ✓ |
| Só Sistema.local | Apenas sub-área (Sanca); vazio → "Geral" | |
| Só Ambiente.nome | Apenas o nome do ambiente | |

**User's choice:** "Ambiente — Local" combinado. Ex.: `Sala — Sanca`, `Cozinha — Marcenaria`.

## Escopo PDF (RES-01/02)

| Opção | Descrição | Selecionada |
|-------|-----------|-------------|
| Resumo do PDF ganha LOCAL + foto; inline fica | Estende blocoResumoFitas (LOCAL + foto da fita); inline como referência | ✓ |
| Dedup completo também no PDF | Remover preço da fita inline no PDF (maior risco visual) | |
| Só a tela nesta fase | PDF fica para fase futura | |

**User's choice:** LOCAL + foto no Resumo de Fitas do PDF, inline mantido. Preservar layout v2 aprovado; reavaliar dedup maior só se a confusão persistir.

## Drivers por ambiente vs bloco global (RES-03)

| Opção | Descrição | Selecionada |
|-------|-----------|-------------|
| Vira ferramenta interna secundária | Drivers por ambiente = oficial; bloco global colapsável/análise interna | ✓ |
| Remover o bloco global | Tirar o Resumo Global de Drivers da tela | |
| Manter, só melhorar rótulo | Mudança mínima | |

**User's choice:** Bloco global → ferramenta de análise interna secundária (colapsável, não-cliente). Preserva insight de economia cross-ambiente sem competir com o pedido.

## Aviso item faltando — bloqueio (RES-05)

| Opção | Descrição | Selecionada |
|-------|-----------|-------------|
| Advisory + "avançar mesmo assim" | Aviso forte não-bloqueante; metragem (Phase 16) continua bloqueando | ✓ |
| Bloqueante | Impede avanço até completar o par | |

**User's choice:** Advisory não-bloqueante. Listar suspeitos, explicar o que falta, permitir continuar conscientemente, registrar visualmente a decisão de prosseguir.

## Aviso item faltando — gatilhos (RES-05)

| Gatilho | Selecionado |
|---------|-------------|
| Fita sem driver | ✓ |
| Driver sem fita | ✓ |
| Peça/luminária sem lâmpada | ✓ (requer pesquisa do modelo de dados) |
| Perfil sem fita | ✓ |

**User's choice:** Todos os quatro.
**Notes:** "Peça sem lâmpada" precisa de investigação — como o modelo identifica que um item "espera lâmpada".

## Destino RES-04 (Duplicar sistema)

| Opção | Descrição | Selecionada |
|-------|-----------|-------------|
| Mover para Phase 18 (junto de UX-04) | Família duplicação planejada junta | ✓ |
| Mandar para o backlog | Sai do marco v1.2 | |
| Manter na Phase 17 como opcional | Risco de inchar a fase | |

**User's choice:** Mover RES-04 → Phase 18. ROADMAP atualizado; cobertura v1.2 segue 18/18.

## Claude's Discretion

- Forma visual do rótulo de referência da fita no ambiente e do breakdown por local na tabela.
- Mecânica de colapso/rotulagem do bloco global de drivers.
- Copy do aviso advisory RES-05 e do registro "prosseguiu mesmo assim".
- Estrutura aditiva do tipo `GrupoFita` (breakdown + imagemUrl).

## Deferred Ideas

- RES-04 (duplicar sistema) → Phase 18.
- Dedup mais agressivo no PDF (remover preço inline) → reabrir só se confusão persistir.
- TODOs de redesign estético de PDF → fora de escopo (perpétuo).
