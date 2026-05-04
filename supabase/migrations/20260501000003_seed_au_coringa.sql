-- Phase 3 / Plan 02: seed dos 16 AU coringa (D-09, D-10, D-11, D-12, D-13)
-- - Cria 16 pais em products (P-AU001..P-AU016) com nome = descrição
-- - Cria 16 variants em product_variants (AU001..AU016) com origem='coringa', editado_manualmente=true
-- - editado_manualmente=true desde o seed: master subsequente NÃO sobrescreve (D-10)
-- - imagem_url=NULL inicialmente; admin sobe via ProdutoEditDialog (D-13) ou bulk import (Plan 04)
-- - preco_tabela e preco_minimo = 0 (default da tabela; D-19: preço deferido para phase futura)

BEGIN;

-- 1. Cria os 16 pais em products
INSERT INTO public.products (codigo_pai, nome, categoria, tipologia) VALUES
  ('P-AU001', 'Drivers', 'AU Coringa', NULL),
  ('P-AU002', 'Plug para Fita LED', 'AU Coringa', NULL),
  ('P-AU003', 'Amplificador e Controlador Fita LED', 'AU Coringa', NULL),
  ('P-AU004', 'Fita LED', 'AU Coringa', NULL),
  ('P-AU005', 'Lâmpadas LED', 'AU Coringa', NULL),
  ('P-AU006', 'Luminárias', 'AU Coringa', NULL),
  ('P-AU007', 'Luminárias decorativas sem LED integrado', 'AU Coringa', NULL),
  ('P-AU008', 'Luminárias de mesa', 'AU Coringa', NULL),
  ('P-AU009', 'Luminárias de mesa sem LED integrado', 'AU Coringa', NULL),
  ('P-AU010', 'Projetores, Embutidos e Espelhos', 'AU Coringa', NULL),
  ('P-AU011', 'Partes Luminárias Decorativas Vidro - Teto', 'AU Coringa', NULL),
  ('P-AU012', 'Partes Luminárias Decorativas Vidro - Outros', 'AU Coringa', NULL),
  ('P-AU013', 'Partes Luminárias Decorativas Plástico - Teto', 'AU Coringa', NULL),
  ('P-AU014', 'Partes Luminárias Decorativas Plástico - Outros', 'AU Coringa', NULL),
  ('P-AU015', 'Partes Luminárias Decorativas Outros - Teto', 'AU Coringa', NULL),
  ('P-AU016', 'Partes Luminárias Decorativas Outros - Outros', 'AU Coringa', NULL)
ON CONFLICT (codigo_pai) DO NOTHING;

-- 2. Cria as 16 variants em product_variants
-- product_id resolvido via subselect; descricao + nome iguais (espelha o pai); origem='coringa'; editado_manualmente=true
INSERT INTO public.product_variants
  (codigo, descricao, nome, product_id, origem, editado_manualmente, preco_tabela, preco_minimo, imagem_url, atributos)
VALUES
  ('AU001', 'Drivers', 'Drivers', (SELECT id FROM public.products WHERE codigo_pai='P-AU001'), 'coringa', true, 0, 0, NULL, '{}'::jsonb),
  ('AU002', 'Plug para Fita LED', 'Plug para Fita LED', (SELECT id FROM public.products WHERE codigo_pai='P-AU002'), 'coringa', true, 0, 0, NULL, '{}'::jsonb),
  ('AU003', 'Amplificador e Controlador Fita LED', 'Amplificador e Controlador Fita LED', (SELECT id FROM public.products WHERE codigo_pai='P-AU003'), 'coringa', true, 0, 0, NULL, '{}'::jsonb),
  ('AU004', 'Fita LED', 'Fita LED', (SELECT id FROM public.products WHERE codigo_pai='P-AU004'), 'coringa', true, 0, 0, NULL, '{}'::jsonb),
  ('AU005', 'Lâmpadas LED', 'Lâmpadas LED', (SELECT id FROM public.products WHERE codigo_pai='P-AU005'), 'coringa', true, 0, 0, NULL, '{}'::jsonb),
  ('AU006', 'Luminárias', 'Luminárias', (SELECT id FROM public.products WHERE codigo_pai='P-AU006'), 'coringa', true, 0, 0, NULL, '{}'::jsonb),
  ('AU007', 'Luminárias decorativas sem LED integrado', 'Luminárias decorativas sem LED integrado', (SELECT id FROM public.products WHERE codigo_pai='P-AU007'), 'coringa', true, 0, 0, NULL, '{}'::jsonb),
  ('AU008', 'Luminárias de mesa', 'Luminárias de mesa', (SELECT id FROM public.products WHERE codigo_pai='P-AU008'), 'coringa', true, 0, 0, NULL, '{}'::jsonb),
  ('AU009', 'Luminárias de mesa sem LED integrado', 'Luminárias de mesa sem LED integrado', (SELECT id FROM public.products WHERE codigo_pai='P-AU009'), 'coringa', true, 0, 0, NULL, '{}'::jsonb),
  ('AU010', 'Projetores, Embutidos e Espelhos', 'Projetores, Embutidos e Espelhos', (SELECT id FROM public.products WHERE codigo_pai='P-AU010'), 'coringa', true, 0, 0, NULL, '{}'::jsonb),
  ('AU011', 'Partes Luminárias Decorativas Vidro - Teto', 'Partes Luminárias Decorativas Vidro - Teto', (SELECT id FROM public.products WHERE codigo_pai='P-AU011'), 'coringa', true, 0, 0, NULL, '{}'::jsonb),
  ('AU012', 'Partes Luminárias Decorativas Vidro - Outros', 'Partes Luminárias Decorativas Vidro - Outros', (SELECT id FROM public.products WHERE codigo_pai='P-AU012'), 'coringa', true, 0, 0, NULL, '{}'::jsonb),
  ('AU013', 'Partes Luminárias Decorativas Plástico - Teto', 'Partes Luminárias Decorativas Plástico - Teto', (SELECT id FROM public.products WHERE codigo_pai='P-AU013'), 'coringa', true, 0, 0, NULL, '{}'::jsonb),
  ('AU014', 'Partes Luminárias Decorativas Plástico - Outros', 'Partes Luminárias Decorativas Plástico - Outros', (SELECT id FROM public.products WHERE codigo_pai='P-AU014'), 'coringa', true, 0, 0, NULL, '{}'::jsonb),
  ('AU015', 'Partes Luminárias Decorativas Outros - Teto', 'Partes Luminárias Decorativas Outros - Teto', (SELECT id FROM public.products WHERE codigo_pai='P-AU015'), 'coringa', true, 0, 0, NULL, '{}'::jsonb),
  ('AU016', 'Partes Luminárias Decorativas Outros - Outros', 'Partes Luminárias Decorativas Outros - Outros', (SELECT id FROM public.products WHERE codigo_pai='P-AU016'), 'coringa', true, 0, 0, NULL, '{}'::jsonb)
ON CONFLICT (codigo) DO UPDATE SET
  descricao = EXCLUDED.descricao,
  nome = EXCLUDED.nome,
  product_id = EXCLUDED.product_id,
  origem = 'coringa',
  editado_manualmente = true;

COMMIT;
