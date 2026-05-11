-- Phase 8 / Plan 01: arquitetos.expand_fields — FORM-02 (ficha completa do escritório)
-- Refs: FORM-02 — desbloqueia ArquitetoDialog expandido (Plan 08-05)
-- Decisões:
--   D-01 endereco TEXT NULL (free-form, sem ViaCEP)
--   D-02 dados bancários em 5 colunas typed (sem JSONB)
--   D-03 data_nascimento DATE NULL + index BTREE (replica Phase 7 D-07/D-08)
--   D-05 7 colunas em uma única migration aditiva
-- Aditivo puro: todas colunas nullable, sem backfill, sem pre-flight.

BEGIN;

-- =========================================================================
-- Bloco 1 — ADD COLUMN x 7 (todas nullable — schema sempre aditivo)
-- =========================================================================
ALTER TABLE public.arquitetos
  ADD COLUMN data_nascimento DATE,
  ADD COLUMN endereco        TEXT,
  ADD COLUMN banco           TEXT,
  ADD COLUMN agencia         TEXT,
  ADD COLUMN conta           TEXT,
  ADD COLUMN tipo_conta      TEXT,
  ADD COLUMN pix             TEXT;

-- =========================================================================
-- Bloco 2 — Index BTREE em data_nascimento (D-03)
-- Replica padrão Phase 7 D-08 (clientes.data_nascimento). Volume atual baixo;
-- index funcional MONTH/DAY pode entrar depois se cron de aniversário do
-- arquiteto for ativado (out of scope v1.1).
-- =========================================================================
CREATE INDEX idx_arquitetos_data_nascimento
  ON public.arquitetos(data_nascimento);

-- =========================================================================
-- Bloco 3 — COMMENT ON COLUMN x 7 (citando Phase 8 FORM-02 em cada uma)
-- =========================================================================
COMMENT ON COLUMN public.arquitetos.data_nascimento IS
  'Data de nascimento do arquiteto (opcional). Phase 8 FORM-02. Preparado para eventual cron de aniversário (Phase 12+).';
COMMENT ON COLUMN public.arquitetos.endereco IS
  'Endereço do escritório do arquiteto (string única free-form, sem estrutura CEP/UF/cidade). Phase 8 FORM-02 D-01.';
COMMENT ON COLUMN public.arquitetos.banco IS
  'Nome do banco para pagamento de comissão. Phase 8 FORM-02 D-02.';
COMMENT ON COLUMN public.arquitetos.agencia IS
  'Número da agência bancária. Phase 8 FORM-02 D-02.';
COMMENT ON COLUMN public.arquitetos.conta IS
  'Número da conta bancária. Phase 8 FORM-02 D-02.';
COMMENT ON COLUMN public.arquitetos.tipo_conta IS
  'Tipo de conta (corrente/poupança/etc — string livre, sem CHECK). Phase 8 FORM-02 D-02.';
COMMENT ON COLUMN public.arquitetos.pix IS
  'Chave Pix do arquiteto (CPF/email/telefone/aleatória — string genérica). Phase 8 FORM-02 D-02.';

COMMIT;
