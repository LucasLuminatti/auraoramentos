import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "node:fs";
for (const f of [".env",".env.local"]) { try { for (const l of readFileSync(f,"utf8").split(/\r?\n/)) { const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/); if(m&&!(m[1] in process.env)) process.env[m[1]]=m[2].replace(/^["']|["']$/g,""); } } catch {} }
const sb=createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const rows=[]; let from=0;
for(;;){ const {data,error}=await sb.from("product_variants").select("codigo,descricao,watts_por_metro,tamanho_rolo_m").eq("tipo_produto","fita").range(from,from+999); if(error) throw error; if(!data?.length) break; rows.push(...data); if(data.length<1000) break; from+=1000; }
const ehFita = d => { const up=(d||"").toUpperCase(); return !/^\s*(ADAPTADOR|FONTE|DRIVER|CONTROLADOR|SIST\b|SISTEMA|KIT|PERFIL|CONECTOR)/.test(up) && /FITA|NEON/.test(up); };
const falta = rows.filter(r => (r.watts_por_metro==null || r.tamanho_rolo_m==null))
  .sort((a,b)=>(a.codigo||"").localeCompare(b.codigo||""));
const fitas = falta.filter(r=>ehFita(r.descricao));
const naoFitas = falta.filter(r=>!ehFita(r.descricao));
const linhas=["codigo;descricao;watts_por_metro;tamanho_rolo_m;o_que_falta"];
for (const r of fitas) linhas.push([r.codigo,(r.descricao||"").replace(/;/g,","),r.watts_por_metro??"",r.tamanho_rolo_m??"",
  [r.watts_por_metro==null?"W/m":null, r.tamanho_rolo_m==null?"tamanho do rolo":null].filter(Boolean).join(" + ")].join(";"));
linhas.push("");
linhas.push("PRODUTOS ABAIXO ESTAO CADASTRADOS COMO FITA MAS NAO SAO FITA (adaptador, sistema, kit) - o certo e corrigir o tipo, nao preencher W/m;;;;");
for (const r of naoFitas) linhas.push([r.codigo,(r.descricao||"").replace(/;/g,","),"","","tipo_produto errado"].join(";"));
writeFileSync("../analise/fitas-cadastro-pendente-2026-09-08.csv","﻿"+linhas.join("\r\n"),"utf8");
console.log("fitas de verdade pendentes:", fitas.length, "| classificadas errado como fita:", naoFitas.length);
