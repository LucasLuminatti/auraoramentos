# Phase 16: Cálculo & Metragem - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-11
**Phase:** 16-c-lculo-metragem
**Areas discussed:** Itens vazios/rascunhos (selecionada); CALC-02 e CALC-03 ajustados antes de fechar. Bloqueio de 0m resolvido de quebra via discussão de rascunhos.

---

## Seleção de áreas

| Área | Descrição | Selecionada |
|------|-----------|-------------|
| Bloqueio de 0m (CALC-01) | Como impedir submeter fita sem perfil com 0m | (resolvida via "Rascunho") |
| Metragem na descrição (CALC-02) | Formato/origem/sincronia da metragem na descrição | ✓ (ajuste de default) |
| Limite de passadas (CALC-03) | Restringir vs sugerir por família | ✓ (ajuste de default) |
| Itens vazios/rascunhos | Sistema vazio + rascunho antigo + null vs 0 | ✓ |

---

## Itens vazios/rascunhos

### Sistema totalmente em branco ao avançar

| Option | Description | Selected |
|--------|-------------|----------|
| Remover silencioso | Some sem fricção ao avançar | |
| Avisar e remover | Aviso de que será removido, remove ao confirmar | ✓ |
| Bloquear | Impede avançar até preencher/apagar | |

**User's choice:** Avisar e remover.
**Notes:** Manter filosofia v1.2 de tornar ações visíveis e previsíveis. Sistema vazio não segue para o orçamento, mas não deve desaparecer silenciosamente: detectar ao avançar, informar que serão removidos, remover após continuar, não bloquear.

### Rascunho antigo com metragem faltando — quando avisar

| Option | Description | Selected |
|--------|-------------|----------|
| Inline no Step 2 + trava no avanço | Marca no card + bloqueia avanço | ✓ |
| Só ao tentar avançar | Aviso só no clique de Próximo | |
| Badge não-bloqueante | Estilo Fase 15, sem travar | |

**User's choice:** Inline no Step 2 + trava no avanço.
**Notes:** Metragem ausente é dado obrigatório, diferente de voltagem (que pode ser intencional). Problema visível no card, bloqueio do avanço até corrigir, mesmo comportamento para sistemas novos e rascunhos antigos, mensagem clara e orientativa.

### Metragem ausente: null vs 0

| Option | Description | Selected |
|--------|-------------|----------|
| Tratar igual | Ambos = metragem inválida, mesmo tratamento | ✓ |
| Diferenciar | Mensagens distintas por caso | |

**User's choice:** Tratar igual.
**Notes:** null e 0 significam "não há metragem válida". Mesmo aviso, destaque e bloqueio. Mensagem sugerida: "Informe uma metragem válida para este sistema antes de continuar." Sem expor a diferença técnica.

---

## CALC-02 — Metragem na descrição (ajuste de default)

### Onde a metragem aparece

| Option | Description | Selected |
|--------|-------------|----------|
| Embutida na descrição | Vira parte do texto, propaga p/ card+Resumo+PDF | ✓ |
| Só no card do Step 2 | Elemento separado, não propaga | |
| Campo dedicado em tudo | Coluna própria em card/Resumo/PDF (Fase 17) | |

**User's choice:** Embutida na descrição.
**Notes:** Visível para todos sem implementação separada por tela. Formato `PERFIL X — 2,5m`. Garantir atualização automática ao mudar comprimento/quantidade e não sobrescrever edição manual.

### Sincronia com edição manual

| Option | Description | Selected |
|--------|-------------|----------|
| Sufixo gerenciado | Sufixo controlado pelo sistema, texto livre intacto | ✓ |
| Preenche uma vez | Escreve ao inserir, não atualiza depois | |
| Campo separado | Metragem fora da descrição | |

**User's choice:** Sufixo gerenciado.
**Notes:** Separar texto livre do colaborador (`PERFIL EMBUTIR SALA`) do sufixo calculado (`— 2,5m`). Só o sufixo é atualizado quando comprimento/quantidade mudam; parte manual nunca alterada. Resultado: `PERFIL EMBUTIR SALA — 2,5m`.

---

## CALC-03 — Limite de passadas (ajuste de default)

| Option | Description | Selected |
|--------|-------------|----------|
| Sugere padrão + permite manual | Pré-seleciona passadas_padrao, dropdown só válidos, bloqueia só inválido | ✓ |
| Só restringe | Mostra válidos sem pré-seleção inteligente | |
| Sugere por consumo | Calcula sugestão por metragem/consumo | |

**User's choice:** Sugere padrão + permite manual.
**Notes:** Pré-selecionar `passadas_padrao` da família como sugestão; dropdown só com opções válidas; permitir alterar manualmente para qualquer valor válido; bloquear só combinações inválidas (ex.: quantidade fora do limite da família). Mesma filosofia v1.2.

## Claude's Discretion

- Mecânica do gate em `Step2Ambientes` (coleta/exibição de inválidos antes de `onNext`).
- Forma visual do marcador inline de metragem inválida.
- Copys exatos dos avisos (remoção de vazio / bloqueio de metragem).
- Estrutura da migration de sync de `passadas_padrao` (idempotente, aditiva, antes do unlock da UI).

## Deferred Ideas

- Sugestão de passadas por consumo/metragem (rejeitada nesta fase).
- Apresentação do Resumo/PDF (Fase 17).
- Todos de estética de PDF (Fases 5/17).
