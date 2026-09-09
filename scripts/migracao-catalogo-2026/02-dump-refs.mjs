import { createClient } from "@supabase/supabase-js";
import fs from "node:fs"; import path from "node:path";
const ROOT=path.resolve(import.meta.dirname,"../.."),HERE=import.meta.dirname;
function loadEnv(f){const o={};try{for(const l of fs.readFileSync(path.join(ROOT,f),"utf8").split(/\r?\n/)){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);if(m)o[m[1]]=m[2].replace(/^["']|["']$/g,"");}}catch{}return o;}
const env={...loadEnv(".env"),...loadEnv(".env.local")};
const sb=createClient(env.VITE_SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
async function dump(t,s="*"){let a=[];for(let f=0;;f+=1000){const{data,error}=await sb.from(t).select(s).range(f,f+999);if(error){console.error(t,error.message);return a;}a=a.concat(data);if(data.length<1000)break;}return a;}
const vinc=await dump("vinculos_spot_lampada");
const orcs=await dump("orcamentos","id,status,ambientes");
fs.writeFileSync(path.join(HERE,"db-vinculos.json"),JSON.stringify(vinc,null,2));
// extrai todos os codigos usados em ambientes jsonb
const usados=new Set();
function walk(o){if(!o||typeof o!=="object")return;if(Array.isArray(o)){o.forEach(walk);return;}for(const[k,v]of Object.entries(o)){if((k==="codigo"||k==="produto_codigo")&&typeof v==="string")usados.add(v.trim().toUpperCase());else walk(v);}}
for(const o of orcs)walk(o.ambientes);
fs.writeFileSync(path.join(HERE,"db-codigos-usados-orcamentos.json"),JSON.stringify([...usados].sort(),null,2));
console.log("vinculos_spot_lampada:",vinc.length);
const vcodes=new Set();vinc.forEach(v=>{if(v.codigo_spot)vcodes.add(v.codigo_spot.toUpperCase());if(v.codigo_lampada)vcodes.add(v.codigo_lampada.toUpperCase());});
console.log("codigos referenciados por vinculos:",vcodes.size);
console.log("orcamentos:",orcs.length,"| codigos usados em orcamentos:",usados.size);
