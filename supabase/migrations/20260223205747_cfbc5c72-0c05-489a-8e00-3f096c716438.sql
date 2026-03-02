ALTER TABLE public.produtos
  ADD COLUMN preco_tabela numeric NOT NULL DEFAULT 0,
  ADD COLUMN preco_minimo numeric NOT NULL DEFAULT 0;