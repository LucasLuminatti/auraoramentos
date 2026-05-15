-- Phase 12 / Plan 03 — Cron diário 09:00 UTC chamando aniversario-clientes (AUTO-01/AUTO-02)
-- Refs: CONTEXT D-01 (06:00 BR = 09:00 UTC), D-03 (cron via SQL migration)
--
-- PRÉ-REQUISITOS (NÃO podem estar em git — manuais):
--   1. Edge function `aniversario-clientes` JÁ DEPLOYED em prod (Wave 2, 12-02-PLAN concluído).
--      Caso contrário, primeiro run às 09:00 UTC dará 404 silencioso (pg_net não falha
--      em HTTP 4xx/5xx, só em TCP/DNS).
--   2. Secret `service_role_key` JÁ EXISTE no Vault (Wave 3 Task 1 / Lenny manual).
--      Confirmar com: SELECT count(*) FROM vault.secrets WHERE name='service_role_key';
--      Se faltar, o primeiro cron run monta Authorization 'Bearer ' (vazio) → 401.

BEGIN;

-- Extensões managed pela Supabase (no-op se já habilitadas)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Cleanup defensivo (caso já exista do unschedule/reschedule)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'aniversario-diario') THEN
    PERFORM cron.unschedule('aniversario-diario');
  END IF;
END
$$;

-- Schedule diário 09:00 UTC = 06:00 BR (CONTEXT D-01)
SELECT cron.schedule(
  'aniversario-diario',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url := 'https://jkewlaezvrbuicmncqbj.supabase.co/functions/v1/aniversario-clientes',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets
        WHERE name = 'service_role_key'
      )
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000  -- 60s cobre batch grande sem cortar Resend
  ) AS request_id;
  $$
);

COMMENT ON EXTENSION pg_cron IS
  'Phase 12: agendamento de jobs no Postgres (managed Supabase). Job principal: aniversario-diario @ 09:00 UTC.';

COMMENT ON EXTENSION pg_net IS
  'Phase 12: HTTP requests assíncronos a partir do SQL (managed Supabase). Usado pelo cron pra chamar edge function aniversario-clientes.';

COMMIT;
