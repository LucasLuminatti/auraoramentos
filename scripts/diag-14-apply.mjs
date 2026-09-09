// Aplica o fix de dados da Phase 14 (CAT-01) em PROD via service role.
// Só toca product_variants.tipo_produto. Idempotente (setar valor já correto é no-op de dado).
// Escopo aprovado por Lenny (Tier 1): perfil + fita do diag-14-tier1.json.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

for (const f of [".env", ".env.local"]) {
  try { for (const l of readFileSync(f, "utf8").split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/); if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); } } catch {}
}
const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const t = JSON.parse(readFileSync("scripts/diag-14-tier1.json", "utf8"));
const chunk = (a, n) => { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };

async function baseline() {
  const rows = []; let from = 0;
  for (;;) { const { data, error } = await sb.from("product_variants").select("tipo_produto").range(from, from + 999); if (error) throw error; if (!data?.length) break; rows.push(...data); if (data.length < 1000) break; from += 1000; }
  const m = {}; for (const r of rows) { const k = r.tipo_produto ?? "(null)"; m[k] = (m[k] || 0) + 1; } return m;
}

// estado ANTES dos codigos-alvo (pra contar quantos realmente mudam)
async function beforeState(codigos) {
  const map = new Map();
  for (const c of chunk(codigos, 80)) {
    const { data, error } = await sb.from("product_variants").select("codigo,tipo_produto").in("codigo", c);
    if (error) throw error;
    for (const r of data) map.set(r.codigo, r.tipo_produto);
  }
  return map;
}

async function applyTipo(codigos, alvo) {
  let touched = 0;
  for (const c of chunk(codigos, 80)) {
    const { data, error } = await sb.from("product_variants").update({ tipo_produto: alvo }).in("codigo", c).select("codigo");
    if (error) throw error;
    touched += data.length;
  }
  return touched;
}

console.log("Baseline ANTES:", JSON.stringify(await baseline()));
const beforePerfil = await beforeState(t.perfil);
const beforeFita = await beforeState(t.fita);
const jaPerfil = [...beforePerfil.values()].filter((v) => v === "perfil").length;
const jaFita = [...beforeFita.values()].filter((v) => v === "fita").length;
const naoEncontradosPerfil = t.perfil.filter((c) => !beforePerfil.has(c));
const naoEncontradosFita = t.fita.filter((c) => !beforeFita.has(c));

const tp = await applyTipo(t.perfil, "perfil");
const tf = await applyTipo(t.fita, "fita");

console.log("Baseline DEPOIS:", JSON.stringify(await baseline()));
console.log(JSON.stringify({
  perfil: { lista: t.perfil.length, ja_perfil_antes: jaPerfil, mudaram: t.perfil.length - jaPerfil - naoEncontradosPerfil.length, nao_encontrados: naoEncontradosPerfil },
  fita: { lista: t.fita.length, ja_fita_antes: jaFita, mudaram: t.fita.length - jaFita - naoEncontradosFita.length, nao_encontrados: naoEncontradosFita },
  rows_touched_perfil: tp, rows_touched_fita: tf,
}, null, 2));
