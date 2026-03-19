
-- Migration: tabela de regras de compatibilidade por família de perfil
-- Refs: seções 2.4, 2.5, 2.6, 2.7, 7.x do relatório técnico v5
-- Esta tabela centraliza todas as restrições físicas dos perfis de alumínio

CREATE TABLE public.regras_compatibilidade_perfil (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  familia_perfil TEXT NOT NULL UNIQUE,

  -- Número padrão de passadas de fita (automático, mas editável pelo usuário)
  passadas_padrao INTEGER NOT NULL DEFAULT 1,

  -- Largura máxima da fita que cabe no canal do perfil (mm)
  -- NULL = sem restrição de largura definida
  largura_max_fita_mm NUMERIC,

  -- Se true, SOMENTE fita Baby é permitida neste perfil (bloquear todas as outras)
  somente_baby BOOLEAN NOT NULL DEFAULT false,

  -- Potência máxima do driver que cabe fisicamente (W)
  -- NULL = sem restrição (qualquer driver cabe)
  driver_max_watts NUMERIC,

  -- Tipo de driver aceito: 'slim' = apenas Slim; 'qualquer' = sem restrição de tipo
  driver_tipo_aceito TEXT NOT NULL DEFAULT 'qualquer',

  -- Sistemas compatíveis com este perfil (array)
  -- Ex: '{padrao}', '{padrao,s_mode}', '{magneto_48v}'
  sistemas_compativeis TEXT[] NOT NULL DEFAULT '{padrao}',

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.regras_compatibilidade_perfil
  ADD CONSTRAINT check_driver_tipo_aceito CHECK (
    driver_tipo_aceito IN ('slim', 'qualquer')
  );

-- Habilitar RLS
ALTER TABLE public.regras_compatibilidade_perfil ENABLE ROW LEVEL SECURITY;

-- Leitura pública (necessário para o frontend filtrar produtos)
CREATE POLICY "Anyone can read regras_compatibilidade_perfil"
  ON public.regras_compatibilidade_perfil
  FOR SELECT USING (true);

-- Somente admins podem gerenciar as regras
CREATE POLICY "Admins can manage regras_compatibilidade_perfil"
  ON public.regras_compatibilidade_perfil
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- SEED: dados baseados na tabela 2.6 do relatório técnico v5
-- ============================================================
INSERT INTO public.regras_compatibilidade_perfil
  (familia_perfil, passadas_padrao, largura_max_fita_mm, somente_baby, driver_max_watts, driver_tipo_aceito, sistemas_compativeis)
VALUES
  ('light_mini',          1, 5.7,  true,  NULL, 'qualquer', '{padrao}'),
  ('light_mini_sobrepor', 1, 5.7,  true,  NULL, 'qualquer', '{padrao}'),
  ('embutir_sobrepor_12', 1, 12.0, false, NULL, 'qualquer', '{padrao}'),
  ('embutir_sobrepor_18', 1, 18.0, false, NULL, 'qualquer', '{padrao}'),
  ('embutir_sobrepor_30', 2, 30.0, false, NULL, 'qualquer', '{padrao}'),
  ('light_nano_12',       1, 12.0, false, NULL, 'qualquer', '{padrao}'),
  ('light_nano_30',       2, 25.0, false, NULL, 'qualquer', '{padrao}'),
  ('light_50',            3, 35.0, false, NULL, 'qualquer', '{padrao}'),
  ('alojamento',          2, 35.0, false, 72,   'slim',     '{padrao}'),
  ('no_frame_unilateral', 1, 20.0, false, NULL, 'qualquer', '{padrao}'),
  ('no_frame_bilateral',  2, 20.0, false, NULL, 'qualquer', '{padrao}'),
  ('no_frame_wide',       2, 24.0, false, NULL, 'qualquer', '{padrao}'),
  ('bid',                 1, NULL, false, NULL, 'qualquer', '{padrao}'),
  ('ripado',              1, 6.0,  true,  NULL, 'qualquer', '{padrao}'),
  ('wall_washer',         2, 20.0, false, NULL, 'qualquer', '{padrao}'),
  ('trik',                2, NULL, false, 72,   'slim',     '{padrao}'),
  ('fk',                  2, NULL, false, 72,   'slim',     '{padrao}'),
  ('premium_lateral',     1, NULL, false, NULL, 'qualquer', '{padrao}'),
  ('movelaria',           1, 12.0, false, NULL, 'qualquer', '{padrao}'),
  ('cantoneira',          1, 10.0, false, NULL, 'qualquer', '{padrao}'),
  ('eco',                 1, 12.0, false, NULL, 'qualquer', '{padrao}'),
  ('sanca',               2, 30.0, false, NULL, 'qualquer', '{padrao}'),
  ('pendente',            2, 25.0, false, NULL, 'qualquer', '{padrao}'),
  ('rodape',              1, 12.0, false, NULL, 'qualquer', '{padrao}'),
  ('s_mode_difuso',       1, NULL, false, NULL, 'qualquer', '{s_mode}');
