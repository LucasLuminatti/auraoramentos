# Motor de Cálculo LED — Spec Fechado v1

**Status:** spec fechado para v1 — aguarda Marco 1 terminar antes de virar fase.
**Origem:** discussão Lenny ↔ Claude, validação Luminatti (2026-05-04).
**Escopo previsto:** Marco 3 (CALC-01..03 do REQUIREMENTS.md).
**Princípio condutor:** simplicidade de obra > otimização elétrica.

---

## ✅ Escopo do motor v1 (DENTRO)

### Tensões suportadas
- **12V** e **24V** apenas.

### Topologia de alimentação (regra fixa, não parametrizada por fita)
- **12V → limite 5m**
- **24V → limite 10m**
- L ≤ limite → **unilateral**
- L ≤ 2·limite → **bilateral**
- L > 2·limite → **múltiplos pontos de injeção** (segmentado)
- pontos = `ceil(L / limite)` — função apenas de comprimento + tensão

### Classificação (agrupador funcional)
- Campo **criado pelo usuário** no orçamento.
- Não substitui `aplicacao` nem `tipo_produto` do produto.
- Drivers **não cruzam classificações**.
- Perfis dentro da mesma classificação **podem** ser agrupados.
- Exemplos: `teto`, `mobiliário` (mas é livre).

### Estratégia de drivers (INVERTE comportamento atual)
- **Preferir 1 driver por perfil**.
- Evitar agrupamento automático agressivo.
- Agrupamento só **dentro da mesma classificação**.
- Justificativa: simplicidade de obra > otimização de custo.
- ⚠️ Mudança esperada no orçamento: **mais drivers, mais cabo, mais custo** vs. código atual.

### Padronização dentro da classificação
- Se houver múltiplos drivers na mesma classificação → **tentar mesma potência**.
- Driver menor pode receber capacidade ociosa em troca de uniformidade na obra.

### Margem de segurança
- **10% fixo** (`× 1.1`), **hardcoded**.
- Remover configurabilidade existente (`MARGEM_SEGURANCA_DRIVER`).

### Hard constraints (não-negociáveis)
- driver deve ter **mesma tensão** da fita
- potência do driver ≥ **carga × 1.1**
- não sugerir driver inexistente no catálogo
- não misturar classificações automaticamente

### UX
- Tudo automático por padrão.
- Editáveis pelo usuário: **passadas, agrupamento (classificação), drivers**.
- Sistema recalcula ao editar.

### Output do motor
- `fita_total_metros` consolidada (apenas total, sem breakdown).
- Por perfil: passadas, potência, pontos de injeção, tipo de alimentação.
- Por classificação: lista de drivers (qtd, potência, tensão).

---

## 🚫 Fora do escopo v1 (NÃO entra)

- **48V** — fica em fluxo paralelo como hoje (`analisarMagneto48V`).
- **Limite de potência por ponto de injeção** — pontos = só função de comprimento. Sem teto numérico de W/ponto no v1.
- **Iteração do ajuste de pontos** — bloqueado pela decisão acima (não existe a regra).
- **Bitola / corrente** — fora.
- **Ajuste por tipo de fita** (W/m, alta densidade etc.) — regra 5m/10m é fixa, não varia.
- **Otimização de rolos (5m/10m/15m)** — vira **etapa posterior** ao motor. Motor entrega só metragem total.
- **Limites rígidos de passadas** — heurística automática + override manual obrigatório (sem trava).

---

## ⚠️ O que muda em relação ao código atual

| Tema | Hoje | v1 do motor |
|---|---|---|
| Estratégia de drivers | Junta perfis até atingir capacidade do driver (otimiza) | 1 driver por perfil (preferência), agrupa só dentro da classificação |
| Margem de segurança | Constante `MARGEM_SEGURANCA_DRIVER` configurável | 10% fixo, hardcoded |
| Agrupamento de rolos | Dentro de `calcularDemandaFita` (5/10/15m) | Sai do motor — vira etapa posterior |
| Tensão | Tem `analisarMagneto48V` | Motor só 12V/24V; 48V continua paralelo |
| Passadas por largura | Cálculo automático | Heurística automática + override manual obrigatório |

---

## 📋 Pré-requisitos antes de virar fase

1. UAT manual da Phase 3 fechado (Master xlsx + bulk imagens pendentes).
2. Phases 4-6 do Marco 1 concluídas.
3. **CALC-01** — documentar fórmulas atuais de fita/driver/perfil/rolos antes de mexer (baseline).
4. Definir suite de testes regressivos: orçamentos antigos devem continuar gerando o **mesmo PDF** mesmo que o motor mude internamente, ou mudanças visíveis devem ser explícitas.

---

## Frase-resumo (uma linha)

Motor v1 cobre **12V/24V**, agrupa por **classificação criada pelo usuário**, prefere **1 driver por perfil**, padroniza potência dentro do grupo, usa **5m/10m fixos** para topologia, margem **10% fixo**, e entrega **fita total consolidada** — agrupamento de rolos e 48V ficam fora.

---

*Última atualização: 2026-05-04 — spec fechado para v1, aguardando Marco 1 + CALC-01 baseline antes de virar fase.*
