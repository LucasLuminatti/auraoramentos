-- Migration: RULE-014/015/019 — categorias de fita por orçamento
-- Modelo definido na Reunião 6 e confirmado no WhatsApp de 2026-08-12 (CONF-11):
-- as categorias são criadas ANTES dos ambientes, pertencem ao ORÇAMENTO (não são padrões
-- globais) e carregam só nome + fita — o perfil é vinculado caso a caso no ambiente.
--
-- Shape do jsonb (espelha CategoriaFita de src/types/orcamento.ts):
--   [{ "id": "uuid", "nome": "Sanca quente", "fita": { ...ItemFitaLED } }]
--
-- Aditiva e retrocompatível: orçamentos existentes ficam com '[]' e continuam consolidando
-- a fita por código (o campo `categoriaId` dos sistemas simplesmente não existe neles).

ALTER TABLE public.orcamentos
  ADD COLUMN IF NOT EXISTS categorias JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.orcamentos.categorias IS
  'Categorias de fita do orçamento (RULE-014): [{id, nome, fita}]. Vazio = orçamento sem categorias.';
