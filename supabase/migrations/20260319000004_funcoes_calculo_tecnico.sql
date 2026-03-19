
-- Migration: funções de cálculo técnico centralizadas no banco
-- Refs: seções 2.2, 2.3, 4.1, 9.1 do relatório técnico v5

-- ============================================================
-- FUNÇÃO 1: calcular_drivers
-- Calcula a quantidade de drivers necessários dado um segmento de fita
-- Aplica SIMULTANEAMENTE a restrição de potência e a de extensão (seção 2.2 + 2.3)
-- Retorna o maior valor entre os dois critérios (MAX)
-- ============================================================
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
  -- Passo 2: Consumo total
  v_potencia_total := p_metragem_fita * p_watts_por_metro;

  -- Passo 3: Margem de segurança de 5%
  v_potencia_segura := v_potencia_total * 1.05;

  -- Passo 4: Quantidade por potência
  v_qtd_por_potencia := CEIL(v_potencia_segura / p_potencia_driver);

  -- Passo 5: Quantidade por extensão (seção 2.3)
  v_limite_metros := CASE p_tensao
    WHEN 12 THEN 5.0
    WHEN 24 THEN 10.0
    ELSE NULL  -- 48V: sem limite fixo (verificar fabricante Magneto)
  END;

  IF v_limite_metros IS NOT NULL THEN
    v_qtd_por_extensao := CEIL(p_metragem_fita / v_limite_metros);
  ELSE
    v_qtd_por_extensao := v_qtd_por_potencia; -- sem restrição de extensão, potência manda
  END IF;

  -- Passo 6: Retorna o maior valor (pior caso)
  RETURN GREATEST(v_qtd_por_potencia, v_qtd_por_extensao);
END;
$$;

-- ============================================================
-- FUNÇÃO 2: calcular_metragem_fita
-- Calcula a metragem total de fita em um sistema de perfil (seção 2.2 Passo 1)
-- ============================================================
CREATE OR REPLACE FUNCTION public.calcular_metragem_fita(
  p_comprimento_perfil NUMERIC,  -- comprimento de cada peça de perfil (m)
  p_quantidade_pecas   INTEGER,  -- número de peças
  p_num_passadas       INTEGER   -- número de passadas de fita no perfil
)
RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN p_comprimento_perfil * p_quantidade_pecas * p_num_passadas;
END;
$$;

-- ============================================================
-- FUNÇÃO 3: calcular_drivers_magneto_48v
-- Cálculo específico do sistema Magneto 48V (seção 4.1)
-- Drivers disponíveis: 100W (LM2343) e 200W (LM2344)
-- Retorna um JSONB com qtd para cada opção
-- ============================================================
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
  v_potencia_segura := p_potencia_total_modulos * 1.05;

  RETURN jsonb_build_object(
    'opcao_100w', CEIL(v_potencia_segura / 100.0),
    'opcao_200w', CEIL(v_potencia_segura / 200.0),
    'potencia_segura_w', ROUND(v_potencia_segura, 2)
  );
END;
$$;

-- ============================================================
-- FUNÇÃO 4: otimizar_rolos_fita
-- Algoritmo guloso para otimizar a compra de rolos de fita (seção 9.1)
-- Prioridade: 15m → 10m → 5m
-- Arredondamento acontece UMA ÚNICA VEZ no total do projeto
-- ============================================================
CREATE OR REPLACE FUNCTION public.otimizar_rolos_fita(
  p_demanda_metros NUMERIC  -- demanda total de fita do projeto (todos os ambientes somados)
)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_restante  NUMERIC;
  v_rolos_15  INTEGER;
  v_rolos_10  INTEGER;
  v_rolos_5   INTEGER;
  v_total_m   NUMERIC;
BEGIN
  v_restante := p_demanda_metros;

  -- Algoritmo guloso: maior rolo primeiro
  v_rolos_15 := FLOOR(v_restante / 15.0);
  v_restante  := v_restante - (v_rolos_15 * 15.0);

  v_rolos_10 := FLOOR(v_restante / 10.0);
  v_restante  := v_restante - (v_rolos_10 * 10.0);

  -- Resto vai para rolos de 5m (arredonda para cima)
  v_rolos_5  := CEIL(v_restante / 5.0);

  v_total_m := (v_rolos_15 * 15) + (v_rolos_10 * 10) + (v_rolos_5 * 5);

  RETURN jsonb_build_object(
    'rolos_15m',     v_rolos_15,
    'rolos_10m',     v_rolos_10,
    'rolos_5m',      v_rolos_5,
    'demanda_m',     p_demanda_metros,
    'total_compra_m', v_total_m,
    'sobra_m',       v_total_m - p_demanda_metros
  );
END;
$$;

-- ============================================================
-- FUNÇÃO 5: calcular_conectores_emenda
-- Lógica dos conectores de trilho Tiny Magneto e Magneto 48V (seções 3.4, 4.4)
-- ============================================================
CREATE OR REPLACE FUNCTION public.calcular_conectores_emenda(
  p_qtd_perfis INTEGER,  -- número total de barras/peças de trilho
  p_qtd_cantos INTEGER   -- número de cantos em L no layout
)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN jsonb_build_object(
    'conectores_retos',  GREATEST(0, (p_qtd_perfis - 1) - p_qtd_cantos),
    'conectores_curvos', p_qtd_cantos,
    'total_conectores',  GREATEST(0, p_qtd_perfis - 1)
  );
END;
$$;

-- ============================================================
-- FUNÇÃO 6: calcular_tampas_vedacao_fita_flexivel
-- Calcula pacotes de tampas de vedação para fita flexível (seção 8)
-- Cada sessão de fita precisa de 2 tampas. Pacote = 50 unidades (LM2600)
-- ============================================================
CREATE OR REPLACE FUNCTION public.calcular_tampas_vedacao_fita_flexivel(
  p_qtd_sessoes INTEGER  -- número de trechos/sessões de fita flexível
)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_qtd_tampas  INTEGER;
  v_qtd_pacotes INTEGER;
BEGIN
  v_qtd_tampas  := 2 * p_qtd_sessoes;
  v_qtd_pacotes := CEIL(v_qtd_tampas::NUMERIC / 50.0);

  RETURN jsonb_build_object(
    'qtd_tampas',       v_qtd_tampas,
    'qtd_pacotes_lm2600', v_qtd_pacotes,
    'codigo_produto',   'LM2600'
  );
END;
$$;

-- ============================================================
-- FUNÇÃO 7: calcular_tampa_cega_smode
-- Calcula a metragem de tampa cega necessária no sistema S-Mode (seção 6.2)
-- ============================================================
CREATE OR REPLACE FUNCTION public.calcular_tampa_cega_smode(
  p_comprimento_perfil  NUMERIC,  -- comprimento total do frame/perfil (m)
  p_comprimentos_modulos NUMERIC[] -- array com o comprimento de cada módulo instalado (m)
)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_soma_modulos NUMERIC := 0;
  v_tampa_cega   NUMERIC;
  v_comprimento  NUMERIC;
BEGIN
  FOREACH v_comprimento IN ARRAY p_comprimentos_modulos LOOP
    v_soma_modulos := v_soma_modulos + v_comprimento;
  END LOOP;

  v_tampa_cega := p_comprimento_perfil - v_soma_modulos;

  RETURN jsonb_build_object(
    'tampa_cega_m',       GREATEST(0, v_tampa_cega),
    'soma_modulos_m',     v_soma_modulos,
    'comprimento_frame_m', p_comprimento_perfil
  );
END;
$$;
