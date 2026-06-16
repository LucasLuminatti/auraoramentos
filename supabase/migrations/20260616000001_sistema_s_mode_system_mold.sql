-- Migration: 20260616000001_sistema_s_mode_system_mold.sql
-- Marca perfis-âncora SYSTEM MOLD e módulos difusos com sistema='s_mode' (Phase 21 / SIST-03).
-- Padrão CAT-03 (Phase 19). Aplicar via MCP apply_migration + migration repair (NÃO supabase db push).
-- Tabela: product_variants (view 'produtos' é alias). Idempotente via IS DISTINCT FROM.

BEGIN;

-- 1. Perfis MODULAR âncora (NOFRAME + EMBUTIR) — esperado: 12 linhas (LM1998–LM2003 + LM2109–LM2114)
-- Filtro preciso exclui TAMPAS, KIT MODULAR e spots (Pitfall 3).
UPDATE public.product_variants
SET sistema = 's_mode'
WHERE descricao ILIKE '%SYSTEM MOLD%'
  AND (
    descricao ILIKE '%PERFIL NOFRAME MODULAR%'
    OR descricao ILIKE '%PERFIL DE EMBUTIR MODULAR%'
  )
  AND sistema IS DISTINCT FROM 's_mode';

-- 2. Módulos difusos (PARA FITA LED) — esperado: 15 linhas
-- tipo_produto='acessorio' é o discriminador confiável; DIFUSO estreita ainda mais.
UPDATE public.product_variants
SET sistema = 's_mode'
WHERE descricao ILIKE '%SYSTEM MOLD%'
  AND descricao ILIKE '%DIFUSO%'
  AND tipo_produto = 'acessorio'
  AND sistema IS DISTINCT FROM 's_mode';

COMMIT;
