-- Migration: CAT-03 — corrigir tipo_produto de CONECTORES e KITS DE FIXAÇÃO de sistemas compostos (Phase 19 / Plan 02)
-- Motivo: conectores (LM2338 MAGNETO 48V; LM3168/LM3169 TINY 24V) e kit de fixação (LM2987)
--   precisam de tipo_produto='conector'/'kit_fixacao' para aparecer na busca de componentes
--   (useProdutoSearch.ts agora roteia filtro='conector'/'kit_fixacao' via .eq('tipo_produto', filtro)).
-- Escopo: lista EXPLÍCITA de codigo auditada contra o DB (D-08). NUNCA UPDATE em massa (PITFALLS C-1).
-- Aditiva, idempotente (guarda IS DISTINCT FROM), transacional. Mira a TABELA product_variants (não a view produtos).
-- NÃO toca snapshots em orcamentos.ambientes (jsonb autocontido — padrão Phase 14 CAT-01).
--
-- AUDITORIA DB (resultado registrado no 19-02-SUMMARY.md):
--   Auditoria ao vivo não pôde ser executada neste executor (sem credencial de service role em runtime).
--   Lista-semente usada: LM2338, LM3168, LM3169 → 'conector'; LM2987 → 'kit_fixacao'.
--   A lista DEVE ser confirmada e expandida na task [BLOCKING] do Plan 03 antes de aplicar:
--     SELECT codigo, descricao, tipo_produto, sistema
--     FROM public.product_variants
--     WHERE codigo IN ('LM2338','LM3168','LM3169','LM2987')
--        OR descricao ILIKE '%CONECTOR%MAGNETIC%'
--        OR descricao ILIKE '%CONECTOR%TINY%'
--        OR descricao ILIKE '%KIT%FIXA%'
--     ORDER BY codigo;
--   SKUs adicionais da mesma família revelados pela query acima devem ser anexados às listas abaixo
--   antes de executar (caso existam variantes de cor, versão embutida, etc.).
--
-- ROLLBACK:
--   BEGIN;
--   UPDATE public.product_variants SET tipo_produto = NULL
--     WHERE codigo IN ('LM2338', 'LM3168', 'LM3169') AND tipo_produto = 'conector';
--   UPDATE public.product_variants SET tipo_produto = NULL
--     WHERE codigo IN ('LM2987') AND tipo_produto = 'kit_fixacao';
--   COMMIT;

BEGIN;

-- Estender check_tipo_produto para incluir 'kit_fixacao'.
-- 'conector' JÁ está no enum do DB (PITFALLS N-2); 'kit_fixacao' NÃO existe — precisa ser adicionado.
-- O ALTER é idempotente: re-declara o conjunto completo + 'kit_fixacao'.
-- Se o nome exato do constraint divergir de 'check_tipo_produto', ajustar abaixo antes de executar
-- (confirmar via: SELECT conname FROM pg_constraint WHERE conrelid='public.product_variants'::regclass AND contype='c';).
ALTER TABLE public.product_variants DROP CONSTRAINT IF EXISTS check_tipo_produto;
ALTER TABLE public.product_variants ADD CONSTRAINT check_tipo_produto
  CHECK (tipo_produto IS NULL OR tipo_produto IN (
    'fita','driver','perfil','spot','lampada','acessorio','conector','suporte','kit_fixacao'
  ));

-- CONECTORES → 'conector'
-- Sementes: LM2338 (CONECTOR MAGNETO 48V), LM3168/LM3169 (CONECTOR TINY 24V)
-- Expandir com SKUs adicionais da auditoria Plan 03 se necessário.
UPDATE public.product_variants
  SET tipo_produto = 'conector'
  WHERE codigo IN (
    'LM2338',
    'LM3168',
    'LM3169'
  )
  AND tipo_produto IS DISTINCT FROM 'conector';

-- KIT DE FIXAÇÃO → 'kit_fixacao'
-- Semente: LM2987 (KIT FIXAÇÃO)
-- Expandir com SKUs adicionais da auditoria Plan 03 se necessário.
UPDATE public.product_variants
  SET tipo_produto = 'kit_fixacao'
  WHERE codigo IN (
    'LM2987'
  )
  AND tipo_produto IS DISTINCT FROM 'kit_fixacao';

COMMIT;
