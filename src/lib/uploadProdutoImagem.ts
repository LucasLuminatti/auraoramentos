/**
 * Phase 3 / Plan 03
 *
 * Utilitário para upload de imagem de produto no bucket Supabase Storage 'produtos-imagens'.
 * Validações:
 *  - Tipo: jpg/jpeg/png/webp (mesma whitelist de ImportImagens.tsx)
 *  - Tamanho máximo: 2MB
 *  - Path = `<codigo>.<ext>` (sanitizado a partir do código, NÃO do filename do user — Pitfall path traversal)
 *
 * Refs: D-14 (bucket plural 'produtos-imagens'), D-16 (UI admin upload),
 * RESEARCH Code Example 5, ImportImagens.tsx:141-143 padrão pré-existente
 */

import { supabase } from "@/integrations/supabase/client";

const BUCKET = "produtos-imagens";
const ACCEPTED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_SIZE = 2 * 1024 * 1024;

export interface UploadProdutoImagemResult {
  publicUrl: string;
  path: string;
}

export class UploadProdutoImagemError extends Error {
  code: "INVALID_TYPE" | "TOO_LARGE" | "INVALID_CODIGO" | "UPLOAD_FAILED";
  constructor(code: UploadProdutoImagemError["code"], message: string) {
    super(message);
    this.name = "UploadProdutoImagemError";
    this.code = code;
  }
}

/**
 * Faz upload da imagem para o bucket produtos-imagens. Path derivado do código (não do filename).
 * @param codigo - SKU do produto (ex: 'AU001', 'LM2847'). Usado como prefixo do path.
 * @param file - File do <input type="file">
 * @returns publicUrl + path no bucket
 */
export async function uploadProdutoImagem(
  codigo: string,
  file: File,
): Promise<UploadProdutoImagemResult> {
  // 1. Validar codigo (alfanumérico + hífen — defesa em profundidade contra path traversal)
  const codigoTrim = codigo.trim();
  if (!codigoTrim || !/^[A-Za-z0-9_-]+$/.test(codigoTrim)) {
    throw new UploadProdutoImagemError(
      "INVALID_CODIGO",
      "Código inválido: apenas letras, números, hífen e underscore",
    );
  }

  // 2. Validar tipo (whitelist por extensão E mime type)
  const dot = file.name.lastIndexOf(".");
  const ext = dot >= 0 ? file.name.substring(dot).toLowerCase() : "";
  if (!ACCEPTED_EXTENSIONS.has(ext) && !ACCEPTED_TYPES.has(file.type)) {
    throw new UploadProdutoImagemError(
      "INVALID_TYPE",
      `Formato não aceito (${ext || file.type}). Use JPG, PNG ou WEBP.`,
    );
  }

  // 3. Validar tamanho
  if (file.size > MAX_SIZE) {
    throw new UploadProdutoImagemError(
      "TOO_LARGE",
      `Arquivo excede 2MB (${(file.size / 1024 / 1024).toFixed(1)}MB).`,
    );
  }

  // 4. Path derivado do código (NÃO do filename — Pitfall path traversal)
  const safeExt = ext.replace(".", "") || "jpg";
  const path = `${codigoTrim}.${safeExt}`;

  // 5. Upload com upsert (admin pode atualizar imagem existente)
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type });

  if (upErr) {
    throw new UploadProdutoImagemError("UPLOAD_FAILED", upErr.message);
  }

  // 6. Public URL
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { publicUrl: data.publicUrl, path };
}
