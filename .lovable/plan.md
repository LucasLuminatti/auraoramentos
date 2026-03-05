

# Refatoracao: Perfil Opcional no Sistema Fita+Driver

## Problema atual

O modelo atual (`SistemaPerfil`) trata o **perfil como obrigatorio** e fita/driver como opcionais. A realidade do negocio e o inverso:

- **Fita LED e o elemento central** — sempre presente
- **Driver sempre acompanha a fita** — obrigatorio se ha fita
- **Perfil e opcional** — nem toda fita precisa de perfil

Quando nao ha perfil, o usuario precisa informar a metragem manualmente.

## Mudancas

### 1. Tipos (`src/types/orcamento.ts`)

Renomear `SistemaPerfil` para `SistemaIluminacao` e inverter a obrigatoriedade:

```text
SistemaIluminacao {
  id: string;
  perfil: ItemPerfil | null;     // OPCIONAL (era obrigatorio)
  fita: ItemFitaLED;             // OBRIGATORIO (era opcional)
  driver: ItemDriver;            // OBRIGATORIO (era opcional)
  metragemManual: number | null; // novo: usado quando nao ha perfil
}
```

Adicionar campo `metragemManual` ao sistema. Se `perfil` existe, a metragem vem do calculo (`comprimentoPeca * quantidade`). Se nao, vem de `metragemManual`.

Adicionar campo `passadasManual: 1|2|3` ao sistema (usado quando nao ha perfil, pois `passadas` hoje vive no ItemPerfil).

Atualizar funcoes de calculo:
- `calcularDemandaFita(sistema)` — usa perfil se existir, senao `metragemManual * passadasManual`
- `calcularConsumoW(sistema)` — idem
- `calcularQtdDrivers(sistema)` — idem
- `calcularSubtotalSistema(sistema)` — perfil so entra se existir
- `calcularRolosPorGrupo` — adaptar para usar a nova assinatura

### 2. UX — AmbienteCard (`src/components/AmbienteCard.tsx`)

Renomear tab "Sistemas de Perfil" para "Sistemas de Iluminacao".

Ao criar novo sistema: fita e driver ja vem inicializados (vazios mas presentes), perfil = null.

Layout do card de sistema:

```text
┌─ FITA LED (obrigatoria) ──────────────────┐
│ [Autocomplete codigo]  [Descricao]        │
│ W/m: [__]   Rolo: [5/10/15m]             │
│ Preco Un.: [__]                           │
├─ PERFIL (opcional) ───────────────────────┤
│ [+ Vincular Perfil]  OU                   │
│ [Autocomplete codigo]  [Descricao]        │
│ Comprimento: [1/2/3m]  Qtd: [__]         │
│ Preco Un.: [__]                           │
│ → Metragem total: 6m                      │
├─ SEM PERFIL ──────────────────────────────┤
│ (se perfil = null):                       │
│ Metragem (m): [__]    Passadas: [1/2/3]   │
│ → Demanda fita: Xm                        │
├─ DRIVER (obrigatorio) ────────────────────┤
│ [Autocomplete codigo]  [Descricao]        │
│ Potencia: [__W]  Voltagem: [12V/24V]     │
│ → Qtd drivers: X                          │
│ Preco Un.: [__]                           │
├───────────────────────────────────────────┤
│ Badges: Consumo Xw | Demanda Xm          │
│ SUBTOTAL (s/ fita): R$ xxx               │
└───────────────────────────────────────────┘
```

Se o usuario vincula perfil, os campos metragemManual/passadasManual somem (valores vem do perfil). Se remove perfil, aparecem metragemManual/passadasManual.

### 3. Step3Revisao e PDF

Adaptar referencias de `SistemaPerfil` para `SistemaIluminacao`. Coluna de perfil mostra "—" quando nao ha perfil. Metragem sempre aparece (vinda do perfil ou manual).

### 4. Arquivos a alterar

1. `src/types/orcamento.ts` — renomear tipo, inverter obrigatoriedade, adicionar metragemManual/passadasManual, adaptar funcoes de calculo
2. `src/components/AmbienteCard.tsx` — novo layout com fita e driver sempre presentes, perfil como secao opcional
3. `src/components/Step3Revisao.tsx` — adaptar nome do tipo e renderizacao condicional do perfil
4. `src/lib/gerarPdfHtml.ts` — idem para PDF

