-- Migration: RULE-005 + RULE-006 — rolo do catálogo por produto e 5% de sobra POR ROLO
-- Decisões da equipe (Luis/Paolla, WhatsApp 2026-08-12):
--   RULE-005: os tamanhos de rolo são os do catálogo, por produto (produtos.tamanho_rolo_m —
--             valores reais em 2026-08-12: 5, 10, 25 e 50 m). O greedy 15→10→5 sai de cena:
--             um pedido de fita usa um único tamanho de rolo, o do próprio produto.
--   RULE-006: a sobra de 5% incide sobre CADA ROLO — de um rolo de 5 m aproveitam-se ~4,75 m.
-- Espelha SOBRA_ROLO_FITA/calcularRolosPorGrupo (src/types/orcamento.ts) e otimizarRolos da
-- edge validar-sistema-orcamento — as 3 camadas mudam no MESMO deploy.
-- Substitui a FUNÇÃO 4 de 20260319000004_funcoes_calculo_tecnico.sql.

-- A assinatura muda (novo parâmetro): dropar a versão de 1 argumento evita overload ambíguo.
DROP FUNCTION IF EXISTS public.otimizar_rolos_fita(NUMERIC);

CREATE OR REPLACE FUNCTION public.otimizar_rolos_fita(
  p_demanda_metros  NUMERIC,           -- demanda de fita do grupo (mesmo código de fita)
  p_tamanho_rolo_m  NUMERIC DEFAULT 5  -- produtos.tamanho_rolo_m; fallback 5 m
)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_tamanho_rolo   NUMERIC;
  v_metros_uteis   NUMERIC;
  v_qtd_rolos      INTEGER;
  v_total_m        NUMERIC;
BEGIN
  v_tamanho_rolo := COALESCE(NULLIF(p_tamanho_rolo_m, 0), 5);

  -- RULE-006: 5% de perda em cada rolo
  v_metros_uteis := v_tamanho_rolo * 0.95;

  IF COALESCE(p_demanda_metros, 0) <= 0 THEN
    v_qtd_rolos := 0;
  ELSE
    -- CEIL sobre o valor CRU (padrão WR-03); arredondar antes subdimensionaria
    v_qtd_rolos := CEIL(p_demanda_metros / v_metros_uteis);
  END IF;

  v_total_m := v_qtd_rolos * v_tamanho_rolo;

  RETURN jsonb_build_object(
    'tamanho_rolo_m',        v_tamanho_rolo,
    'metros_uteis_por_rolo', ROUND(v_metros_uteis, 2),
    'qtd_rolos',             v_qtd_rolos,
    'demanda_m',             p_demanda_metros,
    'total_compra_m',        v_total_m,
    'sobra_m',               ROUND(v_total_m - COALESCE(p_demanda_metros, 0), 2)
  );
END;
$$;
