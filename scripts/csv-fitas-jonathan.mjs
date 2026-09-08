/** Planilha de pendências de cadastro das FITAS para o Jonathan. */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "node:fs";
for (const f of [".env",".env.local"]) { try { for (const l of readFileSync(f,"utf8").split(/\r?\n/)) { const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/); if(m&&!(m[1] in process.env)) process.env[m[1]]=m[2].replace(/^["']|["']$/g,""); } } catch {} }
const sb=createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const rows=[]; let from=0;
for(;;){ const {data,error}=await sb.from("product_variants").select("codigo,descricao,watts_por_metro,tamanho_rolo_m").eq("tipo_produto","fita").range(from,from+999); if(error) throw error; if(!data?.length) break; rows.push(...data); if(data.length<1000) break; from+=1000; }

const num = s => parseFloat(String(s).replace(",", "."));
const wTotal = d => { const up=(d||"").toUpperCase().replace(/(\d+(?:[,.]\d+)?)\s*W\s*\/?\s*M\b/g," "); const m=up.match(/(?:^|\s)(\d{1,4}(?:[,.]\d+)?)\s*W\b/); return m?num(m[1]):null; };

const falta = rows.filter(r=>r.watts_por_metro==null || r.tamanho_rolo_m==null).sort((a,b)=>(a.codigo||"").localeCompare(b.codigo||""));
// divergência entre o "W total" do nome e o W/m cadastrado (rolo conhecido)
const conferir = rows.filter(r=>{
  if (r.watts_por_metro==null || r.tamanho_rolo_m==null) return false;
  const t = wTotal(r.descricao);
  return t != null && Math.abs(t/r.tamanho_rolo_m - r.watts_por_metro) > 0.06;
}).sort((a,b)=>(a.codigo||"").localeCompare(b.codigo||""));

const L=["codigo;descricao;watts_por_metro;tamanho_rolo_m;o_que_falta"];
for (const r of falta) L.push([r.codigo,(r.descricao||"").replace(/;/g,","),r.watts_por_metro??"",r.tamanho_rolo_m??"",
  [r.watts_por_metro==null?"W/m":null,r.tamanho_rolo_m==null?"tamanho do rolo":null].filter(Boolean).join(" + ")].join(";"));
L.push("");
L.push("CONFERIR - o W total do nome nao bate com o W/m cadastrado (um dos dois esta errado);;;;");
for (const r of conferir) L.push([r.codigo,(r.descricao||"").replace(/;/g,","),r.watts_por_metro,r.tamanho_rolo_m,
  `nome sugere ${Math.round((wTotal(r.descricao)/r.tamanho_rolo_m)*100)/100} W/m`].join(";"));
writeFileSync("../analise/fitas-cadastro-pendente-2026-09-08.csv","﻿"+L.join("\r\n"),"utf8");
console.log("pendentes:", falta.length, "| a conferir:", conferir.length, "| fitas no total:", rows.length);
