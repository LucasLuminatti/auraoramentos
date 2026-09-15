import { test, expect, request } from "@playwright/test";
import { admin } from "./helpers/supabaseAdmin";

/**
 * Acervo de imagens de produto no bucket público `produtos-imagens`.
 * Valida que as URLs públicas servem imagem de verdade (a carga em massa funcionou)
 * e que a maioria do catálogo tem foto.
 */
const SUPA = process.env.VITE_SUPABASE_URL || "https://jkewlaezvrbuicmncqbj.supabase.co";
const ANON = process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;
const BUCKET = `${SUPA}/storage/v1/object/public/produtos-imagens`;

// produtos que sabidamente receberam foto na carga (jpg do portal)
const COM_FOTO = ["LM029", "LM040", "LM2397"];

test("imagens públicas de produto servem 200 + content-type image/*", async () => {
  const ctx = await request.newContext();
  for (const cod of COM_FOTO) {
    const res = await ctx.get(`${BUCKET}/${cod}.jpg`);
    expect(res.status(), `${cod}.jpg deve existir`).toBe(200);
    expect(res.headers()["content-type"], `${cod} deve ser imagem`).toMatch(/^image\//);
  }
  await ctx.dispose();
});

test("cobertura de fotos do catálogo é alta (>= 75%)", async () => {
  // O catálogo deixou de ser legível sem login (auditoria de segurança 2026-09-15), então a
  // contagem passa pela service role dos helpers em vez da chave pública.
  const sb = admin();
  const contar = async (comFoto: boolean) => {
    const q = sb.from("product_variants").select("id", { count: "exact", head: true });
    const { count, error } = comFoto ? await q.not("imagem_url", "is", null) : await q;
    if (error) throw new Error(`contagem falhou: ${error.message}`);
    return count ?? 0;
  };
  const total = await contar(false);
  const comFoto = await contar(true);
  expect(total, "catálogo não vazio").toBeGreaterThan(0);
  const pct = comFoto / total;
  expect(pct, `cobertura ${comFoto}/${total} = ${(pct * 100).toFixed(1)}%`).toBeGreaterThanOrEqual(0.75);
});

test("catálogo não é legível sem login (RLS)", async () => {
  const ctx = await request.newContext();
  const res = await ctx.get(`${SUPA}/rest/v1/product_variants?select=id`, {
    headers: { apikey: ANON, Authorization: `Bearer ${ANON}` },
  });
  expect(res.status(), "chave pública sozinha não deve ler o catálogo").toBe(401);
  await ctx.dispose();
});

test("URL de produto inexistente não serve imagem", async () => {
  const ctx = await request.newContext();
  const res = await ctx.get(`${BUCKET}/PRODUTO_QUE_NAO_EXISTE_ZZZ.jpg`);
  expect(res.status()).toBeGreaterThanOrEqual(400);
  await ctx.dispose();
});
