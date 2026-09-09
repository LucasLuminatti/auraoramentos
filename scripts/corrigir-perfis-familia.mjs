/**
 * Autorizado pelo Lenny em 2026-09-09 (itens 1 e 2):
 *
 * [1] Trik, Alojamento e Wall Washer entram com 2 PASSADAS.
 *     A família vem da coluna "Familia" da planilha do catálogo (Conferencia catalogo 2),
 *     que é o nome oficial da linha — o nome do PRODUTO não serve: o Trik se chama
 *     "PERFIL DE SOBREPOR INDIRETO" e nunca casou com a detecção por nome.
 *     Preenche `familia_perfil` com o vocabulário de `regras_compatibilidade_perfil`
 *     (trik / alojamento / wall_washer) e `passadas_padrao = 2` (RULE-102: "uma de cada
 *     lado"). No Trik e no Alojamento também grava a restrição de driver da regra
 *     (Slim, teto de 72 W — RULE-029/100), que no Trik nunca chegava a valer.
 *
 * [2] LM486/LM487 são lâmpadas AR70/AR111 cadastradas como `driver` -> `lampada`.
 *
 * Backup antes de gravar.
 *   node scripts/corrigir-perfis-familia.mjs           # DRY-RUN
 *   node scripts/corrigir-perfis-familia.mjs --apply
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "node:fs";
import * as XLSX from "xlsx";
for (const f of [".env",".env.local"]) { try { for (const l of readFileSync(f,"utf8").split(/\r?\n/)) { const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/); if(m&&!(m[1] in process.env)) process.env[m[1]]=m[2].replace(/^["']|["']$/g,""); } } catch {} }
const APPLY = process.argv.includes("--apply");
const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// família do catálogo -> família da tabela de regras ("AC" é a versão acrílica da mesma linha)
const MAPA = {
  "PERFIL TRIK": "trik",
  "PERFIL ALOJAMENTO": "alojamento",
  "PERFIL ALOJAMENTO AC": "alojamento",
  "PERFIL WALL WASHER": "wall_washer",
};

const wb = XLSX.read(readFileSync("../Conferencia catalogo 2 (1).xlsx"), { type: "buffer" });
const plan = XLSX.utils.sheet_to_json(wb.Sheets["Planilha1"], { defval: "" });
const famDoCatalogo = new Map(plan.map(r => [String(r["Código Produto"]).trim(), String(r["Familia"] || "").trim()]));

const { data: regras } = await sb.from("regras_compatibilidade_perfil").select("*");
const porFamilia = new Map((regras || []).map(r => [r.familia_perfil, r]));

const rows = []; let from = 0;
for (;;) { const { data, error } = await sb.from("product_variants").select("id,codigo,descricao,tipo_produto,familia_perfil,passadas_padrao,driver_tipo_permitido,driver_max_watts").range(from, from + 999); if (error) throw error; if (!data?.length) break; rows.push(...data); if (data.length < 1000) break; from += 1000; }

const patches = [];
for (const r of rows.filter(x => x.tipo_produto === "perfil")) {
  const alvo = MAPA[famDoCatalogo.get(r.codigo)];
  if (!alvo) continue;
  const regra = porFamilia.get(alvo);
  if (!regra) continue;
  const campos = {};
  if (r.familia_perfil !== alvo) campos.familia_perfil = alvo;
  if (regra.passadas_padrao != null && r.passadas_padrao !== regra.passadas_padrao) campos.passadas_padrao = regra.passadas_padrao;
  if (regra.driver_tipo_aceito && regra.driver_tipo_aceito !== "qualquer" && r.driver_tipo_permitido !== regra.driver_tipo_aceito) campos.driver_tipo_permitido = regra.driver_tipo_aceito;
  if (regra.driver_max_watts != null && r.driver_max_watts !== regra.driver_max_watts) campos.driver_max_watts = regra.driver_max_watts;
  if (Object.keys(campos).length) patches.push({ id: r.id, codigo: r.codigo, familia: alvo, campos, antes: { familia_perfil: r.familia_perfil, passadas_padrao: r.passadas_padrao, driver_tipo_permitido: r.driver_tipo_permitido, driver_max_watts: r.driver_max_watts } });
}

// [2] lâmpadas cadastradas como driver
for (const r of rows.filter(x => x.tipo_produto === "driver" && /^\s*(AR\d+|MR\d+|PAR\d+|DICROICA)\b/i.test(x.descricao))) {
  patches.push({ id: r.id, codigo: r.codigo, familia: "-", campos: { tipo_produto: "lampada" }, antes: { tipo_produto: r.tipo_produto } });
}

console.log(`patches: ${patches.length}`);
const porFam = new Map();
for (const p of patches) { const k = p.familia; porFam.set(k, (porFam.get(k) || 0) + 1); }
console.log("por família:", [...porFam.entries()]);
for (const p of patches) console.log(`  ${p.codigo.padEnd(9)} ${p.familia.padEnd(12)} ${JSON.stringify(p.campos)}`);

if (!APPLY) { console.log("\nDRY-RUN. Rode com --apply."); } else {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  writeFileSync(`scripts/backup-perfis-${stamp}.json`, JSON.stringify(patches.map(({ id, codigo, antes }) => ({ id, codigo, antes })), null, 2));
  let ok = 0, erro = 0;
  for (const p of patches) { const { error } = await sb.from("product_variants").update(p.campos).eq("id", p.id); if (error) { erro++; console.error("  x", p.codigo, error.message); } else ok++; }
  console.log(`\nbackup: scripts/backup-perfis-${stamp}.json\naplicado: ${ok} | erros: ${erro}`);
}
