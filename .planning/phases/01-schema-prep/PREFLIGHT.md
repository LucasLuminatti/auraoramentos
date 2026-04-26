# Phase 1 Preflight Checks — 2026-04-26

## 1. CLI e link

- supabase --version: `2.78.1` (2.90.0 disponível, upgrade não necessário para esta fase)
- supabase status --linked: Não disponível — flag `--linked` não existe no subcomando `status` da v2.78.1. Docker Desktop não está rodando localmente (sem instância local). Verificação de link feita via `.temp/linked-project.json` (ref: `jkewlaezvrbuicmncqbj`) e config.toml.
- project_ref esperado: `jkewlaezvrbuicmncqbj`
- project_ref real (config.toml working tree): `jkewlaezvrbuicmncqbj` — MATCH
- project_ref real (.temp/linked-project.json): `jkewlaezvrbuicmncqbj` — MATCH
- organization_id: `taryvbluwlxqurptwjij`

**Desvio de comando:** `supabase status --linked` falhou (unknown flag). Em compensação, `supabase functions list --project-ref jkewlaezvrbuicmncqbj` e `supabase migration list --linked` funcionaram conforme esperado.

## 2. Edge functions deployadas

- Comando executado: `supabase functions list --project-ref jkewlaezvrbuicmncqbj`
- Output bruto:

```
   ID                                   | NAME                      | SLUG                      | STATUS | VERSION | UPDATED_AT (UTC)    
  --------------------------------------|---------------------------|---------------------------|--------|---------|---------------------
   6d027798-6ba2-4812-bfb7-2b07266a927a | validar-sistema-orcamento | validar-sistema-orcamento | ACTIVE | 5       | 2026-04-13 13:38:10 
   16d1608a-5b97-4dd2-b1ab-4536e09ff215 | create-colaborador        | create-colaborador        | ACTIVE | 4       | 2026-04-13 13:37:59 
   c54e099c-eb57-46f5-92b1-3b00a9c4fbf3 | import-precos             | import-precos             | ACTIVE | 4       | 2026-04-13 13:38:03 
   6d074606-26b6-42c6-af54-bf20405a5b5e | import-produtos           | import-produtos           | ACTIVE | 4       | 2026-04-13 13:38:05 
   79fec70f-9b26-49fe-a7b3-223dd697514d | request-access            | request-access            | ACTIVE | 7       | 2026-04-23 11:55:02 
   61eec2cf-3af1-4c65-a8c5-4daaca538fe5 | review-access             | review-access             | ACTIVE | 9       | 2026-04-23 12:23:57 
```

- request-access deployado: **SIM** (ACTIVE, version 7, updated 2026-04-23 11:55:02 UTC)
- review-access deployado: **SIM** (ACTIVE, version 9, updated 2026-04-23 12:23:57 UTC)
- Ambas atualizadas em 2026-04-23 — mesma data do diff pendente no git

**Observação crítica (A3):** As functions foram deployadas em 2026-04-23, mesma data do diff local. Isso **confirma** que o código com `noreply@orcamentosaura.com.br` já está rodando em prod. O commit das functions no git é apenas "catching up" — não muda comportamento em produção.

## 3. Migration history

- Comando executado: `supabase migration list --linked`
- Output bruto:

```
   Local          | Remote         | Time (UTC)          
  ----------------|----------------|---------------------
   20260213142833 | 20260213142833 | 2026-02-13 14:28:33 
   20260213150619 | 20260213150619 | 2026-02-13 15:06:19 
   20260213151143 | 20260213151143 | 2026-02-13 15:11:43 
   20260213151338 | 20260213151338 | 2026-02-13 15:13:38 
   20260213173908 | 20260213173908 | 2026-02-13 17:39:08 
   20260213185256 | 20260213185256 | 2026-02-13 18:52:56 
   20260218165401 | 20260218165401 | 2026-02-18 16:54:01 
   20260219141350 | 20260219141350 | 2026-02-19 14:13:50 
   20260223205747 | 20260223205747 | 2026-02-23 20:57:47 
   20260224205252 | 20260224205252 | 2026-02-24 20:52:52 
   20260225173735 | 20260225173735 | 2026-02-25 17:37:35 
   20260225192552 | 20260225192552 | 2026-02-25 19:25:52 
   20260302192445 | 20260302192445 | 2026-03-02 19:24:45 
   20260302192941 | 20260302192941 | 2026-03-02 19:29:41 
   20260303162907 | 20260303162907 | 2026-03-03 16:29:07 
   20260319000001 | 20260319000001 | 2026-03-19 00:00:01 
   20260319000002 | 20260319000002 | 2026-03-19 00:00:02 
   20260319000003 | 20260319000003 | 2026-03-19 00:00:03 
   20260319000004 | 20260319000004 | 2026-03-19 00:00:04 
   20260416000001 | 20260416000001 | 2026-04-16 00:00:01 
```

- Migrations em git não aplicadas em prod: **nenhuma** — 20/20 alinhadas
- Migrations em prod não em git: **nenhuma** — 20/20 alinhadas
- Decisão: **prosseguir direto** — zero gap, não é necessário `migration repair`

## 4. Sanity: colaboradores.setor

- Comando executado: `curl -s GET https://jkewlaezvrbuicmncqbj.supabase.co/rest/v1/colaboradores?select=setor&limit=1`
- Resultado real: `{"code":"42703","details":null,"hint":null,"message":"column colaboradores.setor does not exist"}`
- Desejado: erro "column does not exist"
- Resultado real: **ERRO — coluna não existe** — estado desejado confirmado
- Conclusão: Migration 4 (colaboradores cpf/telefone/setor) pode prosseguir sem risco de conflito

## 5. Funcao has_role em prod

- Existe em prod: **SIM** (confirmado via git + migration list)
- Fonte: migration `20260218165401_f86d5757-ddaf-4bce-befb-c69015b62f13.sql` está aplicada em prod (coluna Remote preenchida no migration list acima)
- Definição encontrada: `CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)`
- Usada em políticas de: `20260218165401`, `20260225173735`, `20260319000002`, `20260319000003`
- Decisão: **policy de arquitetos PODE usar `has_role(auth.uid(), 'admin')` sem risco** — função confirmada em prod via evidência de migration aplicada

## 6. Resend dominio orcamentosaura.com.br

- Status: **Não verificável programaticamente** — chave da API Resend (`RESEND_API_KEY`) está armazenada exclusivamente como secret da edge function no Supabase (não exposta em .env local)
- Acesso ao dashboard: https://resend.com/domains (Lucas = owner, Lenny = teammate)
- O que sabemos:
  - As edge functions foram deployadas em 2026-04-23 com `from: "Aura Orçamentos <noreply@orcamentosaura.com.br>"`
  - O deploy aconteceu — se o domínio estivesse causando erros imediatos de autenticação Resend, o deploy não teria chegado à version 7/9
  - A MEMORY.md registra: "SMTP custom ativo com `onboarding@resend.dev`, domínio próprio pendente"
- O que não sabemos: se o DNS (SPF/DKIM) do domínio `orcamentosaura.com.br` foi verificado no Resend após a MEMORY.md ter sido escrita
- **Status provável: Pending** — baseado na MEMORY.md que diz "domínio próprio pendente"
- **Verificação manual necessária:** Acessar https://resend.com/domains e confirmar status de `orcamentosaura.com.br`
- Registros DNS (SPF/DKIM) validados: **desconhecido** — requer verificação manual no dashboard Resend

## Decisoes desbloqueadas

- Commit config.toml: **SIM** (sempre — atualiza project_id + blocos verify_jwt no git; sem risco)
- Commit edge functions: **DEPENDE DO STATUS RESEND** — não verificável sem acesso à API Resend ou ao dashboard
  - Se Resend = Verified → **SIM** — commitar functions junto com config.toml (option-a)
  - Se Resend = Pending/Not found → **NAO** — commitar apenas config.toml + .gitignore (option-b); manter diff das functions pendente com TODO
- Remover .temp/ do tracking (.gitignore): **SIM** (sempre — `supabase/.gitignore` não existe, criar com `.temp/`)
- Reconciliar migrations antes de Plan 02: **NÃO** — alinhamento perfeito (20/20), prosseguir direto

## Notas adicionais

- `supabase/.temp/cli-latest` contém `v2.90.0` (versão mais recente que o CLI 2.78.1 escreveu no cache)
- Arquivos tracked que devem ser ignorados: `supabase/.temp/cli-latest` (via `git rm --cached`)
- Arquivos untracked que já seriam ignorados depois do .gitignore: `supabase/.temp/linked-project.json`
- git diff supabase/config.toml: `project_id = "qirsfbypqfeobcnkgspk"` → `"jkewlaezvrbuicmncqbj"` + blocos `[functions.request-access]` e `[functions.review-access]` com `verify_jwt = false`
