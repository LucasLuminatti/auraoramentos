---
phase: 20
slug: fluxos-magn-ticos
status: draft
shadcn_initialized: true
preset: default (style: default, baseColor: slate, cssVariables: true)
created: 2026-06-15
---

# Phase 20 — UI Design Contract

> Visual and interaction contract para a reorganização do AmbienteCard: busca product-first única, lista unificada, cards de composição MAGNETO 48V e TINY 24V, painel de driver com "aplicar", checklist de componentes obrigatórios.
>
> Gerado por gsd-ui-researcher. Fonte primária: CONTEXT.md (D-01 a D-12), REQUIREMENTS.md (SIST-05, SIST-01/02, COMP-01/02/03, DRV-01/02), AmbienteCard.tsx (estado atual).

---

## Design System

| Property | Value |
|----------|-------|
| Tool | shadcn-ui (Radix UI) — já inicializado |
| Preset | style: default, baseColor: slate, cssVariables: true (components.json) |
| Component library | Radix UI via shadcn-ui (`src/components/ui/`) |
| Icon library | lucide-react 0.462.0 |
| Font | DM Sans (Google Fonts, já importado em src/index.css) |

**shadcn gate:** `components.json` encontrado. Design system ativo. Nenhuma inicialização necessária.

---

## Spacing Scale

Segue o 8-point scale existente do Tailwind/shadcn. As classes já em uso no AmbienteCard são preservadas.

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px (`gap-1`, `px-1`, `py-0`) | Gaps internos de badge, ícones inline |
| sm | 8px (`gap-2`, `p-2`, `px-3 py-2`) | Espaçamento compacto entre campos, padding de aviso |
| md | 16px (`p-4`, `gap-4`) | Padding padrão de card, seções internas |
| lg | 24px (`space-y-3`, `space-y-4`) | Separação entre grupos de campos |
| xl | 32px | Layout gaps entre AmbienteCards (herdado de Step2Ambientes) |
| 2xl | 48px | Não aplicável nesta fase |
| 3xl | 64px | Não aplicável nesta fase |

Exceções:
- Altura de input compacto: `h-8` (32px) — padrão já em uso no card de fita/driver.
- Área de toque mínima em botões de ação inline: `h-7 w-7` (28px) — aceito para ações secundárias (ícone de lixeira, copiar). Botões CTA (Aplicar driver, Adicionar componente) usam altura `h-8` mínima.
- Badge de tipo detectado: `px-1 py-0 text-[10px]` — segue padrão dos badges de validação existentes.

---

## Typography

Herdada diretamente do design system existente. Nenhuma nova escala de tipo é introduzida.

| Role | Size | Weight | Line Height | Token Tailwind |
|------|------|--------|-------------|----------------|
| Body/campo | 14px | 400 (regular) | 1.5 | `text-sm` (padrão input/badge) |
| Label de seção | 12px | 600 (semibold) | 1.2 | `text-xs font-semibold uppercase tracking-wide` |
| Heading do card | 14px | 600 (semibold) | 1.2 | `text-sm font-semibold text-foreground` |
| Caption/aviso | 12px | 400 (regular) | 1.5 | `text-xs text-muted-foreground` |

Pesos declarados: **400 (regular)** e **600 (semibold)** — apenas esses dois, consistente com o código existente.

Novas ocorrências de tipo introduzidas nesta fase:
- Badge de tipo detectado: `text-[10px] font-semibold` — hierarquia suficiente em 10px; alinhado com os dois pesos declarados.
- Painel de driver (recomendação): `text-xs` body, `text-xs font-semibold` para SKU destacado.
- Checklist de obrigatórios: `text-xs` para cada linha de item, ícone de check/X `h-3.5 w-3.5`.

---

## Color

Herda os tokens CSS do design system (definidos em `src/index.css`). Valores calculados abaixo para referência.

| Role | CSS Token | Valor Aproximado (light) | Usage |
|------|-----------|--------------------------|-------|
| Dominant (60%) | `--background` | `hsl(40 20% 98%)` — off-white quente | Fundo da página (Step2Ambientes) |
| Secondary (30%) | `--card` + `--muted` | `hsl(0 0% 100%)` card / `hsl(40 10% 95%)` muted | Card do AmbienteCard (`bg-card`), seções internas (`bg-muted/20`, `bg-muted/30`, `bg-muted/40`) |
| Accent (10%) | `--primary` / `--accent` | `hsl(36 83% 51%)` — âmbar dourado | Reservado para: label de seção `text-primary` (Fita LED, Driver, Perfil), botão primário "Aplicar driver", ring de foco |
| Destructive | `--destructive` | `hsl(0 84% 60%)` — vermelho | Botão de remoção (Trash2), badge de erro de voltagem, bordas de preço abaixo do mínimo |

**Accent reservado para (lista explícita):**
1. Labels de seção interna do card (`text-primary uppercase tracking-wide`) — Fita LED, Driver, Perfil
2. Botão "Aplicar" do painel de driver (variant `default`, que usa `bg-primary`)
3. Ring de foco em inputs e autocomplete

**Novas superfícies de cor introduzidas nesta fase:**

| Superfície | Classe Tailwind | Quando aparece |
|------------|----------------|----------------|
| Card de composição (fundo) | `bg-muted/20 border rounded-lg` | Sempre que `item.composicao?.length > 0` |
| Header do card de composição | `bg-muted/40 border-b` | Cabeçalho com tipo detectado + botões |
| Painel de driver — estado normal | `bg-blue-50 border border-blue-400/40` | Driver recomendado calculado, aguardando aplicar |
| Painel de driver — estado aplicado | `bg-green-50 border border-green-400/40` | Após clicar "Aplicar"; driver preenchido e dimensionado |
| Painel de driver — estado subdimensionado | `bg-amber-50 border border-amber-400/40` | Driver aplicado ficou subdimensionado após edição de módulos |
| Painel de driver — estado >200W (48V) | `bg-amber-50 border border-amber-400/40` | Carga total > 200W, múltiplos drivers necessários |
| Checklist — item presente | `text-green-700` + ícone `Check` | SKU obrigatório encontrado no `composicao[]` |
| Checklist — item ausente | `text-amber-700` + ícone `AlertCircle` | SKU obrigatório ausente |

---

## Layout — AmbienteCard Reorganizado

Esta seção descreve a anatomia visual e de interação da reorganização principal desta fase.

### Estrutura geral do AmbienteCard após Phase 20

```
┌─ Collapsible: AmbienteCard ──────────────────────────────┐
│  [Header: nome + edit + duplicate + trash]               │
├──────────────────────────────────────────────────────────┤
│  [Busca product-first — ProdutoAutocomplete unificado]   │  ← NOVO (substitui tabs)
│  ──────────────────────────────────────────────────────  │
│  Lista unificada de itens (rendering order: luminarias[] │
│  + sistemas[] mesclados na UI; arrays subjacentes intatos)│
│                                                          │
│  ┌─ Item simples (luminária avulsa) ──────────────────┐  │
│  │  [código] [descrição] [qtd] [preço] [subtotal]     │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  ┌─ Card de Fita Padrão (SistemaIluminacao) ──────────┐  │  ← INTOCADO
│  │  [conteúdo idêntico ao atual — byte-identical]     │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  ┌─ Card de Composição Magnética ─────────────────────┐  │  ← NOVO
│  │  [Header: "MAGNETO 48V" badge + load + trash]      │  │
│  │  [Trilho âncora: código, descrição, qtd, preço]    │  │
│  │  [Módulos: lista de ItemComposicao papel=modulo]   │  │
│  │  [+ Adicionar módulo (busca escopada)]             │  │
│  │  [Painel de driver: recomendação + "Aplicar"]      │  │
│  │  [Checklist de obrigatórios]                       │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

### Ordem de renderização da lista unificada

A lista percorre `ambiente.luminarias` primeiro, depois `ambiente.sistemas`. Dentro de `luminarias[]`:
- Item com `composicao === undefined || composicao.length === 0` → renderiza como **item simples** (linha compacta existente + ação "converter em sistema" se `item.sistema` for reconhecido mas composição estiver vazia).
- Item com `composicao.length > 0` → renderiza como **card de composição** (anatomia detalhada abaixo).

Depois, para cada entrada em `sistemas[]`:
- Renderiza o card de Fita Padrão existente — byte-identical, sem alteração de markup ou lógica.

---

## Anatomia: Busca Product-First (substitui as tabs)

**Componente:** `ProdutoAutocomplete` existente, sem `filtro` pré-fixado (busca todos os tipos).

**Posição:** acima da lista, abaixo do header do Collapsible. Substitui `<Tabs>`.

**Placeholder:** `"Buscar produto por código ou descrição..."`

**Largura:** `w-full`

**Comportamento ao selecionar produto:**

| `product.sistema` / `tipo_produto` | Rota detectada | Ação |
|-------------------------------------|---------------|------|
| `tipo_produto === 'fita'` | Fita Padrão | Cria `SistemaIluminacao` em `sistemas[]` (fluxo atual, intocado) |
| `sistema === 'magneto_48v'` E `tipo_produto === 'trilho'` ou descrição contém `TRILHO` | MAGNETO 48V | Cria `ItemLuminaria` com `composicao: [{...trilho, papel: 'modulo'}]` no papel de âncora |
| `sistema === 'tiny_magneto'` E trilho | TINY 24V | Cria `ItemLuminaria` com `composicao: [{...trilho, papel: 'modulo'}]` |
| `sistema === 's_mode'` ou perfil modular detectado | Modular (Phase 21) | Entra como item simples + badge "converter em sistema (Phase 21)" — não inicializa composição |
| Qualquer outro (`luminaria`, `perfil`, `acessório`, etc.) | Item simples | Cria `ItemLuminaria` sem `composicao` (comportamento atual) |
| `sistema`/`tipo_produto` ausente ou nulo | Fallback | Item simples + ação "converter em sistema" (D-03) |

**Fallback gracioso (D-03):** dado sujo → item simples sem diálogo de confirmação. O badge "converter em sistema" aparece como Button `size="sm" variant="outline"` no item simples quando `item.sistema` é reconhecido mas `composicao` está vazia. Texto do botão: `"Iniciar como sistema composto"`.

---

## Anatomia: Card de Composição Magnética

### Header do card

```
┌─ bg-muted/40 border-b px-4 py-2 ───────────────────────────────┐
│  [Badge tipo]  "Sistema N"  [Carga total badge]  [Trash] │
└────────────────────────────────────────────────────────────────┘
```

- **Badge de tipo detectado** (informativo, não requisito obrigatório): `Badge variant="outline"` com `text-[10px] px-1 py-0 font-semibold`. Valores: `"MAGNETO 48V"` (borda âmbar `border-amber-500 text-amber-700 bg-amber-50`) ou `"TINY 24V"` (borda violeta `border-violet-400 text-violet-700 bg-violet-50`).
- **Carga total**: `Badge variant="secondary" text-xs` — `"Carga: {N}W"`. Derivado de `Σ(módulo.potenciaW × quantidade)`. Aparece sempre que carga > 0.
- **Botão remover composição:** `Button size="icon" variant="ghost" h-7 w-7 text-destructive` com `Trash2 h-3.5 w-3.5`.

### Trilho âncora

Linha compacta dentro do card (não editável via busca — é o produto que iniciou a composição):

```
[código readonly] [descrição readonly] [qtd: Input number w-20] [preço: PrecoInput] [subtotal badge]
```

- Código e descrição: `Input readOnly className="bg-muted/50"` — padrão existente.
- Qtd e preço: campos editáveis padrão (`Input type="number"`, `PrecoInput`).

### Lista de módulos

Cada `ItemComposicao` com `papel === 'modulo'` renderiza como linha compacta:

```
[código readonly w-28] [descrição readonly flex-1] [qtd Input w-20] [potenciaW badge "Nw"] [preço PrecoInput] [Trash2 ghost]
```

- Badge de potência: `Badge variant="outline" text-xs` — `"{N}W"`. Não editável (snapshot).
- Botão remover: `Button size="icon" variant="ghost" h-7 w-7 text-destructive`.

### Botão "+ Adicionar módulo"

- **Componente:** `Button variant="outline" size="sm" className="gap-2 mt-2"`
- **Ícone:** `Plus h-4 w-4`
- **Label:** `"+ Adicionar módulo"`
- **Abre busca escopada:** `ProdutoAutocomplete` com `filtro="luminaria"` (ou filtro custom de módulos da família) restrito à família correta. Para MAGNETO 48V: `filtro` retorna produtos com `sistema='magneto_48v'` excluindo trilhos. Para TINY 24V: `sistema='tiny_magneto'` excluindo trilhos.
- **Voltage lock (D-12):** A busca de driver dentro de uma composição 48V usa `filtroVoltagem={48}` — driver de outra voltagem não aparece no autocomplete. Não há toast de erro; a filtragem impede a seleção inválida por construção.

### Painel de driver (DRV-01 / DRV-02)

Aparece abaixo da lista de módulos, sempre visível dentro do card de composição.

**Estado: sem módulos com carga**
```
┌─ rounded-md border border-dashed p-3 bg-muted/30 ──────────────┐
│  text-xs text-muted-foreground                                  │
│  "Adicione módulos para calcular o driver recomendado."         │
└────────────────────────────────────────────────────────────────┘
```

**Estado: driver recomendado calculado (carga ≤ 200W para 48V)**
```
┌─ rounded-md border border-blue-400/40 bg-blue-50 px-3 py-2 ───┐
│  text-xs text-blue-900                                          │
│  "Driver recomendado: LM2343 (100W) — 1 unidade"              │
│  "Carga total: {N}W × 1,05 = {N}W"                            │
│  [Button "Aplicar" size="sm" variant="default" h-8]            │
└────────────────────────────────────────────────────────────────┘
```

**Estado: carga > 200W (48V) — múltiplos drivers (D-08)**
```
┌─ rounded-md border border-amber-400/40 bg-amber-50 px-3 py-2 ─┐
│  text-xs text-amber-900                                         │
│  "Atenção: carga total {N}W excede 200W."                      │
│  "Recomendado dividir em {N} circuitos com driver LM2344 (200W) cada." │
│  "A divisão do trilho é decisão de projeto — adicione os drivers manualmente." │
│  [sem botão "Aplicar" — não auto-insere]                       │
└────────────────────────────────────────────────────────────────┘
```

**Estado: driver aplicado e dimensionado corretamente**
```
┌─ rounded-md border border-green-400/40 bg-green-50 px-3 py-2 ─┐
│  text-xs text-green-900                                         │
│  [Check h-3.5 w-3.5 text-green-700]  "Driver aplicado: LM2343 (100W) × 1" │
│  [Button "Alterar" size="sm" variant="outline" h-8]            │
└────────────────────────────────────────────────────────────────┘
```

**Estado: driver aplicado mas subdimensionado após edição de módulos**
```
┌─ rounded-md border border-amber-400/40 bg-amber-50 px-3 py-2 ─┐
│  text-xs text-amber-900                                         │
│  "Driver atual ({N}W) insuficiente para a carga atual ({N}W)." │
│  "Recomendado: LM2343 (100W)"                                  │
│  [Button "Reaplicar" size="sm" variant="default" h-8]          │
└────────────────────────────────────────────────────────────────┘
```

**Lógica do botão "Aplicar":**
- Preenche um `ItemComposicao` com `papel='driver_recomendado'` no array `composicao[]` da luminária âncora.
- SKU, descrição, preço e `potenciaW` são snapshot do catálogo no momento da aplicação.
- O colaborador pode editar quantidade ou remover o item depois — nunca irreversível.
- Após "Aplicar", o painel transita para estado "aplicado". Se módulos forem editados e o driver ficar subdimensionado, o painel transita para "subdimensionado".

**Driver 24V (TINY):** o painel busca o menor driver compatível com `potencia >= carga * 1.05` e `tensao = 24` via query ao Supabase. Se encontrado, exibe SKU real; se nenhum driver satisfizer, exibe: `"Nenhum driver 24V compatível encontrado no catálogo para {N}W."` em `text-xs text-destructive`.

### Checklist de componentes obrigatórios (COMP-01 / COMP-02)

Aparece abaixo do painel de driver. Lê `REGRAS_COMPOSICAO[item.sistema]`.

**Layout:**
```
┌─ rounded-md border px-3 py-2 space-y-1 ───────────────────────┐
│  text-xs font-semibold text-muted-foreground uppercase          │
│  "Componentes obrigatórios"                                     │
│                                                                 │
│  [Check/AlertCircle h-3.5 w-3.5]  "Conector LM2338"  [btn]   │
│  [Check/AlertCircle h-3.5 w-3.5]  "Kit Fixação LM2987 (embutir)"  [btn] │
└────────────────────────────────────────────────────────────────┘
```

Cada linha:
- **Ícone presente:** `Check h-3.5 w-3.5 text-green-600` — quando o SKU existe em `composicao[]` ou `luminarias[]` do ambiente.
- **Ícone ausente:** `AlertCircle h-3.5 w-3.5 text-amber-500` — quando ausente.
- **Texto:** `text-xs` — nome do componente + código.
- **Botão de atalho (COMP-02):** `Button size="sm" variant="outline" h-6 text-[10px] gap-1` — `"+ Adicionar"` — aparece apenas quando item ausente. Clique insere o `ItemComposicao` com papel `'conector_energia'` ou `'kit_fixacao'` no `composicao[]` da luminária âncora, com preço snapshot do catálogo.

**Regras de presença por família:**
- `magneto_48v` → verifica `LM2338`; kit `LM2987` apenas se trilho âncora tiver `EMBUTIR` na descrição.
- `tiny_magneto` → satisfeito com `LM3168` (preto) OU `LM3169` (branco) — não acusa falta por cor (D-10). Atalho "Adicionar" usa `LM3168` como default. Kit `LM2987` apenas para embutir.

**Embutir detection (D-11):** regex `/EMBUTIR/i` aplicado sobre `item.descricao` do trilho âncora. Se match → linha do kit aparece no checklist. Sem match → linha do kit não aparece.

---

## Copywriting Contract

Todos os textos em português brasileiro. Sem emojis nos estados novos (os toasts existentes mantêm os emojis atuais por compatibilidade — não alterar).

| Element | Copy |
|---------|------|
| Placeholder da busca product-first | `"Buscar produto por código ou descrição..."` |
| Label da busca (acima do campo) | `"Adicionar ao ambiente"` (text-xs text-muted-foreground) |
| Badge tipo MAGNETO 48V | `"MAGNETO 48V"` |
| Badge tipo TINY 24V | `"TINY 24V"` |
| Badge carga total | `"Carga: {N}W"` |
| Botão adicionar módulo | `"+ Adicionar módulo"` |
| Painel driver — sem carga | `"Adicione módulos para calcular o driver recomendado."` |
| Painel driver — recomendação 48V ≤ 200W | `"Driver recomendado: {SKU} ({N}W) — {N} unidade(s)"` + linha `"Carga: {N}W × 1,05 = {N}W calculados"` |
| Painel driver — botão aplicar | `"Aplicar"` |
| Painel driver — aplicado | `"Driver aplicado: {SKU} ({N}W) × {N}"` |
| Painel driver — botão alterar | `"Alterar"` |
| Painel driver — subdimensionado | `"Driver atual ({N}W) insuficiente para a carga atual ({N}W)."` + `"Recomendado: {SKU}"` |
| Painel driver — botão reaplicar | `"Reaplicar recomendação"` |
| Painel driver — carga > 200W | `"Atenção: carga total {N}W excede 200W."` + `"Recomendado dividir em {N} circuitos com driver LM2344 (200W) cada."` + `"A divisão do trilho é decisão de projeto — adicione os drivers manualmente."` |
| Painel driver — sem driver 24V compatível | `"Nenhum driver 24V compatível no catálogo para {N}W. Selecione manualmente."` |
| Checklist — título | `"Componentes obrigatórios"` |
| Checklist — item presente | `"Conector {SKU} — presente"` |
| Checklist — item ausente | `"Conector {SKU} — ausente"` |
| Checklist — botão atalho | `"+ Adicionar"` |
| Item simples — ação converter | `"Iniciar como sistema composto"` |
| Estado vazio do ambiente | `"Nenhum item adicionado. Use a busca acima para adicionar luminárias ou sistemas."` (text-xs text-muted-foreground, centralizado) |
| Fallback dado sujo | Item simples entra silenciosamente — sem mensagem de erro ao usuário |

**Ações destrutivas nesta fase:**

| Ação | Confirmação |
|------|-------------|
| Remover composição inteira (Trash no header do card) | Sem modal — remoção direta (padrão do AmbienteCard atual para luminária/sistema). O Trash tem `text-destructive` como sinal visual. |
| Remover módulo individual da composição | Sem modal — remoção direta via Trash2 na linha. |
| Remover item simples | Sem modal — padrão atual. |

Não há nova confirmação modal introduzida nesta fase. Consistente com o padrão atual do AmbienteCard.

---

## Component Inventory

Componentes shadcn/Radix a reutilizar (todos já presentes em `src/components/ui/`):

| Componente | Uso nesta fase |
|------------|----------------|
| `Badge` | Tipo detectado, carga total, estado do driver, subtotal de composição |
| `Button` | "Aplicar", "Reaplicar", "Alterar", "+ Adicionar módulo", "+ Adicionar" (checklist), "Iniciar como sistema composto" |
| `Input` | Quantidade de módulo, preço de trilho/módulo/driver aplicado, busca product-first (via ProdutoAutocomplete) |
| `Collapsible` / `CollapsibleContent` | AmbienteCard (intocado) |
| `ProdutoAutocomplete` (custom) | Busca product-first global + busca escopada de módulos + busca escopada de driver |

Ícones lucide-react a reutilizar ou adicionar:

| Ícone | Uso |
|-------|-----|
| `Plus` | Botão "+ Adicionar módulo" |
| `Check` | Checklist item presente + estado driver aplicado |
| `AlertCircle` | Checklist item ausente |
| `Trash2` | Remover composição, remover módulo (existente) |
| `ChevronDown` | Header collapsible (existente) |
| `Zap` | Opcional: dentro do badge MAGNETO 48V (pode usar apenas texto) |

**Não adicionar novos componentes shadcn** nesta fase. Toda a UI é composta de primitivos já instalados.

---

## Interaction States

### Busca product-first

| Estado | Comportamento visual |
|--------|---------------------|
| Idle | Placeholder visível, bordas `border-input` |
| Focado | Ring `ring-ring` (padrão shadcn) |
| Digitando | Dropdown de sugestões (ProdutoAutocomplete existente) |
| Produto selecionado | Campo limpa (nova busca possível); item aparece na lista |
| Loading (detecção) | Sem spinner — detecção é síncrona (leitura de `produto.sistema`) |

### Card de composição

| Estado | Comportamento visual |
|--------|---------------------|
| Recém criado (só trilho âncora) | Lista de módulos vazia, painel de driver estado "sem carga", checklist com itens ausentes |
| Módulos adicionados, driver não aplicado | Painel driver estado "recomendado" com botão "Aplicar" |
| Driver aplicado, dimensionado | Painel driver estado "aplicado" em verde |
| Módulos editados → driver subdimensionado | Painel driver transita para estado "subdimensionado" em âmbar |
| Carga > 200W (48V) | Painel driver estado ">200W" em âmbar — sem "Aplicar" |
| Checklist item ausente | AlertCircle + botão "+ Adicionar" |
| Checklist item presente | Check verde, sem botão |

### Busca escopada de módulos

| Filtro ativo | Quais produtos aparecem |
|-------------|------------------------|
| Composição MAGNETO 48V | `sistema='magneto_48v'` excluindo trilhos e conectores |
| Composição TINY 24V | `sistema='tiny_magneto'` excluindo trilhos e conectores |
| Driver de composição 48V | `tipo_produto='driver'` + `tensao=48` (voltage lock — D-12) |
| Driver de composição 24V | `tipo_produto='driver'` + `tensao=24` (voltage lock — D-12) |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | Badge, Button, Input, Collapsible | not required |
| Terceiros | nenhum | não aplicável |

Nenhum bloco de registry terceiro nesta fase. Toda a UI é composta de shadcn oficial + componentes existentes do projeto.

---

## Fita Padrão — Contrato de Não-Regressão

O card de Fita Padrão (`SistemaIluminacao`) é **byte-identical** ao estado atual. Nenhuma alteração visual, de cálculo ou de interação é introduzida nesta fase. O único ponto de entrada muda: em vez do botão "Novo Sistema" na tab Sistemas, a busca product-first detecta `tipo_produto='fita'` e invoca `addSistema()` com o produto pré-preenchido.

Cálculos protegidos (não tocar): `calcularDemandaFita`, `calcularConsumoW`, `calcularQtdDrivers`, `calcularSubtotalSistemaSemFita`, `isSistemaVazio`.

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
