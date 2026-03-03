

# Fluxo de Encerramento de Negociacao

## Problema
Nao existe status "perdido" nem campos para registrar data de fechamento ou motivo de perda. O dashboard calcula metricas incorretamente.

## 1. Banco de Dados

Adicionar 3 colunas na tabela `orcamentos`:
- `fechado_at` (timestamptz, nullable) — data real do encerramento (ganho ou perdido)
- `motivo_perda` (text, nullable) — opcao pre-definida: "preco", "concorrencia", "prazo", "sem_retorno", "outro"
- `motivo_perda_detalhe` (text, nullable) — campo livre opcional

Novo status permitido: **"perdido"** (alem dos existentes: rascunho, enviado, aprovado, fechado)

## 2. UX — Modal de Encerramento

Substituir o botao de check simples por um botao "Encerrar" que abre um **dialog modal** com duas opcoes:

```text
┌─────────────────────────────────┐
│  Encerrar Negociacao            │
│                                 │
│  [✓ Ganho]     [✗ Perdido]      │
│                                 │
│  (se Perdido):                  │
│  Motivo: [select obrigatorio]   │
│  - Preco                        │
│  - Concorrencia                 │
│  - Prazo                        │
│  - Sem retorno do cliente       │
│  - Outro                        │
│                                 │
│  Observacao: [textarea opcional]│
│                                 │
│  [Cancelar]  [Confirmar]        │
└─────────────────────────────────┘
```

- **Ganho**: seta status = "fechado", fechado_at = now()
- **Perdido**: seta status = "perdido", fechado_at = now(), motivo_perda, motivo_perda_detalhe
- O botao aparece para orcamentos com status "enviado" ou "aprovado" (tanto no ClienteList quanto no Admin)
- Feedback via toast de sucesso com icone diferenciado

### Estados visuais
- Rascunho: cinza (existente)
- Enviado: amarelo (existente)
- Aprovado: azul (existente)
- Fechado/Ganho: verde (existente)
- **Perdido: vermelho** (novo)

## 3. Dashboard — Correcao das Metricas

**Taxa de Conversao** (corrigida):
```
ganhos / (ganhos + perdidos)
```
Apenas orcamentos efetivamente encerrados, nao mais "enviados" no denominador.

**Ciclo Medio de Vendas** (corrigido):
```
media( fechado_at - created_at ) para status "fechado" ou "perdido" onde fechado_at IS NOT NULL
```
Usar `fechado_at` real em vez da coluna `data`.

**Novo KPI — Motivos de Perda**: adicionar um mini-grafico ou lista mostrando distribuicao dos motivos de perda.

## 4. Arquivos alterados

- **Migracao SQL**: adicionar colunas `fechado_at`, `motivo_perda`, `motivo_perda_detalhe` na tabela `orcamentos`
- **`src/components/ClienteList.tsx`**: substituir botao de check por botao "Encerrar" + modal, adicionar status "perdido" nos labels/classes
- **`src/pages/Admin.tsx`**: mesma logica de encerramento na tab Orcamentos, adicionar status "perdido"
- **`src/components/AdminDashboard.tsx`**: corrigir calculo de conversao e ciclo medio, usar `fechado_at`, adicionar "perdido" no pie chart e cores

