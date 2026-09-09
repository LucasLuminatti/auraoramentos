// Diagnóstico Phase 14 (CAT-01/CAT-02) — read-only contra prod.
// Roda Queries A-D do 14-RESEARCH.md fazendo a agregação em JS (PostgREST + service role).
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

// Carrega .env e .env.local (mesmo padrão do playwright.config.ts).
for (const f of [".env", ".env.local"]) {
  try {
    for (const line of readFileSync(f, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {}
}

const URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) throw new Error("Faltam VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
const sb = createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });

const VALIDOS = ["fita", "driver", "perfil", "spot", "lampada", "acessorio", "conector", "suporte"];

async function fetchAll(table, cols) {
  const rows = [];
  let from = 0;
  const page = 1000;
  for (;;) {
    const { data, error } = await sb.from(table).select(cols).range(from, from + page - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < page) break;
    from += page;
  }
  return rows;
}

const variants = await fetchAll("product_variants", "id,product_id,codigo,descricao,tipo_produto,familia_perfil,sistema");
const products = await fetchAll("products", "id,categoria");
const catById = new Map(products.map((p) => [p.id, p.categoria]));

// Query A — baseline count por tipo_produto
const a = new Map();
for (const v of variants) {
  const k = v.tipo_produto === null ? "(null)" : v.tipo_produto;
  a.set(k, (a.get(k) || 0) + 1);
}

// Query B — null/invalidos agrupados por (categoria, familia_perfil, tipo_atual)
const isInvalido = (t) => t === null || !VALIDOS.includes(t);
const bMap = new Map();
for (const v of variants) {
  if (!isInvalido(v.tipo_produto)) continue;
  const cat = catById.get(v.product_id) ?? "(sem categoria)";
  const fam = v.familia_perfil ?? "(sem familia)";
  const tipo = v.tipo_produto === null ? "(null)" : v.tipo_produto;
  const key = `${cat}|||${fam}|||${tipo}`;
  if (!bMap.has(key)) bMap.set(key, { cat, fam, tipo, qtd: 0, exCod: null, exDesc: null, codigos: [] });
  const g = bMap.get(key);
  g.qtd++;
  g.codigos.push(v.codigo);
  if (g.exCod === null || (v.codigo && v.codigo < g.exCod)) { g.exCod = v.codigo; }
  if (g.exDesc === null || (v.descricao && v.descricao < g.exDesc)) { g.exDesc = v.descricao; }
}
const bGroups = [...bMap.values()].sort((x, y) => y.qtd - x.qtd);

// Query C — familias conhecidas do UAT
const cPat = ["WALL WASHER", "CANTONEIRA", "LM3475", "LM3291"];
const cRows = variants
  .filter((v) => cPat.some((p) => (v.descricao || "").toUpperCase().includes(p)))
  .sort((x, y) => (x.descricao || "").localeCompare(y.descricao || ""));

// Query D — MAGNETO root cause
const dRows = variants
  .filter((v) => (v.descricao || "").toUpperCase().includes("MAGNETO") || ["magneto_48v", "tiny_magneto"].includes(v.sistema))
  .sort((x, y) => `${x.sistema}`.localeCompare(`${y.sistema}`) || (x.descricao || "").localeCompare(y.descricao || ""));

// Persistir resultado completo em JSON pro passo seguinte montar o markdown.
import { writeFileSync } from "node:fs";
const out = {
  total: { total_variants: variants.length, total_products: products.length },
  queryA: [...a.entries()].sort(),
  queryB: bGroups.map((g) => ({ cat: g.cat, fam: g.fam, tipo: g.tipo, qtd: g.qtd, exCod: g.exCod, exDesc: g.exDesc, codigos: g.codigos })),
  queryC: cRows.map((v) => ({ codigo: v.codigo, descricao: v.descricao, tipo_produto: v.tipo_produto, familia_perfil: v.familia_perfil, sistema: v.sistema })),
  queryD: dRows.map((v) => ({ codigo: v.codigo, descricao: v.descricao, tipo_produto: v.tipo_produto, sistema: v.sistema, familia_perfil: v.familia_perfil })),
};
writeFileSync("scripts/diag-14-out.json", JSON.stringify(out, null, 2));

// Resumo compacto pro stdout (sem os arrays gigantes de codigos).
console.log("===QUERY_A (baseline)===");
for (const [k, n] of out.queryA) console.log(`  ${k.padEnd(12)} ${n}`);
console.log("\n===QUERY_B (grupos null/invalido) — só grupos COM familia_perfil OU categoria conhecida===");
console.log("  qtd | familia_perfil | categoria | tipo_atual | exemplo");
for (const g of bGroups) {
  const relevante = g.fam !== "(sem familia)" || g.cat !== "(sem categoria)";
  if (!relevante) continue;
  console.log(`  ${String(g.qtd).padStart(4)} | ${g.fam} | ${g.cat} | ${g.tipo} | ${g.exCod} ${(g.exDesc || "").slice(0, 45)}`);
}
const semFamGroup = bGroups.find((g) => g.fam === "(sem familia)" && g.cat === "(sem categoria)");
console.log(`\n  [grupo "(sem familia)/(sem categoria)" tipo null: ${semFamGroup?.qtd || 0} SKUs — luminárias gerais, aparecem no seletor luminária; NÃO mexer salvo exceção]`);
console.log("\n===QUERY_C (familias do UAT)===");
for (const v of cRows) console.log(`  ${v.codigo} | tipo=${v.tipo_produto} | fam=${v.familia_perfil} | sist=${v.sistema} | ${v.descricao}`);
console.log("\n===QUERY_D (MAGNETO)===");
for (const v of dRows) console.log(`  ${v.codigo} | tipo=${v.tipo_produto} | sist=${v.sistema} | fam=${v.familia_perfil} | ${v.descricao}`);
console.log(`\n===TOTAL: ${variants.length} variants, ${products.length} products===`);
