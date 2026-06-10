# Phase 15: Tensão & Validação — Research

**Researched:** 2026-06-10
**Domain:** Validação de voltagem fita↔driver, sugestão automática de driver, advisory TINY, grouping fix
**Confidence:** HIGH (todo o código-fonte e catálogo real lidos na sessão)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01:** Ao selecionar a fita → pré-preencher um driver compatível sugerido E pré-filtrar o seletor de driver para mostrar só os de voltagem compatível. Comportamento proativo, mas o colaborador continua podendo trocar por outro driver compatível.

**D-02:** Regra de escolha do driver sugerido sai da análise do catálogo real de drivers. **CHECKPOINT D-02a** (aprovação prévia antes de implementar): regra exata + margem + 3 exemplos reais. Ver seção `## D-02a — Checkpoint: Regra de Sugestão de Driver`.

**D-03:** Sugestão só preenche se driver estiver vazio. Se a fita mudar e o driver ficar incompatível → avisar mas NÃO apagar/substituir sem ação do usuário.

**D-04:** Badge inline persistente + toast ao criar a divergência. Badge some quando corrigido.

**D-05:** Aviso NÃO bloqueia avanço pro Step 3. Tom orientativo, não bloqueante.

**D-06:** Advisory TINY: toast + badge informativo, advisory puro. Sem montar sistema nem adicionar componente automaticamente.

**D-07:** Detecção TINY pelo dado `sistema='tiny_magneto'` (não regex). Regex só como fallback de diagnóstico.

**D-08:** Fix grouping key em `calcularDriversPorProjeto`: Map key muda de `codigo` para `${codigo}|${voltagem}`.

**D-09:** Forma visual de mostrar voltagem no Resumo Global de Drivers — Claude decide, com aprovação prévia (D-09a). Ver seção `## D-09a — Checkpoint: Display de Voltagem no Resumo`.

**D-10:** Validação sempre por-sistema. Ambientes 100% independentes. Hipótese: bloqueio indevido vem do default `voltagem: 24` nos objetos vazios `novaFita`/`novoDriver`.

### Claude's Discretion

- Regra exata de seleção do driver (D-02, com aprovação prévia via D-02a).
- Forma visual de mostrar voltagem no resumo (D-09, com aprovação prévia via D-09a).
- Mecânica do pré-filtro do seletor (estende `filtro="driver"` em `ProdutoAutocomplete`/`useProdutoSearch`).

### Deferred Ideas (OUT OF SCOPE)

- Montagem assistida completa de sistemas compostos (TINY/MAGNETO/MODULAR) — v1.3 (SIST-01/02/03).
- Botão que adiciona driver 24V automaticamente ao incluir item TINY — rejeitado nesta fase.
- PDF gerado tá zuado — Phase 5 (PDF Redesign).
- Foto da fita no Resumo de Fitas do PDF — Phase 17 (RES-01).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TENS-01 | Voltagem do driver inferida/validada a partir da fita; aviso quando não bate em vez de seleção silenciosa | D-01 (pré-fill+filtro), D-04 (badge+toast), D-05 (non-blocking) |
| TENS-02 | Tensão diferente em ambientes diferentes sem bloqueio; agregação global de drivers por (código + voltagem) | D-10 (validação por-sistema), D-08 (grouping key fix) |
| SIST-04 | Ao adicionar item da linha TINY, avisa que requer driver 24V | D-06 (advisory toast+badge), D-07 (detecção via `sistema`) |
| UX-02 | Ao escolher a fita, sugere driver compatível (voltagem + potência) como default | D-01 (pré-fill automático), D-02 (regra de seleção) |
</phase_requirements>

---

## Summary

Esta fase é puramente frontend + lógica de cálculo — zero migrações de schema, zero edge functions novas. Toda a informação necessária já existe nos dados do produto (`voltagem` em `produto.tensao`, `potencia_watts` em `produto.potencia_watts`). O sistema já valida por-sistema (L137-149 em AmbienteCard), mas bloqueia indevidamente porque o default do objeto vazio (`novaFita.voltagem = 24`, `novoDriver.voltagem = 24`) faz a validação disparar contra um driver "vazio" com voltagem 24 — não há vínculo real entre ambientes.

**Descoberta crítica do catálogo:** 46 dos 61 drivers têm `tensao = null` no banco. O pré-filtro por voltagem precisa incluir tanto os drivers com `tensao = voltagem_da_fita` quanto os com `tensao IS NULL` que mencionam a voltagem na descrição — do contrário o seletor ficará quase vazio para 12V e 24V. A abordagem recomendada é filtrar na query com `tensao.eq.X OR tensao.is.null` para o seletor (mostrando tudo compatível), e na sugestão automática preferir drivers com `tensao` preenchida igual à fita.

**Recomendação primária:** Implementar em 4 tarefas atômicas: (1) fix grouping key, (2) pré-fill + pré-filtro + aviso de divergência, (3) reformular toast/badge de divergência e remover bloqueio, (4) advisory TINY.

---

## Standard Stack

### Componentes e funções envolvidas (sem nova dependência)

| Arquivo | Propósito na fase | Tipo de mudança |
|---------|------------------|-----------------|
| `src/types/orcamento.ts` | Fix grouping key em `calcularDriversPorProjeto` (~L300) | Lógica pura |
| `src/components/AmbienteCard.tsx` | Pré-fill driver, badge divergência, advisory TINY, reformular toast | UI + lógica |
| `src/hooks/useProdutoSearch.ts` | Adicionar filtro `filtroVoltagem?: number` ao hook | Hook |
| `src/components/ProdutoAutocomplete.tsx` | Prop `filtroVoltagem?: number` passada ao hook | Componente |

**Sem novas dependências npm.** Sonner (toasts) e Badge (shadcn) já em uso.

---

## D-02a — Checkpoint: Regra de Sugestão de Driver

> Esta seção atende o checkpoint obrigatório D-02a antes da implementação.

### Catálogo real de drivers (verificado via Supabase)

**Total: 61 drivers** `tipo_produto = 'driver'`

**Drivers com voltagem preenchida no banco (`tensao` NOT NULL):**

| Voltagem | Potências disponíveis | Drivers |
|----------|-----------------------|---------|
| 12V | 18W, 18W, 24W, 60W, 72W, 200W, 300W, 400W | LM1116 (slim 18W), LM1121 (pro 18W), LM1472 (pro 24W), LM1474 (60W), LM1123 (pro 72W), LM1475 (200W), LM1115 (300W), LM1473 (400W) |
| 24V | 6W, 18W, 36W, 72W, 100W, 150W, 200W | LM1908 (6W), LM1460 (pro 18W), LM1461 (pro 36W), LM1462 (pro 72W), LM2130 (100W), LM1477 (150W), LM1476 (200W — marcado DESCONTINUAR) |

**46 dos 61 drivers têm `tensao = null`** — a voltagem está na descrição (ex: "PARA FITA LED 24V", "PARA FITA LED 12V"). Estes são drivers válidos que devem aparecer no seletor filtrado.

**Drivers 48V:** Apenas LM2343 (100W) e LM2344 (200W) — ambos MAGNETO e com `tensao = null`.

### Regra de sugestão (proposta, baseada nos dados reais)

**Regra [APROVADA por Lenny 2026-06-10 — com refinamento da estimativa]:**
1. Buscar no catálogo drivers onde `tensao = voltagem_da_fita` (coluna preenchida).
2. De todos os encontrados, selecionar o de **menor potência suficiente**: `potencia_watts >= consumoW_estimado * MARGEM_SEGURANCA_DRIVER (1.05)`.
3. **Estimar o consumo (REFINAMENTO APROVADO):**
   - **Se a metragem do sistema já estiver preenchida → usar a metragem REAL** do sistema (`consumoW = metragem_real * wm_da_fita`). Aproveita a informação real quando ela existe.
   - **Se a metragem ainda NÃO estiver preenchida → usar 5m como fallback** (`consumoW = wm_da_fita * 5`), só para não deixar o campo vazio na sugestão inicial.
4. Se nenhum driver com `tensao` preenchida atender → não fazer pré-fill (deixar vazio, filtro ainda funciona via query).

> **Nota de implementação:** o pré-fill dispara no `handleSelectProdutoSistema` quando `component === 'fita'`. Nesse ponto, ler `sis.fita.metragem` (ou campo equivalente do sistema) — se `> 0`, usar como metragem real; senão, 5m. Confirmar o nome exato do campo de metragem no tipo `SistemaIluminacao`/`ItemFitaLED` ao planejar.

**Margem de segurança:** `MARGEM_SEGURANCA_DRIVER = 1.05` (já definida em `src/types/orcamento.ts:118`). [VERIFIED: leitura do código fonte]

### Exemplos reais com produtos do catálogo

**Exemplo 1: Fita LM826 (12V, 5W/m) num ambiente típico de 5m**
- Consumo estimado: 5m × 5W/m = 25W
- Consumo com margem: 25W × 1.05 = 26.25W
- Drivers 12V disponíveis: 18W, 18W, 24W, 60W, 72W...
- Menor potência suficiente: **24W** (LM1472 — DRIVER PRO 24W, para fita 12V)
- Driver sugerido: **LM1472**

**Exemplo 2: Fita LM2040 (24V, 11W/m) num ambiente típico de 5m**
- Consumo estimado: 5m × 11W/m = 55W
- Consumo com margem: 55W × 1.05 = 57.75W
- Drivers 24V disponíveis: 6W, 18W, 36W, 72W, 100W...
- Menor potência suficiente: **72W** (LM1462 — DRIVER PRO 72W, para fita 24V)
- Driver sugerido: **LM1462**

**Exemplo 3: Fita LM1365 (24V, 15W/m) num ambiente típico de 5m**
- Consumo estimado: 5m × 15W/m = 75W
- Consumo com margem: 75W × 1.05 = 78.75W
- Drivers 24V disponíveis: 6W, 18W, 36W, 72W, 100W, 150W...
- Menor potência suficiente: **100W** (LM2130 — DRIVER 100W para fita 24V)
- Driver sugerido: **LM2130**

**Comportamento quando não há driver com `tensao` preenchida suficiente:**
- 48V: LM2343 e LM2344 têm `tensao = null` — não serão encontrados pela busca de `tensao = 48`. Nesse caso: não pré-preencher (campo fica vazio), mas o pré-filtro via query por descrição pode mostrar opções.
- 12V: a lógica funciona bem (8 drivers com tensao preenchida).
- 24V: funciona (7 drivers com tensao preenchida), mas LM1476 está marcado DESCONTINUAR — filtrar por `NOT descricao ILIKE '%DESCONTINUAR%'` ou por `subtipo != 'descontinuado'` se o campo existir.

**Limitação da sugestão de 5m de estimativa:** O pré-fill sugere um driver de potência para 5m. Depois que o colaborador define a metragem real, a qtd de drivers é recalculada automaticamente pelas funções existentes — o pré-fill é só para inicializar o código/voltagem, não a potência definitiva. O colaborador pode trocar.

**Resumo da regra — APROVADA por Lenny (D-02a, 2026-06-10):**
> "Ao selecionar a fita, o sistema estima o consumo usando a **metragem real do sistema se já estiver preenchida** (senão 5m como fallback), aplica a margem de 5% e seleciona o driver de menor potência suficiente entre os drivers de mesma voltagem com `tensao` preenchida no banco. O driver sugerido pode ser trocado a qualquer momento."

✅ **STATUS: APROVADO** (com o refinamento da metragem real acima). Pronto para o planner.

[VERIFIED: catálogo consultado via Supabase service role, 2026-06-10]

---

## D-09a — Checkpoint: Display de Voltagem no Resumo Global de Drivers

> Esta seção atende o checkpoint obrigatório D-09a antes da implementação.

### Layout atual do Resumo Global de Drivers (Step3Revisao.tsx L756-804)

A tabela atual já tem uma coluna "Tensão" dedicada (`<TableHead className="text-right">Tensão</TableHead>`) que exibe `{d.voltagem}V` em célula separada.

Colunas existentes: **Driver** (código + descrição na mesma célula) | Tensão | Consumo Total | Extensão Total | Qtd Global | Soma p/ Ambiente | Economia Potencial

### Problema que o fix precisa resolver

Com o grouping key atual (só `codigo`), duas linhas com o mesmo driver em voltagens diferentes seriam colapsadas numa só — o que é o bug. Após o fix (key = `codigo|voltagem`), duas linhas distintas aparecem para o mesmo código em voltagens diferentes.

A pergunta do D-09a é: quando aparecem "LM2130 | 12V" e "LM2130 | 24V" (hipotético), o colaborador entende por que são duas linhas?

### Proposta visual (para aprovação de Lenny)

**Opção A — Rótulo composto no campo Driver (recomendada):**
```
Driver (coluna)
├─ "LM2130 · 24V"          (fonte mono, texto primário)
└─ "DRIVER 100W para fita LED 24V (100W)"  (texto muted abaixo)
```
A voltagem fica no mesmo elemento visual que o código — imediatamente visível ao escanear a coluna de identificação. A coluna "Tensão" separada pode ser removida (redundante) ou mantida para consistência.

**Opção B — Coluna Tensão separada (situação atual, quase funciona):**
Manter como está. Após o fix do grouping key, cada linha já mostrará a voltagem correta na coluna "Tensão" (`{d.voltagem}V`). O colaborador vê código numa coluna e voltagem em outra.

**Recomendação:** Opção A — rótulo composto `"LM2130 · 24V"` no campo de código dentro da coluna Driver. Mais imediato ao ler: o identificador único visual é o código+voltagem juntos, não dois campos separados. Elimina a coluna "Tensão" separada (simplifica a tabela). Implementação: mudar `{d.driverCodigo}` para `` `${d.driverCodigo} · ${d.voltagem}V` `` no `<div className="font-mono text-xs">` e remover a coluna `<TableHead>Tensão</TableHead>` + a célula `<TableCell>{d.voltagem}V</TableCell>`.

✅ **STATUS: APROVADO por Lenny (D-09a, 2026-06-10) — Opção A (rótulo composto, remover coluna Tensão separada).** Pronto para o planner.

[VERIFIED: leitura do código Step3Revisao.tsx L756-804]

---

## Architecture Patterns

### Padrão de pré-filtro de voltagem em useProdutoSearch

**Situação atual:**
```typescript
// useProdutoSearch.ts — filtro atual
if (filtro === 'fita' || filtro === 'driver' || filtro === 'perfil') {
  queryBuilder = queryBuilder.eq('tipo_produto', filtro);
}
```

**Extensão necessária (pré-filtro de voltagem):**
```typescript
export function useProdutoSearch(
  query: string,
  filtro: ProdutoFiltro = 'todos',
  filtroVoltagem?: number   // NOVO — undefined = sem filtro
) {
  // ...
  if (filtro === 'driver' && filtroVoltagem !== undefined) {
    // Inclui drivers com tensao == voltagem OU tensao IS NULL
    // (46/61 drivers têm tensao null mas são compatíveis por descrição)
    queryBuilder = queryBuilder.or(
      `tensao.eq.${filtroVoltagem},tensao.is.null`
    );
  }
}
```

**Justificativa:** 46 dos 61 drivers têm `tensao = null`. Filtrar apenas por `tensao = X` deixaria o seletor quase vazio. A query `tensao.eq.X OR tensao.is.null` mostra todos os drivers potencialmente compatíveis — o colaborador ainda pode errar, mas o badge de divergência corrige isso.

[VERIFIED: consulta ao banco Supabase, 2026-06-10]

### Padrão de pré-fill de driver em handleSelectProdutoSistema

```typescript
// AmbienteCard.tsx — dentro do branch component === 'fita'
} else if (component === 'fita') {
  const fitaAtualizada = {
    ...sis.fita,
    codigo: produto.codigo,
    // ... outros campos ...
    voltagem: (produto.voltagem ?? sis.fita.voltagem) as 12 | 24 | 48,
    wm: produto.wm ?? sis.fita.wm,
  };
  
  // D-01: pré-fill só se driver ainda vazio (código === '')
  // D-03: se driver não vazio mas voltagem incompatível → só avisar, NÃO substituir
  let driverAtualizado = sis.driver;
  const fitaVoltagem = fitaAtualizada.voltagem;
  const driverVazio = !sis.driver.codigo;
  
  if (driverVazio && fitaVoltagem) {
    const sugerido = await buscarDriverSugerido(fitaVoltagem, fitaAtualizada.wm);
    if (sugerido) {
      driverAtualizado = {
        ...sis.driver,
        codigo: sugerido.codigo,
        descricao: sugerido.descricao,
        voltagem: (sugerido.voltagem ?? fitaVoltagem) as 12 | 24 | 48,
        potencia: sugerido.driver_potencia_w ?? sis.driver.potencia,
        precoUnitario: sugerido.preco_tabela ?? sis.driver.precoUnitario,
        precoMinimo: sugerido.preco_minimo ?? sis.driver.precoMinimo,
      };
    }
  }
  
  updateSistema(sistemaIndex, {
    ...sis,
    fita: fitaAtualizada,
    driver: driverAtualizado,
  });
}
```

**Nota sobre async:** `handleSelectProdutoSistema` é atualmente síncrono. A busca do driver sugerido precisa de uma query Supabase. Duas abordagens:
- **A (recomendada):** Tornar o handler `async` — já é prática comum no codebase (`persistirOrcamento`, `handleSolicitarExcecao` são async).
- **B:** Buscar drivers disponíveis de antemão via `useQuery` e fazer o cálculo localmente — mais complexo, mas sem loading spinner.

### Padrão de badge persistente de divergência

Badge inline no card de sistema, calculado derivativamente do state (sem estado próprio):

```typescript
// Dentro do render do sistema em AmbienteCard.tsx
const fitaVoltagem = sis.fita.voltagem;
const driverVoltagem = sis.driver.voltagem;
const temDivergencia = (
  !!sis.fita.codigo &&    // fita preenchida
  !!sis.driver.codigo &&  // driver preenchido  
  fitaVoltagem !== undefined &&
  driverVoltagem !== undefined &&
  fitaVoltagem !== driverVoltagem
);

// No JSX do header do sistema:
{temDivergencia && (
  <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
    ⚠ {fitaVoltagem}V × {driverVoltagem}V
  </Badge>
)}
```

Badge some automaticamente quando `fitaVoltagem === driverVoltagem` (derivado do state, sem limpeza manual).

### Fix do grouping key em calcularDriversPorProjeto

**Código atual (L300 em orcamento.ts):**
```typescript
const cod = sis.driver.codigo;
// ...
grupos.get(cod) / grupos.set(cod, ...)
```

**Fix:**
```typescript
// Chave composta: código + voltagem — dois sistemas com mesmo driver
// em voltagens diferentes geram linhas distintas (D-08 / C-4)
const chave = `${sis.driver.codigo}|${sis.driver.voltagem}`;
// ...
grupos.get(chave) / grupos.set(chave, ...)

// No loop de saída:
for (const [chave, g] of grupos) {
  // driverCodigo extraído da chave (antes do '|')
  const driverCodigo = chave.split('|')[0];
  resultado.push({ driverCodigo, ... });
}
```

**Atenção:** A interface `ResumoDriverProjeto` já tem campo `voltagem: 12 | 24 | 48` (L279) — não precisa mudar a interface, só a chave do Map e garantir que o campo `voltagem` seja populado corretamente (já está: `voltagem: sis.driver.voltagem` na linha de criação do grupo).

[VERIFIED: leitura do código orcamento.ts L288-342]

### Advisory TINY (D-06/D-07)

**Detecção via dado (não regex):**
```typescript
// AmbienteCard.tsx — em handleSelectProdutoLuminaria (já existe lógica em L89)
// D-07: usar produto.sistema_magnetico === 'tiny_magneto' como condição primária
if (produto.sistema_magnetico === 'tiny_magneto') {
  toast.warning(
    'Driver 24V externo obrigatório para TINY MAG. Inclua o driver no sistema de iluminação correspondente.',
    { duration: 9000 }
  );
}
```

**Badge persistente (advisory, não bloqueante):**
```typescript
// Em ItemLuminaria já existe campo sistema?: string | null (L32)
// Badge no card de luminária quando item.sistema === 'tiny_magneto'
{item.sistema === 'tiny_magneto' && (
  <Badge variant="outline" className="text-[10px] border-amber-400 text-amber-700 bg-amber-50">
    requer driver 24V externo
  </Badge>
)}
```

[VERIFIED: leitura AmbienteCard.tsx L89-95; dados TINY via Supabase]

### Reformulação do toast de divergência (D-05)

**Código atual (AmbienteCard.tsx L137-154) — bloqueante com `return`:**
```typescript
// REMOVER: return após toast — isso bloqueia a seleção
toast.error(`⚠️ Tensão incompatível! ...`);
return; // ← REMOVER ESTE RETURN
```

**Novo comportamento (orientativo, não bloqueante):**
```typescript
// Ao selecionar driver com voltagem diferente da fita:
if (component === 'driver' && produto.voltagem && sis.fita.voltagem) {
  if (produto.voltagem !== sis.fita.voltagem) {
    toast.warning(
      `Atenção: driver ${produto.voltagem}V com fita ${sis.fita.voltagem}V — certifique-se de que a combinação está correta.`,
      { duration: 6000 }
    );
    // SEM return — permite salvar a seleção divergente
  }
}
```

O badge persistente (derivado do state) mantém o aviso visual enquanto a divergência existir.

---

## Don't Hand-Roll

| Problema | Não construir | Usar em vez disso |
|----------|--------------|-------------------|
| Filtro de driver por voltagem | Query customizada com join | `useProdutoSearch` estendido com `filtroVoltagem?: number` |
| Aviso persistente de divergência | Estado booleano separado `isDivergente` | Badge derivado diretamente de `sis.fita.voltagem !== sis.driver.voltagem` |
| Toasts | Componente próprio de alerta | `toast.warning()` do sonner já em uso |
| Lookup de driver sugerido | Cache local de drivers | Query direta via supabase client (async handler, padrão do codebase) |

---

## Common Pitfalls

### Pitfall 1: Pré-filtro vazio para 12V e 24V

**O que dá errado:** Filtrar `tensao.eq.12` para drivers 12V retorna apenas 8 drivers. 46 drivers têm `tensao = null` mas são válidos.
**Por que acontece:** Dados históricos sem preenchimento da coluna `tensao` na tabela `produtos`.
**Como evitar:** Usar `tensao.eq.X OR tensao.is.null` na query. Aceitável mostrar mais drivers do que o necessário — o badge de divergência corrige seleções erradas.
**Sinal de alerta:** Seletor de driver quase vazio após filtrar por voltagem.

[VERIFIED: consulta direta ao banco, 2026-06-10]

### Pitfall 2: Bloqueio indevido entre ambientes (origem real)

**O que dá errado:** Criar Ambiente A com 24V e Ambiente B com 12V → o sistema bloqueia seleção no Ambiente B.
**Por que acontece:** `novaFita.voltagem = 24` e `novoDriver.voltagem = 24` são os defaults em `addSistema()` (AmbienteCard.tsx L63-64). Quando o colaborador seleciona uma fita 12V, a validação de tensão no branch `component === 'fita'` (L146-154) compara `produto.voltagem (12)` com `sis.driver.voltagem (24)` — o driver é o objeto padrão vazio, não um driver real do outro ambiente.
**Como evitar:** Remover o `return` da validação bloqueante (D-05). O badge de divergência cobre o caso legítimo. Não alterar os defaults de `addSistema()` (pitfall C-3 do STATE.md).
**Sinal de alerta:** Usuário não consegue salvar uma fita 12V num sistema cujo driver ainda tem o código vazio.

[VERIFIED: leitura AmbienteCard.tsx L63-64 + L146-154]

### Pitfall 3: Pré-fill sobrescreve driver manual

**O que dá errado:** Colaborador ajusta o driver manualmente; troca a fita; driver é sobrescrito.
**Por que acontece:** Pré-fill sem verificar se driver está vazio.
**Como evitar:** Pré-fill só quando `sis.driver.codigo === ''` (D-03). Mudança de fita com driver já preenchido → só toast + badge de divergência se voltagens divergirem.

[VERIFIED: leitura da decisão D-03 em CONTEXT.md]

### Pitfall 4: LM1476 marcado DESCONTINUAR

**O que dá errado:** Driver sugerido seria LM1476 (200W 24V) que está marcado "DESCONTINUAR" na descrição.
**Por que acontece:** Está `tensao = 24V` no banco e seria elegível pela regra.
**Como evitar:** Na query de busca do driver sugerido, adicionar `.not('descricao', 'ilike', '%DESCONTINUAR%')`.

[VERIFIED: dados do catálogo via Supabase, 2026-06-10]

### Pitfall 5: Handler async em handleSelectProdutoSistema

**O que dá errado:** Tornar `handleSelectProdutoSistema` async sem cuidado pode introduzir condição de corrida se o colaborador clicar duas vezes rapidamente.
**Por que acontece:** React pode re-renderizar entre o disparo e a resolução da promise.
**Como evitar:** Adicionar flag `isLoading` local (useState no AmbienteCard) para desabilitar o seletor de driver enquanto o pré-fill está buscando. Alternativamente: usar abordagem B (pré-carregar drivers via useQuery e calcular localmente, sem async no handler).

---

## Code Examples

### Query de driver sugerido (busca pontual, async)

```typescript
// Dentro de handleSelectProdutoSistema, branch component === 'fita'
// Source: padrão Supabase JS SDK v2 do codebase (useProdutoSearch.ts)
const buscarDriverSugerido = async (
  voltagem: number,
  wm: number
): Promise<Produto | null> => {
  const consumoEstimado = wm * 5 * 1.05; // 5m típico + margem
  const { data } = await supabase
    .from('produtos')
    .select(
      'id, codigo, descricao, preco_tabela, preco_minimo, ' +
      'voltagem:tensao, driver_potencia_w:potencia_watts, driver_tipo:subtipo'
    )
    .eq('tipo_produto', 'driver')
    .eq('tensao', voltagem)
    .gte('potencia_watts', consumoEstimado)
    .not('descricao', 'ilike', '%DESCONTINUAR%')
    .order('potencia_watts', { ascending: true })
    .limit(1);
  return data?.[0] ?? null;
};
```

### Extensão de useProdutoSearch com filtroVoltagem

```typescript
// Source: leitura de useProdutoSearch.ts
export function useProdutoSearch(
  query: string,
  filtro: ProdutoFiltro = 'todos',
  filtroVoltagem?: number   // NOVO
) {
  // ...dentro do useEffect, após o filtro de tipo_produto:
  if (filtro === 'driver' && filtroVoltagem !== undefined) {
    queryBuilder = queryBuilder.or(
      `tensao.eq.${filtroVoltagem},tensao.is.null`
    );
  }
}
```

### Extensão de ProdutoAutocomplete com filtroVoltagem

```typescript
// Source: leitura de ProdutoAutocomplete.tsx
interface ProdutoAutocompleteProps {
  value: string;
  onSelect: (produto: Produto) => void;
  placeholder?: string;
  className?: string;
  filtro?: ProdutoFiltro;
  filtroVoltagem?: number; // NOVO
}

// Uso no AmbienteCard para o seletor de driver:
<ProdutoAutocomplete
  value={sis.driver.codigo}
  onSelect={(p) => handleSelectProdutoSistema(p, si, 'driver')}
  placeholder="Código do driver"
  filtro="driver"
  filtroVoltagem={sis.fita.voltagem}  // NOVO — pré-filtra por voltagem da fita
/>
```

---

## Runtime State Inventory

Fase puramente de código/lógica frontend + lógica de cálculo. Não há rename, migração de dados ou estado em serviço externo. Omitida conforme instrução (fase não é rename/refactor/migration).

---

## Environment Availability

Fase sem dependências externas além das já presentes no projeto. Supabase, sonner e shadcn já disponíveis. Omitida seção detalhada (code-only changes).

---

## State of the Art

| Situação atual | Após a fase | Impacto |
|----------------|-------------|---------|
| Validação bloqueante com `return` (L137-154) | Toast orientativo + badge persistente, sem bloqueio | Remove bloqueio indevido entre ambientes |
| Grouping key só por `codigo` | Grouping key `codigo\|voltagem` | Ambientes com mesmo driver em voltagens diferentes geram linhas distintas no resumo |
| Driver selecionado manualmente pelo colaborador | Pré-fill automático quando driver vazio, filtro por voltagem | UX proativa, menos erro |
| Advisory TINY por regex de descrição | Detecção via `sistema_magnetico === 'tiny_magneto'` (dado confiável) | Detecção robusta |

---

## Assumptions Log

| # | Claim | Section | Risk se errado |
|---|-------|---------|----------------|
| A1 | Estimativa de 5m de metragem para o pré-fill do driver sugerido é representativa de um ambiente típico | D-02a — Checkpoint | Driver sugerido pode ser sub-dimensionado para ambientes maiores — mas é apenas sugestão inicial, colaborador troca |
| A2 | `tensao.eq.X OR tensao.is.null` é sintaxe Supabase JS SDK válida para o filtro combinado | Padrão de pré-filtro | Query retornaria erro — verificar na implementação com teste da query |
| A3 | O campo `sis.fita.voltagem` sempre está disponível quando uma fita real é selecionada (não undefined) | Badge de divergência | Badge não apareceria se voltagem for undefined — guard `?? undefined` já no código |

**Se a tabela não estiver vazia:** A1 é de baixo risco (sugestão, não obrigação). A2 deve ser verificado no primeiro plano de implementação. A3 é coberto pela estrutura de tipo `voltagem?: 12 | 24 | 48` em `ItemFitaLED`.

---

## Open Questions

1. **Drivers com tensao null para 48V**
   - O que sabemos: LM2343 e LM2344 (drivers MAGNETO 48V) têm `tensao = null` no banco.
   - Lacuna: Não há drivers com `tensao = 48` no banco. O pré-fill para fitas 48V não encontrará nada via `tensao.eq.48`.
   - Recomendação: Para 48V, não fazer pré-fill (deixar vazio e deixar o colaborador selecionar manualmente). O advisory TINY (D-06) cobre o aviso de driver 24V para TINY, que é o caso mais crítico. O MAGNETO 48V fica para v1.3.

2. **Sincronização de voltagem do driver após pré-fill async**
   - O que sabemos: `handleSelectProdutoSistema` é síncrono atualmente.
   - Lacuna: Tornar async introduz window de state inconsistente se colaborador interagir durante a query.
   - Recomendação: Avaliar na implementação se adicionar flag de loading local ou pré-carregar drivers via useQuery. Decisão pode ser deixada para o planner.

---

## Sources

### Primary (HIGH confidence — código lido nesta sessão)
- `src/types/orcamento.ts` (lido completo, L1-442) — estruturas de dados, `calcularDriversPorProjeto`, `MARGEM_SEGURANCA_DRIVER`
- `src/components/AmbienteCard.tsx` (lido completo, L1-547) — `handleSelectProdutoSistema`, toast atual, branch tiny_magneto
- `src/hooks/useProdutoSearch.ts` (lido completo) — filtro atual, alias de colunas
- `src/components/ProdutoAutocomplete.tsx` (lido completo) — props, integração com hook
- `src/components/Step3Revisao.tsx` (lido completo, L1-837) — Resumo Global de Drivers (L756-804), layout das tabelas
- Supabase service role query ao banco prod — catálogo completo de 61 drivers com voltagem e potência
- `.planning/phases/15-tens-o-valida-o/15-CONTEXT.md` — decisões D-01 a D-10
- `.planning/REQUIREMENTS.md` — TENS-01, TENS-02, SIST-04, UX-02
- `.planning/STATE.md` — pitfalls C-3, C-4; execution directives

### Secondary (MEDIUM confidence)
- `.planning/ROADMAP.md §Phase 15` — success criteria (5 critérios verificados)

---

## Metadata

**Confidence breakdown:**
- Catálogo de drivers: HIGH — consultado diretamente via Supabase service role (2026-06-10)
- Código a modificar: HIGH — todos os 4 arquivos lidos na íntegra
- Arquitetura de extensão (filtroVoltagem, async handler): MEDIUM — padrão inferido do código existente, sem prova de conceito executada
- Regra de sugestão de 5m: MEDIUM — estimativa razoável mas não confirmada com Lenny (checkpoint D-02a)

**Research date:** 2026-06-10
**Valid until:** 2026-07-10 (catálogo de produtos pode mudar; código base é estável)
