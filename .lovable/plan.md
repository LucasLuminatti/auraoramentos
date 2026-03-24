

# Expandir Campos de Importacao para Todas as Colunas do Banco

## Problema
O mapeamento de colunas (de-para) ja existe no `ImportMapper`, mas os imports de Produtos e Precos so expoe 2-3 campos. O usuario quer poder importar **todos os campos** da tabela `produtos` de uma vez, sem ficar preso a um modelo de planilha.

## Solucao

### 1. ImportProdutos — expandir campos

Adicionar todos os campos da tabela `produtos` como opcoes de mapeamento:

| Campo | Label | Obrigatorio |
|-------|-------|-------------|
| codigo | Codigo | Sim |
| descricao | Descricao | Sim |
| grupo | Grupo | Nao |
| categoria | Categoria | Nao |
| preco_tabela | Preco Tabela | Nao |
| preco_minimo | Preco Minimo | Nao |
| wm | W/m | Nao |
| voltagem | Voltagem | Nao |
| passadas | Passadas | Nao |
| familia_perfil | Familia Perfil | Nao |
| fita_compativel | Fita Compativel | Nao |
| driver_potencia_w | Potencia Driver (W) | Nao |
| driver_tipo | Tipo Driver | Nao |
| driver_restr_tipo | Restricao Tipo Driver | Nao |
| driver_restr_max_w | Restricao Max W Driver | Nao |
| sistema_magnetico | Sistema Magnetico | Nao |
| is_baby | Baby | Nao |

Ajustar o `handleImport` para enviar todos os campos mapeados (nao apenas codigo/descricao).

### 2. Edge Function `import-produtos` — aceitar todos os campos

Atualizar para aceitar e fazer upsert de todos os campos enviados (nao apenas codigo/descricao). Campos nao mapeados simplesmente nao sao incluidos no upsert.

### 3. ImportPrecos — manter como esta

Ja funciona bem com os 3 campos (codigo + precos). Nao precisa de alteracao.

## Arquivos a alterar

1. `src/components/ImportProdutos.tsx` — expandir array `fields` com todas as colunas, ajustar `handleImport` para passar todos os campos mapeados
2. `supabase/functions/import-produtos/index.ts` — aceitar e fazer upsert de todos os campos enviados dinamicamente

