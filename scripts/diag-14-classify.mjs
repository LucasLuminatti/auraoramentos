// Classificação refinada Phase 14 — lê diag-14-out.json e separa os nulls que
// REALMENTE pertencem aos seletores perfil/driver/fita (escondidos hoje) dos
// acessórios (que já aparecem no seletor luminária mesmo com tipo null).
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const out = JSON.parse(readFileSync("scripts/diag-14-out.json", "utf8"));

// reconstruir lista plana de todos os variants null/invalidos a partir do queryB
const flat = [];
for (const g of out.queryB) {
  for (const cod of g.codigos) flat.push({ codigo: cod, cat: g.cat, fam: g.fam, tipo: g.tipo });
}
// precisamos da descrição → re-fetch só descricoes (rápido) via service role
for (const f of [".env", ".env.local"]) {
  try { for (const l of readFileSync(f, "utf8").split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/); if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); } } catch {}
}
const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
async function fetchAll(t, c) { const r = []; let from = 0; for (;;) { const { data, error } = await sb.from(t).select(c).range(from, from + 999); if (error) throw error; if (!data?.length) break; r.push(...data); if (data.length < 1000) break; from += 1000; } return r; }
const variants = await fetchAll("product_variants", "codigo,descricao,tipo_produto,familia_perfil,sistema");
const byCod = new Map(variants.map((v) => [v.codigo, v]));

const ACESSORIO_PERFIL = /DIFUSOR|KIT|ACABAMENTO|\bTAMPA\b|CONECTOR|FIXA[ÇC]|SUPORTE|TERMINAL|UNI[ãa]o|EMENDA|PERFIL.*EMB UNILATERAL/i;
const isNull = (v) => v.tipo_produto === null;

const cand = { perfil: [], driver: [], fita: [], acessorioPerfil: [], spotWW: [], outros: [] };
for (const v of variants) {
  if (!isNull(v)) continue;
  const d = (v.descricao || "").toUpperCase();
  if (/^SPOT\b.*WALL WASHER/.test(d)) { cand.spotWW.push(v); continue; }
  if (/^PERFIL\b/.test(d) && !ACESSORIO_PERFIL.test(d)) { cand.perfil.push(v); continue; }
  if (/\bPERFIL\b/.test(d) && (ACESSORIO_PERFIL.test(d) || !/^PERFIL\b/.test(d))) { cand.acessorioPerfil.push(v); continue; }
  if (/^DRIVER\b|^FONTE\b/.test(d)) { cand.driver.push(v); continue; }
  if (/^FITA\b|^MANGUEIRA\b/.test(d)) { cand.fita.push(v); continue; }
}

const fmt = (arr) => arr.map((v) => v.codigo).sort();
console.log("=== TIER 1 (escondidos do seletor — fix funcional) ===");
console.log(`\nPERFIL real (null → 'perfil'): ${cand.perfil.length}`);
for (const v of cand.perfil.sort((a,b)=>a.codigo.localeCompare(b.codigo))) console.log(`  ${v.codigo} | ${v.descricao}`);
console.log(`\nDRIVER/FONTE real (null → 'driver'): ${cand.driver.length}`);
for (const v of cand.driver) console.log(`  ${v.codigo} | ${v.descricao}`);
console.log(`\nFITA real (null → 'fita'): ${cand.fita.length}`);
for (const v of cand.fita) console.log(`  ${v.codigo} | ${v.descricao}`);

console.log("\n=== TIER 2 (acessórios/spots — já aparecem no seletor luminária; mudança só semântica) ===");
console.log(`\nAcessórios de perfil (DIFUSOR/KIT/CONECTOR/etc, null): ${cand.acessorioPerfil.length}  [proposto: 'acessorio' — OPCIONAL]`);
for (const v of cand.acessorioPerfil.sort((a,b)=>a.codigo.localeCompare(b.codigo)).slice(0,12)) console.log(`  ${v.codigo} | ${v.descricao}`);
if (cand.acessorioPerfil.length>12) console.log(`  ... +${cand.acessorioPerfil.length-12}`);
console.log(`\nSPOT EMBUTIR WALL WASHER (null): ${cand.spotWW.length}  [proposto: 'spot' — OPCIONAL]`);
for (const v of cand.spotWW) console.log(`  ${v.codigo} | ${v.descricao}`);

console.log("\n=== Lookups UAT diretos ===");
for (const cod of ["LM3291","LM3475","LM3477","LM3479"]) {
  const v = byCod.get(cod);
  console.log(`  ${cod}: ${v ? `tipo=${v.tipo_produto} | sist=${v.sistema} | fam=${v.familia_perfil} | ${v.descricao}` : "NÃO ENCONTRADO"}`);
}
// Exportar listas tier1 pro plano 02
import { writeFileSync } from "node:fs";
writeFileSync("scripts/diag-14-tier1.json", JSON.stringify({
  perfil: fmt(cand.perfil), driver: fmt(cand.driver), fita: fmt(cand.fita),
  acessorioPerfil: fmt(cand.acessorioPerfil), spotWW: fmt(cand.spotWW),
}, null, 2));
