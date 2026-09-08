/**
 * Preenche tamanho_rolo_m e watts_por_metro das fitas a partir do NOME do produto.
 * Parser validado contra as já preenchidas: 186/186 no rolo, 226/229 no W/m
 * (as 3 divergências são erro de cadastro, listadas em SUSPEITOS).
 *
 * Só preenche NULL — nunca sobrescreve valor existente. Backup antes de aplicar.
 *   node scripts/corrigir-fitas.mjs           # DRY-RUN
 *   node scripts/corrigir-fitas.mjs --apply   # aplica
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "node:fs";
for (const f of [".env",".env.local"]) { try { for (const l of readFileSync(f,"utf8").split(/\r?\n/)) { const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/); if(m&&!(m[1] in process.env)) process.env[m[1]]=m[2].replace(/^["']|["']$/g,""); } } catch {} }
const APPLY = process.argv.includes("--apply");
const sb=createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const num = s => parseFloat(String(s).replace(",", "."));
const ROLOS_VALIDOS = [5,10,15,20,25,30,50,100];
const WM_MAX_PLAUSIVEL = 100; // acima disso é erro de digitação no nome (ex.: "700W/M")

function roloDoNome(d) {
  const up=(d||"").toUpperCase();
  const achados=[...up.matchAll(/(?<![\d,.])(\d{1,3}(?:[,.]\d+)?)\s*M\b(?!M)/g)].map(x=>num(x[1])).filter(v=>ROLOS_VALIDOS.includes(v));
  const unicos=[...new Set(achados)];
  return unicos.length===1 ? unicos[0] : null;
}
function wmExplicito(d) {
  const m=(d||"").toUpperCase().match(/(\d{1,4}(?:[,.]\d+)?)\s*W\s*\/?\s*M\b/);
  const v = m ? num(m[1]) : null;
  return v != null && v <= WM_MAX_PLAUSIVEL ? v : null;
}
function wTotal(d) {
  const up=(d||"").toUpperCase().replace(/(\d+(?:[,.]\d+)?)\s*W\s*\/?\s*M\b/g," ");
  const m=up.match(/(?:^|\s)(\d{1,4}(?:[,.]\d+)?)\s*W\b/);
  return m ? num(m[1]) : null;
}
function ehFitaDeVerdade(d) {
  const up=(d||"").toUpperCase();
  if (/^\s*(ADAPTADOR|FONTE|DRIVER|CONTROLADOR|SIST\b|SISTEMA|KIT|PERFIL|CONECTOR)/.test(up)) return false;
  return /FITA|NEON/.test(up);
}

const rows=[]; let from=0;
for(;;){ const {data,error}=await sb.from("product_variants").select("id,codigo,descricao,watts_por_metro,tamanho_rolo_m").eq("tipo_produto","fita").range(from,from+999); if(error) throw error; if(!data?.length) break; rows.push(...data); if(data.length<1000) break; from+=1000; }

const patchesRolo=[], patchesWm=[], suspeitos=[], naoEhFita=[], sobra=[];
for (const r of rows) {
  const rolo = r.tamanho_rolo_m ?? roloDoNome(r.descricao);
  if (r.tamanho_rolo_m == null && rolo != null) patchesRolo.push({ ...r, novo: rolo });
  if (r.watts_por_metro == null) {
    const e = wmExplicito(r.descricao);
    const t = wTotal(r.descricao);
    const calc = e ?? (t != null && rolo ? Math.round((t/rolo)*100)/100 : null);
    if (calc != null && calc > 0) patchesWm.push({ ...r, novo: calc, origem: e != null ? "W/m no nome" : `${t}W ÷ ${rolo}m` });
    else if (!ehFitaDeVerdade(r.descricao)) naoEhFita.push(r);
    else sobra.push(r);
  }
  // erro de cadastro: W/m gravado parece ser a potência TOTAL do rolo
  if (r.watts_por_metro != null && rolo) {
    const e = wmExplicito(r.descricao), t = wTotal(r.descricao);
    const esperado = e ?? (t != null ? Math.round((t/rolo)*100)/100 : null);
    if (esperado != null && Math.abs(esperado - r.watts_por_metro) > 0.06) {
      suspeitos.push({ codigo: r.codigo, descricao: r.descricao, banco: r.watts_por_metro, nome: esperado, rolo });
    }
  }
}
console.log(`fitas: ${rows.length}`);
console.log(`\n[1] tamanho_rolo_m a preencher: ${patchesRolo.length} (de ${rows.filter(r=>r.tamanho_rolo_m==null).length} vazios)`);
patchesRolo.slice(0,8).forEach(p=>console.log(`   ${p.codigo}: ${p.novo}m  ← ${p.descricao.slice(0,75)}`));
console.log(`\n[2] watts_por_metro a preencher: ${patchesWm.length} (de ${rows.filter(r=>r.watts_por_metro==null).length} vazios)`);
patchesWm.slice(0,8).forEach(p=>console.log(`   ${p.codigo}: ${p.novo}W/m (${p.origem})  ← ${p.descricao.slice(0,70)}`));
console.log(`\n[3] SUSPEITOS (valor gravado diverge do nome — NÃO tocados): ${suspeitos.length}`);
suspeitos.forEach(s=>console.log(`   ${s.codigo}: banco=${s.banco} nome=${s.nome} | ${s.descricao.slice(0,75)}`));
console.log(`\n[4] classificados como fita mas NÃO são fita: ${naoEhFita.length}`);
naoEhFita.slice(0,10).forEach(r=>console.log(`   ${r.codigo} | ${r.descricao.slice(0,80)}`));
console.log(`\n[5] fita de verdade que continua sem W/m (vai pro Jonathan): ${sobra.length}`);

if (!APPLY) { console.log("\nDRY-RUN. Rode com --apply para gravar."); process.exit(0); }

const backup = rows.filter(r => patchesRolo.some(p=>p.id===r.id) || patchesWm.some(p=>p.id===r.id))
  .map(({id,codigo,watts_por_metro,tamanho_rolo_m})=>({id,codigo,watts_por_metro,tamanho_rolo_m}));
const stamp = new Date().toISOString().replace(/[:.]/g,"-");
writeFileSync(`scripts/backup-fitas-${stamp}.json`, JSON.stringify(backup,null,2));
console.log(`\nbackup: scripts/backup-fitas-${stamp}.json (${backup.length} linhas)`);

const patch = new Map();
for (const p of patchesRolo) patch.set(p.id, { ...(patch.get(p.id)||{}), tamanho_rolo_m: p.novo });
for (const p of patchesWm)  patch.set(p.id, { ...(patch.get(p.id)||{}), watts_por_metro: p.novo });
let ok=0, erro=0;
for (const [id, campos] of patch) {
  const { error } = await sb.from("product_variants").update(campos).eq("id", id);
  if (error) { erro++; console.error("  ✗", id, error.message); } else ok++;
}
console.log(`\naplicado: ${ok} produtos | erros: ${erro}`);
