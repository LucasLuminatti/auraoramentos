-- Permitir exclusão de cliente cascateando os registros vinculados.
--
-- Contexto: o Admin falhava ao excluir cliente com o erro 23503 em
-- orcamentos_cliente_id_fkey. Duas FKs estavam como NO ACTION e bloqueavam
-- o cascade (todas as demais FKs do grafo cliente→projeto→* já eram CASCADE):
--   - orcamentos.cliente_id        (bloqueador direto)
--   - price_exceptions.projeto_id  (bloqueava o cascade do projeto)
--
-- Verificado por probe transacional (DROP+ADD + DELETE + ROLLBACK): após o
-- fix, excluir um cliente remove em cascata projetos, orçamentos,
-- price_exceptions (e exception_messages), pastas e arquivos, sem deixar
-- nenhuma FK NO ACTION/RESTRICT residual no fechamento transitivo.
--
-- Proteção de venda: a aplicação (Admin.tsx → handleDeleteCliente) bloqueia
-- a exclusão quando o cliente possui orçamento status='fechado', evitando que
-- uma venda concretizada seja apagada silenciosamente por este CASCADE.
--
-- Idempotente: DROP CONSTRAINT IF EXISTS antes de cada ADD (ADD não tem
-- IF NOT EXISTS no Postgres). Mantém os mesmos nomes de constraint.

BEGIN;

ALTER TABLE public.orcamentos
  DROP CONSTRAINT IF EXISTS orcamentos_cliente_id_fkey;
ALTER TABLE public.orcamentos
  ADD CONSTRAINT orcamentos_cliente_id_fkey
  FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE CASCADE;

ALTER TABLE public.price_exceptions
  DROP CONSTRAINT IF EXISTS price_exceptions_projeto_id_fkey;
ALTER TABLE public.price_exceptions
  ADD CONSTRAINT price_exceptions_projeto_id_fkey
  FOREIGN KEY (projeto_id) REFERENCES public.projetos(id) ON DELETE CASCADE;

COMMIT;
