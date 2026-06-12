-- Migration: CAT-03 — corrigir tipo_produto de CONECTORES e KITS DE FIXAÇÃO de sistemas compostos (Phase 19 / Plan 02)
-- Motivo: conectores (LM2338 MAGNETO 48V; LM3168/LM3169 TINY 24V) e kit de fixação (LM2987)
--   precisam de tipo_produto='conector'/'kit_fixacao' para aparecer na busca de componentes
--   (useProdutoSearch.ts agora roteia filtro='conector'/'kit_fixacao' via .eq('tipo_produto', filtro)).
-- Escopo: lista EXPLÍCITA de codigo auditada contra o DB (D-08). NUNCA UPDATE em massa (PITFALLS C-1).
-- Aditiva, idempotente (guarda IS DISTINCT FROM), transacional. Mira a TABELA product_variants (não a view produtos).
-- NÃO toca snapshots em orcamentos.ambientes (jsonb autocontido — padrão Phase 14 CAT-01).
--
-- AUDITORIA DB (executada ao vivo via service role na task [BLOCKING] do Plan 03, 2026-06-12):
--   Constraint real confirmado: check_tipo_produto permite
--     ('fita','driver','perfil','spot','lampada','acessorio','conector','suporte') + NULL.
--     'kit_fixacao' NÃO existia → adicionado pelo ALTER abaixo (9 valores).
--   product_variants.codigo tem UNIQUE (produtos_codigo_key) → FK da produto_composicao válido.
--   A auditoria revelou conectores ADICIONAIS das famílias magneto_48v/tiny_magneto com tipo_produto=NULL
--   (mesma família dos sistemas compostos), então a lista de 'conector' foi EXPANDIDA da semente
--   (LM2338/LM3168/LM3169) para todos os conectores de energia/driver/joelho dessas famílias:
--     magneto_48v:  LM2337, LM2338, LM2339, LM2340, LM2341, LM2342  (CONECTOR DE ENERGIA / JOELHO - MAX 48V)
--     tiny_magneto: LM3166, LM3167, LM3168, LM3169                  (CONECTOR DE ENERGIA / DRIVER - MAX 24V)
--   'kit_fixacao' mantido CIRÚRGICO em LM2987 (molas de fixação do trilho de embutir magnético).
--   Os demais "KIT FIXAÇÃO" do catálogo são acessórios de PERFIL (outro domínio) e NÃO entram aqui.
--
-- ROLLBACK (nota: LM3168/LM3169 já eram 'conector' antes da fase — não reverter esses para NULL):
--   BEGIN;
--   UPDATE public.product_variants SET tipo_produto = NULL
--     WHERE codigo IN ('LM2337','LM2338','LM2339','LM2340','LM2341','LM2342','LM3166','LM3167')
--       AND tipo_produto = 'conector';
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
-- Lista auditada (Plan 03): conectores das famílias magneto_48v (48V) e tiny_magneto (24V).
-- LM3168/LM3169 já estavam 'conector'; demais estavam NULL. Guarda IS DISTINCT FROM torna idempotente.
UPDATE public.product_variants
  SET tipo_produto = 'conector'
  WHERE codigo IN (
    'LM2337', 'LM2338', 'LM2339', 'LM2340', 'LM2341', 'LM2342',
    'LM3166', 'LM3167', 'LM3168', 'LM3169'
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
