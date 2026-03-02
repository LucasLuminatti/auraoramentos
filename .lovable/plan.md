

## Ajustes no PDF: Informacoes Importantes + Header de Tabela Mais Leve

### Resumo

Duas alteracoes no arquivo `src/lib/gerarPdfHtml.ts`:

1. **Header das tabelas mais leve** — Trocar o fundo escuro (`--gray-900` / `#1a1f2e`) por um tom claro e suave, mantendo legibilidade.
2. **Secao "Informacoes Importantes"** — Adicionar um bloco completo com todos os termos e condicoes fornecidos, posicionado entre a secao de info-cards e o footer.

---

### 1. Header das tabelas — cor mais leve

**Antes:** `thead tr { background: var(--gray-900) }` (fundo quase preto)
**Depois:** `thead tr { background: var(--gray-100) }` (cinza claro `#f4f6f8`) com texto em `var(--gray-600)` ao inves de branco

Isso torna a barra de cabecalho das tabelas mais discreta e integrada ao design, sem perder a separacao visual.

---

### 2. Secao "Informacoes Importantes"

Novo bloco HTML inserido apos a `info-section` e antes do `footer`, com:

- Titulo "INFORMACOES IMPORTANTES" em estilo section-header (com numero decorativo ou icone)
- Lista com marcadores (bullet points) contendo todos os itens fornecidos:
  - Proposta de aplicacao como sugestao particular
  - Garantia aplicada apenas ao funcionamento
  - Recomendacao de profissionais capacitados
  - Acompanhamento/suporte nao inclusos
  - Limite de 3 alteracoes em projetos luminotecnicos
  - Politica de nao devolucao
  - Projetos luminotecnicos nao enviados antes do pedido
  - Conferencia no recebimento (quantidade, estado fisico, lacres)
  - Garantia de 1 ano
  - Mensagem de agradecimento

**Estilo visual:**
- Fundo `var(--gray-100)` com borda `var(--gray-200)`, border-radius 10px
- Titulo em uppercase com letter-spacing, cor `var(--blue)`
- Itens em fonte 10px, cor `var(--gray-600)`, line-height confortavel
- Marcadores customizados (pequenos circulos azuis ou tracinhos)

---

### Arquivo modificado

**`src/lib/gerarPdfHtml.ts`**

Alteracoes:
- CSS: `thead tr` background de `var(--gray-900)` para `var(--gray-100)`, cor do texto de branco para `var(--gray-600)`
- CSS: Novas classes `.terms-section`, `.terms-title`, `.terms-list`, `.terms-list li`
- HTML: Novo bloco `terms-section` inserido apos `.info-section` (dentro de `.body`), antes do fechamento de `.body`

