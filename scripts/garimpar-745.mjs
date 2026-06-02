/**
 * Garimpo dos produtos SEM foto: procura o código em QUALQUER parte do caminho
 * (subpasta, meio do nome) — não só no basename. Recupera fotos onde o código
 * está numa pasta nomeada por produto ou embutido no meio do arquivo.
 *
 * Só considera path que refere a EXATAMENTE 1 produto vazio (sem ambiguidade de kit).
 *
 * Uso:
 *   node scripts/garimpar-745.mjs                        # DRY-RUN
 *   node scripts/garimpar-745.mjs --apply                # sobe os candidatos únicos
 *   IMG_DIR="C:/.../Base Imagens" node scripts/garimpar-745.mjs ...
 */

import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

const APPLY = process.argv.includes("--apply");
const ROOT = path.resolve(import.meta.dirname, "..");
const IMG_DIR = process.env.IMG_DIR || "C:/Users/lenny/Desktop/Luminatti/Base Imagens";
const BUCKET = "produtos-imagens";
const MAX_SIZE = 2 * 1024 * 1024;
const CONCURRENCY = 12;
const CODE_RE = /(LM|OR|AU)\s*0*(\d{2,6})/gi;

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
if (!SUPABASE_URL || !SERVICE_KEY) { console.error("✗ Falta env"); process.exit(1); }
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

// banco: byUpper (todos) + vazios (upper sem imagem)
async function fetchBanco() {
  const byUpper = new Map(), vazios = new Set();
  let from = 0; const page = 1000;
  for (;;) {
    const { data, error } = await supabase.from("product_variants").select("codigo,imagem_url").range(from, from + page - 1);
    if (error) throw error;
    if (!data?.length) break;
    for (const r of data) if (r.codigo) {
      const u = String(r.codigo).trim().toUpperCase();
      byUpper.set(u, r.codigo);
      if (!r.imagem_url) vazios.add(u);
    }
    if (data.length < page) break;
    from += page;
  }
  return { byUpper, vazios };
}

function walkImages(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walkImages(full));
    else if (/\.(png|jpe?g|webp)$/i.test(e.name)) out.push(full);
  }
  return out;
}

// extrai códigos válidos do path INTEIRO (relativo ao IMG_DIR pra não pegar lixo do prefixo)
function codigosNoPath(fullPath, byUpper) {
  const rel = path.relative(IMG_DIR, fullPath).toUpperCase();
  const found = new Set();
  let m; CODE_RE.lastIndex = 0;
  while ((m = CODE_RE.exec(rel))) {
    const cod = (m[1] + m[2]).toUpperCase();
    if (byUpper.has(cod)) found.add(byUpper.get(cod));
  }
  return [...found];
}

async function readMaybeCompress(filePath) {
  let buf = fs.readFileSync(filePath);
  let compressed = false;
  if (buf.length > MAX_SIZE) {
    for (const width of [1600, 1200, 900]) {
      buf = await sharp(fs.readFileSync(filePath)).resize({ width, height: width, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer();
      compressed = true;
      if (buf.length <= MAX_SIZE) break;
    }
  }
  return { buf, compressed };
}

async function uploadOne(codigo, filePath) {
  let ext = (path.extname(filePath).slice(1) || "jpg").toLowerCase();
  let { buf, compressed } = await readMaybeCompress(filePath);
  if (compressed) ext = "jpg"; // recomprimido vira jpg
  const objectPath = `${codigo}.${ext}`;
  const ct = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
  const { error: upErr } = await supabase.storage.from(BUCKET).upload(objectPath, buf, { upsert: true, contentType: ct });
  if (upErr) throw new Error(`storage: ${upErr.message}`);
  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(objectPath);
  const { error: dbErr } = await supabase.from("product_variants").update({ imagem_url: urlData.publicUrl }).eq("codigo", codigo);
  if (dbErr) throw new Error(`db: ${dbErr.message}`);
}

async function runPool(items, worker) {
  let i = 0, ok = 0; const errors = [];
  async function next() {
    while (i < items.length) {
      const idx = i++; const [codigo, file] = items[idx];
      try { await worker(codigo, file); ok++; if (ok % 50 === 0) console.log(`  ... ${ok}/${items.length}`); }
      catch (e) { errors.push({ codigo, file: path.basename(file), reason: e.message }); }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, next));
  return { ok, errors };
}

// ---- main ----
console.log(`Pasta: ${IMG_DIR}`);
console.log(`Modo: ${APPLY ? "APLICAR" : "DRY-RUN"}\n`);
const { byUpper, vazios } = await fetchBanco();
console.log(`Produtos SEM foto (alvo): ${vazios.size}`);
const files = walkImages(IMG_DIR);
console.log(`Arquivos varridos: ${files.length}\n`);

// pra cada path: códigos válidos no path. Só interessa se refere a 1 produto VAZIO.
const candPorVazio = new Map(); // codigoVazio -> [paths]
let ambiguos = 0;
for (const f of files) {
  const cods = codigosNoPath(f, byUpper);
  const cVazios = cods.filter((c) => vazios.has(c.toUpperCase()));
  if (cVazios.length === 1 && cods.length === 1) {
    const c = cVazios[0];
    if (!candPorVazio.has(c)) candPorVazio.set(c, []);
    candPorVazio.get(c).push(f);
  } else if (cVazios.length >= 1 && cods.length > 1) {
    ambiguos++;
  }
}

console.log(`Vazios COM candidato (recuperável): ${candPorVazio.size}`);
console.log(`Vazios ainda SEM nenhuma foto: ${vazios.size - candPorVazio.size}`);
console.log(`(paths ambíguos com >1 código, ignorados: ${ambiguos})\n`);

console.log("Exemplos de recuperação:");
let n = 0;
for (const [c, paths] of candPorVazio) {
  console.log(`  ${c}  ←  ${path.relative(IMG_DIR, paths[0])}${paths.length > 1 ? `  (+${paths.length - 1} outros)` : ""}`);
  if (++n >= 20) break;
}
console.log("");

// 1 path por código vazio (o primeiro)
const items = [...candPorVazio.entries()].map(([c, paths]) => [c, paths[0]]);

if (!APPLY) { console.log(`DRY-RUN: ${items.length} seriam subidos. Rode com --apply.`); process.exit(0); }

console.log(`Subindo ${items.length} fotos garimpadas...`);
const { ok, errors } = await runPool(items, uploadOne);
console.log(`\n=== RESULTADO ===\n✓ Enviados: ${ok}\n✗ Erros: ${errors.length}`);
for (const e of errors.slice(0, 20)) console.log(`  ${e.codigo} (${e.file}): ${e.reason}`);
