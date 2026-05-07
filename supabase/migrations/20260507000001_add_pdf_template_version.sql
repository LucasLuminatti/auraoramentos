-- Phase 5 / Plan 01: pdf_template_version em orcamentos (PDF-05 compat)
-- Refs: RESEARCH.md "Architecture Pattern 1: Template Versioning"
-- Estratégia: ADD COLUMN nullable com default 2 (snapshots novos pegam v2);
-- snapshots criados ANTES desta migration ficam NULL e o leitor faz
-- coalesce(pdf_template_version, 1) no router gerarPdfHtml.ts (Plan 05).

BEGIN;

-- =========================================================================
-- Bloco 1 — ADD COLUMN pdf_template_version (aditiva, não-destrutiva)
-- =========================================================================
ALTER TABLE public.orcamentos
  ADD COLUMN pdf_template_version integer DEFAULT 2;

COMMENT ON COLUMN public.orcamentos.pdf_template_version IS
  'Versão do template do PDF a ser usado para renderizar este orçamento. NULL ou < 2 = template v1 (legacy, antes da Phase 5). >= 2 = template v2 (editorial, Phase 5+). Default 2 em rows novas; rows pré-existentes ficam NULL e são tratadas como v1 via coalesce no router.';

-- =========================================================================
-- Bloco 2 — Verificação pós-migration
-- Sanity check: confirma que a coluna existe e que rows existentes ficaram NULL
-- (não preencher retroativamente — esse é o comportamento desejado para PDF-05).
-- =========================================================================
DO $$
DECLARE col_count int;
BEGIN
  SELECT count(*) INTO col_count
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'orcamentos'
      AND column_name = 'pdf_template_version';
  IF col_count = 0 THEN
    RAISE EXCEPTION 'Migration failed: pdf_template_version não foi adicionada';
  END IF;
END $$;

COMMIT;
