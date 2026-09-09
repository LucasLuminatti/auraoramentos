/**
 * Aplica a conferência de catálogo 2026 (Conferencia catalogo 2.xlsx) ao banco.
 *
 * Escopo (decidido com o Lenny):
 *   1. Refrescar descricao + nome dos 2088 SKUs master com as descrições ricas do Excel.
 *   2. Gravar EAN/categoria/familia/subfamilia do catálogo em atributos jsonb (MERGE, não clobber).
 *   3. Aplicar as 27 correções de EAN (Planilha2) sobre atributos.ean.
 *   4. Inativar (ativo=false) os 102 SKUs legado marcados "Remover" (Planilha3).
 *
 * NUNCA toca: preco_tabela, preco_minimo, tensao, watts_por_metro, potencia_watts,
 *             largura_mm, cor, tipo_produto, sistema, familia_perfil, imagem_url, arquiteto_id.
 *
 * Uso:
 *   node scripts/migracao-catalogo-2026/03-aplicar.mjs            # DRY-RUN (não escreve)
 *   node scripts/migracao-catalogo-2026/03-aplicar.mjs --apply    # backup + escreve
 *
 * --apply requer que a migration 20260602000001 (coluna ativo) já esteja aplicada.
 */
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

const APPLY = process.argv.includes("--apply");
const HERE = import.meta.dirname;
const ROOT = path.resolve(HERE, "../..");
const BATCH = 200;

function loadEnv(f) {
  const o = {};
  try {
    for (const l of fs.readFileSync(path.join(ROOT, f), "utf8").split(/\r?\n/)) {
      const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (m) o[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {}
  return o;
}
const env = { ...loadEnv(".env"), ...loadEnv(".env.local") };
const sb = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const norm = (s) => (s == null ? null : String(s).trim().toUpperCase());

// ---- carrega Excel extraído + DB atual ----
const excel = JSON.parse(fs.readFileSync(path.join(HERE, "excel-extract.json"), "utf8"));
const catByCode = new Map(excel.catalogo.map((r) => [norm(r.codigo), r]));
const eanFix = new Map(excel.ean_fix.map((r) => [norm(r.codigo), r.ean_correto]));
const removerSet = new Set(excel.remover.map(norm));

async function fetchVariants() {
  const all = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb
      .from("product_variants")
      .select("id, codigo, descricao, nome, atributos, origem")
      .range(from, from + 999);
    if (error) throw new Error("fetch variants: " + error.message);
    all.push(...data);
    if (data.length < 1000) break;
  }
  return all;
}

const variants = await fetchVariants();
const dbByCode = new Map(variants.map((v) => [norm(v.codigo), v]));

// ---- monta os updates ----
const descUpdates = []; // {id, codigo, descricao, atributos}
let descChanged = 0, atribChanged = 0, eanFixApplied = 0;

for (const [code, cat] of catByCode) {
  const v = dbByCode.get(code);
  if (!v) continue; // não deveria acontecer (todos os 2088 existem), mas seguro

  const novaDesc = cat.desc || v.descricao;
  const eanFinal = eanFix.get(code) ?? cat.ean_cadastro ?? cat.ean_catalogo ?? null;
  if (eanFix.has(code)) eanFixApplied++;

  const atribAntigo = v.atributos && typeof v.atributos === "object" ? v.atributos : {};
  const atribNovo = {
    ...atribAntigo,
    ean: eanFinal,
    ean_catalogo: cat.ean_catalogo ?? null,
    categoria_catalogo: cat.categoria ?? null,
    familia_catalogo: cat.familia ?? null,
    subfamilia_catalogo: cat.subfamilia ?? null,
  };

  const descDiff = novaDesc && novaDesc !== v.descricao;
  const atribDiff = JSON.stringify(atribNovo) !== JSON.stringify(atribAntigo);
  if (!descDiff && !atribDiff) continue;
  if (descDiff) descChanged++;
  if (atribDiff) atribChanged++;

  descUpdates.push({
    id: v.id,
    codigo: v.codigo,
    descricao: novaDesc,
    nome: novaDesc,
    atributos: atribNovo,
  });
}

// ---- inativar 102 ----
const inativarIds = [];
for (const code of removerSet) {
  const v = dbByCode.get(code);
  if (v) inativarIds.push({ id: v.id, codigo: v.codigo, origem: v.origem });
}

// ---- relatório ----
console.log("===== CONFERÊNCIA CATÁLOGO 2026 =====");
console.log(APPLY ? ">>> MODO APPLY (vai escrever) <<<" : ">>> DRY-RUN (não escreve) <<<");
console.log("variants no DB:", variants.length);
console.log("catálogo Excel:", catByCode.size);
console.log("--- UPDATES de descrição/atributos ---");
console.log("  linhas a atualizar:", descUpdates.length);
console.log("  com descrição mudada:", descChanged);
console.log("  com atributos mudados:", atribChanged);
console.log("  correções de EAN aplicadas:", eanFixApplied, "de", eanFix.size);
console.log("--- INATIVAR ---");
console.log("  SKUs a marcar ativo=false:", inativarIds.length, "de", removerSet.size, "no Excel");
console.log("  origens:", JSON.stringify(inativarIds.reduce((a, x) => ((a[x.origem] = (a[x.origem] || 0) + 1), a), {})));
console.log("--- amostra 3 updates ---");
for (const u of descUpdates.slice(0, 3)) {
  console.log("  ", u.codigo, "->", (u.descricao || "").slice(0, 60));
  console.log("       atributos.ean =", u.atributos.ean, "| categoria_catalogo =", u.atributos.categoria_catalogo);
}

if (!APPLY) {
  fs.writeFileSync(path.join(HERE, "preview-updates.json"), JSON.stringify({ descUpdates, inativarIds }, null, 2));
  console.log("\nDry-run salvo em preview-updates.json. Rode com --apply para escrever.");
  process.exit(0);
}

// ---- BACKUP antes de escrever ----
const afetados = new Set([...descUpdates.map((u) => u.id), ...inativarIds.map((x) => x.id)]);
const backup = variants.filter((v) => afetados.has(v.id));
const bkPath = path.join(HERE, `backup-${variants.length}-rows.json`);
fs.writeFileSync(bkPath, JSON.stringify(backup, null, 2));
console.log("\nBackup de", backup.length, "linhas afetadas ->", path.basename(bkPath));

// ---- 1) updates descrição/atributos (um a um: patch difere por linha) ----
let okU = 0, errU = 0;
const errs = [];
for (let i = 0; i < descUpdates.length; i++) {
  const u = descUpdates[i];
  const { error } = await sb
    .from("product_variants")
    .update({ descricao: u.descricao, nome: u.nome, atributos: u.atributos })
    .eq("id", u.id);
  if (error) { errU++; errs.push({ sku: u.codigo, reason: error.message }); }
  else okU++;
  if (i % 200 === 0) console.log(`  updates ${i}/${descUpdates.length}`);
}
console.log("updates desc/atributos: ok", okU, "| erros", errU);

// ---- 2) inativar em batch ----
let okI = 0, errI = 0;
for (let i = 0; i < inativarIds.length; i += BATCH) {
  const ids = inativarIds.slice(i, i + BATCH).map((x) => x.id);
  const { error } = await sb.from("product_variants").update({ ativo: false }).in("id", ids);
  if (error) { errI += ids.length; errs.push({ sku: "batch-inativar", reason: error.message }); }
  else okI += ids.length;
}
console.log("inativar: ok", okI, "| erros", errI);

if (errs.length) {
  fs.writeFileSync(path.join(HERE, "erros-apply.json"), JSON.stringify(errs, null, 2));
  console.log("Erros salvos em erros-apply.json");
}
console.log("\nCONCLUÍDO.");
