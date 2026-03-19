
-- Migration: campos técnicos em produtos para suportar regras do Relatório v5
-- Refs: seções 2.1, 2.4, 2.5, 2.6, 2.7 do relatório técnico

ALTER TABLE public.produtos
  -- Tensão elétrica (12, 24 ou 48 V) — regra de compatibilidade fita/driver (seção 2.1)
  ADD COLUMN IF NOT EXISTS tensao INTEGER,

  -- Watts por metro — para cálculo de potência da fita (seção 2.2)
  ADD COLUMN IF NOT EXISTS watts_por_metro NUMERIC,

  -- Largura física em mm — fitas e canais de perfil (seção 2.5)
  ADD COLUMN IF NOT EXISTS largura_mm NUMERIC,

  -- Classificação do produto
  -- Valores: 'fita', 'driver', 'perfil', 'spot', 'lampada', 'acessorio', 'conector', 'suporte'
  ADD COLUMN IF NOT EXISTS tipo_produto TEXT,

  -- Subtipo para drivers: 'slim', 'convencional', 'pro', 'dimerizavel', 'magnetico'
  -- Subtipo para fitas: 'baby', 'padrao'
  -- Subtipo para spots: 'hub', 'connect', 'trilha', 'tiny_magneto'
  ADD COLUMN IF NOT EXISTS subtipo TEXT,

  -- Sistema de iluminação ao qual o produto pertence
  -- Valores: 'padrao', 'tiny_magneto', 'magneto_48v', 's_mode', 'trilha'
  ADD COLUMN IF NOT EXISTS sistema TEXT,

  -- Família do perfil (para produtos do tipo 'perfil')
  -- Ex: 'light_mini', 'trik', 'fk', 'alojamento', 'sanca', 'pendente', 'ripado', etc.
  ADD COLUMN IF NOT EXISTS familia_perfil TEXT,

  -- Número padrão de passadas de fita para este perfil (seção 2.4)
  ADD COLUMN IF NOT EXISTS passadas_padrao INTEGER DEFAULT 1,

  -- Largura máxima do canal do perfil em mm (seção 2.5)
  ADD COLUMN IF NOT EXISTS largura_canal_mm NUMERIC,

  -- Potência máxima do driver que cabe fisicamente neste perfil (seção 2.7)
  -- NULL = sem restrição
  ADD COLUMN IF NOT EXISTS driver_max_watts NUMERIC,

  -- Tipo de driver permitido neste perfil: 'slim' ou 'qualquer' (seção 2.7)
  ADD COLUMN IF NOT EXISTS driver_tipo_permitido TEXT DEFAULT 'qualquer',

  -- Flag: este perfil aceita SOMENTE fita Baby (seções 7.1, 7.2)
  ADD COLUMN IF NOT EXISTS somente_baby BOOLEAN DEFAULT false,

  -- Tamanho do rolo em metros (para fitas vendidas em rolo: 5, 10 ou 15)
  ADD COLUMN IF NOT EXISTS tamanho_rolo_m NUMERIC,

  -- Fator multiplicador para spots: 1=simples, 2=duplo, 3=triplo, 4=quádruplo (seção 5.1)
  ADD COLUMN IF NOT EXISTS fator_spot INTEGER DEFAULT 1,

  -- Potência individual do produto em Watts (para drivers e spots)
  ADD COLUMN IF NOT EXISTS potencia_watts NUMERIC,

  -- Cor do produto: 'preto', 'branco', 'dourado', NULL (sem restrição)
  ADD COLUMN IF NOT EXISTS cor TEXT,

  -- Aplicação do produto: 'embutir', 'sobrepor', 'pendente', NULL (universal)
  ADD COLUMN IF NOT EXISTS aplicacao TEXT;

-- Constraints de validação
ALTER TABLE public.produtos
  ADD CONSTRAINT check_tensao CHECK (tensao IN (12, 24, 48) OR tensao IS NULL),
  ADD CONSTRAINT check_tipo_produto CHECK (tipo_produto IN (
    'fita', 'driver', 'perfil', 'spot', 'lampada', 'acessorio', 'conector', 'suporte'
  ) OR tipo_produto IS NULL),
  ADD CONSTRAINT check_sistema CHECK (sistema IN (
    'padrao', 'tiny_magneto', 'magneto_48v', 's_mode', 'trilha'
  ) OR sistema IS NULL),
  ADD CONSTRAINT check_driver_tipo_permitido CHECK (
    driver_tipo_permitido IN ('slim', 'qualquer')
  ),
  ADD CONSTRAINT check_fator_spot CHECK (fator_spot IN (1, 2, 3, 4) OR fator_spot IS NULL),
  ADD CONSTRAINT check_aplicacao CHECK (aplicacao IN (
    'embutir', 'sobrepor', 'pendente'
  ) OR aplicacao IS NULL);

-- Índices para filtros frequentes
CREATE INDEX IF NOT EXISTS idx_produtos_tipo ON public.produtos (tipo_produto);
CREATE INDEX IF NOT EXISTS idx_produtos_sistema ON public.produtos (sistema);
CREATE INDEX IF NOT EXISTS idx_produtos_tensao ON public.produtos (tensao);
CREATE INDEX IF NOT EXISTS idx_produtos_familia_perfil ON public.produtos (familia_perfil);
CREATE INDEX IF NOT EXISTS idx_produtos_subtipo ON public.produtos (subtipo);
