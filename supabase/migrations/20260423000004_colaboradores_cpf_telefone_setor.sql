-- Colaboradores ganham campos de cadastro expandido: CPF, telefone, setor (enum-like via CHECK).
-- Todos nullable — colaboradores existentes ja logados nao sao bloqueados.
-- Refs: REQUIREMENTS USR-01 (CPF), USR-02 (telefone), USR-03 (setor) — schema apenas;
--       USR-04 back-fill via UI fica para Fase 2.
--
-- Decisao: TEXT + CHECK constraint em vez de CREATE TYPE AS ENUM.
-- Justificativa: padrao dominante do codebase (5 ocorrencias em produtos vs 1 em app_role);
-- setor pode evoluir (Marketing, RH); ALTER TYPE ADD VALUE tem limitacoes em transacao.
-- Ver 01-RESEARCH.md secao "CHECK Constraint vs CREATE TYPE ENUM para `setor`".

ALTER TABLE public.colaboradores
  ADD COLUMN cpf TEXT,
  ADD COLUMN telefone TEXT,
  ADD COLUMN setor TEXT,
  ADD CONSTRAINT check_colaboradores_setor CHECK (
    setor IN ('comercial', 'projetos', 'logistica', 'financeiro') OR setor IS NULL
  );

COMMENT ON COLUMN public.colaboradores.cpf IS 'CPF do colaborador. Validacao algoritmica no app (signup, USR-01). Nullable: colaboradores antigos preenchem via USR-04 sem bloqueio.';
COMMENT ON COLUMN public.colaboradores.telefone IS 'Telefone BR do colaborador. Formato livre (mascara/validacao no app, USR-02). Nullable.';
COMMENT ON COLUMN public.colaboradores.setor IS 'Setor da Luminatti. Valores atuais: comercial, projetos, logistica, financeiro (USR-03). CHECK constraint permite extensao futura via DROP/ADD CONSTRAINT sem ALTER TYPE.';
