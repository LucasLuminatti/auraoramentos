/**
 * Phase 3 / Plan 02
 *
 * Parsers puros para mapear linhas da master (base_dados_site_2026.xlsx) para o shape
 * esperado por product_variants. Separa typed columns (tensao, watts_por_metro, etc.)
 * de atributos jsonb (Lumens, IRC, Material, Cabo, Dimensao, etc. — D-02).
 *
 * Funções puras — testáveis sem mock.
 */

const PARSE_TENSAO_RE = /^(\d+)V\s*DC\b/i;

/** Extrai 12, 24 ou 48 de strings tipo "12V DC", "24V DC", "48V DC".
 *  Retorna null para outras formas (vão para atributos.tensao_raw). */
export function parseTensao(raw: unknown): number | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const m = s.match(PARSE_TENSAO_RE);
  if (!m) return null;
  const v = parseInt(m[1], 10);
  return [12, 24, 48].includes(v) ? v : null;
}

/** Extrai watts numéricos de "10W/m", "5W", "38W", "2,5W" etc. Aceita vírgula como decimal. */
export function parsePotencia(raw: unknown): number | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const m = s.match(/^([\d,.]+)\s*W/i);
  if (!m) return null;
  const n = parseFloat(m[1].replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export interface MasterVariantRow {
  sku: string;
  produto_id: string;       // P0001 etc — código do pai na master
  variante_nome: string;
  categoria: string;
  tipologia: string;
  atributos: Record<string, unknown>;
  // colunas typed (mapeadas)
  tensao: number | null;
  watts_por_metro: number | null;
  potencia_watts: number | null;
  largura_mm: number | null;
  cor: string | null;
}

/** Mapeia 1 linha da aba "Variantes" / "Base Completa (flat)" da master.
 *  Schema da master inspecionado fisicamente em 2026-04-30 (RESEARCH Sources). */
export function mapMasterRow(row: Record<string, unknown>): MasterVariantRow {
  const sku = String(row.SKU ?? "").trim();
  const produto_id = String(row.produto_id ?? "").trim();
  const variante_nome = String(row.Variante_Nome ?? "").trim();
  const categoria = String(row.Categoria ?? "").trim();
  const tipologia = String(row.Tipologia ?? "").trim();

  const tensao = parseTensao(row.Variante_Tensao);

  // Para fita LED, Variante_Potencia é watts/metro; para outros, é potência total
  const isFita = tipologia === "Fita LED";
  const watts_por_metro = isFita ? parsePotencia(row.Variante_Potencia) : null;
  const potencia_watts = !isFita ? parsePotencia(row.Variante_Potencia) : null;

  // Cor da peça (se string) vai pra coluna typed; resto vai pra atributos
  const corPeca = row["Variante_Cor da peca"];
  const cor = typeof corPeca === "string" && corPeca.trim() ? corPeca.trim() : null;

  // Tudo que não cabe em coluna typed vai para atributos jsonb (preserva dado original).
  // Pitfall 4: tensao_raw preservada mesmo quando parseTensao retorna null.
  const atributos: Record<string, unknown> = {
    instalacao: row.Variante_Instalacao,
    tipo: row.Variante_Tipo,
    cor_peca: row["Variante_Cor da peca"],
    temperatura_k: row["Variante_Temperatura da luz (K)"],
    cor_iluminacao: row["Variante_Cor da iluminacao"],
    lumens: row.Variante_Lumens,
    eficiencia: row.Variante_Eficiencia,
    irc: row.Variante_IRC,
    angulo: row.Variante_Angulo,
    tensao_raw: row.Variante_Tensao, // preserva sempre — Pitfall 4
    fator_potencia: row["Variante_Fator de Potencia"],
    frequencia: row.Variante_Frequencia,
    material: row.Variante_Material,
    cabo: row.Variante_Cabo,
    driver_incluso: row["Variante_Driver incluso"],
    dimensao: row.Variante_Dimensao,
    nicho: row.Variante_Nicho,
    variante: row.Variante_Variante,
    familia: row.Variante_Familia,
    pagina: row.Variante_Pagina,
    observacoes: row.Variante_Observacoes,
  };

  return {
    sku,
    produto_id,
    variante_nome,
    categoria,
    tipologia,
    atributos,
    tensao,
    watts_por_metro,
    potencia_watts,
    largura_mm: null, // master não traz
    cor,
  };
}
