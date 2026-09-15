/**
 * Respostas do Jonathan (2026-09-15) à mensagem 5 de `analise/mensagens-2026-09-08.txt`.
 *
 *   1. LM3827 (Baby): o W/m certo é 10 (o da planilha), não os 7 do catálogo. Grava 10.
 *   2. LM3823/LM3824/LM3828 "lançamento cancelado" e LM927 "fora de linha" -> ativo=false.
 *   3. LM3851 (Micro Baby 3 mm) "também serve para esses perfis" (Light Mini e Ripado) -> cadastra
 *      com o molde da LM3827. Entra ativa e sem preço, igual à própria LM3827: o preço da lista
 *      AURA dela está pendente com o Davi. A RULE-103 reconhece a fita pelo "BABY" no nome.
 *   4. LM3843-LM3850 "é o mesmo produto" de um código antigo, em transição ("quando acabar
 *      estoque o código antigo sairá de linha") -> cadastra copiando o técnico do gêmeo, sem preço.
 *   5. Regra da transição, idempotente: em cada grupo de fitas com NOME IDÊNTICO e algum código
 *      no portfólio, fica visível só o código de maior número que tenha preço AURA; os outros
 *      ficam ocultos. Hoje isso mostra o antigo, porque o novo não tem preço na lista AURA. Quando
 *      o preço do novo entrar, rodar o script de novo faz a troca sozinho.
 *      Isso também desfaz o que `ocultar-fora-de-linha.mjs` escondeu por engano em 14/09: o código
 *      antigo de uma transição não está no portfólio nem no catálogo e parecia fora de linha.
 *
 * O preço NÃO sai da "Tabela Inteligente" do SAP. Ela traz as tabelas de revenda (a LM3427
 * custa R$ 92,65 lá e R$ 307,81 na lista AURA) e, nela, o código novo sai mais barato que o antigo.
 *
 *   node scripts/aplicar-respostas-jonathan-2.mjs           # DRY-RUN
 *   node scripts/aplicar-respostas-jonathan-2.mjs --apply
 */
import { createClient } from "@supabase/supabase-js";
import XLSX from "xlsx";
import { readFileSync, writeFileSync } from "node:fs";
for (const f of [".env",".env.local"]) { try { for (const l of readFileSync(f,"utf8").split(/\r?\n/)) { const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/); if(m&&!(m[1] in process.env)) process.env[m[1]]=m[2].replace(/^["']|["']$/g,""); } } catch {} }
const APPLY = process.argv.includes("--apply");
const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const CANCELADOS = ["LM3823", "LM3824", "LM3828", "LM927"];
const MICRO_BABY = "LM3851";
const LINHA_INICIO_PORTFOLIO = 57;

const semAcento = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
const nomeNormalizado = (s) => semAcento(s).replace(/\s+/g, " ").trim().replace(/\.$/, "").trim();
const numeroDoCodigo = (c) => parseInt(String(c).replace(/\D/g, ""), 10) || 0;

// ── fontes ──
const ws = XLSX.readFile("../analise/fitas-jonathan-devolvida-2026-09-14.xlsx").Sheets["Preencher"];
const portfolio = new Map(
  XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })
    .map((r, i) => ({ linha: i + 1, codigo: String(r[0] ?? "").trim(), descricao: String(r[1] ?? "").trim() }))
    .filter((r) => r.linha >= LINHA_INICIO_PORTFOLIO && /^LM\d/.test(r.codigo))
    .map((r) => [r.codigo, r.descricao]),
);
const resultado14 = JSON.parse(readFileSync("../analise/fitas-jonathan-resultado-2026-09-14.json", "utf8"));
// nada que o Jonathan tirou de linha pode voltar a aparecer pela regra da transição
const nuncaVisivel = new Set([...CANCELADOS, ...resultado14.foraDeLinhaExplicito.map((r) => r.codigo)]);

async function paginado(q) { const out=[]; let from=0; for(;;){ const {data,error}=await q().range(from,from+999); if(error) throw error; out.push(...data); if(data.length<1000) break; from+=1000; } return out; }
const fitas = await paginado(() => sb.from("product_variants").select("*").eq("tipo_produto", "fita").order("codigo"));
const porCodigo = new Map(fitas.map((f) => [f.codigo, f]));
const porId = new Map(fitas.map((f) => [f.id, f]));

// ── alterações em produto existente ──
const updates = []; // {id, codigo, campos, antes, motivo}
function addUpdate(row, campos, motivo) {
  const mudou = Object.entries(campos).filter(([k, v]) => row[k] !== v);
  if (!mudou.length) return;
  let u = updates.find((x) => x.id === row.id);
  if (!u) { u = { id: row.id, codigo: row.codigo, campos: {}, antes: {}, motivo: [] }; updates.push(u); }
  for (const [k, v] of mudou) { u.campos[k] = v; if (!(k in u.antes)) u.antes[k] = row[k]; }
  u.motivo.push(motivo);
}

// [1] Baby
const baby = porCodigo.get("LM3827");
if (!baby) throw new Error("LM3827 não encontrada");
// `nome` ainda tinha o "700W/M" que saiu da descrição em 08/09.
// NÃO marcar editado_manualmente: a edge import-precos pula produto com essa flag, e a Baby
// ficaria a R$ 0 mesmo depois de importada a lista AURA. Custo aceito: um novo import do
// catálogo mestre (que diz 7 W/m) desfaz o W/m — rodar este script de novo corrige.
addUpdate(baby, { watts_por_metro: 10, nome: baby.descricao }, "W/m 10 (Jonathan)");

// [2] cancelados / fora de linha
for (const c of CANCELADOS) {
  const row = porCodigo.get(c);
  if (row) addUpdate(row, { ativo: false }, "lançamento cancelado / fora de linha (Jonathan)");
}

// ── cadastros novos ──
const NAO_COPIAR = new Set(["id", "created_at", "codigo", "descricao", "nome", "ativo", "origem", "editado_manualmente", "preco_tabela", "preco_minimo"]);
function deMolde(molde, extra) {
  const base = Object.fromEntries(Object.entries(molde).filter(([k]) => !NAO_COPIAR.has(k)));
  return {
    ...base,
    // EAN e página são do código do molde, não do novo
    atributos: { ...(molde.atributos ?? {}), ean_cadastro: null, ean_catalogo: null, pagina: null },
    preco_tabela: 0, preco_minimo: 0, origem: "manual", editado_manualmente: false,
    ...extra,
  };
}
const porNome = new Map();
for (const f of fitas) { const k = nomeNormalizado(f.descricao); if (!porNome.has(k)) porNome.set(k, []); porNome.get(k).push(f); }

const inserts = [];
// [4] código novo de transição: está no portfólio, não está no banco, tem UM gêmeo de nome idêntico
for (const [codigo, descricao] of portfolio) {
  if (porCodigo.has(codigo) || codigo === MICRO_BABY) continue;
  const gemeos = porNome.get(nomeNormalizado(descricao)) ?? [];
  if (gemeos.length !== 1) { console.log(`  ! ${codigo}: ${gemeos.length} fitas de mesmo nome no banco — não cadastrado`); continue; }
  inserts.push(deMolde(gemeos[0], { codigo, descricao, nome: descricao, _gemeo: gemeos[0].codigo }));
}
// [3] Micro Baby — molde da Baby, com o técnico dela
if (!porCodigo.has(MICRO_BABY)) {
  const descricao = portfolio.get(MICRO_BABY);
  if (!descricao) throw new Error(`${MICRO_BABY} não está no portfólio`);
  inserts.push(deMolde(baby, {
    codigo: MICRO_BABY, descricao, nome: descricao,
    tensao: 12, watts_por_metro: 6, tamanho_rolo_m: 5, largura_mm: null, imagem_url: null,
    atributos: { ...(baby.atributos ?? {}), variante: "5 metros - 6W/m", dimensao: null, lumens: null,
      observacoes: "COB Potencia total 30W", ean_cadastro: null, ean_catalogo: null, pagina: null },
    _gemeo: null,
  }));
}

// ── [5] regra da transição ──
const ativoPendente = (f) => updates.find((u) => u.id === f.id)?.campos.ativo ?? f.ativo;
const estado = [...fitas.map((f) => ({ ...f, ativo: ativoPendente(f) })), ...inserts];
const grupos = new Map();
for (const f of estado) {
  if (nuncaVisivel.has(f.codigo)) continue;
  const k = nomeNormalizado(f.descricao);
  if (!grupos.has(k)) grupos.set(k, []);
  grupos.get(k).push(f);
}
const transicoes = [];
for (const membros of grupos.values()) {
  if (membros.length < 2 || !membros.some((m) => portfolio.has(m.codigo))) continue;
  const comPreco = membros.filter((m) => Number(m.preco_tabela) > 0);
  if (!comPreco.length) continue; // ninguém do grupo tem preço AURA: não há o que escolher
  const visivel = comPreco.reduce((a, b) => (numeroDoCodigo(b.codigo) > numeroDoCodigo(a.codigo) ? b : a));
  transicoes.push({ visivel: visivel.codigo, ocultos: membros.filter((m) => m !== visivel).map((m) => m.codigo) });
  for (const m of membros) {
    const ativo = m === visivel;
    if (m.id) addUpdate(porId.get(m.id), { ativo }, ativo ? "transição: visível (maior código com preço AURA)" : `transição: oculto em favor de ${visivel.codigo}`);
    else m.ativo = ativo;
  }
}
// sem grupo de transição: código novo com gêmeo fica oculto (evita linha duplicada); Micro Baby entra
for (const i of inserts) if (i.ativo === undefined) i.ativo = !i._gemeo;

// ── relatório ──
console.log(`alterações: ${updates.length}`);
for (const u of updates) console.log(`  ${u.codigo}: ${JSON.stringify(u.campos)} — ${u.motivo.join("; ")}`);
console.log(`\ncadastros: ${inserts.length}`);
for (const i of inserts) console.log(`  ${i.codigo} ativo=${i.ativo}${i._gemeo ? ` (gêmeo de ${i._gemeo})` : ""} — ${i.descricao}`);
console.log(`\ntransições: ${transicoes.length}`);
for (const t of transicoes) console.log(`  visível ${t.visivel} | ocultos ${t.ocultos.join(", ")}`);

if (!APPLY) { console.log("\nDRY-RUN. Rode com --apply."); } else {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backup = `scripts/backup-jonathan2-${stamp}.json`;
  writeFileSync(backup, JSON.stringify({
    alteracoes: updates.map(({ id, codigo, antes }) => ({ id, codigo, antes })),
    cadastrados: inserts.map((i) => i.codigo),
  }, null, 2));
  console.log(`\nbackup: ${backup}`);
  let ok = 0, erro = 0;
  if (inserts.length) {
    const { error } = await sb.from("product_variants").insert(inserts.map(({ _gemeo, ...row }) => row));
    if (error) { erro += inserts.length; console.error("  x cadastro:", error.message); } else ok += inserts.length;
  }
  for (const u of updates) {
    const { error } = await sb.from("product_variants").update(u.campos).eq("id", u.id);
    if (error) { erro++; console.error("  x", u.codigo, error.message); } else ok++;
  }
  console.log(`aplicado: ${ok} | erros: ${erro}`);
}
