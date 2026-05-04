# Motor de Cálculo LED — Spec em Construção

**Status:** rascunho — não implementar até Marco 1 fechar UAT.
**Origem:** discussão Lenny ↔ Claude (2026-05-04), antes de virar fase.
**Escopo previsto:** Marco 3 (CALC-01..03 do REQUIREMENTS.md).

---

## ✅ Validado (regras fechadas com a Luminatti)

### Tensão e topologia de alimentação
- **12V → até 5m**
- **24V → até 10m**
- até o limite (L ≤ limite) → **unilateral**
- até 2× o limite (L ≤ 2·limite) → **bilateral**
- acima de 2× → **múltiplos pontos de injeção** (segmentado)
- pontos = `ceil(L / limite)`

### Classificação
- Campo **criado pelo usuário** ao montar o orçamento (não substitui `aplicacao` nem `tipo_produto` do produto).
- É um **agrupador funcional** para cálculo e separação de drivers.
- Exemplos de uso real: `teto`, `mobiliário`.
- Drivers **não cruzam classificações** por padrão.
- Perfis dentro da mesma classificação **podem ser agrupados** num mesmo driver.

### Padronização de drivers dentro da classificação
- Se houver mais de um driver na mesma classificação, sistema **tenta manter a mesma potência** entre eles.
- Motivação: padronização de obra → reduz erro de instalação e facilita execução.
- Implica que driver menor pode receber capacidade ociosa em troca de uniformidade.

### Hard constraints (não-negociáveis)
- driver deve ter **mesma tensão** da fita
- potência do driver ≥ **carga × 1.1** (folga 10%)
- não sugerir driver inexistente no catálogo
- não misturar classificações automaticamente

### UX
- Tudo automático por padrão.
- Tudo editável (passadas, agrupamento, drivers).
- Ao editar, sistema recalcula.

---

## ❌ Não definido — não inventar

1. **Limites de passadas por largura** — os 15mm/35mm da spec inicial não foram validados com a Luminatti. Pode ser que existam mais faixas, ou que dependa de família de perfil.
2. **48V** — não entrou nas regras validadas. Decidir se motor cobre só 12/24 ou estende. Hoje o código tem `analisarMagneto48V` separado.
3. **Regra 5m/10m — fixa ou por datasheet?** — confirmar se o número vale pra qualquer fita ou se varia por W/m. Fitas de alta densidade caem mais rápido.
4. **Limite de potência por ponto de injeção** — se existe um teto numérico além do comprimento (ex: "60W por ponto"), qual é? Spec inicial sugeriu `limite_pratico` mas não definiu valor.
5. **Iteração do ajuste de pontos** — quando potência por ponto excede limite, soma 1 ponto **uma vez** ou itera até caber? Comportamento de borda.

---

## ⚠️ Conflitos com código atual a resolver antes de implementar

### Estratégia de drivers (3.9)
- **Spec nova:** "1 perfil = 1 driver. Múltiplos perfis = 1 driver POR perfil (preferência)."
- **Código atual:** otimiza juntando perfis num driver até atingir capacidade.
- **Decisão pendente:** confirmar se a inversão é intencional. Se sim, isso muda significativamente a quantidade de drivers que aparecem no orçamento (mais drivers, mais cabo, mais custo).

### Margem de segurança
- **Spec:** 1.1 (10%) hard-coded.
- **Código atual:** constante `MARGEM_SEGURANCA_DRIVER` (verificar valor atual).
- **Decisão pendente:** manter configurável ou fixar em 1.1?

### Agrupamento de rolos
- **Spec nova:** silente sobre agrupamento de rolos (5m/10m/15m).
- **Código atual:** `calcularDemandaFita` faz otimização de rolos.
- **Decisão pendente:** motor novo entrega só `fita_total_metros` ou já com breakdown de rolos?

---

## 📋 Pré-requisitos antes de virar fase

1. UAT manual da Phase 3 fechado (Master xlsx + bulk imagens pendentes).
2. Phases 4-6 do Marco 1 concluídas.
3. Lenny confirma com Luminatti as 5 dúvidas em aberto acima.
4. Decisão sobre conflitos com código atual (3 itens) tomada.
5. Documentar fórmulas atuais de fita/driver/perfil/agrupamento de rolos (CALC-01) — pra ter baseline antes de mexer.

---

## Frase-resumo (uma linha)

Motor agrupa por **classificação criada pelo usuário**, calcula **fita consolidada**, gera **driver por perfil ou grupo**, e ajusta alimentação automaticamente para **12V/24V com limites 5m/10m**, sem misturar classificações.

---

*Última atualização: 2026-05-04 — não promover a fase até pré-requisitos serem cumpridos.*
