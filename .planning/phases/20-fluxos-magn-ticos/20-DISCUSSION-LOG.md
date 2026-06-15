# Phase 20: Fluxos Magnéticos - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisões estão no CONTEXT.md — este log preserva as alternativas consideradas.

**Date:** 2026-06-15
**Phase:** 20-fluxos-magn-ticos
**Areas discussed:** Montador & seletor de tipo, Driver auto + aplicar, Checklist + atalho, Voltage lock

---

## Montador & seletor de tipo (exploração aberta → product-first)

A discussão começou com modelos category-first (aba dedicada, seletor por sistema, "peça vs linha"). O Lenny rejeitou progressivamente toda taxonomia imposta ao usuário, argumentando que o vendedor pensa em **produto**, não em categoria, e convergiu para **product-first puro**: uma busca única que detecta o tipo automaticamente pelo `sistema`/`tipo_produto` do produto âncora.

Modelos apresentados e descartados:
- **Re-taxonomia das 2 abas** (Itens prontos vs Sistemas montados) — descartado: mantém decisão de categoria antes da ação.
- **Lista única + botão com menu visual** — descartado como entrada, mas a *lista única* foi mantida.
- **"Peça vs linha de luz"** (fluxo por intenção) — descartado: ainda é taxonomia; intenção não determina produto (fuzzy).
- **Galeria/chips de descoberta** — descartado: usuário conhece as famílias; "não resolver problema que talvez não exista".

### Fork: até onde a busca product-first vai

| Option | Description | Selected |
|--------|-------------|----------|
| Busca única substitui as abas (unificação) | AmbienteCard vira busca + lista única; fita/avulsa só mudam ponto de entrada | ✓ |
| Product-first só para compostos; abas intactas | Mantém Luminárias/Sistemas; product-first só p/ MAGNETO/TINY | |
| Não sei / pensar | — | |

**Escolha:** Unificação completa. Um modelo mental só (produto). Fita continua `sistemas[]` (card/cálculo idênticos), avulsa `luminarias[]`, compostos `composicao[]` — só o ponto de entrada muda.

### Fork: SIST-05 pede "seletor de tipo visível"

| Option | Description | Selected |
|--------|-------------|----------|
| Reescrever o critério para detecção | Atualiza ROADMAP/REQUIREMENTS p/ detecção automática | ✓ |
| Manter indicador mínimo de tipo visível | Badge do tipo detectado p/ cumprir a letra | |

**Escolha:** Reescrever. Seletor removido por design; badge informativo opcional, não requisito.

---

## Driver auto + aplicar

### Fork: carga > 200W (48V)

| Option | Description | Selected |
|--------|-------------|----------|
| Recomenda dividir, não auto-insere | Painel avisa excesso e orienta dividir; vendedor monta | ✓ |
| Auto-insere a combinação | Insere 2× LM2344 etc. num clique | |
| Insere o maior (200W) + aviso | Aplica 1× 200W e avisa falta de capacidade | |

**Escolha:** Recomenda dividir. Divisão de circuito é decisão de projeto; não agir silenciosamente em decisão estrutural.

---

## Checklist + atalho

### Fork: conector do TINY (LM3168 preto / LM3169 branco)

| Option | Description | Selected |
|--------|-------------|----------|
| Default LM3168 + trocar fácil | Insere preto, troca depois | |
| Dois botões no atalho | Escolhe a cor na hora | |
| Marca presente se QUALQUER um existir | Valida presença técnica; atalho usa default | ✓ |

**Escolha:** Validação por compatibilidade técnica, não cor. LM3168 OU LM3169 satisfaz; atalho insere default LM3168.

---

## Voltage lock

### Fork: como o hard lock impede driver de voltagem errada

| Option | Description | Selected |
|--------|-------------|----------|
| Busca de driver escopada à voltagem | Composição 48V → busca só retorna drivers 48V | ✓ |
| Permite buscar, bloqueia ao aplicar | Toast bloqueante ao tentar | |

**Escolha:** Lock por construção. Não mostrar opções inválidas pra depois bloquear. Princípio se estende ao card todo (módulos/conector escopados à família).

## Claude's Discretion

- Camada de apresentação da lista única, layout dos painéis, badge de tipo, `papel` do driver, detecção de "embutir", re-cálculo do painel após mudança de carga.

## Deferred Ideas

- Elementos de descoberta (chips/galeria), SYSTEM MOLD (Phase 21), aviso bloqueante Step2→3 (VAL-01/Phase 21), duplicar composto (DUP-01/Phase 21), PDF v3 (Phase 22).
- Todos de PDF (3) revisados e não dobrados — escopo Phase 22.
