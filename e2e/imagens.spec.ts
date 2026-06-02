import { test, expect, request } from "@playwright/test";

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
  const ctx = await request.newContext();
  const countOf = async (filtro: string) => {
    const res = await ctx.get(`${SUPA}/rest/v1/product_variants?select=id${filtro}`, {
      headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, Prefer: "count=exact", Range: "0-0" },
    });
    expect(res.status()).toBeLessThan(300);
    return Number((res.headers()["content-range"] || "").split("/")[1] || "0");
  };
  const total = await countOf("");
  const comFoto = await countOf("&imagem_url=not.is.null");
  expect(total, "catálogo não vazio").toBeGreaterThan(0);
  const pct = comFoto / total;
  expect(pct, `cobertura ${comFoto}/${total} = ${(pct * 100).toFixed(1)}%`).toBeGreaterThanOrEqual(0.75);
  await ctx.dispose();
});

test("URL de produto inexistente não serve imagem", async () => {
  const ctx = await request.newContext();
  const res = await ctx.get(`${BUCKET}/PRODUTO_QUE_NAO_EXISTE_ZZZ.jpg`);
  expect(res.status()).toBeGreaterThanOrEqual(400);
  await ctx.dispose();
});
