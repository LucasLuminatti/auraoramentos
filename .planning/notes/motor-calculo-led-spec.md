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

### Classificação (agrupador funcional novo)
- **Campo NOVO** criado pelo usuário no orçamento, **não substitui** `aplicacao` nem `tipo_produto` do produto (esses continuam existindo nos cadastros).
- Função: **agrupador operacional** para drivers e perfis dentro do orçamento.
- Drivers **não cruzam classificações**.
- Perfis dentro da mesma classificação **podem** ser agrupados.
- Exemplos: `teto`, `mobiliário` (mas é livre).

### Estratégia de drivers (INVERTE comportamento atual)
- Cálculo é **por perfil OU por grupo/classificação** — não é regra absoluta.
- **Preferência padrão: separar (1 driver por perfil)** para reduzir erro de obra.
- Agrupamento permitido só **dentro da mesma classificação** quando fizer sentido.
- Justificativa: simplicidade/segurança de obra > otimização de custo.
- ⚠️ Mudança esperada vs. código atual: **mais drivers, mais cabo, mais custo** (porque o atual agrupa agressivo por capacidade).

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

- **48V** — motor novo cobre apenas 12V e 24V. Se 48V continuar no código atual (ex: `analisarMagneto48V`), é **outro fluxo separado**, não parte do motor v1.
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
| Estratégia de drivers | Junta perfis até atingir capacidade do driver (otimiza custo) | Por perfil OU por grupo/classificação — separação como **preferência padrão** (segurança de obra), agrupamento só dentro da mesma classificação quando fizer sentido |
| Agrupador operacional | `aplicacao` / `tipo_produto` (do produto) | **Classificação** (campo novo do orçamento, criado pelo usuário). `aplicacao` e `tipo_produto` continuam existindo nos cadastros |
| Margem de segurança | Constante `MARGEM_SEGURANCA_DRIVER` configurável | 10% fixo, hardcoded |
| Agrupamento de rolos | Dentro de `calcularDemandaFita` (5/10/15m) | Sai do motor — vira etapa posterior |
| Tensão | 12V/24V/48V no mesmo fluxo (`analisarMagneto48V`) | Motor v1 cobre **só 12V/24V**. 48V (se mantido) é **outro fluxo separado**, não parte do motor novo |
| Passadas por largura | Cálculo automático | Heurística automática + override manual obrigatório |

---

## 📋 Pré-requisitos antes de virar fase

1. UAT manual da Phase 3 fechado (Master xlsx + bulk imagens pendentes).
2. Phases 4-6 do Marco 1 concluídas.
3. **CALC-01** — documentar fórmulas atuais de fita/driver/perfil/rolos antes de mexer (baseline).
4. Definir suite de testes regressivos: orçamentos antigos devem continuar gerando o **mesmo PDF** mesmo que o motor mude internamente, ou mudanças visíveis devem ser explícitas.

---

## Frase-resumo (uma linha)

Motor v1 cobre **só 12V/24V**, agrupa por **classificação criada pelo usuário** (campo novo, não substitui `aplicacao`/`tipo_produto`), calcula drivers **por perfil ou por grupo** com **separação como preferência padrão**, padroniza potência dentro do grupo, usa **5m/10m fixos** para topologia, margem **10% fixo**, entrega **fita total consolidada** — agrupamento de rolos e 48V ficam fora (48V, se mantido, é fluxo separado).

---

*Última atualização: 2026-05-06 — 3 correções pós-revisão Lenny (drivers como preferência ≠ regra absoluta; 48V é fluxo separado, não parte do motor v1; classificação é agrupador novo, não substituto de `aplicacao`/`tipo_produto`).*
