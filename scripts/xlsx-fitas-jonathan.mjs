/** Versão .xlsx da planilha de pendências das fitas (mais amigável de preencher que CSV). */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import * as XLSX from "xlsx";
for (const f of [".env",".env.local"]) { try { for (const l of readFileSync(f,"utf8").split(/\r?\n/)) { const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/); if(m&&!(m[1] in process.env)) process.env[m[1]]=m[2].replace(/^["']|["']$/g,""); } } catch {} }
const sb=createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const rows=[]; let from=0;
for(;;){ const {data,error}=await sb.from("product_variants").select("codigo,descricao,watts_por_metro,tamanho_rolo_m").eq("tipo_produto","fita").range(from,from+999); if(error) throw error; if(!data?.length) break; rows.push(...data); if(data.length<1000) break; from+=1000; }
const num = s => parseFloat(String(s).replace(",", "."));
const wTotal = d => { const up=(d||"").toUpperCase().replace(/(\d+(?:[,.]\d+)?)\s*W\s*\/?\s*M\b/g," "); const m=up.match(/(?:^|\s)(\d{1,4}(?:[,.]\d+)?)\s*W\b/); return m?num(m[1]):null; };

const falta = rows.filter(r=>r.watts_por_metro==null||r.tamanho_rolo_m==null).sort((a,b)=>(a.codigo||"").localeCompare(b.codigo||""));
const conferir = rows.filter(r=>{ if(r.watts_por_metro==null||r.tamanho_rolo_m==null) return false; const t=wTotal(r.descricao); return t!=null && Math.abs(t/r.tamanho_rolo_m - r.watts_por_metro)>0.06; });

const aba1 = falta.map(r=>({
  "Código": r.codigo,
  "Descrição": r.descricao,
  "Watts por metro (W/m)": r.watts_por_metro ?? "",
  "Tamanho do rolo (m)": r.tamanho_rolo_m ?? "",
  "O que falta": [r.watts_por_metro==null?"W/m":null, r.tamanho_rolo_m==null?"tamanho do rolo":null].filter(Boolean).join(" + "),
}));
const aba2 = conferir.map(r=>({
  "Código": r.codigo,
  "Descrição": r.descricao,
  "W/m cadastrado": r.watts_por_metro,
  "Tamanho do rolo (m)": r.tamanho_rolo_m,
  "W/m que o nome sugere": Math.round((wTotal(r.descricao)/r.tamanho_rolo_m)*100)/100,
  "W/m correto (preencher)": "",
}));

const wb = XLSX.utils.book_new();
const ws1 = XLSX.utils.json_to_sheet(aba1);
ws1["!cols"] = [{wch:12},{wch:78},{wch:22},{wch:20},{wch:22}];
XLSX.utils.book_append_sheet(wb, ws1, "Preencher");
const ws2 = XLSX.utils.json_to_sheet(aba2);
ws2["!cols"] = [{wch:12},{wch:60},{wch:16},{wch:20},{wch:24},{wch:24}];
XLSX.utils.book_append_sheet(wb, ws2, "Conferir");
XLSX.writeFile(wb, "../analise/fitas-cadastro-pendente-2026-09-08.xlsx");
console.log(`Preencher: ${aba1.length} linhas | Conferir: ${aba2.length} linhas`);
