---
status: partial
phase: 16-c-lculo-metragem
source: [16-VERIFICATION.md]
started: 2026-06-11T17:44:10Z
updated: 2026-06-11T17:44:10Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Gate CALC-01 — bloqueio de metragem inválida
expected: No Step 2, criar um sistema com fita selecionada e SEM perfil, deixar a metragem manual vazia (ou 0). Ao clicar "Próximo", o avanço para o Step 3 é bloqueado e aparece o toast "Informe uma metragem válida para este sistema antes de continuar." Badge inline "⚠ Metragem obrigatória" visível no header do sistema.
result: [pending]

### 2. Sufixo CALC-02 — metragem na descrição ao vivo
expected: Ao selecionar um perfil e informar/alterar comprimento e quantidade, a descrição do item passa a mostrar o sufixo de metragem no formato " — 2,5m" (travessão + vírgula decimal). Re-editar não duplica o sufixo e preserva o texto manual.
result: [pending]

### 3. Select de passadas — família COM regra
expected: Selecionar um perfil da família `light_nano_30` (passadas_padrao = 2). O Select de passadas oferece apenas [1, 2] (opção 3 não aparece), pré-selecionando o padrão da família.
result: [pending]

### 4. Select de passadas — famílias SEM regra (WR-01)
expected: Selecionar um perfil das famílias `light_30` (passadas_padrao=2 no DB), `light_12` (=1) e `light_15` (=1). Confirmar o comportamento real do Select. DECISÃO: se `light_12`/`light_15` mostrarem apenas [1] e isso for indesejado (deveriam permitir até 3 por não terem regra explícita), aplicar o fix de 1 linha em AmbienteCard.tsx:203 (`produto.passadas ?? 3` em vez de `produto.passadas ?? base.passadas`). Nota: `light_50` NÃO existe no catálogo de produção (não há como testá-lo com dado real).
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
