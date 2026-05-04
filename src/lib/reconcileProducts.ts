/**
 * Phase 3 / Plan 02
 *
 * Função pura de reconciliação UPSERT entre master XLSX e estado atual do DB
 * (product_variants). Implementa as regras D-05..D-10 do CONTEXT.md:
 *
 *  D-05: SKU em ambos, editado_manualmente=false → master sobrescreve nome+atributos+typed cols
 *        (NUNCA arquiteto_id, preco_tabela, preco_minimo)
 *  D-06: SKU só no DB → mantém como legado (preservado, não tocado)
 *  D-07: SKU só na master → cria com origem='master'
 *  D-08: editado_manualmente=true → master NÃO sobrescreve (loga em skipped)
 *  D-10: origem='coringa' (AU001..16) → NUNCA sobrescrita por master
 *
 * Função PURA — sem IO. Plan 04 consome o report e roda batches via supabase.from().upsert().
 */

import type { MasterVariantRow } from "./productAttributes";

export type Origem = "master" | "legado" | "coringa" | "manual";

export interface DbVariantRow {
  id: string;
  codigo: string;        // SKU (chave de negócio)
  product_id: string;
  origem: Origem;
  editado_manualmente: boolean;
  arquiteto_id: string | null;
  preco_tabela: number | null;
  preco_minimo: number | null;
}

export type SkippedReason = "editado_manualmente" | "origem_coringa";

export interface ReconcileUpdate {
  id: string;
  sku: string;
  patch: Record<string, unknown>;
}

export interface ReconcileSkipped {
  sku: string;
  reason: SkippedReason;
}

export interface ReconcileReport {
  creates: MasterVariantRow[];
  updates: ReconcileUpdate[];
  skipped: ReconcileSkipped[];
  legados_preserved: string[];
}

/**
 * Reconcilia master XLSX contra estado atual do DB.
 * @param master - linhas parseadas da aba Variantes da master
 * @param db - snapshot atual de product_variants (codigos, flags)
 * @returns relatório com 4 buckets para o consumidor decidir o que fazer (INSERT batch, UPDATE batch, log)
 */
export function reconcile(
  master: MasterVariantRow[],
  db: DbVariantRow[],
): ReconcileReport {
  const dbBySku = new Map(db.map((v) => [v.codigo, v]));
  const masterSkus = new Set(master.map((v) => v.sku));

  const creates: MasterVariantRow[] = [];
  const updates: ReconcileUpdate[] = [];
  const skipped: ReconcileSkipped[] = [];

  for (const m of master) {
    const existing = dbBySku.get(m.sku);

    if (!existing) {
      // D-07: SKU só na master → cria
      creates.push(m);
      continue;
    }

    if (existing.origem === "coringa") {
      // D-10: AU coringa NUNCA sobrescrito por master
      skipped.push({ sku: m.sku, reason: "origem_coringa" });
      continue;
    }

    if (existing.editado_manualmente) {
      // D-05/D-08: master NÃO sobrescreve edição manual
      skipped.push({ sku: m.sku, reason: "editado_manualmente" });
      continue;
    }

    // D-05: master sobrescreve nome + atributos + typed cols
    // INVARIANTE CRÍTICO: NUNCA inclui arquiteto_id, preco_tabela, preco_minimo, editado_manualmente
    updates.push({
      id: existing.id,
      sku: m.sku,
      patch: {
        nome: m.variante_nome,
        descricao: m.variante_nome, // espelha nome da master na descricao
        atributos: m.atributos,
        tensao: m.tensao,
        watts_por_metro: m.watts_por_metro,
        potencia_watts: m.potencia_watts,
        largura_mm: m.largura_mm,
        cor: m.cor,
        origem: "master",
        // intencionalmente fora do patch:
        //   arquiteto_id (preserva DB)
        //   preco_tabela (preserva DB)
        //   preco_minimo (preserva DB)
        //   editado_manualmente (não muda — só ProdutoEditDialog seta)
      },
    });
  }

  // D-06: SKUs no DB sem match na master mantêm como 'legado' (preservados)
  const legados_preserved = db
    .filter((v) => !masterSkus.has(v.codigo))
    .map((v) => v.codigo);

  return { creates, updates, skipped, legados_preserved };
}
