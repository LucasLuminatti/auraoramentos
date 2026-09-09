// Diagnóstico: foto-produto-nao-aparece-pdf
// Inspeciona o orçamento Ablim Cozinha e os imagemUrl dos itens no snapshot.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

for (const f of [".env", ".env.local"]) {
  try {
    for (const line of readFileSync(f, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {}
}

const URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) throw new Error("Faltam VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
const sb = createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });

// 1. Buscar orçamentos recentes (Ablim ou criados hoje)
console.log("=== 1. Orçamentos recentes (criados hoje ou com 'Ablim' no projeto/cliente) ===");
const today = new Date().toISOString().slice(0, 10);
const { data: orcamentos, error: orcErr } = await sb
  .from("orcamentos")
  .select("id, projeto_id, cliente_id, pdf_template_version, created_at, valor, status")
  .gte("created_at", today + "T00:00:00Z")
  .order("created_at", { ascending: false })
  .limit(10);

if (orcErr) throw orcErr;
console.log(`Encontrados ${orcamentos.length} orçamentos hoje:`);
for (const o of orcamentos) console.log(` - id=${o.id} projeto=${o.projeto_id} cliente=${o.cliente_id} template=${o.pdf_template_version} valor=${o.valor} status=${o.status} created=${o.created_at}`);

// 2. Para cada orçamento, ler ambientes jsonb e checar imagemUrl
if (orcamentos.length === 0) {
  console.log("\nNenhum orçamento hoje. Buscando os 5 mais recentes...");
  const { data: recent, error: rErr } = await sb
    .from("orcamentos")
    .select("id, projeto_id, pdf_template_version, created_at, valor, status")
    .order("created_at", { ascending: false })
    .limit(5);
  if (rErr) throw rErr;
  for (const o of recent) console.log(` - id=${o.id} created=${o.created_at} template=${o.pdf_template_version}`);
}

// 3. Pega o orçamento mais recente (ou Ablim se disponível) para inspecionar ambientes
let targetId = orcamentos[0]?.id;

// Tenta buscar por "ablim" no nome do cliente/projeto se não encontrou hoje
if (!targetId) {
  // Busca via clientes/projetos
  const { data: clientes } = await sb.from("clientes").select("id, nome").ilike("nome", "%ablim%");
  console.log("\nClientes com 'Ablim':", clientes);
  if (clientes?.length) {
    const { data: orcsCliente } = await sb
      .from("orcamentos")
      .select("id, pdf_template_version, created_at")
      .eq("cliente_id", clientes[0].id)
      .order("created_at", { ascending: false })
      .limit(1);
    targetId = orcsCliente?.[0]?.id;
  }
}

if (!targetId) {
  console.log("\nNão encontrou orçamento. Pegando o mais recente de todos...");
  const { data: fallback } = await sb
    .from("orcamentos")
    .select("id, pdf_template_version, created_at")
    .order("created_at", { ascending: false })
    .limit(1);
  targetId = fallback?.[0]?.id;
}

if (!targetId) {
  console.log("ERRO: Nenhum orçamento encontrado.");
  process.exit(1);
}

console.log(`\n=== 2. Inspecionando ambientes do orçamento ${targetId} ===`);
const { data: orc, error: orcDetailErr } = await sb
  .from("orcamentos")
  .select("id, pdf_template_version, created_at, ambientes")
  .eq("id", targetId)
  .single();
if (orcDetailErr) throw orcDetailErr;

const ambientes = orc.ambientes;
console.log(`pdf_template_version: ${orc.pdf_template_version}`);
console.log(`Total ambientes: ${ambientes?.length ?? 0}`);

// Coletar todos os imagemUrl e codigos
const imagemUrls = [];
const codigos = new Set();

for (const amb of (ambientes || [])) {
  console.log(`\nAmbiente: ${amb.nome}`);
  for (const l of (amb.luminarias || [])) {
    console.log(`  Luminária [${l.codigo}] "${l.descricao}" → imagemUrl: ${l.imagemUrl || "(vazio)"}`);
    if (l.imagemUrl) imagemUrls.push({ tipo: "luminaria", codigo: l.codigo, url: l.imagemUrl });
    if (l.codigo) codigos.add(l.codigo);
  }
  for (const s of (amb.sistemas || [])) {
    console.log(`  Sistema fita [${s.fita?.codigo}] → imagemUrl: ${s.fita?.imagemUrl || "(vazio)"}`);
    console.log(`  Sistema driver [${s.driver?.codigo}] → imagemUrl: ${s.driver?.imagemUrl || "(vazio)"}`);
    if (s.perfil) console.log(`  Sistema perfil [${s.perfil?.codigo}] → imagemUrl: ${s.perfil?.imagemUrl || "(vazio)"}`);
    if (s.fita?.imagemUrl) imagemUrls.push({ tipo: "fita", codigo: s.fita.codigo, url: s.fita.imagemUrl });
    if (s.driver?.imagemUrl) imagemUrls.push({ tipo: "driver", codigo: s.driver.codigo, url: s.driver.imagemUrl });
    if (s.perfil?.imagemUrl) imagemUrls.push({ tipo: "perfil", codigo: s.perfil.codigo, url: s.perfil.imagemUrl });
    if (s.fita?.codigo) codigos.add(s.fita.codigo);
    if (s.driver?.codigo) codigos.add(s.driver.codigo);
    if (s.perfil?.codigo) codigos.add(s.perfil.codigo);
  }
}

// 4. Checar imagem_url no catálogo para os mesmos códigos
console.log(`\n=== 3. imagem_url no catálogo (product_variants) para os ${codigos.size} códigos ===`);
if (codigos.size > 0) {
  const { data: variants, error: vErr } = await sb
    .from("product_variants")
    .select("codigo, descricao, imagem_url")
    .in("codigo", Array.from(codigos));
  if (vErr) throw vErr;
  for (const v of (variants || [])) {
    console.log(`  [${v.codigo}] "${v.descricao}" → imagem_url: ${v.imagem_url || "(NULL)"}`);
  }
}

// 5. Testar fetch de cada imagemUrl para checar CORS
console.log(`\n=== 4. Testando fetch das URLs de imagem (CORS check) ===`);
if (imagemUrls.length === 0) {
  console.log("  Nenhuma imagemUrl encontrada no snapshot — CONFIRMADO: imagemUrl está vazio no snapshot.");
} else {
  for (const { tipo, codigo, url } of imagemUrls) {
    try {
      const res = await fetch(url, { method: "HEAD" });
      const cors = res.headers.get("access-control-allow-origin") || "(ausente)";
      console.log(`  [${tipo}][${codigo}] HTTP ${res.status} CORS: ${cors} | ${url.slice(0, 80)}...`);
    } catch (e) {
      console.log(`  [${tipo}][${codigo}] FETCH ERRO: ${e.message} | ${url.slice(0, 80)}`);
    }
  }
}

console.log("\n=== Diagnóstico concluído ===");
