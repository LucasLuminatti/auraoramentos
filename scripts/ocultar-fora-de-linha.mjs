/**
 * Esconde da busca do orçamento (ativo=false) o que não se vende mais. Depende da migration
 * 20260602000001_product_variants_ativo, aplicada em 2026-09-14. Soft-delete: o Admin continua
 * vendo o produto e o backup desfaz.
 *   - códigos AU* — linhas de categoria do ERP ("Drivers", "Fita LED"...), R$ 0;
 *   - fitas fora de linha segundo a planilha do Jonathan
 *     (`analise/fitas-jonathan-resultado-2026-09-14.json`): as marcadas por ele + as que não estão
 *     nem no portfólio nem no catálogo 2026.
 * As que estão fora do portfólio mas NO catálogo (`foraDoPortfolioMasNoCatalogo`) continuam
 * ativas até o Jonathan responder.
 *   node scripts/ocultar-fora-de-linha.mjs           # DRY-RUN
 *   node scripts/ocultar-fora-de-linha.mjs --apply
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "node:fs";
for (const f of [".env",".env.local"]) { try { for (const l of readFileSync(f,"utf8").split(/\r?\n/)) { const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/); if(m&&!(m[1] in process.env)) process.env[m[1]]=m[2].replace(/^["']|["']$/g,""); } } catch {} }
const APPLY = process.argv.includes("--apply");
const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const res = JSON.parse(readFileSync("../analise/fitas-jonathan-resultado-2026-09-14.json", "utf8"));

const { data: au, error: auErr } = await sb.from("product_variants").select("codigo").ilike("codigo", "AU%");
if (auErr) throw auErr;

const origem = new Map(); // codigo -> motivo
for (const r of au.filter((r) => /^AU\d+$/.test(r.codigo))) origem.set(r.codigo, "AU* (linha de categoria)");
for (const r of res.foraDeLinhaExplicito) if (!origem.has(r.codigo)) origem.set(r.codigo, "fora de linha (Jonathan)");
for (const r of res.foraDoPortfolioECatalogo) if (!origem.has(r.codigo)) origem.set(r.codigo, "fora do portfólio e do catálogo 2026");

// trava: nada que alguma fonte ainda dá como vivo pode entrar.
// TRANSICAO: códigos antigos de uma troca de código (mesmo produto do código novo, vendidos até
// acabar o estoque). Pareciam fora de linha e foram ocultados por engano em 2026-09-14; quem
// decide a visibilidade deles é `aplicar-respostas-jonathan-2.mjs`.
const TRANSICAO = ["LM2439", "LM2440", "LM2570", "LM2800", "LM3435", "LM3439", "LM3440"];
for (const c of TRANSICAO) origem.delete(c);
const vivos = new Set([
  ...res.foraDoPortfolioMasNoCatalogo.map((r) => r.codigo),
  ...res.conflitos.map((r) => r.codigo),
  ...res.patches.map((r) => r.codigo),
]);
const invasores = [...origem.keys()].filter((c) => vivos.has(c));
if (invasores.length) throw new Error(`códigos ainda vivos na lista: ${invasores.join(", ")}`);

const codigos = [...origem.keys()];
const rows = [];
for (let i = 0; i < codigos.length; i += 100) {
  const { data, error } = await sb.from("product_variants").select("id,codigo,descricao,ativo").in("codigo", codigos.slice(i, i + 100));
  if (error) throw error;
  rows.push(...data);
}
const faltando = codigos.filter((c) => !rows.some((r) => r.codigo === c));
const alvo = rows.filter((r) => r.ativo !== false);

const porMotivo = alvo.reduce((a, r) => { const k = origem.get(r.codigo); a[k] = (a[k] || 0) + 1; return a; }, {});
console.log(`a desativar: ${alvo.length}`, porMotivo);
console.log(`já inativos: ${rows.length - alvo.length} | não achados no banco: ${faltando.join(", ") || "nenhum"}`);

if (!APPLY) { console.log("\nDRY-RUN. Rode com --apply."); } else {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  writeFileSync(`scripts/backup-ativo-${stamp}.json`, JSON.stringify(alvo.map(({ id, codigo, ativo }) => ({ id, codigo, antes: { ativo } })), null, 2));
  console.log(`backup: scripts/backup-ativo-${stamp}.json`);
  let ok = 0, erro = 0;
  for (let i = 0; i < alvo.length; i += 100) {
    const lote = alvo.slice(i, i + 100);
    const { error } = await sb.from("product_variants").update({ ativo: false }).in("id", lote.map((r) => r.id));
    if (error) { erro += lote.length; console.error("  x lote", i, error.message); } else ok += lote.length;
  }
  console.log(`aplicado: ${ok} | erros: ${erro}`);
}
