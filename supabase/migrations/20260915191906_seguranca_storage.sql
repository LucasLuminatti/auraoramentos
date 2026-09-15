-- Segurança — storage (auditoria de 2026-09-15, analise/seguranca-auditoria-2026-09-15.md).
-- Separada da migration de RLS porque a alteração de buckets pode ser bloqueada pelo schema
-- storage; aplicada à mão com `npx supabase db query --linked -f`.

begin;

-- Buckets legados sem nenhum objeto e sem uso no código (src/ e supabase/functions/):
-- públicos e com upload/alteração para qualquer logado, sem limite de tamanho ou tipo.
drop policy if exists "Authenticated can upload to temp-imports" on storage.objects;
drop policy if exists "Anyone can read temp-imports" on storage.objects;
drop policy if exists "Auth upload produto-imagens" on storage.objects;
drop policy if exists "Auth update produto-imagens" on storage.objects;
drop policy if exists "Auth delete produto-imagens" on storage.objects;
drop policy if exists "Public read produto-imagens" on storage.objects;
update storage.buckets set public = false where id in ('temp-imports', 'produto-imagens');

-- produtos-imagens é público: as imagens abrem pela URL pública sem precisar de policy de
-- SELECT. A policy só servia para LISTAR o bucket inteiro (4.230 objetos) sem login.
-- O upsert do admin (ImportImagens) segue coberto por "Admins can manage produtos-imagens".
drop policy if exists "Anyone can read produtos-imagens" on storage.objects;

-- Limite de tamanho e tipo nas imagens de produto. Os arquivos atuais são image/png e
-- image/jpg (tipo não padrão gravado pelo import) com no máximo ~2 MB; o upload valida 2 MB.
update storage.buckets
  set file_size_limit = 5242880,
      allowed_mime_types = array['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
  where id = 'produtos-imagens';

commit;
