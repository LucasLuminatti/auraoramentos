# Phase 1: Schema & Prep — Research

**Researched:** 2026-04-23
**Domain:** Supabase Postgres migrations + git hygiene (prep phase, no application code)
**Confidence:** HIGH

## Summary

Phase 1 é preparação estrutural: limpar git pendente e empurrar migrations aditivas pro Supabase de produção. Não há app code novo. O risco é 100% em ordem das operações e compatibilidade com dados existentes.

O codebase **já tem padrão estabelecido** de migrations (20 migrations em `supabase/migrations/` usando timestamp ou sufixo semântico), RLS ativo em todas as tabelas, e uso misto de `CHECK` constraint (produtos) e `CREATE TYPE ... AS ENUM` (app_role). A decisão técnica mais importante desta fase é qual dos dois padrões usar para o novo campo `setor`.

O git pendente é substantivo e load-bearing: `config.toml` aponta pro projeto correto de prod (`jkewlaezvrbuicmncqbj`), as edge functions foram atualizadas com `noreply@orcamentosaura.com.br` (domínio próprio) em vez de `onboarding@resend.dev`, e o arquivo `supabase/.temp/linked-project.json` é untracked. Jogar fora é destrutivo; commitar tudo é seguro **porque** o frontend e as edge functions em prod já estão com esse código (Vercel já builda com config desse branch main).

**Primary recommendation:** Commitar tudo o que está pendente em um commit `chore(supabase)` + adicionar `supabase/.temp/` ao `.gitignore` no mesmo commit. Depois criar **4 migrations separadas** (arquitetos → FKs clientes/produtos → colunas colaboradores → colunas clientes) na ordem de dependência. Usar `CHECK constraint` para `setor` (consistente com o padrão dominante do codebase em produtos). Todas FKs com `ON DELETE SET NULL`. Push não-interativo via `supabase db push --linked --password "$SUPABASE_DB_PASSWORD" --yes`. Regerar types com `supabase gen types typescript --linked > src/integrations/supabase/types.ts`.

## User Constraints (from CONTEXT.md)

**CONTEXT.md não existe para esta fase** — não houve discuss-phase. As constraints vêm diretamente do prompt de spawn e dos documentos do marco (PROJECT.md, REQUIREMENTS.md, ROADMAP.md).

### Locked Decisions (inferidas de PROJECT.md / ROADMAP.md / additional_context)

1. **Schema aditivo, nunca destrutivo** — nova tabela, colunas nullable, FKs nullable. Nunca DROP, nunca `NOT NULL` em coluna recém-adicionada que já tem dados.
2. **Produção no Vercel kappa** com dados reais — qualquer migration tem que não quebrar queries existentes.
3. **Tabela `arquitetos`** com campos: `id`, `nome`, `contato` (nullable), `created_at`.
4. **FK `arquiteto_id`** (nullable) em `clientes` e `produtos`. ARQ-05 explicitamente diz: orçamentos **não** ganham FK direta — chegam em arquiteto via cliente.
5. **Colunas novas em `colaboradores`**: `cpf`, `telefone`, `setor` (enum: comercial/projetos/logistica/financeiro), todas nullable. Isso é bloqueante pra Fase 2 (USR-01..03) mas vive na Fase 1 por ordem física.
6. **Colunas novas em `clientes`**: `contato`, `cpf_cnpj`, nullable. Bloqueante pra Fase 2 (CLI-01/02).
7. **Types regenerados** após push (`src/integrations/supabase/types.ts` é auto-gerado).
8. **RLS** não é foco desta fase (vai pra Fase 4), mas toda tabela nova precisa ter RLS habilitado (consistência com padrão do codebase — toda tabela tem `ENABLE ROW LEVEL SECURITY`).

### Claude's Discretion

1. **Formato de enum para `setor`**: `CREATE TYPE ... AS ENUM` vs `TEXT + CHECK constraint` — decidir com tradeoff justificado.
2. **`ON DELETE` behavior** das FKs `arquiteto_id` — recomendar SET NULL vs RESTRICT vs CASCADE.
3. **Validação de CPF em Postgres** (check constraint no formato) vs só no app layer — recomendar.
4. **Índices** em tabela `arquitetos` e colunas FK novas — decidir.
5. **Ordem de commits/migrations** dentro da fase — agrupar ou separar.
6. **Handling do `supabase/.temp/`** — adicionar ao `.gitignore`, commitar ou deixar como está.

### Deferred Ideas (OUT OF SCOPE — Phase 1)

- CRUD de arquitetos no admin (ARQ-02 é Fase 2).
- Formulário de signup com CPF/telefone/setor (USR-01..03 é Fase 2).
- Formulário de cliente com arquiteto (CLI-01..03 é Fase 2).
- Vinculação de produtos existentes a arquiteto (PROD-03 é Fase 2).
- RLS por colaborador no Drive (ACC-01..04 é Fase 4).
- Validação semântica de CPF no cliente (out of scope do marco inteiro).

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PREP-01 | Decidir sobre edge functions `request-access`/`review-access` e `supabase/config.toml` não-commitadas | Diff analysis abaixo mostra que são mudanças intencionais (domínio novo `orcamentosaura.com.br` + link do projeto correto); recomendação: commitar tudo + `.gitignore` pro `.temp/` |
| ARQ-01 | Tabela `arquitetos` com campos id/nome/contato(nullable)/created_at | Schema definido na seção Code Examples; padrão `gen_random_uuid() PRIMARY KEY` + `TIMESTAMP WITH TIME ZONE DEFAULT now()` já é convenção das 20 migrations existentes |
| ARQ-03 | FK `arquiteto_id` (nullable) em `clientes` | `ALTER TABLE ... ADD COLUMN arquiteto_id UUID REFERENCES arquitetos(id) ON DELETE SET NULL`; aditiva porque nullable |
| ARQ-04 | FK `arquiteto_id` (nullable) em `produtos` | Mesmo padrão de clientes; produtos já tem 20 colunas adicionadas incrementalmente sem regressão (migration 20260319000001 como precedente) |
| ARQ-05 | Orçamentos expõem arquiteto via cliente → arquiteto, sem FK direta | NENHUM schema change pra orçamentos nesta fase. Precisa ser documentado no comentário da migration para não esquecer em fases futuras. Implementação da exposição é lógica de consulta (Fase 4 — visualização detalhada de pedido) |

## Standard Stack

### Core (já instalado, não instalar nada novo)
| Ferramenta | Versão verificada | Uso | Por que padrão |
|------------|-------------------|-----|----------------|
| Supabase CLI | 2.78.1 (instalada local); 2.90.0 disponível | Criar/empurrar migrations | Única ferramenta oficial para gerenciar schema Supabase [VERIFIED: `supabase --version` na máquina do Lenny] |
| PostgreSQL | 15+ (Supabase managed, sa-east-1) | DB | [CITED: STACK.md L105] |
| Supabase SDK JS | 2.95.3 | Frontend consome tipos | [CITED: STACK.md L38] |

**Versão do CLI:** 2.78.1 local vs 2.90.0 disponível. Upgrade **não é necessário** para esta fase — todos os comandos usados (`migration new`, `db push --linked`, `gen types --linked`) já existem e estão estáveis desde v1.x. Upgrade pode ser feito em paralelo sem bloquear. [VERIFIED: flags confirmadas via `--help` no CLI 2.78.1]

### Supporting (já no projeto)
| Item | Uso | Quando |
|------|-----|--------|
| `src/integrations/supabase/types.ts` | Tipos TS auto-gerados (654 linhas atualmente) | Regerar ao final da fase, depois de todas as migrations aplicadas |
| `supabase/migrations/` | Diretório canônico de migrations | Onde criar os 4 novos arquivos |

### Alternativas Consideradas
| Em vez de | Poderia usar | Tradeoff |
|-----------|--------------|----------|
| `supabase db push --linked` | SQL direto via dashboard Supabase | Rejeitado — descasaria git vs banco. Hoje as 20 migrations todas estão versionadas em git; quebrar esse padrão vira deriva permanente |
| `supabase gen types --linked` | Escrever tipos à mão em `types.ts` | Rejeitado — `types.ts` tem 654 linhas auto-geradas; editar manual vira lixo na próxima regeneração |
| Migration única com tudo | 4 migrations separadas | Migrations separadas dão rollback granular e commits limpos. Único custo é 4 arquivos em vez de 1 — trivial |

**Instalação:** nada a instalar. Tudo já presente.

**Verificação de versão executada:**
```bash
supabase --version    # 2.78.1 (instalado)
# Flags verificadas via --help: --linked, --password, --yes, --include-all, --dry-run
```

## Architecture Patterns

### Estrutura de Diretório (sem mudança)
```
supabase/
├── config.toml                     # Já aponta pro projeto jkewlaezvrbuicmncqbj (pendente commit)
├── functions/                       # Edge functions (pendentes commit em 2 delas)
│   ├── request-access/
│   └── review-access/
├── migrations/                      # Onde criar os 4 novos SQLs
│   ├── 20260213142833_*.sql         # Pattern 1: timestamp + UUID do Lovable
│   ├── 20260319000001_*.sql         # Pattern 2: YYYYMMDD + seq + nome semântico
│   └── 20260416000001_*.sql
└── .temp/                           # Gerado pelo CLI, não versionar
    ├── cli-latest                   # (tracked — deveria ser ignorado)
    └── linked-project.json          # (untracked — deveria ser ignorado)
```

### Pattern 1: Nome das migrations — seguir convenção mais recente
**O que:** As 5 migrations mais novas (desde 2026-03-19) usam formato `YYYYMMDDNNNNNN_nome_semantico.sql` em vez do `YYYYMMDDHHMMSS_<uuid>.sql` original do Lovable.

**Quando usar:** Sempre que o migration for escrito à mão (não gerado por Lovable UI). É o padrão que o Lenny adotou.

**Exemplo (de 20260319000001):**
```
20260319000001_campos_tecnicos_produtos.sql
20260416000001_orcamentos_ambientes_tipo.sql
```

**Aplicando à Phase 1 (assumindo execução hoje, 2026-04-23):**
```
20260423000001_create_arquitetos.sql
20260423000002_clientes_arquiteto_fk_e_campos.sql
20260423000003_produtos_arquiteto_fk.sql
20260423000004_colaboradores_cpf_telefone_setor.sql
```

[VERIFIED: pattern confirmed by listing `supabase/migrations/`]

### Pattern 2: Migration aditiva segura
**O que:** Adicionar coluna nullable, ou nova tabela, sem tocar estruturas existentes.

**Quando usar:** Toda mudança desta fase. Se precisar de NOT NULL no futuro (ex: quando USR-01 virar enforçado), isso vira migration em fase própria com backfill.

**Exemplo (de 20260416000001_orcamentos_ambientes_tipo.sql):**
```sql
ALTER TABLE public.orcamentos
  ADD COLUMN ambientes jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN tipo text;

COMMENT ON COLUMN public.orcamentos.ambientes IS '...';
```

**Nota:** Aqui o Lenny usou `NOT NULL DEFAULT '...'` em coluna nova porque o default cobre os rows existentes. Essa técnica é **segura e recomendada**: todos os registros antigos recebem o default automaticamente na hora do ALTER, e novos registros ganham o default se não especificarem valor. Para colunas que não têm default óbvio (CPF, telefone, contato) = deixar nullable.

### Pattern 3: RLS sempre habilitado + SELECT permissivo para tabelas de domínio
**O que:** Toda tabela nova tem `ENABLE ROW LEVEL SECURITY` + `CREATE POLICY "..." FOR SELECT USING (true)`. Para tabelas de metadata de negócio (produtos, clientes, colaboradores, **arquitetos**), SELECT é aberto para usuários autenticados e escrita é controlada por role.

**Quando usar:** Nova tabela `arquitetos` segue esse padrão.

**Exemplo (de 20260213142833 e 20260213150619):**
```sql
ALTER TABLE public.arquitetos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read arquitetos"
  ON public.arquitetos FOR SELECT USING (true);
```

**Inserir/atualizar/deletar policies**: Padrão atual em `clientes`/`colaboradores` é permissivo para autenticado (ou até `public`). Isso é "security debt" explícito do codebase e **não é foco desta fase**. Replicar o mesmo padrão permissivo para `arquitetos` mantém consistência — upgrade de segurança é Fase 4. [VERIFIED: `grep FOR INSERT/UPDATE/DELETE` nas migrations mostra ausência de policies estritas em tabelas de metadata]

### Pattern 4: FK com `ON DELETE SET NULL` para relacionamento opcional
**O que:** Quando FK é nullable e o domínio diz "se a entidade pai some, a filha continua existindo sem pai", usar `ON DELETE SET NULL`.

**Precedente no codebase:** Migration 20260302192941 faz `pasta_id UUID REFERENCES public.arquivo_pastas(id) ON DELETE SET NULL` — arquivo perde a pasta mas continua acessível.

**Aplicando à Phase 1:** Se um arquiteto é deletado no admin, clientes/produtos vinculados ficam `arquiteto_id = NULL` — não somem, não quebram queries existentes.

```sql
ALTER TABLE public.clientes
  ADD COLUMN arquiteto_id UUID REFERENCES public.arquitetos(id) ON DELETE SET NULL;
```

### Anti-Patterns a Evitar

- **NOT NULL em coluna nova sem default em tabela com dados existentes:** Quebra o ALTER. Exceção: usar DEFAULT para preencher linhas antigas (como `ambientes jsonb NOT NULL DEFAULT '[]'`).
- **Usar `CREATE TYPE enum` em vez de `CHECK constraint` quando o valor pode evoluir:** Ver seção "CHECK vs ENUM" abaixo.
- **Rodar `supabase db push` sem `--dry-run` primeiro:** Arrisca aplicar mudança incompleta em prod. Sempre `--dry-run` antes.
- **Editar `src/integrations/supabase/types.ts` à mão:** Arquivo auto-gerado de 654 linhas. Regerar, não editar.
- **Commitar `supabase/.temp/linked-project.json`:** É estado local do CLI, contém metadados de organização/ref — não pertence ao repo.
- **Deletar edge functions pendentes só porque não foram testadas:** As functions já estão em produção (o fluxo de request-access funciona hoje no Vercel kappa). Reverter quebra produção.

## Don't Hand-Roll

| Problema | Não Construir | Usar | Por quê |
|----------|---------------|------|---------|
| Gerar `types.ts` manualmente | Digitar interfaces TS | `supabase gen types typescript --linked` | 654 linhas auto-geradas, regenerar é 1 comando |
| Montar timestamp de migration | Inventar nome | `supabase migration new <nome>` gera arquivo timestamped OU seguir padrão YYYYMMDDNNNNNN do codebase | Padrão estabelecido, facilita ordem |
| Validação de CPF em Postgres (dígito verificador) | Função PL/pgSQL custom | Validar **só no app** (algoritmo brasileiro em JS) | Dígito verificador de CPF é lógica de negócio, não integrity constraint. Validar no Postgres custa performance em cada INSERT e duplica lógica. Postgres só valida **formato** (11 dígitos numéricos) se quiser — mas mesmo isso pode ficar no app |
| Enum `setor` mutável com `CREATE TYPE` | Postgres ENUM type | `TEXT + CHECK constraint` | Ver análise "CHECK vs ENUM" abaixo — adicionar valor a ENUM em prod bloqueia; CHECK é reescreve o constraint sem lock longo |
| Sanitização de telefone (formatação) | Trigger Postgres | Aceitar texto livre, padronizar no app layer | Formato BR pode variar (celular 9 dígitos, fixo 8, com/sem DDD); trigger engessa. Campo é nullable agora, formatação é problema de UI (máscara) |
| Auditoria de created_at/updated_at | Triggers custom | `DEFAULT now()` no CREATE e ignorar `updated_at` por enquanto | ROADMAP não pede `updated_at` em `arquitetos`; adicionar só quando houver requisito real (evitar overengineering aditivo) |

**Key insight:** Esta é uma fase de **schema aditivo mínimo**. Cada coluna, constraint ou trigger extra vira dívida — especialmente em prod. Manter migrations estreitas e deixar validações pesadas no app layer onde já existe (Zod, React Hook Form).

## Runtime State Inventory

| Categoria | Itens encontrados | Ação necessária |
|-----------|-------------------|------------------|
| **Stored data** | Tabela `produtos` em prod (dados reais), `clientes` (dados reais), `colaboradores` (dados reais de usuários logados), `orcamentos` (snapshots persistidos desde migration 20260416000001) | **Nenhuma ação de migração de dados nesta fase.** Colunas novas nullable = linhas existentes ficam NULL sem quebrar queries. Backfill de `arquiteto_id` em produtos é Fase 2 (PROD-03) |
| **Live service config** | `supabase/config.toml` em git pendente já reflete o project_id de prod (`jkewlaezvrbuicmncqbj`). Edge functions `request-access`/`review-access` em git pendente usam `noreply@orcamentosaura.com.br`. **Produção já está rodando esse código** (Vercel/edge runtime já atualizado) — git está atrás do que está no ar | Commitar o pendente para o git refletir a realidade. Se não commitar, próximo dev acha que o domínio está em `onboarding@resend.dev` e reverte |
| **OS-registered state** | Nenhum — AURA não registra nada em OS; infra é Vercel + Supabase managed | None — verificado |
| **Secrets / env vars** | `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (Vercel env vars), `RESEND_API_KEY` (Supabase edge function secret), `SUPABASE_DB_PASSWORD` (usado pelo CLI para push) | **Nenhuma mudança de env**. Migrations não tocam secrets. Para rodar `db push --linked` fora de sessão interativa, `SUPABASE_DB_PASSWORD` precisa estar no ambiente do shell que vai executar — mas isso é operacional, não muda o .env do projeto |
| **Build artifacts** | `src/integrations/supabase/types.ts` (654 linhas) — será invalidado após cada migration | Regenerar ao final da fase: `supabase gen types typescript --linked > src/integrations/supabase/types.ts`. Se regerar no meio da fase (depois de cada migration), types.ts vai ter diffs dobrados. Regerar 1x no final é suficiente |

**Canonical question answered:** *Após os arquivos do repo serem atualizados, o que em runtime ainda tem estado velho?*
- `src/integrations/supabase/types.ts` até ser regenerado — por isso ele é a **última** operação da fase, não a primeira.
- Produção (Supabase) após `db push` já fica com schema novo imediatamente.
- `supabase/.temp/linked-project.json` é local apenas, não afeta prod.

## Common Pitfalls

### Pitfall 1: `db push` falha por migrations já aplicadas
**O que dá errado:** `supabase db push` detecta que migration antiga não está no histórico remoto e aborta.
**Por que acontece:** Prod foi migrada via Lovable UI antes — registro em `supabase_migrations.schema_migrations` remoto pode estar desalinhado com o `migrations/` local.
**Como evitar:** Rodar `supabase migration list --linked` **antes** de qualquer push para ver o estado do histórico. Se houver gap, usar `supabase migration repair --status applied <version>` para reconciliar.
**Sinais de alerta:** `db push --dry-run` lista migrations que você **não escreveu nesta fase** como "would be applied". Significa que o histórico remoto está atrasado — investigar antes de continuar.
[CITED: supabase CLI --help output; fluxo documentado em docs.supabase.com/guides/deployment/database-migrations]

### Pitfall 2: `config.toml` rebaseado ao projeto errado
**O que dá errado:** Alguém (ou o Lovable) sobrescreve `project_id` em `config.toml` e o `db push` vai para um banco sandbox.
**Por que acontece:** O diff atual mostra `project_id = "qirsfbypqfeobcnkgspk"` (antigo) → `"jkewlaezvrbuicmncqbj"` (atual). Se o commit não acontecer, na próxima `supabase link`, o CLI pode reverter.
**Como evitar:** **Commitar `config.toml` no primeiro passo da fase.** Só rodar migrations depois que o commit estiver feito. Checar `project_id` no topo do arquivo antes de qualquer push.
**Sinais de alerta:** `supabase status --linked` retorna um project_id diferente do esperado.

### Pitfall 3: Types.ts regerado com schemas do esquema errado
**O que dá errado:** `supabase gen types --linked` sem `--schema public` pode puxar schemas adicionais (auth, storage) que não queremos em `types.ts`.
**Por que acontece:** `--schema` default comportamento varia por versão do CLI.
**Como evitar:** Usar explicitamente `--schema public`. Verificar diff do `types.ts` antes de commitar — se vier auth/storage types novos, abortar e refazer.
**Sinais de alerta:** Diff de `types.ts` mostra mais de ~50 linhas adicionadas para 4 migrations pequenas.
[CITED: `supabase gen types --help`, flag `--schema strings`]

### Pitfall 4: FK criada antes da tabela referenciada
**O que dá errado:** Migration de FK em clientes roda antes de `CREATE TABLE arquitetos` — `db push` falha.
**Por que acontece:** Ordem dos timestamps nos nomes dos arquivos determina a ordem. Se usar `20260423000002_clientes_fk.sql` com a FK e `20260423000003_create_arquitetos.sql` criando a tabela, quebra.
**Como evitar:** Migration 1 = criar `arquitetos`; migrations 2-4 = ALTERs que referenciam `arquitetos`. Essa é a razão de ter 4 arquivos separados em vez de 1 — ordem explícita.

### Pitfall 5: Coluna `setor` com valores inválidos já inseridos antes do CHECK
**O que dá errado:** Se alguém inserir `setor = 'juridico'` na janela entre o ADD COLUMN e o ADD CONSTRAINT, o constraint falha porque viola dados existentes.
**Por que acontece:** Em ALTER TABLE multi-statement, Postgres valida constraints contra todos os dados no momento do constraint.
**Como evitar:** Fazer `ADD COLUMN` e `ADD CONSTRAINT CHECK` no **mesmo ALTER TABLE** (Postgres garante atomicidade) e o constraint só vê as linhas onde `setor IS NULL` (que passam pelo `OR setor IS NULL`). Garantir que o CHECK tem `OR setor IS NULL`.

```sql
-- ERRADO (duas migrations separadas)
ALTER TABLE colaboradores ADD COLUMN setor TEXT;
-- ... meses depois ...
ALTER TABLE colaboradores ADD CONSTRAINT check_setor CHECK (setor IN ('comercial', ...));
-- Se alguém inseriu 'juridico' no meio, constraint falha

-- CERTO (uma migration, CHECK permite NULL)
ALTER TABLE colaboradores
  ADD COLUMN setor TEXT,
  ADD CONSTRAINT check_setor CHECK (
    setor IN ('comercial', 'projetos', 'logistica', 'financeiro') OR setor IS NULL
  );
```

### Pitfall 6: `db push` prompt interativo trava no CI
**O que dá errado:** `supabase db push --linked` pede password interativamente se não encontrar em env var.
**Por que acontece:** CLI usa TTY prompt por padrão.
**Como evitar:** Passar `--password "$SUPABASE_DB_PASSWORD"` na linha de comando, ou exportar `SUPABASE_DB_PASSWORD` no shell, **e** usar flag `--yes` para confirmar.
**Observação para esta fase:** O Lenny executa local no Windows, então TTY funciona — mas documentar o fluxo --password vira padrão replicável.
[VERIFIED: `supabase db push --help` mostra `--password string` e `--yes` como flags]

### Pitfall 7: `.temp/cli-latest` poluindo diffs futuros
**O que dá errado:** Arquivo `supabase/.temp/cli-latest` já está tracked (diff atual mostra modificação). Sem `.gitignore`, vai aparecer em todo diff depois que CLI atualizar versão.
**Por que acontece:** CLI escreve esse marcador de versão em todo comando.
**Como evitar:** Remover do tracking + adicionar ao `.gitignore`.
```bash
git rm --cached supabase/.temp/cli-latest
echo "supabase/.temp/" >> supabase/.gitignore    # supabase/ não tem .gitignore hoje
```
[VERIFIED: `supabase/.gitignore` não existe no repo]

## Code Examples

Patterns verificados contra as 20 migrations existentes no codebase.

### Migration 1: Criar tabela `arquitetos`

**Arquivo:** `supabase/migrations/20260423000001_create_arquitetos.sql`

```sql
-- Entidade nova: arquiteto. Cliente origina do arquiteto; produto é "do arquiteto X".
-- Ref: REQUIREMENTS ARQ-01, PROJECT.md "Arquiteto = entidade própria com FK".

CREATE TABLE public.arquitetos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  contato TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.arquitetos ENABLE ROW LEVEL SECURITY;

-- Policy permissiva alinhada com clientes/colaboradores (security debt intencional,
-- hardening é Fase 4). Leitura pública autenticada; escrita fica em admin via app.
CREATE POLICY "Anyone can read arquitetos"
  ON public.arquitetos FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage arquitetos"
  ON public.arquitetos FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Busca por nome (CRUD admin vai filtrar)
CREATE INDEX idx_arquitetos_nome ON public.arquitetos (nome);

COMMENT ON TABLE public.arquitetos IS 'Arquitetos que originam projetos. Cliente e produto podem ter arquiteto_id (nullable).';
```

**Justificativas das escolhas:**
- `UUID DEFAULT gen_random_uuid()`: padrão em todas as 20 migrations.
- `TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`: padrão em todas as tabelas.
- `ENABLE ROW LEVEL SECURITY` obrigatório em Supabase (policies explícitas).
- `has_role(auth.uid(), 'admin')`: função já existe no banco [VERIFIED: migration 20260218165401].
- `CREATE INDEX ... (nome)` para CRUD de admin (autocomplete/busca por texto). Sem GIN desta vez — volume baixo (estimativa: <100 arquitetos), btree simples serve.
- Sem `updated_at`: ROADMAP não pede, evita overengineering. Se virar requisito futuro, migration à parte.

### Migration 2: Colunas em clientes (FK + contato + cpf_cnpj)

**Arquivo:** `supabase/migrations/20260423000002_clientes_arquiteto_contato_cpf.sql`

```sql
-- Clientes ganham: vínculo com arquiteto (nullable), contato e CPF/CNPJ (opcionais).
-- Ref: REQUIREMENTS ARQ-03 (FK), CLI-01 (contato), CLI-02 (CPF/CNPJ).
-- Todas nullable — registros existentes em prod permanecem válidos.

ALTER TABLE public.clientes
  ADD COLUMN arquiteto_id UUID REFERENCES public.arquitetos(id) ON DELETE SET NULL,
  ADD COLUMN contato TEXT,
  ADD COLUMN cpf_cnpj TEXT;

CREATE INDEX idx_clientes_arquiteto_id ON public.clientes (arquiteto_id);

COMMENT ON COLUMN public.clientes.arquiteto_id IS 'Arquiteto que originou este cliente. Nullable: cliente avulso é válido. ON DELETE SET NULL.';
COMMENT ON COLUMN public.clientes.contato IS 'Nome/info de contato do cliente (opcional, texto livre).';
COMMENT ON COLUMN public.clientes.cpf_cnpj IS 'CPF ou CNPJ do cliente. Sem validação semântica neste marco (REQUIREMENTS out-of-scope).';
```

**Justificativas:**
- `ON DELETE SET NULL`: se o admin deleta um arquiteto, os clientes vinculados continuam existindo sem pai — consistente com pattern de `pasta_id` em `arquivos` (migration 20260302192941).
- Index em `arquiteto_id` prepara Fase 6 (FIL-01 — filtro por arquiteto em clientes). Fazer agora custa zero e evita migration separada depois.
- `TEXT` para CPF/CNPJ (não `VARCHAR(14)` ou `VARCHAR(11)`): permite string com ou sem pontuação, simples. Formato é problema do app layer.

### Migration 3: FK arquiteto_id em produtos

**Arquivo:** `supabase/migrations/20260423000003_produtos_arquiteto.sql`

```sql
-- Produtos ganham vínculo com arquiteto (nullable).
-- Ref: REQUIREMENTS ARQ-04.

ALTER TABLE public.produtos
  ADD COLUMN arquiteto_id UUID REFERENCES public.arquitetos(id) ON DELETE SET NULL;

CREATE INDEX idx_produtos_arquiteto_id ON public.produtos (arquiteto_id);

COMMENT ON COLUMN public.produtos.arquiteto_id IS 'Arquiteto dono do produto (ex: linha exclusiva). Nullable. ON DELETE SET NULL.';
```

### Migration 4: Colunas em colaboradores (CPF, telefone, setor)

**Arquivo:** `supabase/migrations/20260423000004_colaboradores_cpf_telefone_setor.sql`

```sql
-- Colaboradores ganham campos de cadastro expandido: CPF (para comissões futuras),
-- telefone, setor (enum). Todos nullable — colaboradores já logados não são bloqueados.
-- Ref: REQUIREMENTS USR-01/02/03 (Phase 2 usa estas colunas), USR-04 (back-fill via UI).

ALTER TABLE public.colaboradores
  ADD COLUMN cpf TEXT,
  ADD COLUMN telefone TEXT,
  ADD COLUMN setor TEXT,
  ADD CONSTRAINT check_colaboradores_setor CHECK (
    setor IN ('comercial', 'projetos', 'logistica', 'financeiro') OR setor IS NULL
  );

COMMENT ON COLUMN public.colaboradores.cpf IS 'CPF do colaborador. Validação algorítmica no app (signup). Nullable: colaboradores antigos preenchem via USR-04.';
COMMENT ON COLUMN public.colaboradores.telefone IS 'Telefone BR do colaborador. Formato livre; máscara/validação no app.';
COMMENT ON COLUMN public.colaboradores.setor IS 'Setor da Luminatti. Valores: comercial, projetos, logistica, financeiro. CHECK constraint permite extensão futura via migration sem ALTER TYPE.';
```

**Justificativas:**
- `TEXT` + `CHECK` em vez de `CREATE TYPE ... AS ENUM`: Ver análise abaixo.
- Constraint `OR setor IS NULL`: crítico — sem isso, ADD CONSTRAINT falha em produção (linhas existentes têm setor NULL pós-ALTER).
- CPF como `TEXT`: aceita "123.456.789-00" ou "12345678900". App decide formato de exibição e validação.

### Comandos de execução (para o PLAN)

```bash
# 0. Garantir que está no projeto certo e limpo
cd /c/Users/lenny/Desktop/Luminatti/automa_aura/auraoramentos
supabase status --linked      # confirma project_id = jkewlaezvrbuicmncqbj

# 1. Criar arquivos vazios (opcional — pode escrever direto com editor)
#    Ou criar manualmente seguindo o naming pattern.
#    O CLI cria com timestamp completo; para seguir o padrão semântico do codebase,
#    renomear após criação ou apenas criar direto com `touch` + editor.

# 2. Dry-run para ver o que seria aplicado
supabase db push --linked --dry-run

# 3. Aplicar
supabase db push --linked --password "$SUPABASE_DB_PASSWORD" --yes
# (Se o .env não tiver a password, export SUPABASE_DB_PASSWORD=... no shell primeiro)

# 4. Regerar types (apenas uma vez, no final)
supabase gen types typescript --linked --schema public > src/integrations/supabase/types.ts

# 5. Verificar diff do types.ts — deve mostrar:
#    - Nova entrada `arquitetos:` em Tables
#    - Novas colunas em clientes.Row/Insert/Update (arquiteto_id, contato, cpf_cnpj)
#    - Novas colunas em produtos.Row/Insert/Update (arquiteto_id)
#    - Novas colunas em colaboradores.Row/Insert/Update (cpf, telefone, setor)
#    - Novos Relationships em clientes e produtos apontando para arquitetos
git diff src/integrations/supabase/types.ts

# 6. Smoke test (seção dedicada abaixo)
```

## CHECK Constraint vs CREATE TYPE ENUM para `setor`

Esta é a principal decisão técnica da fase. Análise:

| Critério | `CREATE TYPE ... AS ENUM` | `TEXT + CHECK constraint` |
|----------|--------------------------|---------------------------|
| Uso em produção | Valores fixos, raramente expandidos | Valores que podem crescer |
| Adicionar novo valor | `ALTER TYPE ADD VALUE` (1 statement, rápido) MAS: executa sem transação multi-valor antes do PG12, e o novo valor não pode ser usado na mesma transação | Rewrite do CHECK (`DROP CONSTRAINT` + `ADD CONSTRAINT`) — volta a funcionar imediatamente |
| Remover valor | **Impossível** diretamente. Exige recriar o tipo, rewriting da coluna (downtime ou migração complexa) | `DROP CONSTRAINT` + `ADD CONSTRAINT` (sem valor removido) — trivial |
| Renomear valor | `ALTER TYPE RENAME VALUE` (PG10+) | Migration de UPDATE + reescrita do CHECK |
| Tipagem TS (Supabase) | `Enum<"setor_tipo">` — tipado estrito | `string \| null` — type-hint fraco |
| Uso no codebase | 1 ocorrência: `app_role` (admin/user — conjunto fechado por design) | 5+ ocorrências em produtos (tipo_produto, sistema, cor, aplicacao, etc.) — conjunto aberto |
| Complexidade de migration | Criar TYPE primeiro, depois coluna — 2 passos | 1 passo (ADD COLUMN + ADD CONSTRAINT) |

**Recomendação: `TEXT + CHECK constraint`.**

**Justificativa:**

1. **Padrão dominante do codebase:** Em `produtos`, 5 colunas usam CHECK constraint para enum-like (tipo_produto, sistema, driver_tipo_permitido, aplicacao, cor). Só `app_role` usa CREATE TYPE, e `app_role` é security primitive — nunca muda. Setor é tipicamente **expansivo** (Luminatti pode adicionar "Marketing" ou "RH" amanhã). [VERIFIED: grep em migrations]

2. **Custo de expansão futura:** Se a Luminatti adicionar "Marketing" como setor daqui 3 meses, com ENUM é `ALTER TYPE app_setor ADD VALUE 'marketing'` (funciona, mas fora de transação no CLI até PG12+) e o novo valor não pode ser referenciado na mesma transação que o criou. Com CHECK, é `ALTER TABLE colaboradores DROP CONSTRAINT check_setor, ADD CONSTRAINT check_setor CHECK (setor IN ('comercial', 'projetos', 'logistica', 'financeiro', 'marketing') OR setor IS NULL)` — mais verboso, menos frágil.

3. **Custo de contração:** Se um setor deixar de existir, com ENUM é reescrita da coluna (não trivial). Com CHECK é trivial.

4. **Typing:** TS type-hint com ENUM seria `Database["public"]["Enums"]["setor"]`. Com CHECK é `string | null`. O app já vai fazer narrow type em runtime (formulário de signup tem dropdown com valores fixos) — então o "tipo fraco" no types.ts é mitigado no app layer com Zod enum ou union type TS literal:
   ```typescript
   export const SETORES = ['comercial', 'projetos', 'logistica', 'financeiro'] as const;
   export type Setor = typeof SETORES[number];
   ```

**Trade-off assumido:** Perdemos type-strictness no `types.ts`. Ganhamos flexibilidade de evolução. Para um campo que o dono do produto ainda pode refinar (Lenny pode acabar fazendo "Logística" virar "Operações"), a flexibilidade vale a pena.

[CITED: PostgreSQL docs — https://www.postgresql.org/docs/current/sql-altertype.html sobre limitações de ALTER TYPE ADD VALUE; prática dominante em 5 colunas de `produtos` no codebase]

## Validação de CPF: Postgres vs App Layer

**Recomendação: App layer apenas nesta fase.**

**Razões:**
1. REQUIREMENTS USR-01 fala em "validado pelo algoritmo brasileiro" — isso é dígito verificador, não formato. Algoritmo BR em PL/pgSQL é função de ~30 linhas e entra no caminho quente de cada INSERT.
2. Validação de CPF é **lógica de negócio** (dígito verificador via módulo 11), não integrity constraint. Postgres deveria validar apenas formato estrito (se quiser).
3. App já tem Zod + React Hook Form instalados [VERIFIED: STACK.md L41-43]. Biblioteca tipo `@brazilian-utils/brazilian-utils` (ou função pequena custom) cobre isso em 2 linhas.
4. **Formato não-normalizado no banco é OK** para este marco: o campo é nullable, não é chave, não entra em join. Normalizar no signup (stripping `.` e `-`) é suficiente.

**O que NÃO fazer nesta fase:**
- `CHECK (cpf ~ '^\d{11}$')` — engessa colaboradores existentes importados de outras fontes.
- `UNIQUE(cpf)` — só faz sentido depois que todos os colaboradores tiverem CPF (Fase 2 USR-04); adicionar agora quebra tentativas de back-fill.

**Para o planner:** Incluir CPF `UNIQUE` como item **explícito deferred** — migration futura depois da Fase 2.

## State of the Art

| Abordagem antiga | Abordagem atual | Quando mudou | Impacto |
|------------------|------------------|--------------|---------|
| Editar schema via Supabase Dashboard UI | Migrations SQL versionadas em git + `supabase db push` | Lovable já fazia híbrido; práticas atuais (2025+) privilegiam git-first | Sem isso não há PR review, rollback, nem reprodução em staging |
| Auto-gerar types manualmente copiando do dashboard | `supabase gen types typescript --linked` | CLI estável desde 2023 | Elimina inconsistências schema↔frontend |
| `uuid-ossp` extension | `gen_random_uuid()` (pgcrypto, default em Postgres 13+) | PG13 | Codebase já usa `gen_random_uuid()` em todas as 20 migrations [VERIFIED: grep] |
| `timestamp` sem timezone | `TIMESTAMP WITH TIME ZONE` (TIMESTAMPTZ) | Prática Supabase desde sempre | Codebase já consistente |

**Deprecated / outdated (nada aqui para remover):**
- Nada a remover nesta fase. Fase é puramente aditiva.

## Decisão: Commits e ordem de execução

**Recomendação de sequência (o planner deve traduzir isso em tarefas):**

1. **Commit A (PREP-01 fechado):** Limpar git pendente.
   - `supabase/config.toml` (modificado)
   - `supabase/functions/request-access/index.ts` (modificado)
   - `supabase/functions/review-access/index.ts` (modificado)
   - `supabase/.gitignore` (novo, com `*.temp/`)
   - `git rm --cached supabase/.temp/cli-latest`
   - `supabase/.temp/linked-project.json` NÃO commitado (passa a ser ignorado)
   - Mensagem: `chore(supabase): commit pending edge function + config updates and ignore .temp/`

2. **Commit B (ARQ-01):** Migration 1 — criar arquitetos.
   - `supabase/migrations/20260423000001_create_arquitetos.sql`
   - Mensagem: `feat(db): create arquitetos table (ARQ-01)`

3. **Commit C (ARQ-03 + CLI-01/02 schema):** Migration 2 — colunas em clientes.
   - `supabase/migrations/20260423000002_clientes_arquiteto_contato_cpf.sql`
   - Mensagem: `feat(db): add arquiteto_id/contato/cpf_cnpj to clientes (ARQ-03, CLI-01, CLI-02 schema)`

4. **Commit D (ARQ-04):** Migration 3 — FK em produtos.
   - `supabase/migrations/20260423000003_produtos_arquiteto.sql`
   - Mensagem: `feat(db): add arquiteto_id FK to produtos (ARQ-04)`

5. **Commit E (USR-01/02/03 schema):** Migration 4 — colunas em colaboradores.
   - `supabase/migrations/20260423000004_colaboradores_cpf_telefone_setor.sql`
   - Mensagem: `feat(db): add cpf/telefone/setor to colaboradores (USR-01..03 schema)`

6. **Push único em prod:** `supabase db push --linked --password ... --yes` (todas as 4 migrations de uma vez).

7. **Commit F:** Regenerar types.
   - `supabase gen types typescript --linked --schema public > src/integrations/supabase/types.ts`
   - Revisar diff (deve adicionar ~60-80 linhas: novo table `arquitetos`, novas colunas, novos Relationships).
   - Mensagem: `chore(types): regenerate Supabase types after Phase 1 migrations`

8. **Smoke manual (sem commit):** ver seção Smoke Test abaixo.

**Por que push único no passo 6 e não por commit:** Prod deve aceitar as 4 migrations em uma transação do ponto de vista do usuário. Se der problema na migration 3, `db push` já aplicou 1 e 2 e a fase fica num estado inconsistente. Com push único + `--dry-run` antes, qualquer falha aparece pré-aplicação.

**Alternativa considerada:** Push após cada commit. **Rejeitado** porque aumenta surface de erro 4x e não traz benefício.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Supabase CLI | Criar migrations, push, gen types | ✓ | 2.78.1 (2.90.0 disponível, upgrade não necessário) | Não existe fallback — Dashboard UI pra schema é contra-padrão |
| git (bash) | Commits e gitignore | ✓ (assumido — repo já é git) | — | — |
| Acesso ao projeto Supabase linked | `db push`, `gen types` | ✓ | Ref `jkewlaezvrbuicmncqbj` em `config.toml` + `.temp/linked-project.json` | — |
| `SUPABASE_DB_PASSWORD` (env var ou prompt) | `db push` não-interativo | Desconhecido | — | Interactive prompt funciona em sessão local Windows do Lenny |
| Conexão com sa-east-1 | `db push` vai a prod | Assumido ✓ | — | — |

**Missing dependencies with no fallback:** Nenhuma.

**Missing dependencies with fallback:** Nenhuma crítica. Upgrade do CLI 2.78→2.90 é opcional; `SUPABASE_DB_PASSWORD` pode vir por prompt interativo.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Supabase Auth já no codebase (não tocado nesta fase) |
| V3 Session Management | no (não afetado) | — |
| V4 Access Control | yes | RLS + policy `has_role(auth.uid(), 'admin')` para escrita em `arquitetos`; SELECT aberto consistente com clientes/produtos |
| V5 Input Validation | yes (parcial) | CHECK constraint em `setor`. Validação de CPF/telefone/contato/cpf_cnpj fica no app (Zod) |
| V6 Cryptography | no | Não há campo criptografado nesta fase |

### Known Threat Patterns for Supabase Postgres + RLS

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Tabela criada sem `ENABLE ROW LEVEL SECURITY` | Information Disclosure | Todo CREATE TABLE seguido de `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` (padrão do codebase já aplicado) |
| Policy `USING (true)` em tabela sensível | Information Disclosure | Não aplicável a `arquitetos` — é metadado de negócio, não sensível. Consistente com `produtos`, `clientes`, `colaboradores` atuais |
| FK sem CASCADE control levando a ghost rows | Tampering / Data Integrity | `ON DELETE SET NULL` explícito em ambas FKs novas |
| CPF/CNPJ em texto claro no banco | Information Disclosure | Out of scope pra este marco — campo nullable, volume pequeno (~dezenas de colaboradores). Se virar PII crítica, marco futuro adiciona column-level encryption via pgcrypto |
| Injeção SQL via parametrização manual | Tampering | Não aplicável — Supabase SDK do frontend já é paramétrico por construção |
| Migration aplicada em prod mas não em git | Repudiation | Fluxo `git push → supabase db push` mantém artifact em git sempre antes do banco. Dry-run antes de push |
| `.temp/linked-project.json` vazando org ID | Information Disclosure (pequeno) | Adicionar ao .gitignore. O ref do projeto já é público no `config.toml` então o risco real é só o organization_slug — ainda assim vale ignorar |

**Policy recomendada para `arquitetos` (reforço):**
- `FOR SELECT USING (true)` — qualquer autenticado lê (consistente com clientes/produtos).
- `FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'))` — só admin escreve. **Isso é mais estrito** que a policy de clientes/colaboradores atuais (que permitem autenticado qualquer), e é proposital: arquiteto é nova entidade, podemos começar com a security certa desde o dia 1. Não é "breaking" porque a tabela ainda não tem CRUD no app (Fase 2).

## Smoke Test pós-migration

Não há `npm run test` de integração útil aqui (Vitest só tem unit, e não há suite de DB). Smoke **manual**, 5 minutos:

1. **Wizard de orçamento (leitura de clientes/produtos/colaboradores):**
   - Login como colaborador em dev local (`npm run dev` → http://localhost:8080).
   - Abrir `/` — ClienteList deve listar clientes existentes (query: `clientes` com colunas novas retornando `null`).
   - Clicar em um cliente com orçamentos — Step3 deve abrir com snapshot antigo (coluna `ambientes` jsonb pré-existente).
   - **Pass criteria:** nenhum crash no console, todos os clientes aparecem, Step1→2→3 navega.

2. **Admin abas (produtos/clientes/colaboradores):**
   - Login como admin, `/admin`.
   - Aba Produtos — deve listar normalmente (coluna `arquiteto_id` nova retornando `null`).
   - Aba Clientes — listar normalmente (colunas novas retornando `null`).
   - Aba Colaboradores — listar normalmente.
   - **Pass criteria:** listas renderizam, nenhum `TypeError: Cannot read property X of undefined`.

3. **Verificar schema aplicado via Dashboard:**
   - Supabase Dashboard → Table Editor → `arquitetos` deve existir, vazia.
   - `clientes` deve ter colunas `arquiteto_id`, `contato`, `cpf_cnpj`.
   - `produtos` deve ter coluna `arquiteto_id`.
   - `colaboradores` deve ter `cpf`, `telefone`, `setor`.

4. **Types.ts sanity check:**
   - `grep -c "arquitetos:" src/integrations/supabase/types.ts` → deve ser `>= 1`.
   - `grep "arquiteto_id" src/integrations/supabase/types.ts` → deve aparecer em clientes e produtos.
   - `npx tsc --noEmit` → sem erros novos (types.ts novo deve compatibilizar sem tocar componentes — nenhum componente ainda consome as colunas novas).

5. **Edge functions ainda funcionam:**
   - Fluxo `/request-access` (form de pedido de acesso) → request-access edge function ainda responde (mudança não-commitada já está em prod, commit só atualiza git).
   - Trigger aprovação via email → review-access responde.
   - **Pass criteria:** request-access aceita novo pedido sem 5xx.

**Se qualquer item falhar:**
- Rollback de migration em Supabase é destrutivo (exige DROP). Hot-fix: escrever migration compensatória aditiva (`ADD COLUMN` do que ficou pendente, ou `DROP COLUMN` da nova se ainda não usada). Documentar como migration 20260423000005.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Upgrade do Supabase CLI 2.78→2.90 não é necessário | Standard Stack | Se 2.78 tem bug em `db push` que 2.90 resolve, push falha. Mitigation: `--dry-run` detecta antes de prod. Baixo risco porque flags usadas são todas estáveis há muitas versões |
| A2 | `has_role(auth.uid(), 'admin')` função existe em prod | Code Examples (policy de arquitetos) | Se não existir, CREATE POLICY falha. **Verificável** em 30s via Supabase Dashboard → Database → Functions, ou via `supabase db dump --schema public -f /tmp/schema.sql` local. Verificado no git (migration 20260218165401) mas git pode estar atrás de prod |
| A3 | Edge functions pendentes já estão deployed em prod (diff é só documentação catching up) | Commit A justification | Se edge functions em prod estão desatualizadas, commit só atualiza git e próximo push das functions (via `supabase functions deploy`) muda comportamento em prod. Planner deve pedir: verificar se `request-access` em prod está usando `onboarding@resend.dev` ou `noreply@orcamentosaura.com.br`. Se o primeiro, cuidado: commit do diff será seguido de deploy das functions — tarefa separada |
| A4 | Nenhum colaborador em prod tem `setor` já preenchido de alguma migração antiga esquecida | Migration 4 | Se houver row com `setor = 'juridico'` (valor fora do enum), CHECK constraint falha no ALTER. Verificável antes via `SELECT DISTINCT setor FROM colaboradores` no SQL Editor do Supabase. Esperado: coluna não existe ainda, então valor é trivialmente compatível |
| A5 | Índices btree simples (`idx_arquitetos_nome`, `idx_clientes_arquiteto_id`, `idx_produtos_arquiteto_id`) são suficientes — nenhum FTS é necessário nesta fase | Code Examples | Se volume de arquitetos explodir (>10k), busca por nome pode ser lenta sem GIN. Baixo risco: escala da Luminatti é dezenas |
| A6 | `SUPABASE_DB_PASSWORD` está acessível no ambiente do Lenny (password do projeto Supabase) | Commands section | Se não tiver, CLI prompta TTY — fluxo interativo funciona. Apenas documentar ambos os caminhos |
| A7 | `CREATE TYPE AS ENUM` vs CHECK constraint é decisão reversível e não afeta orçamento futuro | Setor section | Se virar obrigatório converter no futuro, é migração complexa. Baixa probabilidade dado histórico do codebase (CHECK é o padrão em produtos) |

**Itens acima devem ser confirmados pelo planner ou validados no início da execução** — principalmente A2 (policy de admin), A3 (estado das edge functions em prod) e A4 (sanity check antes de migration 4).

## Open Questions

1. **Domínio próprio `orcamentosaura.com.br` no Resend está configurado/verificado?**
   - O que sabemos: diff das edge functions troca `onboarding@resend.dev` → `noreply@orcamentosaura.com.br`.
   - O que não sabemos: se DNS (SPF/DKIM) do domínio `orcamentosaura.com.br` está verificado no Resend. Se não estiver, emails param de sair depois do commit+deploy das functions.
   - Recomendação: **antes** do Commit A, verificar no dashboard do Resend (Lucas é owner). Se domínio não verificado, NÃO commitar o diff das edge functions nesta fase — fica para fase dedicada de infra. Commitar apenas `config.toml` + `.gitignore`, e registrar TODO explícito sobre edge functions.

2. **Prod realmente já está rodando edge functions com o novo domínio?**
   - O que sabemos: git diff mostra mudança; não sabemos se `supabase functions deploy request-access` foi executado após a mudança.
   - Recomendação: ao planner — adicionar tarefa de verificação pré-commit A: `supabase functions list` + inspecionar versão deployed via dashboard.

3. **Existe migration histórica escondida (aplicada direto via dashboard) não em git?**
   - O que sabemos: 20 migrations em git; não sabemos se dashboard teve tweaks manuais depois da última.
   - Recomendação: `supabase migration list --linked` no início da fase. Se gap, usar `supabase migration repair` ou pull remoto (`supabase db pull`) para sincronizar antes de push.

4. **Index em `arquiteto_id` — btree simples ou composite?**
   - Nesta fase FIL-01/02/03 (filtros por arquiteto) não são construídos, mas vão consumir esse index.
   - Recomendação: btree single-column agora é suficiente. Composite só se query real usar, e pode ser adicionado em Fase 6 sem custo.

## Sources

### Primary (HIGH confidence)
- [VERIFIED: Supabase CLI 2.78.1 `--help`] — flags `--linked`, `--password`, `--yes`, `--include-all`, `--dry-run` em `db push`; `--linked`, `--schema`, `--lang` em `gen types`; `migration new <nome>` cria arquivo timestamped.
- [VERIFIED: codebase — 20 migrations em `supabase/migrations/`] — padrões: `gen_random_uuid()`, `TIMESTAMP WITH TIME ZONE DEFAULT now()`, `ENABLE ROW LEVEL SECURITY`, CHECK constraints para enum-like em produtos, `CREATE TYPE AS ENUM` usado só em `app_role`.
- [VERIFIED: `git diff` em config.toml, edge functions] — conteúdo exato das mudanças pendentes.
- [VERIFIED: `supabase/.temp/linked-project.json` conteúdo] — ref `jkewlaezvrbuicmncqbj` confirmado.

### Secondary (MEDIUM confidence)
- [CITED: PostgreSQL docs — `ALTER TYPE`] — limitação de `ADD VALUE` em transação multi-statement até PG12; base pra decisão CHECK vs ENUM.
- [CITED: .planning/codebase/STACK.md] — versões de bibliotecas e plataforma.
- [CITED: .planning/codebase/ARCHITECTURE.md, STRUCTURE.md] — layout e patterns do projeto.
- [CITED: Supabase Docs — Database Migrations workflow] — `supabase db push --linked` como fluxo canônico.

### Tertiary (LOW confidence)
- [ASSUMED] — upgrade do CLI 2.78→2.90 é opcional (nenhum changelog específico inspecionado; baseado em estabilidade histórica das flags usadas).
- [ASSUMED] — `has_role` function existe em prod (verificado em git, mas prod pode diverge).
- [ASSUMED] — edge functions pendentes já estão deployed em prod (depende de `supabase functions deploy` fora do escopo de git).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — CLI verificado localmente, codebase tem 20 precedentes.
- Architecture patterns: HIGH — todos os patterns recomendados têm precedente explícito em migrations do codebase.
- Pitfalls: HIGH — maioria vem de behavior verificado do CLI + experiência com Supabase em prod; Pitfall 5 (CHECK vs dados existentes) é mecânica conhecida do Postgres.
- CHECK vs ENUM decision: MEDIUM-HIGH — baseado em padrão dominante + docs oficiais; trade-off bem caracterizado.
- Edge functions deploy state: LOW — requer verificação manual (Open Question 1 e 2).

**Research date:** 2026-04-23
**Valid until:** 2026-05-23 (30 dias — domínio estável; só invalidaria se Supabase CLI quebrasse compat, o que é raro).
