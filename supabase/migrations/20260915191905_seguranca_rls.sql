-- Segurança — correções de banco da auditoria de 2026-09-15
-- (analise/seguranca-auditoria-2026-09-15.md). Aplicada à mão com
-- `npx supabase db query --linked -f`, como as demais migrations do projeto.
-- Revisada por agente independente antes de aplicar (achados P1–P5 incorporados).
--
-- Modelo de acesso imposto aqui:
--   anon          → nada nas tabelas, views e funções do schema public; só a RPC email_autorizado.
--   authenticated → catálogo em leitura; o que é seu (orçamento que criou OU de cliente seu,
--                   projetos dos seus clientes, suas exceções, seu cadastro); admin vê tudo.
--   service_role  → inalterado (edge functions e scripts).

begin;

-- 1. anon fora do schema public ---------------------------------------------------------------
-- Antes: o default ACL do Supabase dava arwdDxtm ao anon em toda tabela/view e EXECUTE em
-- toda função, e várias policies eram `TO public USING (true)`. O anon lia orçamentos, CPF de
-- colaboradores, e-mails autorizados e o catálogo com preço mínimo, e apagava projetos.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke execute on all functions in schema public from anon, public;
-- has_role é chamada dentro das policies: quem avalia a policy precisa de EXECUTE.
grant execute on function public.has_role(uuid, public.app_role) to authenticated, service_role;

-- 2. view produtos: respeita o RLS de product_variants e deixa de ser gravável -----------------
-- Sem security_invoker a view rodava como o dono (postgres, bypassrls) e era atualizável:
-- `PATCH /rest/v1/produtos` mudava preço sem login. A edge import-precos escreve por ela com
-- a service role, que não é afetada.
alter view public.produtos set (security_invoker = true);
revoke all on public.produtos from authenticated;
grant select on public.produtos to authenticated;

-- 3. catálogo só para logados -------------------------------------------------------------------
drop policy if exists "Anyone can read produtos" on public.product_variants; -- duplicava a de authenticated
drop policy if exists "Anyone can read regras_compatibilidade_perfil" on public.regras_compatibilidade_perfil;
create policy "Authenticated can read regras_compatibilidade_perfil" on public.regras_compatibilidade_perfil
  for select to authenticated using (true);
drop policy if exists "Anyone can read vinculos_spot_lampada" on public.vinculos_spot_lampada;
create policy "Authenticated can read vinculos_spot_lampada" on public.vinculos_spot_lampada
  for select to authenticated using (true);

-- 4. RPCs internas da edge aniversario-clientes: só service_role --------------------------------
revoke execute on function public.buscar_admins_emails() from authenticated;
revoke execute on function public.buscar_aniversariantes_d5() from authenticated;
grant execute on function public.buscar_admins_emails() to service_role;
grant execute on function public.buscar_aniversariantes_d5() to service_role;

-- 5. allowed_users: sem leitura pública; checagem pontual por RPC -------------------------------
-- A RPC só responde sim/não para UM e-mail (checagem de UX na tela de cadastro). A trava real
-- do signup é o hook "before user created" (onda 2).
drop policy if exists "Public can read allowed_users" on public.allowed_users;
create policy "Admins can read allowed_users" on public.allowed_users
  for select to authenticated using (public.has_role((select auth.uid()), 'admin'));

create or replace function public.email_autorizado(p_email text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.allowed_users a where lower(a.email) = lower(trim(p_email))
  );
$$;
revoke all on function public.email_autorizado(text) from public;
grant execute on function public.email_autorizado(text) to anon, authenticated, service_role;

-- 6. colaboradores: cada um lê o próprio cadastro; admin lê todos -------------------------------
-- (o índice único em user_id já existe: idx_colaboradores_user_id)
drop policy if exists "Users can read all colaboradores" on public.colaboradores;
create policy "Colaborador lê o próprio, admin lê todos" on public.colaboradores
  for select to authenticated
  using (user_id = (select auth.uid()) or public.has_role((select auth.uid()), 'admin'));
alter policy "Users can insert their own colaborador" on public.colaboradores to authenticated;
alter policy "Users can update their own colaborador" on public.colaboradores to authenticated;
alter policy "Users can delete their own colaborador" on public.colaboradores to authenticated;

-- Nome do autor de um orçamento, para quem pode ver o orçamento. O dono do cliente não lê a
-- linha do colaborador autor (que tem CPF e telefone) quando o orçamento foi criado por outra
-- pessoa (ex.: admin) — sem isto a tela e o PDF re-emitido mostrariam "—" como colaborador.
create or replace function public.nome_autor_orcamento(p_orcamento_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select c.nome
  from public.orcamentos o
  join public.colaboradores c on c.id = o.colaborador_id
  where o.id = p_orcamento_id
    and (
      public.has_role((select auth.uid()), 'admin')
      or c.user_id = (select auth.uid())
      or exists (select 1 from public.clientes cl where cl.id = o.cliente_id and cl.user_id = (select auth.uid()))
    );
$$;
revoke all on function public.nome_autor_orcamento(uuid) from public, anon;
grant execute on function public.nome_autor_orcamento(uuid) to authenticated, service_role;

-- 7. projetos: dono do cliente ou admin ---------------------------------------------------------
drop policy if exists "Anyone can read projetos" on public.projetos;
drop policy if exists "Authenticated users can insert projetos" on public.projetos;
drop policy if exists "Authenticated users can update projetos" on public.projetos;
drop policy if exists "Authenticated users can delete projetos" on public.projetos;
create policy "Dono do cliente ou admin lê projetos" on public.projetos
  for select to authenticated
  using (
    public.has_role((select auth.uid()), 'admin')
    or exists (select 1 from public.clientes c where c.id = projetos.cliente_id and c.user_id = (select auth.uid()))
  );
create policy "Dono do cliente ou admin cria projetos" on public.projetos
  for insert to authenticated
  with check (
    public.has_role((select auth.uid()), 'admin')
    or exists (select 1 from public.clientes c where c.id = projetos.cliente_id and c.user_id = (select auth.uid()))
  );
create policy "Dono do cliente ou admin altera projetos" on public.projetos
  for update to authenticated
  using (
    public.has_role((select auth.uid()), 'admin')
    or exists (select 1 from public.clientes c where c.id = projetos.cliente_id and c.user_id = (select auth.uid()))
  )
  with check (
    public.has_role((select auth.uid()), 'admin')
    or exists (select 1 from public.clientes c where c.id = projetos.cliente_id and c.user_id = (select auth.uid()))
  );
create policy "Dono do cliente ou admin apaga projetos" on public.projetos
  for delete to authenticated
  using (
    public.has_role((select auth.uid()), 'admin')
    or exists (select 1 from public.clientes c where c.id = projetos.cliente_id and c.user_id = (select auth.uid()))
  );

-- 8. orcamentos ---------------------------------------------------------------------------------
-- Leitura: autor OU dono do cliente (há orçamentos que o admin criou para cliente de colaborador).
drop policy if exists "Anyone can read orcamentos" on public.orcamentos;
create policy "Autor, dono do cliente ou admin lê orcamentos" on public.orcamentos
  for select to authenticated
  using (
    public.has_role((select auth.uid()), 'admin')
    or exists (select 1 from public.colaboradores c where c.id = orcamentos.colaborador_id and c.user_id = (select auth.uid()))
    or exists (select 1 from public.clientes cl where cl.id = orcamentos.cliente_id and cl.user_id = (select auth.uid()))
  );
-- Escrita do colaborador: em nome próprio, para cliente seu, e projeto do mesmo cliente
-- (antes o INSERT era WITH CHECK true e o UPDATE não fixava autor nem cliente).
drop policy if exists "Authenticated users can insert orcamentos" on public.orcamentos;
create policy "Colaborador cria orcamento em nome próprio" on public.orcamentos
  for insert to authenticated
  with check (
    public.has_role((select auth.uid()), 'admin')
    or (
      exists (select 1 from public.colaboradores c where c.id = orcamentos.colaborador_id and c.user_id = (select auth.uid()))
      and exists (select 1 from public.clientes cl where cl.id = orcamentos.cliente_id and cl.user_id = (select auth.uid()))
      and (orcamentos.projeto_id is null
           or exists (select 1 from public.projetos p where p.id = orcamentos.projeto_id and p.cliente_id = orcamentos.cliente_id))
    )
  );
drop policy if exists "Colab can update own orcamentos non-aprovado" on public.orcamentos;
create policy "Colab can update own orcamentos non-aprovado" on public.orcamentos
  for update to authenticated
  using (
    exists (select 1 from public.colaboradores c where c.id = orcamentos.colaborador_id and c.user_id = (select auth.uid()))
    and status <> 'aprovado'
  )
  with check (
    status = any (array['rascunho', 'aprovado', 'perdido', 'pendente'])
    and exists (select 1 from public.colaboradores c where c.id = orcamentos.colaborador_id and c.user_id = (select auth.uid()))
    and exists (select 1 from public.clientes cl where cl.id = orcamentos.cliente_id and cl.user_id = (select auth.uid()))
    and (orcamentos.projeto_id is null
         or exists (select 1 from public.projetos p where p.id = orcamentos.projeto_id and p.cliente_id = orcamentos.cliente_id))
  );
-- Admin: o WITH CHECK antigo só validava o status. Policies permissivas do mesmo comando somam
-- seus WITH CHECK com OR, então o colaborador passava pelo da policy de admin e conseguia
-- trocar o colaborador_id/cliente_id do próprio orçamento.
drop policy if exists "Admin can update orcamentos non-aprovado" on public.orcamentos;
create policy "Admin can update orcamentos non-aprovado" on public.orcamentos
  for update to authenticated
  using (public.has_role((select auth.uid()), 'admin') and status <> 'aprovado')
  with check (
    public.has_role((select auth.uid()), 'admin')
    and status = any (array['rascunho', 'aprovado', 'perdido', 'pendente'])
  );

-- 9. exceções de preço (só a parte de segurança; o redesenho do fluxo fica para depois) --------
alter table public.price_exceptions drop constraint if exists price_exceptions_status_check;
alter table public.price_exceptions
  add constraint price_exceptions_status_check check (status in ('pendente', 'aprovado', 'rejeitado'));
-- o colaborador criava a própria exceção já com status 'aprovado' e liberava o PDF
drop policy if exists "Authenticated users can create exceptions" on public.price_exceptions;
create policy "Solicitante cria exceção pendente" on public.price_exceptions
  for insert to authenticated
  with check (
    solicitante_id = (select auth.uid())
    and status = 'pendente' and resolvido_por is null and resolvido_at is null
  );
drop policy if exists "Authenticated users can read exceptions" on public.price_exceptions;
create policy "Solicitante ou admin lê exceções" on public.price_exceptions
  for select to authenticated
  using (solicitante_id = (select auth.uid()) or public.has_role((select auth.uid()), 'admin'));
drop policy if exists "Admins can update exceptions" on public.price_exceptions;
create policy "Admins can update exceptions" on public.price_exceptions
  for update to authenticated
  using (public.has_role((select auth.uid()), 'admin'))
  with check (public.has_role((select auth.uid()), 'admin'));

drop policy if exists "Authenticated users can read messages" on public.exception_messages;
create policy "Participantes leem mensagens da exceção" on public.exception_messages
  for select to authenticated
  using (
    public.has_role((select auth.uid()), 'admin')
    or exists (select 1 from public.price_exceptions pe where pe.id = exception_messages.exception_id and pe.solicitante_id = (select auth.uid()))
  );
drop policy if exists "Authenticated users can send messages" on public.exception_messages;
create policy "Participantes enviam mensagens na exceção" on public.exception_messages
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (
      public.has_role((select auth.uid()), 'admin')
      or exists (select 1 from public.price_exceptions pe where pe.id = exception_messages.exception_id and pe.solicitante_id = (select auth.uid()))
    )
  );

-- 10. privilégios padrão: objeto novo não nasce aberto ao anon ---------------------------------
-- Tabelas/sequences: o default do schema public dava tudo ao anon.
alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;
-- Funções: o EXECUTE para PUBLIC vem do default GLOBAL (não do schema) — por isso sem `in schema`.
-- Atenção: o default do schema public continua dando EXECUTE a authenticated e service_role.
-- Função nova que NÃO deva ser chamada por usuário logado precisa de REVOKE explícito de
-- authenticated; anon e supabase_auth_admin precisam de GRANT explícito.
alter default privileges for role postgres in schema public revoke execute on functions from anon;
alter default privileges for role postgres revoke execute on functions from public;

commit;
