/**
 * Correções autorizadas pelo Lenny em 2026-09-08 (itens 3, 4 e 5 da lista):
 *   3. LM2791 — watts_por_metro 60 -> 12 (o nome diz "60W ... 12W/M ... 5M": 60W é o TOTAL
 *      do rolo, não o W/m. Do jeito errado, dimensionava driver 5x maior).
 *   4. LM3827 / LM3828 — tira o "700W/M" da DESCRIÇÃO (fita COB não tem 700 W por metro;
 *      é erro de digitação e a descrição vai no PDF do cliente). O watts_por_metro do banco
 *      NÃO é tocado: nele e no "W total" do nome ainda há divergência que só a equipe resolve.
 *   5. 40 produtos com tipo_produto='fita' sem ser fita:
 *        - 2 conectores fita-rede  -> 'conector'
 *        - 2 adaptadores 12V/36W   -> 'driver'  (são fonte de fita; entram na sugestão de driver)
 *        - 36 SIST TAKE AWAY       -> null      (luminária completa; é assim que o catálogo
 *                                                marca luminária, e a busca já trata null)
 * Backup de tudo antes de gravar.
 *   node scripts/corrigir-cadastro-2.mjs           # DRY-RUN
 *   node scripts/corrigir-cadastro-2.mjs --apply
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "node:fs";
for (const f of [".env",".env.local"]) { try { for (const l of readFileSync(f,"utf8").split(/\r?\n/)) { const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/); if(m&&!(m[1] in process.env)) process.env[m[1]]=m[2].replace(/^["']|["']$/g,""); } } catch {} }
const APPLY = process.argv.includes("--apply");
const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const rows=[]; let from=0;
for(;;){ const {data,error}=await sb.from("product_variants").select("id,codigo,descricao,tipo_produto,watts_por_metro").eq("tipo_produto","fita").range(from,from+999); if(error) throw error; if(!data?.length) break; rows.push(...data); if(data.length<1000) break; from+=1000; }
const porCodigo = new Map(rows.map(r=>[r.codigo,r]));

const patches = []; // {id, codigo, campos, motivo, antes}

// [3] LM2791
const p2791 = porCodigo.get("LM2791");
if (p2791 && p2791.watts_por_metro !== 12) {
  patches.push({ id:p2791.id, codigo:"LM2791", campos:{ watts_por_metro: 12 }, motivo:`W/m ${p2791.watts_por_metro} -> 12 (nome: "60W ... 12W/M ... 5M")`, antes:{ watts_por_metro: p2791.watts_por_metro } });
}

// [4] LM3827 / LM3828 — descrição sem o "700W/M"
for (const cod of ["LM3827","LM3828"]) {
  const p = porCodigo.get(cod);
  if (!p) continue;
  const nova = p.descricao.replace(/\s*\b700\s*W\s*\/?\s*M\b/i, "").replace(/\s{2,}/g," ").trim();
  if (nova !== p.descricao) {
    patches.push({ id:p.id, codigo:cod, campos:{ descricao: nova }, motivo:`descrição: tira o "700W/M" -> "${nova}"`, antes:{ descricao: p.descricao } });
  }
}

// [5] reclassificação
const ehFita = d => { const up=(d||"").toUpperCase(); return !/^\s*(ADAPTADOR|FONTE|DRIVER|CONTROLADOR|SIST\b|SISTEMA|KIT|PERFIL|CONECTOR)/.test(up) && /FITA|NEON/.test(up); };
for (const r of rows.filter(x=>!ehFita(x.descricao))) {
  const up = r.descricao.toUpperCase();
  let novo;
  if (/^\s*CONECTOR/.test(up)) novo = "conector";
  else if (/^\s*(ADAPTADOR|FONTE|DRIVER)/.test(up)) novo = "driver";
  else novo = null; // SIST TAKE AWAY e afins: luminária completa
  patches.push({ id:r.id, codigo:r.codigo, campos:{ tipo_produto: novo }, motivo:`tipo_produto fita -> ${novo ?? "null (luminária)"}`, antes:{ tipo_produto: "fita" } });
}

console.log(`patches: ${patches.length}`);
for (const p of patches.slice(0,8)) console.log(`  ${p.codigo}: ${p.motivo}`);
const porTipo = patches.reduce((a,p)=>{ const k=Object.keys(p.campos)[0]; a[k]=(a[k]||0)+1; return a; },{});
console.log("por campo:", porTipo);
if (!APPLY) { console.log("\nDRY-RUN. Rode com --apply."); } else {
  const stamp=new Date().toISOString().replace(/[:.]/g,"-");
  writeFileSync(`scripts/backup-cadastro2-${stamp}.json`, JSON.stringify(patches.map(({id,codigo,antes})=>({id,codigo,antes})),null,2));
  console.log(`backup: scripts/backup-cadastro2-${stamp}.json`);
  let ok=0, erro=0;
  for (const p of patches) {
    const { error } = await sb.from("product_variants").update(p.campos).eq("id", p.id);
    if (error) { erro++; console.error("  x", p.codigo, error.message); } else ok++;
  }
  console.log(`aplicado: ${ok} | erros: ${erro}`);
}
