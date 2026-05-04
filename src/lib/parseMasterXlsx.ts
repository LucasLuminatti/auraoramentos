/**
 * Phase 3 / Plan 04
 *
 * Parser puro do XLSX master (base_dados_site_2026.xlsx).
 * Lê 2 abas relevantes:
 *  - "Produtos" (60 pais): produto_id, Categoria, Tipologia, ...
 *  - "Variantes" (2088 SKUs): SKU, produto_id, Variante_Nome, etc.
 *
 * Retorna shape pronto pra reconcile() e batch INSERT em products + product_variants.
 *
 * Refs: D-01, D-02, RESEARCH Pattern 4 (browser parsing < 1s para 2088 rows),
 *       RESEARCH Code Example 3 (mapMasterRow), Sources (4 abas verificadas).
 *
 * Função pura — recebe ArrayBuffer, sem IO de Storage/DB.
 */

import * as XLSX from "xlsx";
import { mapMasterRow, type MasterVariantRow } from "./productAttributes";

export interface ParsedMasterProduct {
  codigo_pai: string;     // ex: "P0001"
  nome: string;           // herda Categoria + Tipologia (e.g. "Arandela VISION") ou Categoria como fallback
  categoria: string | null;
  tipologia: string | null;
}

export interface ParsedMaster {
  products: ParsedMasterProduct[];
  variants: MasterVariantRow[];
}

export class ParseMasterError extends Error {
  code: "MISSING_SHEET" | "EMPTY_SHEET" | "PARSE_FAILED";
  constructor(code: ParseMasterError["code"], message: string) {
    super(message);
    this.name = "ParseMasterError";
    this.code = code;
  }
}

/**
 * Parseia o workbook XLSX da master e retorna products + variants.
 * @param buffer - ArrayBuffer do arquivo lido via file.arrayBuffer()
 */
export function parseMasterXlsx(buffer: ArrayBuffer): ParsedMaster {
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: "array" });
  } catch (e) {
    throw new ParseMasterError("PARSE_FAILED", `Não foi possível abrir o arquivo XLSX: ${(e as Error).message}`);
  }

  // 1. Aba "Variantes" é obrigatória — sem ela não tem o que importar
  const variantsSheet = workbook.Sheets["Variantes"] || workbook.Sheets["Base Completa (flat)"];
  if (!variantsSheet) {
    throw new ParseMasterError(
      "MISSING_SHEET",
      "Aba 'Variantes' (ou 'Base Completa (flat)') não encontrada no XLSX. Verifique se o arquivo é a master 2026.",
    );
  }

  const variantsRaw = XLSX.utils.sheet_to_json<Record<string, unknown>>(variantsSheet, { defval: null });
  if (variantsRaw.length === 0) {
    throw new ParseMasterError("EMPTY_SHEET", "Aba 'Variantes' está vazia.");
  }

  // 2. Aba "Produtos" — opcional mas usada para enriquecer products[].nome.
  // Se ausente, products[] é derivado dos produto_id distintos das variantes.
  const productsSheet = workbook.Sheets["Produtos"];
  const productsRaw: Record<string, unknown>[] = productsSheet
    ? XLSX.utils.sheet_to_json<Record<string, unknown>>(productsSheet, { defval: null })
    : [];

  // 3. Mapear variantes via mapMasterRow (Plan 02). Filtrar SKUs vazios.
  const variants: MasterVariantRow[] = [];
  for (const row of variantsRaw) {
    const mapped = mapMasterRow(row);
    if (!mapped.sku) continue; // SKU vazio descartado
    variants.push(mapped);
  }

  // 4. Construir products: união de produto_ids das variantes + enriquecimento da aba Produtos
  const productById = new Map<string, ParsedMasterProduct>();

  // 4a. A partir das variantes — nome inicial = Categoria/Tipologia
  for (const v of variants) {
    if (!v.produto_id) continue;
    if (!productById.has(v.produto_id)) {
      const inferredNome = [v.categoria, v.tipologia].filter(Boolean).join(" — ").trim() || v.produto_id;
      productById.set(v.produto_id, {
        codigo_pai: v.produto_id,
        nome: inferredNome,
        categoria: v.categoria || null,
        tipologia: v.tipologia || null,
      });
    }
  }

  // 4b. Sobrescreve nome com info da aba Produtos quando disponível
  for (const row of productsRaw) {
    const id = String(row.produto_id ?? "").trim();
    if (!id) continue;
    const cat = String(row.Categoria ?? "").trim() || null;
    const tip = String(row.Tipologia ?? "").trim() || null;
    const explicitName = String(row.Nome ?? row.nome ?? "").trim();
    const nome = explicitName || [cat, tip].filter(Boolean).join(" — ") || id;
    if (productById.has(id)) {
      const existing = productById.get(id)!;
      existing.nome = nome;
      existing.categoria = cat ?? existing.categoria;
      existing.tipologia = tip ?? existing.tipologia;
    } else {
      productById.set(id, { codigo_pai: id, nome, categoria: cat, tipologia: tip });
    }
  }

  return {
    products: Array.from(productById.values()),
    variants,
  };
}
