
-- Migration: RULE-026 — folga do driver de 5% para 20%
-- Decisão da equipe (Luis/Paolla, reunião confirmada em 2026-08-12): margem de
-- segurança do dimensionamento de drivers = 20% ("pra não ter mais que erro").
-- Espelha MARGEM_SEGURANCA_DRIVER = 1.20 (src/types/orcamento.ts) e a edge
-- validar-sistema-orcamento — as 3 camadas mudam no MESMO deploy.
-- Substitui apenas as funções que embutiam o fator 1.05
-- (20260319000004_funcoes_calculo_tecnico.sql, funções 1 e 3).

CREATE OR REPLACE FUNCTION public.calcular_drivers(
  p_metragem_fita    NUMERIC,  -- metros totais de fita (comprimento × peças × passadas)
  p_watts_por_metro  NUMERIC,  -- W/m da fita selecionada
  p_potencia_driver  NUMERIC,  -- potência nominal do driver selecionado (W)
  p_tensao           INTEGER   -- tensão do sistema: 12, 24 ou 48 (V)
)
RETURNS INTEGER
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_potencia_total    NUMERIC;
  v_potencia_segura   NUMERIC;
  v_qtd_por_potencia  INTEGER;
  v_limite_metros     NUMERIC;
  v_qtd_por_extensao  INTEGER;
BEGIN
  v_potencia_total := p_metragem_fita * p_watts_por_metro;

  -- Margem de segurança de 20% (RULE-026)
  v_potencia_segura := v_potencia_total * 1.20;

  v_qtd_por_potencia := CEIL(v_potencia_segura / p_potencia_driver);

  v_limite_metros := CASE p_tensao
    WHEN 12 THEN 5.0
    WHEN 24 THEN 10.0
    ELSE NULL  -- 48V: sem limite fixo (verificar fabricante Magneto)
  END;

  IF v_limite_metros IS NOT NULL THEN
    v_qtd_por_extensao := CEIL(p_metragem_fita / v_limite_metros);
  ELSE
    v_qtd_por_extensao := v_qtd_por_potencia;
  END IF;

  RETURN GREATEST(v_qtd_por_potencia, v_qtd_por_extensao);
END;
$$;

CREATE OR REPLACE FUNCTION public.calcular_drivers_magneto_48v(
  p_potencia_total_modulos NUMERIC  -- soma da potência de todos os módulos do sistema
)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_potencia_segura NUMERIC;
BEGIN
  -- Margem de segurança de 20% (RULE-026)
  v_potencia_segura := p_potencia_total_modulos * 1.20;

  RETURN jsonb_build_object(
    'opcao_100w', CEIL(v_potencia_segura / 100.0),
    'opcao_200w', CEIL(v_potencia_segura / 200.0),
    'potencia_segura_w', ROUND(v_potencia_segura, 2)
  );
END;
$$;
