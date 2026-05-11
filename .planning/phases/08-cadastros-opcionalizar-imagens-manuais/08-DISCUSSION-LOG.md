# Phase 8: Cadastros — Opcionalizar + Imagens Manuais - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-11
**Phase:** 08-cadastros-opcionalizar-imagens-manuais
**Areas discussed:** Forma do arquiteto expandido, Coringa AU001..AU016 (como destravar edição)
**Areas locked via defaults:** FORM-04 anexar imagem por linha, FORM-01 sinalização cliente opcional

---

## Forma do arquiteto expandido (FORM-02)

### Q1: Como modelar o endereço do escritório?

| Option | Description | Selected |
|--------|-------------|----------|
| String única `endereco TEXT` (Recommended) | Coluna única free-form, alinha com `contato`, sem ViaCEP | ✓ |
| Estruturado: cep/logradouro/numero/complemento/bairro/cidade/uf | 7 colunas typed, integração ViaCEP futura, melhor pra filtros | |
| JSONB `endereco JSONB` | Schema flex, perde typing | |

**User's choice:** String única `endereco TEXT`
**Notes:** v1.1 não tem caso de filtro por UF/cidade. Estruturar depois se necessário.

### Q2: Como modelar os dados bancários?

| Option | Description | Selected |
|--------|-------------|----------|
| 5 colunas typed: banco/agencia/conta/tipo_conta/pix (Recommended) | TEXT nullable, typing claro, padrão projeto | ✓ |
| JSONB `dados_bancarios JSONB` | Schema flex, perde typing | |
| Só Pix (1 coluna) | Simplifica radicalmente | |

**User's choice:** 5 colunas typed
**Notes:** Pix coexiste com banco/agência/conta — campos opcionais paralelos.

### Q3: Data de nascimento — mesmo padrão de `clientes.data_nascimento`?

| Option | Description | Selected |
|--------|-------------|----------|
| Sim, DATE NULL + index BTREE (Recommended) | Replica Phase 7 D-07/D-08; index pra cron futuro | ✓ |
| Só DATE NULL, sem index | Sem index inicial | |
| Não adicionar agora | Deferir do escopo | |

**User's choice:** DATE NULL + index BTREE
**Notes:** Consistência com clientes; cron Phase 12 pode estender pra arquitetos no futuro.

### Q4: Quem pode editar a ficha expandida?

| Option | Description | Selected |
|--------|-------------|----------|
| Admin + colab dono (Recommended) | Alinha com RLS-02 Phase 9 | ✓ |
| Só admin | Centralizado, mais fricção | |
| Qualquer colab logado | Sem RLS no edit até Phase 9 | |

**User's choice:** Admin + colab dono
**Notes:** UI antecipa regra da Phase 9 pra evitar retrabalho.

---

## Coringa AU001..AU016 (FORM-03)

### Discovery before questions
Scout SQL confirmou: 16 coringas existem em `product_variants`, descrição genérica preenchida, ZERO com `imagem_url`. `ProdutoEditDialog` já permite edit sem qualquer bloqueio. Redirecionou as perguntas.

### Q1: Qual o atrito real com os coringa hoje?

| Option | Description | Selected |
|--------|-------------|----------|
| Não aparecem na lista / filtro esconde (Recommended) | FORM-03 = garantir visibilidade no admin | ✓ |
| Descrição/imagem vêm vazias e admin não sabe que eram editáveis | UX clara pra preencher (banner ou ordem) | |
| Check UI/backend impede edit | Remover esse check | |

**User's choice:** Não aparecem na lista / filtro esconde
**Notes:** Lenny vai confirmar visualmente; plan deve testar. Achado registrado no CONTEXT D-07.

### Q2: Imagem do coringa vai onde?

| Option | Description | Selected |
|--------|-------------|----------|
| Mesmo bucket dos demais (Recommended) | `produto-imagens`, path `<codigo>.<ext>` | ✓ |
| Bucket dedicado pra coringa | Separar visualmente | |

**User's choice:** Mesmo bucket
**Notes:** Padrão do projeto, zero novo.

### Q3: Marca `editado_manualmente=true` ao editar coringa?

| Option | Description | Selected |
|--------|-------------|----------|
| Não — origem='coringa' já protege (Recommended) | D-10 reconcile imuniza independente do flag | ✓ |
| Sim, marca também por defesa | Dupla proteção | |

**User's choice:** Não
**Notes:** Flag adicional seria redundante.

### Q4: Código do coringa pode ser alterado?

| Option | Description | Selected |
|--------|-------------|----------|
| Não — imutável (já é padrão do dialog) (Recommended) | `mode='edit'` já desabilita codigo (linha 233) | ✓ |
| Sim, libera edit | Risco de quebrar histórico | |

**User's choice:** Não
**Notes:** Códigos canônicos, preservar.

---

## Áreas locked via defaults (sem discussão)

### FORM-04 anexar imagem por linha

**Defaults aceitos:**
- Ícone inline no row da tabela produtos (ao lado do Pencil)
- Abre `ProdutoEditDialog` em modo edit normal (reuso 100%)
- Replace direto sem preview, upsert true no bucket
- Funciona pra qualquer SKU (master/coringa/manual/legado)

### FORM-01 sinalização cliente opcional

**Defaults aceitos:**
- Remover `required` JSX em Contato, CPF/CNPJ, Arquiteto
- Adicionar `(opcional)` inline nos labels (cinza, sem asterisco vermelho)
- Validação de formato CPF/CNPJ permanece quando preenchido
- Zero mudança backend/schema (payload já manda null quando vazio)

---

## Claude's Discretion

- Ordem dos campos no form arquiteto expandido
- Wording exato de "(opcional)" — `<small>` cinza ou apenas texto inline
- Posicionamento do ícone de imagem inline (antes/depois do Pencil)
- Texto exato dos COMMENT SQL
- Badge "coringa" na lista ou só permitir filtro

## Deferred Ideas

- Endereço estruturado (CEP + ViaCEP) — D-01
- Bucket separado para coringa — D-08
- Marcar editado_manualmente em coringa por defesa — D-09
- Modo "focused-image" novo no dialog — D-11
- Editar código do coringa — D-10
