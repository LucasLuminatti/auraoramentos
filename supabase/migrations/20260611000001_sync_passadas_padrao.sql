-- Migration: sincronizar passadas_padrao de product_variants com regras_compatibilidade_perfil
-- Phase 16 / CALC-03 (D-12) — DEVE ser aplicada antes do unlock da UI de passadas (Plano 02)
-- Idempotente (IS DISTINCT FROM) · Aditivo (apenas UPDATE em product_variants)

BEGIN;

UPDATE public.product_variants pv
  SET passadas_padrao = rcp.passadas_padrao
FROM public.regras_compatibilidade_perfil rcp
WHERE pv.familia_perfil = rcp.familia_perfil
  AND pv.tipo_produto = 'perfil'
  AND pv.passadas_padrao IS DISTINCT FROM rcp.passadas_padrao;

COMMIT;
