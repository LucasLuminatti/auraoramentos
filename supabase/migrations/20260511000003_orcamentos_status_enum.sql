-- Phase 7 / Plan 03: orcamentos.status enum via CHECK constraint (AUTO-03 corolário, destrava WIZ-04)
-- Refs: D-10 (UPDATE fechado→aprovado in-place — única mutação destrutiva de DADO; schema continua aditivo),
--       D-11 (ADD CHECK constraint após UPDATE — trava regressão futura),
--       D-12 (manter DEFAULT 'rascunho' — zero mudança no wizard),
--       D-13 (TS em src/types/orcamento.ts:109 fica desatualizado de propósito — Phase 10 sincroniza),
--       D-14 (pre-flight assert defensivo: nenhum valor fora do enum antes da CHECK).
--
-- Step3Revisao.tsx:224 grava 'rascunho' — continua válido após CHECK.

BEGIN;

-- =========================================================================
-- Bloco 1 — UPDATE in-place: fechado → aprovado (D-10)
-- Renomeia o status legado 'fechado' para o novo nome 'aprovado'.
-- Schema permanece aditivo (coluna não muda forma); só o dado muda.
-- =========================================================================
UPDATE public.orcamentos
   SET status = 'aprovado'
 WHERE status = 'fechado';

-- =========================================================================
-- Bloco 2 — Pre-flight assert (D-14): nenhum valor fora do enum
-- Defesa contra valores inesperados em prod (typo, status manual antigo, etc).
-- Se aparecer algo, RAISE EXCEPTION aborta a transação ANTES da CHECK ser aplicada.
-- =========================================================================
DO $$
DECLARE bad_count int;
BEGIN
  SELECT count(*) INTO bad_count
    FROM public.orcamentos
   WHERE status NOT IN ('rascunho','aprovado','perdido','pendente');
  IF bad_count > 0 THEN
    RAISE EXCEPTION 'Migration aborted: % linha(s) com status fora do enum (rascunho|aprovado|perdido|pendente). Investigue antes de aplicar CHECK.', bad_count;
  END IF;
END $$;

-- =========================================================================
-- Bloco 3 — ADD CHECK constraint (D-11)
-- Trava regressão futura. Hoje status é TEXT NOT NULL DEFAULT 'rascunho' sem CHECK.
-- =========================================================================
ALTER TABLE public.orcamentos
  ADD CONSTRAINT orcamentos_status_check
  CHECK (status IN ('rascunho','aprovado','perdido','pendente'));

-- =========================================================================
-- Bloco 4 — Manter DEFAULT 'rascunho' (D-12)
-- DEFAULT já existe na coluna; não alteramos. Step3Revisao.tsx continua gravando 'rascunho' explícito.
-- =========================================================================
-- (no-op intencional — DEFAULT 'rascunho' permanece como definido em 20260213150619)

COMMENT ON COLUMN public.orcamentos.status IS
  'Status do orçamento. Phase 7 AUTO-03 corolário: enum {rascunho, aprovado, perdido, pendente} enforce via orcamentos_status_check. fechado→aprovado migrado in-place (D-10). DEFAULT rascunho mantido. Phase 10 (WIZ-04) sincroniza tipo TS.';

COMMIT;
