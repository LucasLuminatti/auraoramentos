/** Preenche `tensao` dos drivers a partir do NOME (tensão de SAÍDA, não a de entrada).
 *  A sugestão automática de driver filtra por `.eq('tensao', V)`, então driver sem esse
 *  campo é invisível pra ela — hoje 46 dos 62. Só preenche vazio; backup antes.
 *    node scripts/corrigir-drivers-tensao.mjs           # DRY-RUN + validação
 *    node scripts/corrigir-drivers-tensao.mjs --apply */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "node:fs";
for (const f of [".env",".env.local"]) { try { for (const l of readFileSync(f,"utf8").split(/\r?\n/)) { const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/); if(m&&!(m[1] in process.env)) process.env[m[1]]=m[2].replace(/^["']|["']$/g,""); } } catch {} }
const APPLY = process.argv.includes("--apply");
const sb=createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});

/** Tensão de SAÍDA declarada no nome. A de ENTRADA ("AC127V-220V", "100V-240V", "BIVOLT")
 *  aparece no mesmo texto e não pode ser confundida — por isso os padrões são ancorados. */
export function tensaoSaidaDoNome(descricao) {
  const d = (descricao || "").toUpperCase();
  const padroes = [
    /PARA\s+FITA\s+LED\s+(\d{1,2})\s*V/,        // "PARA FITA LED 24V"
    /SA[IÍ]DA:?\s*(?:\d+\s*-\s*)?(\d{1,2})\s*V/, // "SAÍDA: 15-24V DC" / "SAIDA 12V"
    /^DRIVER\s+(\d{1,2})\s*V\b/,                 // "DRIVER 24V 2.5A ..."
    /FITA\s+LED\s+(\d{1,2})\s*V/,                // fallback do mesmo par
  ];
  for (const p of padroes) {
    const m = d.match(p);
    if (m) { const v = parseInt(m[1], 10); if ([12, 24, 48].includes(v)) return v; }
  }
  // Último recurso: qualquer "12V/24V/48V" solto no nome, desde que só apareça UM valor.
  // As tensões de ENTRADA do catálogo (100V, 127V, 220V, 240V) nunca caem aqui, e nomes
  // como "DRIVER SLIM 24V 200W ..." e "... DC48V" ficam cobertos.
  const soltos = [...d.matchAll(/(?<!\d)(12|24|48)\s*V\b/g)].map((m) => parseInt(m[1], 10));
  const unicos = [...new Set(soltos)];
  return unicos.length === 1 ? unicos[0] : null;
}
/** Produto cadastrado como driver que na verdade é luminária (o driver é acessório dela). */
const naoEhDriverDeFita = (d) => /^\s*(AR\d+|MR\d+|PAR\d+|DICROICA)\b/i.test(d || "");

const { data } = await sb.from("product_variants").select("id,codigo,descricao,tensao,potencia_watts").eq("tipo_produto","driver");
let ok=0, div=0; const divergentes=[];
for (const d of data.filter(x=>x.tensao!=null)) {
  const v = tensaoSaidaDoNome(d.descricao);
  if (v == null) continue;
  if (v === d.tensao) ok++; else { div++; divergentes.push(`${d.codigo}: nome=${v} banco=${d.tensao} | ${d.descricao.slice(0,60)}`); }
}
console.log(`VALIDAÇÃO contra os ${data.filter(x=>x.tensao!=null).length} já preenchidos: ${ok} acertos, ${div} divergências`);
divergentes.forEach(x=>console.log("   x",x));

const vazios = data.filter(x=>x.tensao==null);
const patch = vazios.map(d=>({ ...d, novo: naoEhDriverDeFita(d.descricao) ? null : tensaoSaidaDoNome(d.descricao) }));
const comValor = patch.filter(p=>p.novo!=null);
const semValor = patch.filter(p=>p.novo==null);
console.log(`\ndrivers sem tensao: ${vazios.length} → dá para preencher ${comValor.length}`);
comValor.slice(0,10).forEach(p=>console.log(`   ${p.codigo}: ${p.novo}V ← ${p.descricao.slice(0,66)}`));
console.log(`\nficam sem (nome não diz, ou não é driver de fita): ${semValor.length}`);
semValor.forEach(p=>console.log(`   ${p.codigo} | ${p.descricao.slice(0,72)}`));

if (!APPLY) { console.log("\nDRY-RUN. Rode com --apply."); } else {
  const stamp=new Date().toISOString().replace(/[:.]/g,"-");
  writeFileSync(`scripts/backup-drivers-${stamp}.json`, JSON.stringify(comValor.map(({id,codigo,tensao})=>({id,codigo,tensao})),null,2));
  let n=0; for (const p of comValor) { const {error}=await sb.from("product_variants").update({tensao:p.novo}).eq("id",p.id); if(error) console.error("x",p.codigo,error.message); else n++; }
  console.log(`\nbackup: scripts/backup-drivers-${stamp}.json\naplicado: ${n}`);
}
