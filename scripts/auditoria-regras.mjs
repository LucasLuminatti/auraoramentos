/** Auditoria: regra que o código implementa mas que o catálogo real nunca dispara.
 *  (1) SKUs hardcoded que não existem / estão descontinuados.
 *  (2) Filtros de busca (tipo_produto, subtipo, sistema, familia_perfil) que casam 0 produtos.
 *  (3) Colunas que as regras leem e estão vazias no catálogo inteiro. */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
for (const f of [".env",".env.local"]) { try { for (const l of readFileSync(f,"utf8").split(/\r?\n/)) { const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/); if(m&&!(m[1] in process.env)) process.env[m[1]]=m[2].replace(/^["']|["']$/g,""); } } catch {} }
const sb=createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const rows=[]; let from=0;
for(;;){ const {data,error}=await sb.from("product_variants").select("codigo,descricao,tipo_produto,subtipo,sistema,familia_perfil,cor,largura_mm,largura_canal_mm,tamanho_rolo_m,watts_por_metro,potencia_watts,tensao,somente_baby,driver_tipo_permitido,driver_max_watts,passadas_padrao,imagem_url,preco_tabela,preco_minimo").range(from,from+999); if(error) throw error; if(!data?.length) break; rows.push(...data); if(data.length<1000) break; from+=1000; }
const ativos = rows.filter(r=>!/DESCONTINUAR/i.test(r.descricao||""));
console.log(`catálogo: ${rows.length} variantes (${ativos.length} sem "DESCONTINUAR")\n`);
const porCodigo = new Map(rows.map(r=>[r.codigo,r]));

// (1) SKUs hardcoded
const skus = readFileSync("/tmp/skus-prod.txt","utf8").split(/\r?\n/).filter(Boolean).filter(c=>c!=="LM9999");
console.log("=== (1) SKUs citados no código ===");
for (const c of skus) {
  const p = porCodigo.get(c);
  if (!p) console.log(`  ✗ ${c} NÃO EXISTE no catálogo`);
  else if (/DESCONTINUAR/i.test(p.descricao)) console.log(`  ⚠ ${c} DESCONTINUADO — ${p.descricao.slice(0,60)}`);
}
console.log("  (o que não apareceu acima existe e está ativo)\n");

// (2) filtros usados no código
const conta = (f) => ativos.filter(f).length;
console.log("=== (2) filtros de busca × produtos que casam ===");
const filtros = [
  ["tipo_produto='fita'", r=>r.tipo_produto==="fita"],
  ["tipo_produto='driver'", r=>r.tipo_produto==="driver"],
  ["tipo_produto='perfil'", r=>r.tipo_produto==="perfil"],
  ["tipo_produto='conector'", r=>r.tipo_produto==="conector"],
  ["tipo_produto='kit_fixacao'", r=>r.tipo_produto==="kit_fixacao"],
  ["tipo_produto='acessorio' AND sistema='s_mode' (difusos do modular)", r=>r.tipo_produto==="acessorio"&&r.sistema==="s_mode"],
  ["sistema='tiny_magneto'", r=>r.sistema==="tiny_magneto"],
  ["sistema='magneto_48v'", r=>r.sistema==="magneto_48v"],
  ["sistema='trilha'", r=>r.sistema==="trilha"],
  ["subtipo='magnetico'", r=>r.subtipo==="magnetico"],
  ["descricao ilike '%TAMPA CEGA%'", r=>/TAMPA CEGA/i.test(r.descricao)],
  ["descricao ilike '%BABY%' (fita)", r=>r.tipo_produto==="fita"&&/BABY/i.test(r.descricao)],
  ["descricao ilike '%SYSTEM MOLD%' + MODULO", r=>/SYSTEM MOLD/i.test(r.descricao)&&/MODULO/i.test(r.descricao)],
  ["descricao ilike '%TRILHO ELETRIFICADO%'", r=>/TRILHO ELETRIFICADO/i.test(r.descricao)],
];
for (const [nome,f] of filtros) { const n=conta(f); console.log(`  ${n===0?"✗ ZERO":String(n).padStart(5)} ${nome}`); }

// (3) colunas que as regras leem
console.log("\n=== (3) colunas lidas por regra, e quanto estão vazias ===");
const vazio = (nome, f, universoNome, universoF) => {
  const universo = ativos.filter(universoF);
  const preenchidos = universo.filter(f).length;
  const pct = universo.length ? Math.round((1-preenchidos/universo.length)*100) : 0;
  console.log(`  ${String(preenchidos).padStart(4)}/${String(universo.length).padEnd(5)} ${nome} — ${pct}% vazio (${universoNome})`);
};
vazio("largura_mm", r=>r.largura_mm!=null, "fitas", r=>r.tipo_produto==="fita");
vazio("watts_por_metro", r=>r.watts_por_metro!=null, "fitas", r=>r.tipo_produto==="fita");
vazio("tamanho_rolo_m", r=>r.tamanho_rolo_m!=null, "fitas", r=>r.tipo_produto==="fita");
vazio("familia_perfil", r=>!!r.familia_perfil, "perfis", r=>r.tipo_produto==="perfil");
vazio("largura_canal_mm", r=>r.largura_canal_mm!=null, "perfis", r=>r.tipo_produto==="perfil");
vazio("somente_baby=true", r=>r.somente_baby===true, "perfis", r=>r.tipo_produto==="perfil");
vazio("driver_tipo_permitido", r=>!!r.driver_tipo_permitido, "perfis", r=>r.tipo_produto==="perfil");
vazio("driver_max_watts", r=>r.driver_max_watts!=null, "perfis", r=>r.tipo_produto==="perfil");
vazio("cor", r=>!!r.cor, "todos", ()=>true);
vazio("potencia_watts", r=>r.potencia_watts!=null, "drivers", r=>r.tipo_produto==="driver");
vazio("tensao", r=>r.tensao!=null, "drivers", r=>r.tipo_produto==="driver");
vazio("imagem_url", r=>!!r.imagem_url, "todos", ()=>true);
vazio("preco_tabela > 0", r=>(r.preco_tabela??0)>0, "todos", ()=>true);

// (4) famílias: o que o cadastro usa × o que a tabela de regras conhece
const { data: regras } = await sb.from("regras_compatibilidade_perfil").select("familia_perfil");
const conhecidas = new Set((regras||[]).map(r=>r.familia_perfil));
const usadas = new Map();
for (const r of ativos.filter(x=>x.familia_perfil)) usadas.set(r.familia_perfil,(usadas.get(r.familia_perfil)||0)+1);
console.log("\n=== (4) famílias de perfil: cadastro × tabela de regras ===");
for (const [f,n] of [...usadas.entries()].sort((a,b)=>b[1]-a[1]))
  console.log(`  ${conhecidas.has(f)?"ok ":"✗ SEM REGRA"} ${f} (${n} produtos)`);
const semUso = [...conhecidas].filter(f=>!usadas.has(f));
console.log(`  regras cadastradas que nenhum produto usa: ${semUso.join(", ") || "nenhuma"}`);

// (5) vinculos_spot_lampada
const { count } = await sb.from("vinculos_spot_lampada").select("*",{count:"exact",head:true});
console.log(`\n=== (5) vinculos_spot_lampada: ${count} linhas ===`);
