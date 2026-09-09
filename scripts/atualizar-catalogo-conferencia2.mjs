// Atualiza descricao/nome e enriquece atributos dos produtos do catalogo oficial
// a partir da planilha "Conferencia catalogo 2.xlsx" (Planilha1).
//
// - Atualiza descricao + nome com a descricao completa do catalogo.
// - Enriquece atributos com categoria/familia/subfamilia/pagina/ean (METADADO; sem logica de negocio).
// - Faz MERGE em atributos (nao apaga chaves existentes).
// - PULA produtos editado_manualmente=true.
// - So mexe nos codigos que ja existem no banco (os ausentes ficam intactos).
// - Faz BACKUP do estado atual das linhas afetadas antes de escrever.
//
// Uso:
//   node scripts/atualizar-catalogo-conferencia2.mjs            (dry-run: so mostra o que faria)
//   node scripts/atualizar-catalogo-conferencia2.mjs --apply    (aplica em producao)
//
// Le SUPABASE_SERVICE_ROLE_KEY e VITE_SUPABASE_URL de .env / .env.local.

import fs from "node:fs";
import path from "node:path";
import XLSX from "xlsx";

const APPLY = process.argv.includes("--apply");
const XLSX_PATH =
  process.argv.find((a) => a.endsWith(".xlsx")) ||
  "C:/Users/lenny/Downloads/Conferencia catalogo 2.xlsx";
const SHEET = "Planilha1";
const CONCURRENCY = 10;

// --- env ---
const env = {};
for (const f of [".env", ".env.local"]) {
  const p = path.resolve(process.cwd(), f);
  if (fs.existsSync(p)) {
    for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m) env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
    }
  }
}
const BASE = env.VITE_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const KEY = SERVICE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!BASE || !KEY) throw new Error("Faltam VITE_SUPABASE_URL / chave no .env(.local)");
if (APPLY && !SERVICE_KEY)
  throw new Error("--apply exige SUPABASE_SERVICE_ROLE_KEY no .env.local (a chave publica nao escreve)");

const norm = (s) => (s == null ? "" : s.toString()).trim();
const U = (s) => norm(s).toUpperCase();

// --- le a planilha ---
const wb = XLSX.readFile(XLSX_PATH);
const rows = XLSX.utils.sheet_to_json(wb.Sheets[SHEET], { header: 1, defval: "" }).slice(1);
// colunas: 0 Codigo | 1 Descricao | 3 Categoria | 4 Pagina | 5 Familia | 6 Subfamilia | 7 EAN-Catalogo | 8 EAN-Cadastro
const catalogo = new Map();
for (const r of rows) {
  const cod = U(r[0]);
  const desc = norm(r[1]);
  if (!cod || !desc) continue; // nao sobrescreve com descricao vazia
  catalogo.set(cod, {
    desc,
    categoria: norm(r[3]) || null,
    pagina: r[4] === "" ? null : r[4],
    familia: norm(r[5]) || null,
    subfamilia: norm(r[6]) || null,
    ean_catalogo: norm(r[7]) || null,
    ean_cadastro: norm(r[8]) || null,
  });
}
console.log(`Planilha ${SHEET}: ${catalogo.size} codigos com descricao.`);

// --- busca o estado atual no banco ---
async function fetchAll() {
  const out = [];
  for (let off = 0; ; off += 1000) {
    const res = await fetch(
      `${BASE}/rest/v1/product_variants?select=id,codigo,descricao,nome,atributos,editado_manualmente&limit=1000&offset=${off}`,
      { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } }
    );
    const j = await res.json();
    if (!Array.isArray(j) || !j.length) break;
    out.push(...j);
    if (j.length < 1000) break;
  }
  return out;
}

const db = await fetchAll();
const dbByCode = new Map(db.map((p) => [U(p.codigo), p]));
console.log(`Banco: ${db.length} produtos.`);

// --- monta os updates ---
const updates = [];
let skippedManual = 0;
let notInDb = 0;
for (const [cod, cat] of catalogo) {
  const row = dbByCode.get(cod);
  if (!row) {
    notInDb++;
    continue;
  }
  if (row.editado_manualmente) {
    skippedManual++;
    continue;
  }
  const atributosAtuais = row.atributos && typeof row.atributos === "object" ? row.atributos : {};
  const novosAtributos = {
    ...atributosAtuais,
    categoria: cat.categoria,
    familia: cat.familia,
    subfamilia: cat.subfamilia,
    pagina: cat.pagina,
    ean_catalogo: cat.ean_catalogo,
    ean_cadastro: cat.ean_cadastro,
  };
  updates.push({
    id: row.id,
    codigo: row.codigo,
    antes: { descricao: row.descricao, nome: row.nome },
    patch: { descricao: cat.desc, nome: cat.desc, atributos: novosAtributos },
  });
}

console.log(`\nA atualizar: ${updates.length}`);
console.log(`Pulados (editado_manualmente): ${skippedManual}`);
console.log(`Da planilha mas ausentes no banco (ignorados): ${notInDb}`);
console.log("\nAmostra (antes -> depois):");
for (const u of updates.slice(0, 6)) {
  console.log(`  ${u.codigo}: ${JSON.stringify(u.antes.descricao)} -> ${JSON.stringify(u.patch.descricao)}`);
}

if (!APPLY) {
  console.log("\n[DRY-RUN] Nada foi escrito. Rode com --apply para aplicar.");
  process.exit(0);
}

// --- backup do estado atual das linhas afetadas ---
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupFile = path.resolve(process.cwd(), `scripts/backup-catalogo2-${stamp}.json`);
const backup = updates.map((u) => {
  const row = dbByCode.get(U(u.codigo));
  return { id: row.id, codigo: row.codigo, descricao: row.descricao, nome: row.nome, atributos: row.atributos };
});
fs.writeFileSync(backupFile, JSON.stringify(backup, null, 1));
console.log(`\nBackup salvo: ${backupFile} (${backup.length} linhas)`);

// --- aplica via PATCH por id ---
let ok = 0;
let fail = 0;
const errs = [];
async function patchOne(u) {
  const res = await fetch(`${BASE}/rest/v1/product_variants?id=eq.${u.id}`, {
    method: "PATCH",
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(u.patch),
  });
  if (res.ok) ok++;
  else {
    fail++;
    if (errs.length < 10) errs.push(`${u.codigo}: ${res.status} ${await res.text()}`);
  }
}

async function runPool(items, worker, size) {
  let i = 0;
  const workers = Array.from({ length: size }, async () => {
    while (i < items.length) {
      const idx = i++;
      await worker(items[idx]);
      if (idx % 200 === 0) console.log(`  ...${idx}/${items.length}`);
    }
  });
  await Promise.all(workers);
}

console.log("\nAplicando...");
await runPool(updates, patchOne, CONCURRENCY);
console.log(`\nFeito. OK: ${ok} | Falhas: ${fail}`);
if (errs.length) console.log("Erros:\n" + errs.join("\n"));
