/**
 * Upload em massa de imagens de produto para o bucket Supabase `produtos-imagens`.
 *
 * Replica a lógica da UI (src/components/ImportImagens.tsx + src/lib/uploadProdutoImagem.ts):
 *   - bucket: produtos-imagens
 *   - path: `<codigo>.<ext>` (código real do banco)
 *   - upsert: true, URL pública, depois UPDATE product_variants.imagem_url WHERE codigo
 *
 * Melhorias sobre a UI:
 *   - match CASE-INSENSITIVE (a UI perde arquivos minúsculos como lm1021.png)
 *   - recupera código embutido no nome (LM240-SAP865 -> LM240) quando há exatamente 1 código válido
 *   - comprime arquivos > 2MB com sharp (a UI rejeita; PDF base64 não aguenta foto de 60MB)
 *
 * Uso:
 *   node scripts/upload-imagens.mjs            # DRY-RUN (só mostra o plano)
 *   node scripts/upload-imagens.mjs --apply    # sobe de verdade
 *
 * Requer SUPABASE_SERVICE_ROLE_KEY em .env.local (key secreta, bypassa RLS).
 */

import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

const APPLY = process.argv.includes("--apply");
const SKIP_EXISTING = process.argv.includes("--skip-existing");
const ROOT = path.resolve(import.meta.dirname, "..");
const IMG_DIR =
  process.env.IMG_DIR ||
  "R:/Marketing/1_MARKETING 2.0/LM_02_FOTO DE PRODUTO/PNG";
const BUCKET = "produtos-imagens";
const MAX_SIZE = 2 * 1024 * 1024; // 2MB — acima disso, comprime
const CONCURRENCY = 12;
const CODE_RE = /(LM|OR|AU)\s*0*(\d{2,6})/gi;

// ---------- env ----------
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

if (!SUPABASE_URL) { console.error("✗ Falta VITE_SUPABASE_URL no .env"); process.exit(1); }
if (!SERVICE_KEY) {
  console.error("✗ Falta SUPABASE_SERVICE_ROLE_KEY no .env.local");
  console.error("  Pegue em: Supabase Dashboard → Settings → API → service_role (Reveal)");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ---------- 1. códigos do banco ----------
async function fetchCodigos() {
  const byUpper = new Map(); // UPPER -> código real
  const comImg = new Set(); // código real que JÁ tem imagem_url
  let from = 0;
  const page = 1000;
  for (;;) {
    const { data, error } = await supabase
      .from("product_variants")
      .select("codigo,imagem_url")
      .range(from, from + page - 1);
    if (error) throw error;
    if (!data?.length) break;
    for (const r of data)
      if (r.codigo) {
        byUpper.set(String(r.codigo).trim().toUpperCase(), r.codigo);
        if (r.imagem_url) comImg.add(r.codigo);
      }
    if (data.length < page) break;
    from += page;
  }
  return { byUpper, comImg };
}

// ---------- 2. classificar arquivos ----------
function codigosEmbutidos(nameUpper, byUpper) {
  const found = new Set();
  let m;
  CODE_RE.lastIndex = 0;
  while ((m = CODE_RE.exec(nameUpper))) {
    const cod = (m[1] + m[2]).toUpperCase();
    if (byUpper.has(cod)) found.add(byUpper.get(cod));
  }
  return [...found];
}

function classify(files, byUpper) {
  const assign = new Map(); // códigoReal -> { file, via }
  const skipped = []; // { file, reason }
  const recovered = [];

  // passo 1: match exato (case-insensitive) tem prioridade
  const leftovers = [];
  for (const file of files) {
    const base = path.basename(file, path.extname(file)).trim();
    const real = byUpper.get(base.toUpperCase());
    if (real) {
      if (!assign.has(real)) assign.set(real, { file, via: "exato" });
      // dup pro mesmo código: mantém o primeiro, ignora em silêncio
    } else {
      leftovers.push(file);
    }
  }

  // passo 2: recuperar código embutido (só 1 código válido, e ainda não atribuído)
  for (const file of leftovers) {
    const nameUpper = path.basename(file).toUpperCase();
    const cods = codigosEmbutidos(nameUpper, byUpper);
    if (cods.length === 1) {
      const real = cods[0];
      if (!assign.has(real)) { assign.set(real, { file, via: "recuperado" }); recovered.push({ file, real }); }
      else skipped.push({ file, reason: `código ${real} já coberto por outro arquivo` });
    } else if (cods.length > 1) {
      skipped.push({ file, reason: `múltiplos códigos (kit): ${cods.join(", ")}` });
    } else {
      skipped.push({ file, reason: "sem código reconhecível no nome" });
    }
  }
  return { assign, skipped, recovered };
}

// ---------- 3. comprimir se grande ----------
const MIME = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp" };

async function readMaybeCompress(filePath) {
  const stat = fs.statSync(filePath);
  const srcExt = (path.extname(filePath).slice(1) || "png").toLowerCase();
  let buf = fs.readFileSync(filePath);
  let compressed = false;
  let ext = srcExt;
  if (buf.length > MAX_SIZE) {
    // recomprime como JPEG (extensão E bytes batem) — evita PNG bytes sob nome .jpg
    for (const width of [1600, 1200, 900]) {
      buf = await sharp(fs.readFileSync(filePath))
        .resize({ width, height: width, fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 82 })
        .toBuffer();
      compressed = true;
      ext = "jpg";
      if (buf.length <= MAX_SIZE) break;
    }
  }
  return { buf, compressed, ext, originalSize: stat.size, finalSize: buf.length };
}

// ---------- 4. upload + update ----------
async function uploadOne(codigo, filePath) {
  const { buf, compressed, ext, originalSize, finalSize } = await readMaybeCompress(filePath);
  const objectPath = `${codigo}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(objectPath, buf, { upsert: true, contentType: MIME[ext] || "image/jpeg" });
  if (upErr) throw new Error(`storage: ${upErr.message}`);
  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(objectPath);
  const { error: dbErr } = await supabase
    .from("product_variants")
    .update({ imagem_url: urlData.publicUrl })
    .eq("codigo", codigo);
  if (dbErr) throw new Error(`db: ${dbErr.message}`);
  return { compressed, originalSize, finalSize };
}

async function runPool(items, worker) {
  let i = 0, ok = 0;
  const errors = [];
  let compressedCount = 0;
  async function next() {
    while (i < items.length) {
      const idx = i++;
      const [codigo, { file }] = items[idx];
      try {
        const r = await worker(codigo, file);
        ok++;
        if (r.compressed) compressedCount++;
        if (ok % 100 === 0) console.log(`  ... ${ok}/${items.length} enviados`);
      } catch (e) {
        errors.push({ codigo, file: path.basename(file), reason: e.message });
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, next));
  return { ok, errors, compressedCount };
}

// ---------- main ----------
const t0 = Date.now();
console.log(`Pasta: ${IMG_DIR}`);
console.log(`Modo: ${APPLY ? "APLICAR (sobe de verdade)" : "DRY-RUN (só plano)"}\n`);

if (!fs.existsSync(IMG_DIR)) { console.error(`✗ Pasta não encontrada: ${IMG_DIR}`); process.exit(1); }

function walkImages(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkImages(full));
    else if (/\.(png|jpe?g|webp)$/i.test(entry.name)) out.push(full);
  }
  return out;
}
const files = walkImages(IMG_DIR);

console.log(`Arquivos de imagem na pasta: ${files.length}`);
const { byUpper, comImg } = await fetchCodigos();
console.log(`Códigos no banco: ${byUpper.size} (já com imagem: ${comImg.size})`);
if (SKIP_EXISTING) console.log(`Modo --skip-existing: só preenche produtos SEM foto`);
console.log("");

const { assign, skipped, recovered } = classify(files, byUpper);
const exatos = [...assign.values()].filter((v) => v.via === "exato").length;

// --skip-existing: remove de assign os códigos que já têm imagem no banco
let pulouExistente = 0;
if (SKIP_EXISTING) {
  for (const cod of [...assign.keys()]) {
    if (comImg.has(cod)) { assign.delete(cod); pulouExistente++; }
  }
}

console.log(`✓ Match exato (nome = código):     ${exatos}`);
console.log(`✓ Recuperados (código embutido):   ${recovered.length}`);
if (SKIP_EXISTING) console.log(`↷ Pulados (já tinham foto):        ${pulouExistente}`);
console.log(`→ TOTAL a subir:                   ${assign.size}`);
console.log(`✗ Ignorados (kit/sem código):      ${skipped.length}`);
console.log(`  Produtos do banco que continuam sem imagem: ${byUpper.size - comImg.size - assign.size}\n`);

if (recovered.length) {
  console.log("Exemplos de recuperados:");
  for (const r of recovered.slice(0, 12)) console.log(`  ${path.basename(r.file)}  →  ${r.real}`);
  console.log("");
}
if (skipped.length) {
  console.log("Exemplos de ignorados:");
  for (const s of skipped.slice(0, 12)) console.log(`  ${path.basename(s.file)}  —  ${s.reason}`);
  console.log("");
}

const items = [...assign.entries()];

if (!APPLY) {
  console.log("DRY-RUN: nada foi enviado. Rode com --apply para subir.");
  process.exit(0);
}

console.log(`Subindo ${items.length} imagens (concorrência ${CONCURRENCY})...`);
const { ok, errors, compressedCount } = await runPool(items, uploadOne);
console.log(`\n=== RESULTADO ===`);
console.log(`✓ Enviados com sucesso: ${ok}`);
console.log(`  (comprimidos por excederem 2MB: ${compressedCount})`);
console.log(`✗ Erros: ${errors.length}`);
for (const e of errors.slice(0, 25)) console.log(`  ${e.codigo} (${e.file}): ${e.reason}`);
console.log(`\nTempo: ${((Date.now() - t0) / 1000).toFixed(1)}s`);
