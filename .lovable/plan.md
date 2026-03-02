
# Melhorias no Dialog de Anexar Arquivo

## O que sera feito

Duas alteracoes no componente `ClienteArquivos.tsx`:

### 1. Adicionar seletor de projeto no dialog de upload
- Buscar os projetos do cliente (`projetos` onde `cliente_id` = clienteId) ao abrir o componente
- Adicionar um `Select` no dialog com as opcoes:
  - "Nenhum projeto (geral)" como opcao padrao
  - Lista de projetos do cliente
- Ao fazer upload, salvar o `projeto_id` selecionado na tabela `cliente_arquivos` (coluna ja existe no schema)

### 2. Remover a categoria "Documento"
- Alterar a constante `CATEGORIAS` de `["Planta", "Reuniao", "Documento", "Geral"]` para `["Planta", "Reuniao", "Geral"]`

## Detalhes tecnicos

### Alteracoes em `src/components/ClienteArquivos.tsx`:

1. Adicionar estado `projetos` e `projetoId` (string | null, default null)
2. Fetch de projetos no useEffect: `supabase.from("projetos").select("id, nome").eq("cliente_id", clienteId)`
3. Novo `Select` no dialog entre o file input e o select de categoria:
   - Placeholder: "Projeto (opcional)"
   - Opcao "Nenhum projeto": value = "none"
   - Opcoes dinamicas com os projetos do cliente
4. No `handleUpload`, incluir `projeto_id: projetoId` no insert
5. Remover "Documento" do array CATEGORIAS
6. Resetar `projetoId` ao fechar o dialog
