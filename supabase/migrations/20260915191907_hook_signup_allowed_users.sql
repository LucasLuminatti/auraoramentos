-- Segurança — onda 2 da auditoria de 2026-09-15 (analise/seguranca-auditoria-2026-09-15.md).
-- Trava REAL do cadastro: hoje o signup é aberto e autoconfirmado, e a checagem de
-- allowed_users só existe na tela (Auth.tsx) — qualquer um criava conta pela API.
--
-- Contrato do hook "Before User Created" conferido na doc atual do Supabase
-- (docs/guides/auth/auth-hooks/before-user-created-hook): recebe `event jsonb`, o e-mail vem em
-- event->'user'->>'email'; devolver '{}' permite; devolver {"error":{"http_code","message"}} recusa.
-- Revisado por agente independente contra a doc e o código do GoTrue:
--   - erro na função = cadastro falha (fail-closed); login por senha não passa pelo hook;
--   - vale para signup, convite (dashboard / inviteUserByEmail), OAuth e generate_link;
--   - NÃO vale para "Create new user" do dashboard nem auth.admin.createUser (exigem service role).
--
-- Ordem: aplicar DEPOIS de 20260915191905_seguranca_rls.sql e só então ATIVAR no dashboard:
-- Authentication → Hooks → Before User Created → Postgres function `public.hook_before_user_created`.
-- Ativar antes de a função existir faz todo cadastro falhar. Usuários existentes não são afetados.

begin;

-- A comparação normaliza o e-mail que chega; o dado gravado precisa estar normalizado também
-- (request-access e review-access já gravam em minúsculas e sem espaços; produção: 0 fora do padrão).
alter table public.allowed_users drop constraint if exists allowed_users_email_normalizado;
alter table public.allowed_users
  add constraint allowed_users_email_normalizado check (email = lower(trim(email)));

create or replace function public.hook_before_user_created(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_email text := lower(trim(coalesce(event -> 'user' ->> 'email', '')));
begin
  if v_email = ''
     or not exists (select 1 from public.allowed_users a where a.email = v_email) then
    return jsonb_build_object(
      'error', jsonb_build_object(
        'http_code', 403,
        'message', 'E-mail não autorizado. Solicite acesso antes de criar a conta.'
      )
    );
  end if;
  return '{}'::jsonb;
end;
$$;

-- Só o serviço de Auth chama o hook. Nenhum papel da API pode executá-lo.
revoke execute on function public.hook_before_user_created(jsonb) from public, anon, authenticated;
grant usage on schema public to supabase_auth_admin;
grant execute on function public.hook_before_user_created(jsonb) to supabase_auth_admin;

commit;
