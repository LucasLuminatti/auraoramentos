
-- Migration: tabela de vínculos entre spots e lâmpadas compatíveis
-- Refs: seções 5.1, 5.3, 5.4 do relatório técnico v5
-- Regra: cada spot tem lâmpada específica — sistema deve vincular e alertar se incompatível

CREATE TABLE public.vinculos_spot_lampada (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Código do spot (produto do tipo 'spot')
  codigo_spot TEXT NOT NULL REFERENCES public.produtos(codigo) ON DELETE CASCADE,

  -- Código da lâmpada compatível (produto do tipo 'lampada')
  codigo_lampada TEXT NOT NULL REFERENCES public.produtos(codigo) ON DELETE RESTRICT,

  -- Tipo da lâmpada para exibição e filtragem
  -- Ex: 'dicroica', 'ar70', 'par20', 'led_integrado'
  tipo_lampada TEXT,

  -- Se true, o spot tem LED integrado e não precisa de lâmpada separada (seção 5.3)
  led_integrado BOOLEAN NOT NULL DEFAULT false,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (codigo_spot, codigo_lampada)
);

ALTER TABLE public.vinculos_spot_lampada ENABLE ROW LEVEL SECURITY;

-- Leitura pública para consultas no frontend
CREATE POLICY "Anyone can read vinculos_spot_lampada"
  ON public.vinculos_spot_lampada
  FOR SELECT USING (true);

-- Somente admins gerenciam vínculos
CREATE POLICY "Admins can manage vinculos_spot_lampada"
  ON public.vinculos_spot_lampada
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Índices
CREATE INDEX IF NOT EXISTS idx_vinculos_spot_lampada_spot
  ON public.vinculos_spot_lampada (codigo_spot);

CREATE INDEX IF NOT EXISTS idx_vinculos_spot_lampada_lampada
  ON public.vinculos_spot_lampada (codigo_lampada);
