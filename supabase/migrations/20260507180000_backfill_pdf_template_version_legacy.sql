-- Phase 5 / fix: backfill pdf_template_version=NULL para snapshots pré-Phase-5
--
-- Bug encontrado durante UAT: a migration 20260507000001 usou
-- `ADD COLUMN pdf_template_version integer DEFAULT 2`. Em PostgreSQL 11+ isso
-- preenche TODAS as rows existentes com 2 (não NULL como o comentário afirmava).
-- Resultado: orçamentos criados antes da Phase 5 são re-emitidos com template v2
-- em vez do legacy, quebrando PDF-05 (compat retroativa).
--
-- Fix em 2 partes:
--   1. UPDATE NULL nas rows existentes antes da Phase 5 (cut-off: 2026-05-07
--      00:00 UTC, momento em que a coluna foi adicionada e a Phase 5 iniciou
--      execução).
--   2. DROP DEFAULT — Step3Revisao já persiste `pdf_template_version: 2`
--      explicitamente em insert/update; default na coluna era armadilha (preencheu
--      rows antigas no ADD COLUMN). Sem default: qualquer caminho que não
--      persistir explicitamente fica NULL → coalesce 1 → v1 (fail-safe legacy).

BEGIN;

-- =========================================================================
-- Bloco 1 — Backfill: marcar rows pré-Phase-5 como legacy (NULL → coalesce 1)
-- =========================================================================
UPDATE public.orcamentos
SET pdf_template_version = NULL
WHERE created_at < '2026-05-07T00:00:00+00:00'
  AND pdf_template_version = 2;

-- =========================================================================
-- Bloco 2 — Remover DEFAULT da coluna (era a causa do bug)
-- =========================================================================
ALTER TABLE public.orcamentos
  ALTER COLUMN pdf_template_version DROP DEFAULT;

COMMENT ON COLUMN public.orcamentos.pdf_template_version IS
  'Versão do template do PDF a ser usado para renderizar este orçamento. NULL ou < 2 = template v1 (legacy, antes da Phase 5). >= 2 = template v2 (editorial, Phase 5+). Step3Revisao persiste 2 explicitamente em INSERTs novos; rows com valor NULL são tratadas como v1 via coalesce no router.';

COMMIT;
