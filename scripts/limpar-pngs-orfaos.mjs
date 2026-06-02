/**
 * Limpa do bucket `produtos-imagens` os arquivos .png que não são mais
 * referenciados por nenhum product_variants.imagem_url (órfãos após a troca PNG→JPG).
 *
 * SEGURO: só apaga .png cujo path NÃO aparece em nenhum imagem_url do banco.
 * Preserva qualquer .png ainda em uso.
 *
 * Uso:
 *   node scripts/limpar-pngs-orfaos.mjs            # DRY-RUN (lista o que apagaria)
 *   node scripts/limpar-pngs-orfaos.mjs --apply    # apaga de verdade
 *
 * Requer SUPABASE_SERVICE_ROLE_KEY em .env.local.
 */

import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

const APPLY = process.argv.includes("--apply");
const ROOT = path.resolve(import.meta.dirname, "..");
const BUCKET = "produtos-imagens";

function loadEnv(file) {
  const out = {};
  try {
    for (const line of fs.readFileSync(path.join(ROOT, file), "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {}
  return out;
}
const env = { ...loadEnv(".env"), ...loadEnv(".env.local") };
const SUPABASE_URL = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) { console.error("✗ Falta VITE_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY"); process.exit(1); }

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

// 1. paths .png ainda referenciados no banco
async function referencedPngPaths() {
  const refs = new Set();
  let from = 0;
  const page = 1000;
  for (;;) {
    const { data, error } = await supabase
      .from("product_variants")
      .select("imagem_url")
      .ilike("imagem_url", "%.png") // ilike: pega .png E .PNG
      .range(from, from + page - 1);
    if (error) throw error;
    if (!data?.length) break;
    for (const r of data) if (r.imagem_url) refs.add(normName(r.imagem_url));
    if (data.length < page) break;
    from += page;
  }
  return refs;
}

// Normaliza um path/URL para o nome do objeto: tira query/hash, pega o basename,
// decodifica (à prova de %  malformado) e baixa pra minúsculo. Comparação à prova
// de case e query-string — evita apagar imagem em uso.
function normName(s) {
  const noQuery = String(s).split(/[?#]/)[0];
  const base = noQuery.split("/").pop() || "";
  let decoded = base;
  try { decoded = decodeURIComponent(base); } catch { /* mantém cru se % inválido */ }
  return decoded.toLowerCase();
}

// 2. lista todos os .png no bucket
async function allPngObjects() {
  const names = [];
  let offset = 0;
  const limit = 1000;
  for (;;) {
    const { data, error } = await supabase.storage.from(BUCKET).list("", { limit, offset, sortBy: { column: "name", order: "asc" } });
    if (error) throw error;
    if (!data?.length) break;
    for (const o of data) if (/\.png$/i.test(o.name)) names.push(o.name);
    if (data.length < limit) break;
    offset += limit;
  }
  return names;
}

const refs = await referencedPngPaths();
const pngs = await allPngObjects();
// compara normalizado (case-insensitive) — refs já está normalizado por normName
const orfaos = pngs.filter((n) => !refs.has(normName(n)));

console.log(`Modo: ${APPLY ? "APLICAR (apaga)" : "DRY-RUN (só lista)"}`);
console.log(`.png no bucket: ${pngs.length}`);
console.log(`.png ainda referenciados (preservar): ${refs.size}`);
console.log(`.png ÓRFÃOS (apagar): ${orfaos.length}\n`);
console.log("Amostra a apagar:", JSON.stringify(orfaos.slice(0, 15)));
if (refs.size) console.log("Preservados:", JSON.stringify([...refs].slice(0, 10)));

if (!APPLY) { console.log("\nDRY-RUN: nada apagado. Rode com --apply."); process.exit(0); }

let apagados = 0;
for (let i = 0; i < orfaos.length; i += 100) {
  const batch = orfaos.slice(i, i + 100);
  const { error } = await supabase.storage.from(BUCKET).remove(batch);
  if (error) { console.error(`Erro no lote ${i}:`, error.message); continue; }
  apagados += batch.length;
  console.log(`  ... ${apagados}/${orfaos.length} apagados`);
}
console.log(`\n✓ Órfãos apagados: ${apagados}`);
