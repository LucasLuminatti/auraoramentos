-- Phase 4 / Plan 02 (deviation auto-fix): tornar cliente_arquivos.arquivo_url NULLABLE
--
-- RESEARCH Pitfall 7 + D-08 (errata): pós Plan 4-01 o bucket `cliente-arquivos` é privado,
-- então não há mais URL pública para gravar no INSERT. DriveExplorer.tsx (Plan 04-02) agora
-- envia `arquivo_url: null` em novos uploads — mas a coluna foi criada como NOT NULL no
-- schema legado. Esta micro-migration relaxa para NULL para permitir novos INSERTs.
--
-- Linhas legadas (URLs públicas "podres") permanecem intactas. RLS, FKs e demais policies
-- não são afetados.

BEGIN;

ALTER TABLE public.cliente_arquivos
  ALTER COLUMN arquivo_url DROP NOT NULL;

COMMIT;
