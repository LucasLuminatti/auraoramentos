

# Anexar Arquivos aos Clientes

## Objetivo
Adicionar a capacidade de anexar arquivos (PDF, DWG, SketchUp, notas de reuniao, etc.) a cada cliente, transformando o app em um organizador de relacionamento com clientes.

## 1. Banco de Dados

Criar tabela `cliente_arquivos` para armazenar metadados dos arquivos:

```text
cliente_arquivos
- id (uuid, PK)
- cliente_id (uuid, FK -> clientes.id, ON DELETE CASCADE)
- nome (text) -- nome original do arquivo
- descricao (text, nullable) -- descricao opcional / notas
- categoria (text) -- ex: "planta", "reuniao", "geral"
- arquivo_path (text) -- caminho no storage bucket
- arquivo_url (text) -- URL publica do arquivo
- tamanho (integer) -- tamanho em bytes
- created_at (timestamptz)
```

RLS: usuarios autenticados podem ler, inserir e deletar arquivos.

## 2. Storage

Criar bucket `cliente-arquivos` (publico) para armazenar os arquivos enviados. Arquivos organizados por pasta do cliente: `{cliente_id}/{nome_arquivo}`.

## 3. Interface (ClienteList.tsx)

Quando o cliente estiver expandido, adicionar uma secao "Arquivos" abaixo dos projetos:

- Botao "Anexar Arquivo" que abre um dialog com:
  - Input de arquivo (aceita PDF, DWG, SKP, imagens, etc.)
  - Select de categoria: Planta, Reuniao, Geral
  - Campo opcional de descricao/notas
- Lista dos arquivos ja anexados com:
  - Icone por tipo de arquivo
  - Nome, categoria, data de upload
  - Botao para abrir/baixar o arquivo
  - Botao para excluir

## 4. Componente ClienteArquivos

Criar componente separado `ClienteArquivos.tsx` para manter o codigo organizado:
- Recebe `clienteId` como prop
- Gerencia upload via Supabase Storage
- Lista arquivos do cliente consultando `cliente_arquivos`
- Permite download e exclusao

## Detalhes tecnicos

- Upload: `supabase.storage.from('cliente-arquivos').upload(path, file)`
- URL publica: `supabase.storage.from('cliente-arquivos').getPublicUrl(path)`
- Categorias pre-definidas: "Planta", "Reuniao", "Documento", "Geral"
- Tipos aceitos: `.pdf, .dwg, .skp, .jpg, .jpeg, .png, .doc, .docx, .xls, .xlsx`
- Limite visual: mostrar tamanho formatado (KB/MB)

