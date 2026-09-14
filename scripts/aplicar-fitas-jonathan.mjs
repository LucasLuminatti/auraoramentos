/**
 * Aplica a planilha de fitas devolvida pelo Jonathan em 2026-09-14
 * (`analise/fitas-jonathan-devolvida-2026-09-14.xlsx`, aba "Preencher").
 *
 * A planilha tem duas partes:
 *   - linhas 2-56: as pendências que mandamos, marcadas "Fora de Linha", "Não é Fita" ou
 *     com o valor preenchido;
 *   - linha 57 em diante: "todo nosso portfólio" de fitas, com W/m e tamanho do rolo.
 *
 * O que grava (só com --apply, backup antes):
 *   - tamanho_rolo_m / watts_por_metro onde o banco está VAZIO (nunca sobrescreve);
 *   - "Não é Fita" (GRAN FOCUS / FOCUS com fita embutida) -> tipo_produto null, o mesmo
 *     tratamento dado aos SIST TAKE AWAY em 2026-09-08;
 *   - item do portfólio cadastrado com outro tipo (os PERFIL FLEXIVEL, que têm LED, W/m e
 *     rolo e estavam como perfil/acessório) -> tipo_produto 'fita'.
 *
 * O que só relata (vai para `analise/fitas-jonathan-resultado-2026-09-14.json`):
 *   - valor do banco diferente do da planilha (não sobrescreve sem conferir);
 *   - fitas fora de linha: as marcadas pelo Jonathan + as que não estão nem no portfólio
 *     nem no catálogo 2026 (duas fontes concordando). Esconder depende da coluna `ativo`;
 *   - fitas fora do portfólio mas presentes no catálogo 2026 (as fontes discordam);
 *   - códigos do portfólio que não existem no banco, com o "gêmeo" de mesmo nome.
 *
 *   node scripts/aplicar-fitas-jonathan.mjs           # DRY-RUN
 *   node scripts/aplicar-fitas-jonathan.mjs --apply
 */
import { createClient } from "@supabase/supabase-js";
import XLSX from "xlsx";
import { readFileSync, writeFileSync } from "node:fs";
for (const f of [".env",".env.local"]) { try { for (const l of readFileSync(f,"utf8").split(/\r?\n/)) { const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/); if(m&&!(m[1] in process.env)) process.env[m[1]]=m[2].replace(/^["']|["']$/g,""); } } catch {} }
const APPLY = process.argv.includes("--apply");
const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const PLANILHA = "../analise/fitas-jonathan-devolvida-2026-09-14.xlsx";
const CATALOGO = "../analise/catalogo-2026-paginas.json";
const RESULTADO = "../analise/fitas-jonathan-resultado-2026-09-14.json";
const LINHA_INICIO_PORTFOLIO = 57; // "A partir da linha 57 coloquei todo nosso portfolio"

const num = (v) => {
  if (typeof v === "number") return v;
  const s = String(v ?? "").trim().replace(",", ".");
  return /^\d+(\.\d+)?$/.test(s) ? parseFloat(s) : null;
};
const semAcento = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().trim();
const nomeNormalizado = (s) => semAcento(s).replace(/\.\s*$/, "").replace(/\s+/g, " ");

// ── planilha ──
const ws = XLSX.readFile(PLANILHA).Sheets["Preencher"];
const linhas = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })
  .map((r, i) => ({ linha: i + 1, codigo: String(r[0] ?? "").trim(), descricao: r[1], wm: r[2], rolo: r[3] }))
  .filter((r) => r.linha > 1 && /^(LM|AU)\d/.test(r.codigo));
const pendentes = linhas.filter((r) => r.linha < LINHA_INICIO_PORTFOLIO);
const portfolio = linhas.filter((r) => r.linha >= LINHA_INICIO_PORTFOLIO);
const status = (r) => semAcento(r.wm);

// ── catálogo 2026 (página impressa -> códigos) ──
const cat = JSON.parse(readFileSync(CATALOGO, "utf8"));
const noCatalogo = new Set();
for (const v of Object.values(cat.paginas ?? cat)) for (const c of (Array.isArray(v) ? v : v?.codigos ?? [])) noCatalogo.add(c);

// ── banco ──
const COLS = "id,codigo,descricao,tipo_produto,watts_por_metro,tamanho_rolo_m,preco_tabela";
async function paginado(q) { const out=[]; let from=0; for(;;){ const {data,error}=await q().range(from,from+999); if(error) throw error; out.push(...data); if(data.length<1000) break; from+=1000; } return out; }
const codigos = [...new Set(linhas.map((r) => r.codigo))];
const doBanco = [];
for (let i = 0; i < codigos.length; i += 100) {
  const { data, error } = await sb.from("product_variants").select(COLS).in("codigo", codigos.slice(i, i + 100));
  if (error) throw error;
  doBanco.push(...data);
}
const porCodigo = new Map(doBanco.map((r) => [r.codigo, r]));
const fitasBanco = await paginado(() => sb.from("product_variants").select(COLS).eq("tipo_produto", "fita").order("codigo"));

// ── patches ──
const patches = []; // {id, codigo, campos, motivo, antes}
const conflitos = [];
const addPatch = (row, campo, valor, motivo) => {
  let p = patches.find((x) => x.id === row.id);
  if (!p) { p = { id: row.id, codigo: row.codigo, campos: {}, motivo: [], antes: {} }; patches.push(p); }
  p.campos[campo] = valor; p.antes[campo] = row[campo]; p.motivo.push(motivo);
};

// valores: código que aparece nas duas partes usa a linha do portfólio inteira
const valores = new Map();
for (const r of [...portfolio, ...pendentes]) {
  const wm = num(r.wm), rolo = num(r.rolo);
  if (wm == null && rolo == null) continue;
  if (!valores.has(r.codigo)) valores.set(r.codigo, { wm, rolo, linha: r.linha });
}
for (const [codigo, v] of valores) {
  const row = porCodigo.get(codigo);
  if (!row) continue;
  for (const [campo, novo] of [["watts_por_metro", v.wm], ["tamanho_rolo_m", v.rolo]]) {
    if (novo == null) continue;
    if (row[campo] == null) addPatch(row, campo, novo, `${campo} vazio -> ${novo} (linha ${v.linha})`);
    else if (Math.abs(Number(row[campo]) - novo) > 0.01) conflitos.push({ codigo, campo, banco: row[campo], planilha: novo, linha: v.linha, descricao: row.descricao });
  }
}

// "Não é Fita"
const naoEhFita = pendentes.filter((r) => /NAO E FITA/.test(status(r)));
for (const r of naoEhFita) {
  const row = porCodigo.get(r.codigo);
  if (row?.tipo_produto === "fita") addPatch(row, "tipo_produto", null, `"Não é Fita" (Jonathan) -> tipo null`);
}

// portfólio cadastrado com outro tipo
for (const r of portfolio) {
  const row = porCodigo.get(r.codigo);
  if (row && row.tipo_produto !== "fita") addPatch(row, "tipo_produto", "fita", `está no portfólio de fitas; era ${row.tipo_produto}`);
}

// ── relatórios ──
const codsPortfolio = new Set(portfolio.map((r) => r.codigo));
const codsNaoEhFita = new Set(naoEhFita.map((r) => r.codigo));
const resumo = (row) => ({ codigo: row.codigo, descricao: row.descricao, preco_tabela: row.preco_tabela });

const foraDeLinhaExplicito = pendentes
  .filter((r) => /FORA DE LINHA/.test(status(r)))
  .map((r) => ({ ...resumo(porCodigo.get(r.codigo) ?? { codigo: r.codigo, descricao: r.descricao }), noCatalogo2026: noCatalogo.has(r.codigo) }));
// "ausente" é quem não está no PORTFÓLIO — estar só na parte de pendências sem marcação
// (ex.: AU004, em branco) não conta como presença
const codsForaDeLinha = new Set(foraDeLinhaExplicito.map((f) => f.codigo));
const ausentes = fitasBanco.filter((f) => !codsPortfolio.has(f.codigo) && !codsNaoEhFita.has(f.codigo) && !codsForaDeLinha.has(f.codigo));
const foraDoPortfolioECatalogo = ausentes.filter((f) => !noCatalogo.has(f.codigo)).map(resumo);
const foraDoPortfolioMasNoCatalogo = ausentes.filter((f) => noCatalogo.has(f.codigo)).map(resumo);

const gemeoDe = new Map();
for (const f of [...fitasBanco, ...doBanco]) if (!gemeoDe.has(nomeNormalizado(f.descricao))) gemeoDe.set(nomeNormalizado(f.descricao), f);
const novosSemCadastro = portfolio.filter((r) => !porCodigo.has(r.codigo)).map((r) => {
  const g = gemeoDe.get(nomeNormalizado(r.descricao));
  return { codigo: r.codigo, descricao: r.descricao, wm: num(r.wm), rolo: num(r.rolo),
    gemeo: g ? { codigo: g.codigo, preco_tabela: g.preco_tabela, noPortfolio: codsPortfolio.has(g.codigo) } : null };
});

const porCampo = patches.reduce((a, p) => { for (const k of Object.keys(p.campos)) a[k] = (a[k] || 0) + 1; return a; }, {});
console.log(`planilha: ${pendentes.length} pendências + ${portfolio.length} no portfólio`);
console.log(`patches: ${patches.length} produtos`, porCampo);
for (const p of patches) console.log(`  ${p.codigo}: ${p.motivo.join("; ")}`);
console.log(`\nconflitos (não gravados): ${conflitos.length}`);
for (const c of conflitos) console.log(`  ${c.codigo} ${c.campo}: banco ${c.banco} x planilha ${c.planilha} — ${c.descricao}`);
console.log(`\nfora de linha: ${foraDeLinhaExplicito.length} marcadas + ${foraDoPortfolioECatalogo.length} fora do portfólio e do catálogo`);
console.log(`fora do portfólio MAS no catálogo 2026: ${foraDoPortfolioMasNoCatalogo.map((f) => f.codigo).join(", ") || "nenhuma"}`);
console.log(`no portfólio e sem cadastro: ${novosSemCadastro.map((n) => `${n.codigo}${n.gemeo ? `(=${n.gemeo.codigo})` : ""}`).join(", ") || "nenhum"}`);

writeFileSync(RESULTADO, JSON.stringify({
  geradoEm: new Date().toISOString(), conflitos, foraDeLinhaExplicito, foraDoPortfolioECatalogo,
  foraDoPortfolioMasNoCatalogo, novosSemCadastro,
  patches: patches.map(({ codigo, campos, motivo }) => ({ codigo, campos, motivo })),
}, null, 2));
console.log(`\nrelatório: ${RESULTADO}`);

if (!APPLY) { console.log("\nDRY-RUN. Rode com --apply."); } else {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  writeFileSync(`scripts/backup-fitas-jonathan-${stamp}.json`, JSON.stringify(patches.map(({ id, codigo, antes }) => ({ id, codigo, antes })), null, 2));
  console.log(`backup: scripts/backup-fitas-jonathan-${stamp}.json`);
  let ok = 0, erro = 0;
  for (const p of patches) {
    const { error } = await sb.from("product_variants").update(p.campos).eq("id", p.id);
    if (error) { erro++; console.error("  x", p.codigo, error.message); } else ok++;
  }
  console.log(`aplicado: ${ok} | erros: ${erro}`);
}
