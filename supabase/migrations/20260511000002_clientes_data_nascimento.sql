-- Phase 7 / Plan 02: clientes.data_nascimento + index BTREE
-- Refs: AUTO-03 (cadastro de aniversário) — desbloqueia Phase 12 (cron de aniversário)
-- Decisões: D-07 (DATE NULL, sem default, sem backfill — campo opcional do admin)
--           D-08 (BTREE simples; index funcional MONTH/DAY descartado como premature optimization)
--           D-09 (COMMENT citando Phase 7 AUTO-03 + Phase 12)
-- Aditivo puro: sem pre-flight assert, sem backfill, sem NOT NULL.

BEGIN;

-- =========================================================================
-- Bloco 1 — ADD COLUMN data_nascimento (nullable, sem default)
-- =========================================================================
ALTER TABLE public.clientes
  ADD COLUMN data_nascimento DATE;

-- =========================================================================
-- Bloco 2 — Index BTREE (D-08)
-- Phase 12 (cron de aniversário) vai filtrar por mês/dia; BTREE simples basta
-- para volume atual. Index funcional MONTH/DAY pode ser introduzido depois
-- se profiling indicar necessidade.
-- =========================================================================
CREATE INDEX idx_clientes_data_nascimento
  ON public.clientes(data_nascimento);

-- =========================================================================
-- Bloco 3 — COMMENT (D-09)
-- =========================================================================
COMMENT ON COLUMN public.clientes.data_nascimento IS
  'Data de nascimento do cliente (opcional). Preenchida pelo admin via FORM-02 (Phase 8). Consumida pelo cron de aniversário (Phase 12). Phase 7 AUTO-03.';

COMMIT;
