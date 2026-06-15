# Phase 20: Fluxos Magnéticos — Research

**Researched:** 2026-06-15
**Domain:** UI de montagem de sistemas compostos (AmbienteCard product-first + cards de composição magnética)
**Confidence:** HIGH — todo achado baseado em leitura direta do código-fonte atual

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Busca product-first é o único ponto de entrada. AmbienteCard deixa de ter abas Luminárias/Sistemas e passa a ter busca única + lista única. O colaborador busca o produto; o sistema lê `product.sistema` / `tipo_produto` e roteia automaticamente. Sem chips, sem galeria, sem seletor de categoria.
- **D-02:** Roteamento de detecção a partir do produto âncora: luminária avulsa → item simples em `luminarias[]`; fita LED → `SistemaIluminacao` em `sistemas[]` (card e cálculo atuais de Fita Padrão, byte-idênticos); trilho MAGNETO 48V (`sistema='magneto_48v'`) → inicia composição em `luminarias[].composicao[]`; trilho TINY 24V (`sistema='tiny_magneto'`) → inicia composição; perfil modular → reconhecido mas montagem é Phase 21.
- **D-03:** Fallback gracioso, nunca interrompe. Dado sujo/ausente → item simples + ação manual "converter em sistema". Nunca pergunta "isto é um trilho?".
- **D-04:** Busca global cria apenas a âncora. Filhos (módulos, conector, driver) são adicionados dentro do card da composição.
- **D-05:** SIST-05 e seletor de tipo estão oficialmente removidos. Badge informativo de tipo detectado é bem-vindo mas não obrigatório.
- **D-06:** Carga total derivada automaticamente de `Σ(módulo.potenciaW × quantidade)`. Sem entrada manual de carga.
- **D-07:** Painel de recomendação de driver dentro do card com botão "aplicar". Buckets 48V: LM2343 (100W) / LM2344 (200W) com margem ×1.05; 24V: menor driver compatível do catálogo (`potencia >= carga×1.05`, `tensao=24`).
- **D-08:** Carga > 200W (48V): painel avisa que excede capacidade de um único driver e recomenda N circuitos — NÃO auto-insere a combinação.
- **D-09:** Checklist lê `REGRAS_COMPOSICAO[sistema]` (no código, Phase 19/D-07). Não-bloqueante nesta fase.
- **D-10:** TINY — conector satisfeito com LM3168 OU LM3169. Atalho "adicionar" usa LM3168 como default.
- **D-11:** Kit LM2987 obrigatório apenas para versão embutir. Detecção por regex `/EMBUTIR/i` na descrição do trilho âncora.
- **D-12:** Voltage lock por construção. Composição 48V → busca de driver retorna apenas drivers 48V. Voltagem inferida do trilho âncora.

### Claude's Discretion

- Mecânica fina da camada de apresentação da lista única (ordenação `luminarias[]` + `sistemas[]` mesclados na UI; arrays subjacentes permanecem separados e intactos).
- Forma exata do badge informativo de tipo no card; layout do painel de driver e do checklist (compor primitivos shadcn existentes).
- Como o painel de driver re-reflete mudança de carga após "aplicar" (re-sinaliza se o driver aplicado ficar subdimensionado depois de mexer nos módulos).
- `papel` exato do driver aplicado no `composicao[]` (vocabulário D-05 da Phase 19: `driver_recomendado` / `driver_obrigatorio`).
- Detecção precisa de "embutir" (regex em descrição vs flag de catálogo).

### Deferred Ideas (OUT OF SCOPE)

- Elementos de descoberta (chips de família, galeria visual de tipos, badge prominente).
- Montagem SYSTEM MOLD / modular (SIST-03) — Phase 21.
- Aviso bloqueante Step 2→3 com sistema incompleto (VAL-01) — Phase 21.
- Duplicar sistema composto entre ambientes (DUP-01) — Phase 21.
- PDF v3 — seção de compostos (PDF-03) — Phase 22.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SIST-05 | Colaborador adiciona produtos por busca única (product-first) e o sistema detecta automaticamente o tipo de fluxo — sem seleção manual | Seção "AmbienteCard: Reorganização" — roteamento via `produto.sistema_magnetico` / `produto.tipo_produto` no `handleSelectProdutoLuminaria` |
| SIST-01 | Montagem MAGNETO 48V (trilho + N módulos) com carga total derivada automaticamente | Seção "Lógica de Detecção e Routing" + "Painel de Driver" — `potenciaW` snapshot em `ItemComposicao`, soma em carga total |
| SIST-02 | Montagem TINY 24V com a mesma mecânica de carga automática, pool de drivers 24V | Seção "Lógica de Detecção e Routing" — mesma mecânica, query Supabase por menor driver 24V |
| COMP-01 | Checklist de componentes obrigatórios por família (MAGNETO 48V → LM2338; TINY → LM3168 ou LM3169) | Seção "Checklist REGRAS_COMPOSICAO" — leitura direta da constante já em `orcamento.ts:150` |
| COMP-02 | Quando componente obrigatório ausente, atalho "adicionar componente" insere SKU correto em um clique | Seção "Checklist REGRAS_COMPOSICAO" — botão "+ Adicionar" popula `composicao[]` com snapshot do catálogo |
| COMP-03 | Trilho magnético 48V trava seletor de driver em 48V — hard lock por construção | Seção "Voltage Lock por Construção" — `filtroVoltagem` prop já existe em `ProdutoAutocomplete` |
| DRV-01 | Sistema dimensiona driver automaticamente (48V: LM2343/LM2344 ×1.05; 24V: menor compatível) com revisão/sobrescrever | Seção "Painel de Driver" — promove `analisarMagneto48V` de aviso → ação; helper novo para 24V |
| DRV-02 | Painel de recomendação exibe SKU + quantidade e oferece botão "aplicar" que preenche driver da composição | Seção "Painel de Driver" — 5 estados visuais definidos (sem carga, recomendado, aplicado, subdimensionado, >200W) |
</phase_requirements>

---

## Summary

A Phase 20 reorganiza o AmbienteCard de uma estrutura de abas (Luminárias / Sistemas) para uma busca product-first única com lista unificada de itens. A mudança é principalmente de UI e de roteamento — a fundação de dados (`ItemComposicao`, `REGRAS_COMPOSICAO`, `calcularSubtotalComposicao`) foi entregue pela Phase 19 e está em produção. O código a criar é: (1) a lógica de roteamento no `handleSelectProdutoLuminaria` que detecta o tipo pelo produto âncora, (2) o `ComposicaoCard` — sub-componente inline dentro do `AmbienteCard` que exibe módulos, painel de driver e checklist, (3) o helper de recomendação de driver 24V (query Supabase por menor driver compatível), e (4) as buscas escopadas (filtro de módulos por família + voltage lock no driver).

Os 5 calc sites de Fita Padrão (`calcularDemandaFita`, `calcularConsumoW`, `calcularQtdDrivers`, `calcularSubtotalSistemaSemFita`, `isSistemaVazio`) permanecem byte-idênticos. `luminarias[]` e `sistemas[]` continuam como arrays separados na camada de dados — a "lista única" é puramente visual. Nenhuma nova dependência de biblioteca é necessária.

**Recomendação primária:** Extrair o `ComposicaoCard` como componente separado em `src/components/ComposicaoCard.tsx` para manter o `AmbienteCard.tsx` abaixo de ~800 linhas e isolar a nova lógica de risco baixo de Fita Padrão já existente.

---

## Standard Stack

### Core (nenhuma nova biblioteca necessária)

[VERIFIED: leitura direta do codebase]

| Biblioteca | Versão | Propósito nesta fase |
|-----------|--------|---------------------|
| React 18 + TypeScript | 18.3.1 / 5.8.3 | Componentes e state management (useState) |
| shadcn-ui (Radix UI) | 1.x | Badge, Button, Input, Collapsible — todos já instalados |
| lucide-react | 0.462.0 | Check, AlertCircle, Plus, Trash2 — já importados em AmbienteCard |
| Supabase JS SDK | 2.95.3 | Query para driver 24V recomendado (única nova query desta fase) |
| Tailwind CSS | 3.4.17 | Utilitários de cor para estados do painel de driver |

### Nenhuma nova instalação necessária

Toda a UI desta fase é composta de primitivos já instalados. A única interação nova com Supabase é uma query para o driver 24V menor compatível (mesmo padrão de `buscarDriverSugerido` já em `AmbienteCard.tsx:148`).

---

## Architecture Patterns

### Estrutura de arquivos após Phase 20

```
src/
├── components/
│   ├── AmbienteCard.tsx          (alvo principal — reorganização + detecção)
│   ├── ComposicaoCard.tsx        (NOVO — card de composição magnética)
│   └── ProdutoAutocomplete.tsx   (reaproveitado com filtro escopado)
├── types/
│   └── orcamento.ts              (REGRAS_COMPOSICAO já existe; possível helper detectarTipoAncora)
└── hooks/
    └── useProdutoSearch.ts       (ProdutoFiltro já tem 'conector'/'kit_fixacao'; possível filtroSistema)
```

### Pattern 1: Detecção de tipo no handleSelectProdutoLuminaria (roteamento product-first)

**O que é:** Lógica de roteamento que lê `produto.sistema_magnetico` e `produto.tipo_produto` para determinar para qual fluxo encaminhar.

**Quando usar:** Toda vez que o usuário seleciona um produto na busca global do AmbienteCard.

```typescript
// Fonte: AmbienteCard.tsx:92 — handleSelectProdutoLuminaria (extensão, não substituição)
// produto.sistema_magnetico mapeia product_variants.sistema (via useProdutoSearch alias)

function detectarTipoAncora(produto: Produto): 'luminaria' | 'fita' | 'magneto_48v' | 'tiny_magneto' | 'modular' {
  const sistema = produto.sistema_magnetico; // alias de product_variants.sistema
  const tipo = produto.tipo_produto;
  
  if (tipo === 'fita') return 'fita';
  if (sistema === 'magneto_48v') return 'magneto_48v';
  if (sistema === 'tiny_magneto') return 'tiny_magneto';
  if (sistema === 's_mode') return 'modular'; // Phase 21 — entra como item simples
  return 'luminaria'; // fallback seguro (D-03)
}
```

**NOTA CRÍTICA:** `produto.sistema_magnetico` é o alias de `product_variants.sistema` definido na query de `useProdutoSearch` (linha 24: `"sistema_magnetico:sistema"`). O campo no banco é `sistema`, não `sistema_magnetico`. Ao criar filtros de busca escopada (módulos 48V, módulos 24V), usar `.eq('sistema', 'magneto_48v')` — não o alias.

### Pattern 2: Inicialização da composição ao detectar trilho magnético

**O que é:** Quando trilho MAGNETO/TINY é detectado, criar um `ItemLuminaria` com `composicao: []` (array vazio mas presente, sinalizando que é raiz de composição).

```typescript
// Fonte: extensão de AmbienteCard.tsx handleSelectProdutoLuminaria
// O trilho âncora entra como primeiro item no próprio campo principal (preço, qtd, código)
// composicao: [] sinaliza ao renderer que este item deve usar ComposicaoCard

const novaRaiz: ItemLuminaria = {
  id: uid(),
  codigo: produto.codigo,
  descricao: produto.descricao,
  quantidade: 1,
  precoUnitario: Math.round((produto.preco_tabela || 0) * 100) / 100,
  precoMinimo: Math.round((produto.preco_minimo || 0) * 100) / 100,
  imagemUrl: produto.imagem_url || undefined,
  sistema: produto.sistema_magnetico ?? null,      // 'magneto_48v' | 'tiny_magneto'
  potencia_watts: produto.driver_potencia_w ?? null,
  tensao: produto.voltagem ?? null,
  composicao: [],  // presença de composicao[] (mesmo vazio) ativa o ComposicaoCard
};
```

### Pattern 3: Busca escopada dentro do ComposicaoCard (voltage lock)

**O que é:** `ProdutoAutocomplete` com `filtroSistema` ou `filtroVoltagem` para limitar o resultado a produtos da família correta.

O hook `useProdutoSearch` já aceita `filtroVoltagem` para driver (linha 35: `queryBuilder.or(`tensao.eq.${filtroVoltagem},tensao.is.null`)`). Para módulos, o escopo deve ser pelo campo `sistema`:

```typescript
// Em useProdutoSearch.ts — extensão (adição de 'modulo_magnetico' ao ProdutoFiltro)
// OU usar filtroSistema?: string como novo parâmetro opcional

// Para módulos MAGNETO 48V (excluir trilhos e conectores):
// .eq('sistema', 'magneto_48v')
// .not('tipo_produto', 'in', '("driver","conector","kit_fixacao")')

// Para busca de driver com voltage lock 48V (já funciona):
// filtro='driver' + filtroVoltagem={48}
// → useProdutoSearch linha 35: .or(`tensao.eq.48,tensao.is.null`)
```

### Pattern 4: Adicionar módulo à composição (snapshot pattern)

**O que é:** Ao selecionar um módulo no `ComposicaoCard`, criar um `ItemComposicao` com campos técnicos congelados no add-time.

```typescript
// Fonte: Phase 19 D-03 — snapshot pattern; ItemComposicao:43 em orcamento.ts
const novoModulo: ItemComposicao = {
  id: crypto.randomUUID(),
  codigo: produto.codigo,
  descricao: produto.descricao,
  quantidade: 1,
  precoUnitario: Math.round((produto.preco_tabela || 0) * 100) / 100,
  precoMinimo: Math.round((produto.preco_minimo || 0) * 100) / 100,
  imagemUrl: produto.imagem_url || undefined,
  papel: 'modulo',
  obrigatorio: false,
  potenciaW: produto.driver_potencia_w ?? undefined,  // snapshot de potencia_watts
};
```

### Pattern 5: Cálculo de carga total da composição

**O que é:** Derivar carga total somando `potenciaW × quantidade` de todos os módulos (papel='modulo') da composição.

```typescript
// Função pura — pode ser helper em orcamento.ts ou inline no ComposicaoCard
function calcularCargaComposicao(composicao: ItemComposicao[]): number {
  return composicao
    .filter(c => c.papel === 'modulo')
    .reduce((s, c) => s + (c.potenciaW ?? 0) * c.quantidade, 0);
}
```

### Pattern 6: Recomendação de driver 48V (promoção de analisarMagneto48V)

**O que é:** `analisarMagneto48V` (orcamento.ts:317) já calcula `driverRecomendado` com a lógica correta. Para o painel "aplicar", reaproveitar a lógica e adicionar o fetch do produto real pelo SKU.

A função atual recebe `Ambiente` e filtra `amb.luminarias` por `sistema === 'magneto_48v'`. No Phase 20, o `ComposicaoCard` tem a carga disponível diretamente — não precisa varrer o ambiente. Reusar a lógica:

```typescript
// Derivado de analisarMagneto48V (orcamento.ts:317-338)
// Para ComposicaoCard, calcular diretamente:
const potenciaSeguraW = cargaTotalW * MARGEM_SEGURANCA_DRIVER; // MARGEM_SEGURANCA_DRIVER = 1.05
const skuRecomendado = potenciaSeguraW <= 100 ? 'LM2343' :
                       potenciaSeguraW <= 200 ? 'LM2344' : null; // null = >200W, dividir
```

### Pattern 7: Recomendação de driver 24V (helper novo)

**O que é:** Query Supabase para o menor driver 24V com `potencia >= carga×1.05`. Mesmo padrão de `buscarDriverSugerido` (AmbienteCard.tsx:148).

```typescript
// Fonte: AmbienteCard.tsx:148-161 — buscarDriverSugerido (padrão estabelecido)
// Adaptação para composição TINY 24V:
const buscarDriverTiny24V = async (cargaTotalW: number): Promise<Produto | null> => {
  const consumoNecessario = cargaTotalW * MARGEM_SEGURANCA_DRIVER;
  const { data } = await supabase
    .from('produtos')
    .select('id, codigo, descricao, preco_tabela, preco_minimo, voltagem:tensao, driver_potencia_w:potencia_watts')
    .eq('tipo_produto', 'driver')
    .eq('tensao', 24)
    .gte('potencia_watts', consumoNecessario)
    .not('descricao', 'ilike', '%DESCONTINUAR%')
    .order('potencia_watts', { ascending: true })
    .limit(1);
  return (data?.[0] as Produto) ?? null;
};
```

### Pattern 8: Aplicar driver na composição (botão "Aplicar")

**O que é:** Ao clicar "Aplicar", inserir um `ItemComposicao` com `papel='driver_recomendado'` no `composicao[]` da luminária âncora.

```typescript
// papel: 'driver_recomendado' — vocabulário da Phase 19 D-05
const driverItem: ItemComposicao = {
  id: crypto.randomUUID(),
  codigo: driverProduto.codigo,
  descricao: driverProduto.descricao,
  quantidade: 1,
  precoUnitario: Math.round((driverProduto.preco_tabela || 0) * 100) / 100,
  precoMinimo: Math.round((driverProduto.preco_minimo || 0) * 100) / 100,
  papel: 'driver_recomendado',
  obrigatorio: true,
  potenciaW: driverProduto.driver_potencia_w ?? undefined,
};
```

### Pattern 9: Checklist lendo REGRAS_COMPOSICAO

**O que é:** Verificar presença dos SKUs obrigatórios consultando `composicao[]` da luminária âncora.

```typescript
// Fonte: REGRAS_COMPOSICAO (orcamento.ts:150-165)
// magneto_48v: { conectoresObrigatorios: ['LM2338'], kitFixacaoEmbutir: 'LM2987' }
// tiny_magneto: { conectoresObrigatorios: ['LM3168', 'LM3169'], kitFixacaoEmbutir: 'LM2987' }

const regras = REGRAS_COMPOSICAO[item.sistema ?? ''];
if (!regras) return null; // sem regras = sem checklist

// Verificação de conector: para TINY, OR entre LM3168/LM3169 (D-10)
const temConector = regras.conectoresObrigatorios.some(
  sku => item.composicao?.some(c => c.codigo === sku)
);

// Verificação de kit de fixação (apenas se trilho âncora tem EMBUTIR na descrição)
const ehEmbutir = /EMBUTIR/i.test(item.descricao);
const temKit = !ehEmbutir || item.composicao?.some(c => c.codigo === regras.kitFixacaoEmbutir);
```

### Pattern 10: Renderer da lista unificada (presentational merge)

**O que é:** A lista única no AmbienteCard itera `luminarias[]` primeiro, depois `sistemas[]`. Arrays não mudam.

```typescript
// No JSX do AmbienteCard, substituir as <Tabs> por lista flat:
<div className="space-y-3 mt-4">
  {ambiente.luminarias.map((item, i) => {
    // item com composicao?.length > 0 → ComposicaoCard
    if (item.composicao !== undefined) {
      return <ComposicaoCard key={item.id} item={item} onChange={...} onRemove={...} />;
    }
    // item sem composicao → linha simples (existente)
    return <LinhaLuminaria key={item.id} item={item} ... />;
  })}
  {ambiente.sistemas.map((sis, si) => (
    // Card de Fita Padrão — byte-identical, sem alteração
    <SistemaFitaCard key={sis.id} sis={sis} ... />
  ))}
  {/* Estado vazio */}
  {ambiente.luminarias.length === 0 && ambiente.sistemas.length === 0 && (
    <p className="text-xs text-muted-foreground text-center py-4">
      Nenhum item adicionado. Use a busca acima para adicionar luminárias ou sistemas.
    </p>
  )}
</div>
```

### Anti-Patterns a Evitar

- **Não mover Fita Padrão para o novo fluxo de composição:** O card de `SistemaIluminacao` (Fita Padrão) permanece 100% intacto em `sistemas[]`. Apenas o ponto de entrada muda (busca detecta `tipo_produto='fita'` e chama `addSistema()` existente).
- **Não criar filtro de luminária que exclua todos os tipos magnéticos:** O filtro `filtro='luminaria'` em `useProdutoSearch` atualmente usa `tipo_produto.in.(spot,lampada,acessorio,conector,suporte)`. Produtos com `sistema='magneto_48v'` e `tipo_produto='spot'` ou `null` já aparecem. Não adicionar exclusão de `sistema` nesse filtro.
- **Não usar `analisarMagneto48V(ambiente)` para o painel do ComposicaoCard:** Essa função varre `amb.luminarias` inteiras (Phase 19 compatibilidade). O `ComposicaoCard` tem a carga diretamente via `calcularCargaComposicao(item.composicao)` — mais eficiente e sem acoplamento ao ambiente pai.
- **Não bloquear a montagem se `produto_composicao` estiver vazia:** A tabela `produto_composicao` foi criada vazia na Phase 19. O fluxo Phase 20 usa apenas `REGRAS_COMPOSICAO` (código) e buscas escopadas — não depende de dados na tabela. NUNCA bloquear por ausência de linhas na tabela.
- **Não remover `onRedirectToSistemas` do ProdutoAutocomplete:** O prop ainda é usado na busca global para redirecionar produtos de fita/driver/perfil para o fluxo correto. Com product-first, o redirect deixa de ser necessário para a busca principal, mas o componente pode ainda ser instanciado com esse prop em outros contextos.

---

## Don't Hand-Roll

| Problema | Não construir | Usar | Por quê |
|---------|--------------|------|---------|
| Busca de produto com dropdown | Componente de autocomplete custom | `ProdutoAutocomplete` existente | Já tem debounce, loading, click-outside, redirect UX |
| Filtragem por voltagem de driver | Lógica de filtro manual | `useProdutoSearch` com `filtroVoltagem` | Já implementado (linha 35); inclui tensão null como compatível |
| Detecção de família | Parsing de descrição | `produto.sistema_magnetico` (alias de `system`) | Coluna `sistema` já populada em `product_variants` para famílias MAGNETO/TINY |
| Margem de segurança de driver | Constante hardcoded inline | `MARGEM_SEGURANCA_DRIVER` de `orcamento.ts:144` | Garante paridade com a edge function `validar-sistema-orcamento` |
| Cálculo de subtotal de composição | Redução manual inline | `calcularSubtotalComposicao` de `orcamento.ts:286` | Já existe, já testado, backward-compat garantida |
| Regras de conector por família | Map hardcoded no componente | `REGRAS_COMPOSICAO` de `orcamento.ts:150` | Fonte única de verdade; os componentes devem consumir, não duplicar |

---

## Anatomy: AmbienteCard Current State (Verified)

[VERIFIED: leitura de AmbienteCard.tsx]

### Estado e handlers relevantes

```typescript
// AmbienteCard.tsx — estado atual (linhas verificadas)
const [isOpen, setIsOpen]         // linha 44: collapsible do ambiente
const [editingName, setEditingName] // linha 45: edição de nome inline
const [tempName, setTempName]     // linha 46
const [activeTab, setActiveTab]   // linha 47: 'luminarias' | 'sistemas' — SERÁ REMOVIDO

const ambienteRef = useRef(ambiente); // linha 55: reconciliação de writes após await
```

### Handlers a preservar intactos (usados pelo card de Fita Padrão)

```typescript
addSistema()         // linha 71: cria SistemaIluminacao em sistemas[]
updateSistema()      // linha 77: atualiza sistema por índice
removeSistema()      // linha 81: remove sistema
duplicarSistema()    // linha 85: clona SistemaIluminacao (Phase 18)
handleSelectProdutoSistema()  // linha 163: toda a lógica de fita/driver/perfil — INTOCADA
vincularPerfil()     // linha 311
desvincularPerfil()  // linha 317
buscarDriverSugerido()  // linha 148: driver sugerido para Fita Padrão — INTOCADA
```

### Handlers a estender (não substituir)

```typescript
addLuminaria()       // linha 59: adicionar ItemLuminaria vazio — manter como fallback interno
updateLuminaria()    // linha 62: atualizar luminária por índice — usar no ComposicaoCard
removeLuminaria()    // linha 66: remover luminária — usar no ComposicaoCard
handleSelectProdutoLuminaria()  // linha 92: ESTENDER com roteamento product-first
```

### O que é removido

```typescript
// Remover:
const [activeTab, setActiveTab]  // estado de abas — obsoleto
<Tabs>, <TabsList>, <TabsTrigger>, <TabsContent>  // todo o wrapper de abas
// Botões de entrada diretos:
// "Adicionar Luminária" (linha 408)
// "Novo Sistema" (linha 643)
// Substituídos pela busca product-first única
```

### `analisarMagneto48V` — estado atual na tab Luminárias

```typescript
// AmbienteCard.tsx:370-377 — atualmente renderiza um banner de aviso passivo
// na tab Luminárias quando detecta módulos 48V soltos (luminarias sem composicao)
// Fase 20: manter esse banner como fallback para luminarias antigas (sem composicao[])
// O novo ComposicaoCard terá seu próprio painel de driver — não remover o banner existente
```

---

## Os 5 Calc Sites Protegidos (Verificados — Byte-Idênticos Obrigatórios)

[VERIFIED: leitura direta de orcamento.ts e pdfTemplates/v2.ts]

| Função | Localização | Assinatura | Status |
|--------|------------|-----------|--------|
| `calcularDemandaFita` | orcamento.ts:187-201 | `(arg: SistemaIluminacao \| ItemPerfil): number` | NÃO TOCAR |
| `calcularConsumoW` | orcamento.ts:204-213 | `(arg1: SistemaIluminacao \| ItemPerfil, arg2?: ItemFitaLED): number` | NÃO TOCAR |
| `calcularQtdDrivers` | orcamento.ts:217-242 | `(arg1: SistemaIluminacao \| ItemPerfil, arg2?: ItemFitaLED, arg3?: ItemDriver): number` | NÃO TOCAR |
| `calcularSubtotalSistemaSemFita` | orcamento.ts:302-304 | `(sistema: SistemaIluminacao): number` | NÃO TOCAR |
| `isSistemaVazio` | pdfTemplates/v2.ts:89-93 | `(sis: SistemaIluminacao): boolean` — verifica demanda, consumo e qtdDrivers === 0 | NÃO TOCAR |

**`isSistemaVazio` (v2.ts:89)** verifica `calcularDemandaFita(sis) === 0 && calcularConsumoW(sis) === 0 && calcularQtdDrivers(sis) === 0`. Os compostos NÃO vivem em `sistemas[]` — nunca passam por essa função, portanto zero risco de regressão.

**`calcularTotalAmbienteSemFita` (orcamento.ts:524-531)** já foi modificada na Phase 19 para incluir `calcularSubtotalComposicao(i)`. Esta função NÃO está na lista dos 5 protegidos — foi intencionalmente atualizada.

---

## Colunas do Banco Existentes (Verificadas para Detecção)

[VERIFIED: src/integrations/supabase/types.ts + useProdutoSearch.ts]

| Coluna no banco | Alias em `Produto` (via useProdutoSearch) | Valores conhecidos |
|----------------|------------------------------------------|-------------------|
| `system` (product_variants) | `sistema_magnetico` | `'magneto_48v' \| 'tiny_magneto' \| 's_mode' \| 'padrao' \| 'trilha'` |
| `tipo_produto` | `tipo_produto` | `'fita' \| 'driver' \| 'perfil' \| 'spot' \| 'lampada' \| 'acessorio' \| 'conector' \| 'kit_fixacao' \| 'suporte'` |
| `tensao` | `voltagem` | `12 \| 24 \| 48 \| null` |
| `potencia_watts` | `driver_potencia_w` | número | null |
| `familia_perfil` | `familia_perfil` | string | null |

**Nenhuma coluna nova é necessária.** A detecção de tipo usa `sistema_magnetico` (alias de `sistema`) e `tipo_produto` — ambas já na query de `useProdutoSearch` (linhas 24-25).

**Atenção ao alias:** `produto.sistema_magnetico` no frontend corresponde a `product_variants.sistema` no banco. Ao escrever queries Supabase diretamente (ex: busca escopada de módulos), usar `.eq('sistema', 'magneto_48v')` — não o alias.

---

## Roteamento de Detecção (D-02/D-03) — Lógica Completa

[VERIFIED: AmbienteCard.tsx:92-143 + useProdutoSearch.ts:24]

A detecção hoje já acontece parcialmente em `handleSelectProdutoLuminaria`: os toasts de `sistema_magnetico === 'magneto_48v'` e `=== 'tiny_magneto'` (linhas 97-110) demonstram que o campo está disponível no `Produto` retornado. A extensão product-first apenas adiciona **roteamento baseado na mesma informação**, em vez de apenas mostrar avisos.

Tabela de roteamento definitiva:

| Condição no produto | Rota | Array destino | Ação |
|--------------------|------|--------------|------|
| `tipo_produto === 'fita'` | Fita Padrão | `sistemas[]` | Chamar `addSistema()` e abrir card Fita Padrão com fita pré-preenchida |
| `sistema_magnetico === 'magneto_48v'` | MAGNETO 48V | `luminarias[]` | Criar `ItemLuminaria` com `composicao: []`, `sistema: 'magneto_48v'` |
| `sistema_magnetico === 'tiny_magneto'` | TINY 24V | `luminarias[]` | Criar `ItemLuminaria` com `composicao: []`, `sistema: 'tiny_magneto'` |
| `sistema_magnetico === 's_mode'` | Modular (Phase 21) | `luminarias[]` | Item simples (sem composicao[]) + badge "converter em sistema (Phase 21)" |
| Qualquer outro | Item simples | `luminarias[]` | Comportamento atual de `handleSelectProdutoLuminaria` (toasts preservados) |
| `sistema_magnetico` null/undefined | Fallback (D-03) | `luminarias[]` | Item simples, sem diálogo de confirmação |

**Ponto-chave:** A fita LED já é tratada na tab "Sistemas" hoje. Com product-first, o campo `tipo_produto === 'fita'` deve redirecionar para `addSistema()` com a fita pré-preenchida. Isso significa que ao selecionar um produto de fita, o fluxo chama `addSistema()` (que inicializa o `SistemaIluminacao`) e depois imediatamente chama `handleSelectProdutoSistema(produto, novoSistemaIndex, 'fita')` — aproveitando toda a lógica de sugestão automática de driver já existente. **Não duplicar essa lógica.**

---

## Painel de Driver — 5 Estados e Transições

[VERIFIED: UI-SPEC.md + orcamento.ts:317-338]

O painel de driver é puramente derivado (sem estado próprio de "modo") — seu visual é determinado pelo estado da composição:

```typescript
// Derivar estado do painel a partir de dados
type EstadoPainelDriver = 
  | 'sem_carga'        // composicao.filter(papel=modulo).every(m => !m.potenciaW)
  | 'recomendado'      // tem carga > 0, sem driver aplicado (papel=driver_*)
  | 'aplicado_ok'      // tem driver com papel=driver_recomendado E driver.potenciaW >= carga×1.05
  | 'subdimensionado'  // tem driver com papel=driver_recomendado MAS driver.potenciaW < carga×1.05
  | 'excede_200w'      // carga×1.05 > 200 (48V) — sem "Aplicar", aviso manual

// Para TINY 24V: adicionar estado 'sem_driver_24v' (query não encontrou compatível)
```

| Estado | Fundo | Borda | Botão |
|--------|-------|-------|-------|
| `sem_carga` | `bg-muted/30` | `border-dashed` | — |
| `recomendado` | `bg-blue-50` | `border-blue-400/40` | "Aplicar" (variant default) |
| `aplicado_ok` | `bg-green-50` | `border-green-400/40` | "Alterar" (variant outline) |
| `subdimensionado` | `bg-amber-50` | `border-amber-400/40` | "Reaplicar recomendação" (variant default) |
| `excede_200w` | `bg-amber-50` | `border-amber-400/40` | — (sem botão; aviso manual) |

**Cálculo do estado `excede_200w`:** apenas para sistema 48V (`item.sistema === 'magneto_48v'`). Para 24V não há limite fixo de 200W (usa pool de drivers).

---

## Checklist REGRAS_COMPOSICAO — Implementação Detalhada

[VERIFIED: orcamento.ts:150-165 + CONTEXT.md D-09/D-10/D-11]

A constante `REGRAS_COMPOSICAO` já está em `orcamento.ts:150`:

```typescript
// orcamento.ts:150 — verificado
export const REGRAS_COMPOSICAO = {
  magneto_48v: {
    conectoresObrigatorios: ['LM2338'],
    kitFixacaoEmbutir: 'LM2987',
    descricao: '...',
  },
  tiny_magneto: {
    conectoresObrigatorios: ['LM3168', 'LM3169'],
    kitFixacaoEmbutir: 'LM2987',
    descricao: '...',
  },
};
```

**Lógica de presença de conector (D-10):**
- `magneto_48v`: presente se `composicao.some(c => c.codigo === 'LM2338')`
- `tiny_magneto`: presente se `composicao.some(c => c.codigo === 'LM3168' || c.codigo === 'LM3169')` — OR, não AND

**Lógica do kit de fixação (D-11):**
- Aparece no checklist apenas se `/EMBUTIR/i.test(item.descricao)` (descrição do trilho âncora)
- Presente se `composicao.some(c => c.codigo === 'LM2987')`

**Atalho "+ Adicionar" (COMP-02):**
- Ao clicar, adicionar `ItemComposicao` com `papel='conector_energia'` (para conectores) ou `papel='kit_fixacao'` (para kit LM2987)
- SKU default do atalho: LM2338 (MAGNETO), LM3168 (TINY) — D-10
- Preço via fetch Supabase ao clicar (snapshot no add-time)

---

## Voltage Lock por Construção (D-12/COMP-03)

[VERIFIED: useProdutoSearch.ts:35 + AmbienteCard.tsx:594]

O `ProdutoAutocomplete` já aceita `filtroVoltagem` prop (linha 594 do AmbienteCard: `filtroVoltagem={sis.fita.voltagem}`). Em `useProdutoSearch` linha 35, o filtro já funciona: `.or(`tensao.eq.${filtroVoltagem},tensao.is.null`)`.

Para o `ComposicaoCard`:
- Driver em composição 48V: passar `filtro='driver'` + `filtroVoltagem={48}`
- Driver em composição 24V: passar `filtro='driver'` + `filtroVoltagem={24}`
- O lock é "por construção" — apenas drivers da voltagem correta aparecem no dropdown. Sem toast de erro.

Para módulos, o scope deve ser por `sistema`:
- Módulos MAGNETO 48V: novo filtro `.eq('sistema', 'magneto_48v')` + excluir trilhos/conectores
- Módulos TINY 24V: `.eq('sistema', 'tiny_magneto')` + excluir trilhos/conectores

**Extensão necessária em `useProdutoSearch`:** adicionar `filtroSistema?: string` como parâmetro opcional. Quando presente, adicionar `.eq('sistema', filtroSistema)` ao query builder. Alternativamente, adicionar `'modulo_magneto'` e `'modulo_tiny'` ao tipo `ProdutoFiltro`.

---

## ProdutoAutocomplete — Extensão Necessária para Product-First

[VERIFIED: ProdutoAutocomplete.tsx + useProdutoSearch.ts]

### Mudança no componente global (busca product-first)

A busca global no `AmbienteCard` usará `ProdutoAutocomplete` **sem filtro** (ou `filtro='todos'`):
- `placeholder="Buscar produto por código ou descrição..."`
- `filtro` omitido (defaults para `'todos'` em `useProdutoSearch`)
- Ao selecionar: `handleSelectProdutoLuminaria(produto)` com roteamento D-02

### Comportamento de redirect (UX-01) com product-first

O `redirectTipo` (useProdutoSearch:50-60) detecta quando produto não é encontrado na busca `filtro='luminaria'` mas existe em outro tipo. Com product-first (`filtro='todos'`), este fallback não se aplica — todos os produtos aparecem. O `onRedirectToSistemas` prop pode ser `undefined` na busca global.

### Busca escopada dentro do ComposicaoCard

O `ProdutoAutocomplete` é reutilizado para:
1. Adicionar módulos (filtro por `sistema`)
2. Adicionar driver (filtro `'driver'` + `filtroVoltagem`)
3. Atalho do checklist (não usa ProdutoAutocomplete — busca direta por SKU fixo)

---

## Step2Ambientes — Nenhuma Alteração Necessária

[VERIFIED: Step2Ambientes.tsx]

O `Step2Ambientes.tsx` é o container do `AmbienteCard`. Não precisa de modificação para a Phase 20:
- Já passa `ambiente`, `onChange`, `onRemove`, `onDuplicate` para cada `AmbienteCard` (linhas 165-170)
- O `handleNext` (linha 70) faz validações nos `sistemas[]` (metragem) — compostos em `luminarias[]` não são afetados
- A lógica de advisory (línhas 120-148) verifica `sis.fita.codigo` e `sis.driver.codigo` em `sistemas[]` — compostos não passam aqui (VAL-01 é Phase 21)

---

## Common Pitfalls

### Pitfall 1: Fita LED Detectada como Item Simples ao Buscar Globalmente

**O que vai errado:** O filtro `filtro='todos'` em `useProdutoSearch` retorna produtos de fita. O roteamento precisa detectar `tipo_produto === 'fita'` e chamar `addSistema()` + pre-fill, não `addLuminaria()`.

**Causa:** Fita não tem `sistema_magnetico` definido (é `null`); o fallback cairia em "item simples" sem check explícito de `tipo_produto`.

**Como evitar:** A detecção de `tipo` deve verificar `tipo_produto === 'fita'` ANTES do fallback genérico. Prioridade: `fita` > `magneto_48v` > `tiny_magneto` > `s_mode` > item simples.

**Sinais de alerta:** Fita aparecendo na lista como luminária avulsa sem card de sistema.

### Pitfall 2: Snapshot sem potenciaW Resulta em Carga Zero

**O que vai errado:** Se o módulo no catálogo tem `potencia_watts = null`, `potenciaW` no `ItemComposicao` será `undefined`, e `calcularCargaComposicao` retornará 0. O painel de driver mostrará "sem carga" mesmo com módulos presentes.

**Causa:** Dados de catálogo incompletos (ausência de `potencia_watts` em alguns módulos).

**Como evitar:** O estado `sem_carga` do painel deve mostrar mensagem informativa (já definido no UI-SPEC). Não bloquear a montagem — o colaborador pode adicionar módulos e driver manualmente mesmo sem carga derivada. Mostrar badge `"?W"` (em vez de `"0W"`) quando `potenciaW` for undefined para indicar dado ausente.

### Pitfall 3: Race Condition ao Aplicar Driver com Fetch Assíncrono

**O que vai errado:** Ao clicar "Aplicar", a função faz fetch do produto driver por SKU. Se o usuário modificar módulos enquanto o fetch está em andamento, a composição terá mudado quando o resultado chegar.

**Causa:** Mesmo padrão que o `buscarDriverSugerido` atual (AmbienteCard.tsx:148); resolvido com `ambienteRef`.

**Como evitar:** No `ComposicaoCard`, usar o mesmo padrão de `ambienteRef` já estabelecido em `AmbienteCard.tsx:55-56`. Reconciliar após o await: verificar se a luminária âncora ainda existe no estado mais recente antes de aplicar. Usar `item.id` para localizar, não índice.

### Pitfall 4: `addSistema` ao Selecionar Fita Cria Sistema Vazio Antes de Pré-Preencher

**O que vai errado:** Se chamar `addSistema()` (que inicializa sistema com fita/driver vazios) e depois em seguida chamar `handleSelectProdutoSistema(produto, newIndex, 'fita')`, há um frame onde o sistema existe mas está vazio — pode causar flash visual.

**Como evitar:** Criar o `SistemaIluminacao` pré-populado inline (sem passar por `addSistema()`), da mesma forma que `addSistema()` funciona mas com o produto fita já preenchido. Alternativamente, usar `addSistema()` + `handleSelectProdutoSistema` em sequência síncrona (sem await entre eles) — o React batcha as atualizações de estado.

### Pitfall 5: Remover Tab "Sistemas" Remove a Busca de Redirect (UX-01)

**O que vai errado:** O `ProdutoAutocomplete` no card de Fita Padrão (filtro=`fita`, `driver`, `perfil`) não usa `onRedirectToSistemas`. Mas a busca global product-first também não precisa mais do redirect (detecta o tipo e roteia automaticamente). Ao remover as tabs, o `onRedirectToSistemas` prop no autocomplete da tab Luminárias antiga desaparece.

**Como evitar:** Na busca global product-first, `onRedirectToSistemas` deve ser `undefined`. Dentro do card de Fita Padrão (que continua existindo), os `ProdutoAutocomplete` internos de fita/driver/perfil continuam com seus filtros individuais e sem necessidade de redirect. Nenhuma regressão.

### Pitfall 6: ComposicaoCard em Loop de Re-render por Instabilidade de Referência

**O que vai errado:** Se `onChange` do `AmbienteCard` cria um novo objeto `ambiente` a cada chamada (o que faz hoje), o `ComposicaoCard` recebe nova referência de `item.composicao` a cada render do pai, causando re-renders desnecessários.

**Como evitar:** Usar `useCallback` para os handlers do `ComposicaoCard` que atualizam a composição, ou aceitar que o padrão atual de re-render é aceitável (o app não usa React.memo em componentes de wizard hoje — consistente com padrão existente).

---

## Code Examples

### Verificado: handleSelectProdutoLuminaria atual (AmbienteCard.tsx:92-144)

```typescript
// ATUAL (AmbienteCard.tsx:92) — função a ser ESTENDIDA, não substituída
const handleSelectProdutoLuminaria = (produto: Produto, index: number) => {
  // ... toasts de aviso magnéticos (linhas 96-131) — PRESERVAR ...
  updateLuminaria(index, {
    ...ambiente.luminarias[index],
    codigo: produto.codigo,
    descricao: produto.descricao,
    precoUnitario: Math.round((produto.preco_tabela || 0) * 100) / 100,
    precoMinimo: Math.round((produto.preco_minimo || 0) * 100) / 100,
    imagemUrl: imgUrl,
    sistema: produto.sistema_magnetico ?? null,
    potencia_watts: produto.driver_potencia_w ?? null,
    tensao: produto.voltagem ?? null,
  });
};
```

Com product-first, a assinatura muda: `(produto: Produto)` — sem `index` (pois cria novo item, não edita existente). O routing substitui o "adicionar em branco + preencher depois".

### Verificado: buscarDriverSugerido (AmbienteCard.tsx:148-161) — padrão para driver TINY 24V

```typescript
// PADRÃO EXISTENTE (AmbienteCard.tsx:148) — reusar para TINY 24V
const buscarDriverSugerido = async (voltagem: number, wm: number, metragemReal: number): Promise<Produto | null> => {
  const consumoEstimado = wm * metragem * MARGEM_SEGURANCA_DRIVER;
  const { data } = await supabase.from('produtos').select(...)
    .eq('tipo_produto', 'driver').eq('tensao', voltagem)
    .gte('potencia_watts', consumoEstimado)
    .order('potencia_watts', { ascending: true }).limit(1);
  return (data?.[0] as Produto) ?? null;
};

// ADAPTAÇÃO PARA TINY 24V (ComposicaoCard):
// consumoEstimado = cargaTotalW * MARGEM_SEGURANCA_DRIVER  (sem metragem — carga direta)
// voltagem = 24 (fixo para TINY)
// mesma query, mesmo .limit(1)
```

### Verificado: filtroVoltagem em ProdutoAutocomplete (AmbienteCard.tsx:594)

```typescript
// EXISTENTE — voltage lock já funciona para Fita Padrão
<ProdutoAutocomplete 
  filtro="driver" 
  filtroVoltagem={sis.fita.voltagem}  // 12 | 24 | 48
  ... 
/>

// NOVO — voltage lock para ComposicaoCard (mesmo prop, mesmo mecanismo)
<ProdutoAutocomplete 
  filtro="driver" 
  filtroVoltagem={item.tensao === 48 ? 48 : 24}  // deriva da tensao do trilho âncora
  ... 
/>
```

---

## State of the Art

| Abordagem Antiga | Abordagem Atual (Phase 20) | Impacto |
|-----------------|---------------------------|---------|
| Tabs Luminárias / Sistemas como seletor de tipo | Busca product-first única, tipo detectado automaticamente | Elimina clique extra e ambiguidade de "onde adicionar este produto" |
| Toast de aviso passivo para MAGNETO/TINY (AmbienteCard.tsx:97-110) | Card de composição com checklist + painel de driver acionável | Aviso → ação em 1 clique |
| `analisarMagneto48V` passivo no topo da tab Luminárias (linha 370) | Painel de driver dentro do card de composição, com estado visual dinâmico | Usuário age diretamente no ponto de montagem |
| Módulos MAGNETO/TINY entram como `ItemLuminaria` flat sem estrutura | `ItemComposicao[]` em `luminarias[].composicao[]` — estruturado, com papel e potênciaW | Base para PDF v3 e validação Phase 21 |

**Deprecated/substituído:**
- `activeTab` state e `<Tabs>` no AmbienteCard: removidos nesta fase.
- Botões "Adicionar Luminária" e "Novo Sistema" como pontos de entrada primários: substituídos pela busca product-first. Os handlers `addLuminaria`/`addSistema` continuam existindo (chamados internamente pelo roteamento).

---

## Environment Availability

Step 2.6: SKIPPED — esta fase é puramente front-end (TypeScript + React + shadcn). Nenhuma dependência de CLI externa, serviço de banco separado, ou ferramenta nova. A única interação de rede é com o Supabase já configurado (`VITE_SUPABASE_URL`).

---

## Assumptions Log

| # | Claim | Seção | Risco se errado |
|---|-------|-------|-----------------|
| A1 | `produto.sistema_magnetico` retorna `'magneto_48v'` ou `'tiny_magneto'` para trilhos (não só para módulos) | Roteamento D-02 | Se trilhos não tiverem o campo `sistema` populado no banco, a detecção cairia no fallback de item simples — verificar SKUs de trilhos via query admin antes da implementação |
| A2 | Módulos MAGNETO 48V e TINY 24V têm `potencia_watts` preenchido no catálogo | Painel de Driver | Se `potencia_watts = null` em alguns módulos, carga derivada será 0 e o painel mostrará "sem carga" — coberto pelo Pitfall 2 |
| A3 | Drivers LM2343 e LM2344 estão no catálogo com `tipo_produto='driver'`, `tensao=48` | Painel Driver 48V | Se não existirem ou tiverem tipo errado, o botão "Aplicar" falhará silenciosamente — verificar via query antes de implementar |

**Nota:** A1 é o único risco material. Todos os campos de detecção (`sistema`, `tipo_produto`, `tensao`, `potencia_watts`) foram verificados como existentes no schema (`types.ts`) e na query de `useProdutoSearch`. A dúvida é sobre a *população de dados* específica para trilhos.

---

## Open Questions

1. **Trilhos magnéticos têm `sistema` populado no banco?**
   - O que sabemos: colunas `sistema` e `tipo_produto` existem; módulos têm `sistema='magneto_48v'`/`'tiny_magneto'` (usado em `analisarMagneto48V`). O `handleSelectProdutoLuminaria` já detecta `produto.sistema_magnetico === 'magneto_48v'` — o que significa que pelo menos alguns produtos têm o campo.
   - O que está incerto: trilhos especificamente (LM-xxxx com "TRILHO" na descrição) também têm `sistema` correto? Ou só os módulos?
   - Recomendação: antes de implementar, executar query de verificação: `SELECT codigo, descricao, sistema, tipo_produto FROM produtos WHERE descricao ILIKE '%TRILHO%MAGNET%' OR descricao ILIKE '%TINY%TRILHO%'` para confirmar população. Se trilhos tiverem `sistema=null`, a detecção de "é um trilho" precisará de regex complementar (já presente como fallback no código atual: `/MAGNETO22/`).

2. **SKUs exatos dos drivers LM2343 e LM2344 existem no catálogo com voltagem correta?**
   - O que sabemos: hardcoded em `analisarMagneto48V` (orcamento.ts:330) como SKUs esperados.
   - O que está incerto: se estão com `tipo_produto='driver'` e `tensao=48` para aparecer no voltage-locked autocomplete.
   - Recomendação: query `SELECT codigo, tipo_produto, tensao, potencia_watts FROM produtos WHERE codigo IN ('LM2343', 'LM2344', 'LM2338', 'LM3168', 'LM3169', 'LM2987')` para verificar estado atual.

---

## Sources

### Primary (HIGH confidence)
- `src/components/AmbienteCard.tsx` — leitura completa (654 linhas); handlers, estado, rendering de luminárias e sistemas
- `src/types/orcamento.ts` — leitura completa (673 linhas); `ItemComposicao:43`, `REGRAS_COMPOSICAO:150`, `calcularSubtotalComposicao:286`, `analisarMagneto48V:317`, `MARGEM_SEGURANCA_DRIVER:144`, os 5 calc sites
- `src/hooks/useProdutoSearch.ts` — leitura completa; `ProdutoFiltro:5`, query builder, filtroVoltagem
- `src/components/ProdutoAutocomplete.tsx` — leitura completa; props, dropdown, redirect UX
- `src/components/Step2Ambientes.tsx` — leitura completa; container, handleNext, advisory
- `src/lib/pdfTemplates/v2.ts:89-93` — `isSistemaVazio` verificado
- `src/integrations/supabase/types.ts` — colunas `sistema`, `tipo_produto`, `tensao`, `potencia_watts`, `familia_perfil` verificadas
- `.planning/phases/20-fluxos-magn-ticos/20-CONTEXT.md` — decisões D-01 a D-12 (fonte primária de escopo)
- `.planning/phases/20-fluxos-magn-ticos/20-UI-SPEC.md` — contrato visual completo
- `.planning/phases/19-funda-o-compostos/19-CONTEXT.md` — decisões D-01 a D-09 (fundação)
- `.planning/REQUIREMENTS.md` — SIST-05, SIST-01/02, COMP-01/02/03, DRV-01/02
- `.planning/research/ARCHITECTURE.md`, `FEATURES.md`, `PITFALLS.md`, `STACK.md` — pesquisa original

---

## Metadata

**Confidence breakdown:**
- Arquitetura de roteamento product-first: HIGH — baseada em leitura direta do código; os campos de detecção já são usados em toasts existentes
- Painel de driver 48V: HIGH — `analisarMagneto48V` já tem a lógica; promoção para ação é extensão direta
- Painel de driver 24V: HIGH — padrão `buscarDriverSugerido` já implementado; adaptação para carga direta é trivial
- Checklist REGRAS_COMPOSICAO: HIGH — constante verificada em orcamento.ts:150; lógica de OR para TINY verificada
- Voltage lock por construção: HIGH — `filtroVoltagem` prop já existe e funciona; reuso direto
- Dados de catálogo (trilhos com sistema correto): MEDIUM — colunas existem mas população específica de trilhos não foi verificada (A1)

**Research date:** 2026-06-15
**Valid until:** 2026-07-15 (stack estável; risco principal é estado de dados no catálogo)
