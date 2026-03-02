

# Sistema de Drive - Arquivos por Cliente e Projeto

## Objetivo
Criar um sistema de gerenciamento de arquivos estilo Google Drive, com hierarquia: **Cliente > Projeto > Pastas > Arquivos**. Arquivos podem existir tanto a nivel de cliente (geral) quanto dentro de cada projeto, com navegacao por pastas.

## 1. Banco de Dados

### Adicionar coluna `projeto_id` na tabela `cliente_arquivos`
- Adicionar coluna `projeto_id` (uuid, nullable, FK -> projetos.id ON DELETE CASCADE)
- Quando `projeto_id` e NULL, o arquivo pertence ao cliente (nivel geral)
- Quando preenchido, pertence ao projeto especifico

### Criar tabela `arquivo_pastas` para hierarquia de pastas
```text
arquivo_pastas
- id (uuid, PK)
- nome (text) -- nome da pasta
- cliente_id (uuid, FK -> clientes.id, ON DELETE CASCADE)
- projeto_id (uuid, nullable, FK -> projetos.id, ON DELETE CASCADE)
- pasta_pai_id (uuid, nullable, FK -> arquivo_pastas.id, ON DELETE CASCADE) -- para subpastas
- created_at (timestamptz)
```

### Adicionar coluna `pasta_id` na tabela `cliente_arquivos`
- Adicionar coluna `pasta_id` (uuid, nullable, FK -> arquivo_pastas.id ON DELETE SET NULL)
- Permite organizar arquivos dentro de pastas

### RLS
- Usuarios autenticados podem CRUD em `arquivo_pastas`
- Manter as politicas existentes de `cliente_arquivos`

## 2. Nova Pagina de Drive (`/drive`)

Criar uma pagina dedicada `/drive` com interface estilo Google Drive:

### Layout
- **Sidebar esquerda**: arvore de navegacao com clientes e projetos
- **Area principal**: lista de pastas e arquivos do nivel atual
- **Breadcrumb** no topo mostrando o caminho: Cliente > Projeto > Pasta > Subpasta

### Funcionalidades
- Navegar pela hierarquia clicando nas pastas
- Criar novas pastas em qualquer nivel
- Upload de arquivos para a pasta/nivel atual
- Mover arquivos entre pastas (arrastar ou menu de contexto)
- Excluir pastas (com confirmacao)
- Icones visuais diferenciando pastas de arquivos
- Contagem de itens dentro de cada pasta

## 3. Componentes

### `DriveExplorer.tsx` (componente principal)
- Gerencia o estado de navegacao (breadcrumb path)
- Mostra pastas e arquivos do nivel atual
- Botoes para criar pasta, fazer upload
- Grid ou lista view (toggle)

### `DriveSidebar.tsx` (arvore lateral)
- Lista clientes como raiz
- Dentro de cada cliente: "Arquivos Gerais" + lista de projetos
- Cada projeto pode ter suas pastas
- Indicador visual do nivel selecionado

### `DriveBreadcrumb.tsx` (navegacao por migalhas)
- Mostra caminho atual: Cliente > Projeto > Pasta
- Cada nivel clicavel para navegar para cima

## 4. Integracao com a pagina existente

### Opcao de acesso
- Adicionar botao "Drive" no header da pagina Index (ao lado do botao Admin)
- Rota `/drive` acessivel para usuarios autenticados
- Dentro do ClienteList expandido, manter o componente de arquivos simplificado mas com link "Abrir no Drive" para a visao completa

### Manter compatibilidade
- O `ClienteArquivos` existente continua funcionando como versao compacta
- O Drive e a versao completa para gerenciamento avancado

## 5. Detalhes tecnicos

### Navegacao por estado
```text
Estado do Drive:
- clienteId: string | null
- projetoId: string | null
- pastaId: string | null
- breadcrumb: Array<{ id, nome, tipo }>
```

### Queries
- Listar pastas: `SELECT * FROM arquivo_pastas WHERE cliente_id = X AND projeto_id = Y AND pasta_pai_id = Z`
- Listar arquivos: `SELECT * FROM cliente_arquivos WHERE cliente_id = X AND projeto_id = Y AND pasta_id = Z`
- Arquivos na raiz (sem pasta): `pasta_id IS NULL`

### Arquivos alterados/criados
- `supabase/migrations/` - nova migracao para schema
- `src/pages/Drive.tsx` - nova pagina
- `src/components/DriveExplorer.tsx` - explorador principal
- `src/components/DriveSidebar.tsx` - arvore lateral
- `src/components/DriveBreadcrumb.tsx` - breadcrumb
- `src/components/ClienteArquivos.tsx` - adicionar link para Drive
- `src/components/ClienteList.tsx` - adicionar arquivos por projeto
- `src/App.tsx` - nova rota `/drive`
- `src/pages/Index.tsx` - botao de acesso ao Drive no header

