import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../..");
const HERE = import.meta.dirname;
function loadEnv(file){const out={};try{for(const line of fs.readFileSync(path.join(ROOT,file),"utf8").split(/\r?\n/)){const m=line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);if(m)out[m[1]]=m[2].replace(/^["']|["']$/g,"");}}catch{}return out;}
const env={...loadEnv(".env"),...loadEnv(".env.local")};
const sb=createClient(env.VITE_SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});

async function dumpAll(table,select="*"){let all=[];const page=1000;for(let from=0;;from+=page){const{data,error}=await sb.from(table).select(select).range(from,from+page-1);if(error){console.error(table,error.message);break;}all=all.concat(data);if(data.length<page)break;}return all;}

const variants=await dumpAll("product_variants");
const products=await dumpAll("products");
fs.writeFileSync(path.join(HERE,"db-product_variants.json"),JSON.stringify(variants,null,2));
fs.writeFileSync(path.join(HERE,"db-products.json"),JSON.stringify(products,null,2));
console.log("product_variants:",variants.length);
console.log("products:",products.length);
if(variants[0])console.log("colunas:",Object.keys(variants[0]).join(", "));
const byOrigem={};for(const v of variants)byOrigem[v.origem]=(byOrigem[v.origem]||0)+1;
console.log("por origem:",JSON.stringify(byOrigem));
console.log("com preco_tabela>0:",variants.filter(v=>v.preco_tabela>0).length);
console.log("com campo tecnico:",variants.filter(v=>v.tensao||v.watts_por_metro||v.tipo_produto).length);
console.log("com imagem:",variants.filter(v=>v.imagem_url).length);
