

# Remodelagem: Cadeia Perfil-Fita-Driver + Calculo Global de Fita

## Mudanca principal vs plano anterior

O documento esclarece que a **fita LED e um insumo continuo**, nao um produto por ambiente. A logica correta e:

1. Calcular a demanda exata de cada ambiente (sem arredondar)
2. Agrupar por codigo de fita em todo o projeto
3. Escolher rolos (5m, 10m, 15m) que cubram a demanda total com minimo desperdicio
4. Arredondar **uma unica vez** no final

Isso muda fundamentalmente a arquitetura: o calculo de rolos sai do nivel ambiente e vai para o nivel orcamento.

---

## 1. Tipos (`src/types/orcamento.ts`)

### SistemaPerfil (agrupa perfil + fita + driver)

```text
SistemaPerfil {
  id, perfil: ItemPerfil, fita: ItemFitaLED | null, driver: ItemDriver | null
}
```

**ItemPerfil** reformulado:
- `comprimentoPeca` (1, 2 ou 3m), `quantidade`, `passadas` (1, 2 ou 3)
- Calculado: `metragemTotal = comprimentoPeca × quantidade`
- Calculado: `demandaFita = metragemTotal × passadas` (metragem real de fita necessaria)

**ItemFitaLED** reformulado:
- Remove `passadas` (vem do perfil)
- Mantem `wm`, `metragemRolo` (padrao 5, opcoes 5/10/15)
- A demanda vem do perfil pai

**ItemDriver** (novo):
- `potencia` (W), `voltagem` (12 ou 24)
- Calculados: `qtdDrivers = max(ceil(consumoW / potencia), ceil(demandaFita / limite))` onde limite = 5m p/ 12V, 10m p/ 24V

### Ambiente reformulado

```text
Ambiente {
  luminarias: ItemLuminaria[]  // inalterado
  sistemas: SistemaPerfil[]     // substitui perfis[] e fitasLed[]
}
```

### Funcoes de calculo global de fita

Nova funcao `calcularRolosPorGrupo(ambientes)`:
1. Percorre todos os sistemas de todos os ambientes
2. Agrupa por `fita.codigo`
3. Para cada grupo: soma `demandaFita` de todos os sistemas
4. Algoritmo guloso para escolher rolos: comeca pelo maior (15m), depois 10m, depois 5m, cobrindo a demanda sem ficar abaixo

```text
Exemplo: demanda 23m
→ 1x15m (resta 8m) → 1x10m (resta -2m, coberto)
→ Total: 1x15m + 1x10m = 25m, sobra 2m
```

## 2. UX — AmbienteCard reformulado

Duas tabs: **Luminarias** e **Sistemas de Perfil**

Cada sistema e um card agrupado com 3 secoes visuais (Perfil → Fita → Driver):
- Perfil: autocomplete codigo, select comprimento (1/2/3m), qtd, select passadas (1/2/3), badges automaticos de metragem
- Fita: autocomplete codigo, W/m, badges de consumo total
- Driver: autocomplete codigo, potencia, select voltagem (12V/24V), badge de qtd drivers
- Precos individuais para cada componente com validacao de minimo
- Subtotal do sistema automatico

**Importante**: na tab de fita, os campos de rolos e qtd rolos NAO aparecem por sistema. O calculo de rolos aparece apenas no Step3 (revisao), pois e global.

## 3. Step3 Revisao

### Tabelas por ambiente
- Luminarias: inalterado
- Sistemas: tabela agrupada mostrando perfil + fita + driver de cada sistema, com subtotal

### Resumo global de fitas (NOVO)
Secao dedicada apos os ambientes mostrando:
- Tabela agrupada por codigo de fita
- Colunas: Codigo | Descricao | Demanda Total (m) | Rolos sugeridos | Preco un. | Subtotal
- O subtotal da fita e calculado aqui (preco × qtd rolos), nao por ambiente

### Total geral
- Soma de luminarias (por ambiente) + perfis (por ambiente) + drivers (por ambiente) + fitas (global)

## 4. PDF (`gerarPdfHtml.ts`)

- Adaptar para o novo formato de sistemas
- Adicionar secao "Resumo de Fitas LED" com a tabela global de rolos
- Subtotais de ambiente mostram apenas luminarias + perfis + drivers
- Total de fitas aparece como secao separada antes do total geral

## 5. Arquivos a alterar

1. **`src/types/orcamento.ts`** — Novos tipos, funcoes de calculo encadeado, algoritmo de rolos global
2. **`src/components/AmbienteCard.tsx`** — Reescrever com 2 tabs, UI de sistema agrupado
3. **`src/components/Step2Ambientes.tsx`** — Ajuste minimo (usa `sistemas` em vez de `perfis`/`fitasLed`)
4. **`src/components/Step3Revisao.tsx`** — Tabelas de sistema + secao global de fitas
5. **`src/lib/gerarPdfHtml.ts`** — PDF com novo formato

