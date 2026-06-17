/**
 * Router de templates de PDF. Phase 5 / Plan 05.
 *
 * Mantém a assinatura pública `gerarOrcamentoHtml(params)` para preservar
 * todos os call sites (Step3Revisao + OrcamentoDetalhe). Internamente
 * dispatcha para v1 (legacy) ou v2 (editorial) baseado em
 * `params.templateVersion`.
 *
 * Regra de roteamento:
 * - templateVersion >= 2 → v2 (template editorial novo)
 * - templateVersion < 2 ou ausente → v1 (template legacy) — NOTA: o router
 *   default-aplica 2 quando ausente. O coalesce para 1 (legacy) acontece no
 *   LEITOR (OrcamentoDetalhe → `orc.pdf_template_version ?? 1`), porque é lá
 *   que rows pré-Phase 5 (NULL na coluna) precisam ser tratadas como v1.
 *
 * Step3Revisao sempre passa `templateVersion: 2` explicitamente — orçamentos
 * novos sempre saem com v2 e persistem `pdf_template_version: 2`.
 */

import type { Ambiente } from "@/types/orcamento";
import { gerarOrcamentoHtmlV1 } from "./pdfTemplates/v1";
import { gerarOrcamentoHtmlV2, type AtributosMap } from "./pdfTemplates/v2";
import { gerarOrcamentoHtmlV3 } from "./pdfTemplates/v3";
import { supabase } from "@/integrations/supabase/client";

export interface PdfParams {
  clienteNome: string;
  projetoNome: string;
  colaborador: string;
  tipo: string;
  ambientes: Ambiente[];
  logoBase64?: string;
  /**
   * Versão do template do PDF. >=2 = v2 editorial (Phase 5+).
   * <2 ou ausente = v1 legacy. PDF-05.
   */
  templateVersion?: number;
}

/**
 * WIZ-05 (D-23): batch lookup de atributos por código para descrição rica no PDF v2.
 * Executado apenas quando templateVersion >= 2. PDF v1 não faz lookup (D-21).
 */
async function buildAtributosMap(ambientes: Ambiente[]): Promise<AtributosMap> {
  const codigos = new Set<string>();
  for (const amb of ambientes) {
    for (const l of amb.luminarias) {
      if (l.codigo) codigos.add(l.codigo);
      // Phase 22: incluir códigos de composicao[] para lookup de atributos no bloco composto
      for (const c of l.composicao ?? []) if (c.codigo) codigos.add(c.codigo);
    }
    for (const sis of amb.sistemas) {
      if (sis.fita?.codigo) codigos.add(sis.fita.codigo);
      if (sis.driver?.codigo) codigos.add(sis.driver.codigo);
      if (sis.perfil?.codigo) codigos.add(sis.perfil.codigo);
    }
  }
  if (codigos.size === 0) return {};
  const { data, error } = await supabase
    .from("product_variants")
    .select("codigo, atributos, potencia_watts")
    .in("codigo", Array.from(codigos));
  if (error || !data) return {};
  const map: AtributosMap = {};
  for (const row of data) {
    if (row.codigo) {
      map[row.codigo] = {
        atributos: (row.atributos as Record<string, unknown> | null) ?? null,
        potencia_watts: row.potencia_watts ?? null,
      };
    }
  }
  return map;
}

/**
 * Router de templates de PDF — async para suportar batch lookup de atributos no v2 (WIZ-05).
 * Call sites já são async (handlePDF em Step3Revisao, OrcamentoDetalhe).
 */
export async function gerarOrcamentoHtml(params: PdfParams): Promise<string> {
  const v = params.templateVersion ?? 2;
  // Phase 22: branch v3 aditivo — dispara quando templateVersion >= 3 (default ?? 2 inalterado)
  if (v >= 3) {
    const atributosMap = await buildAtributosMap(params.ambientes);
    return gerarOrcamentoHtmlV3({ ...params, atributosMap });
  }
  if (v >= 2) {
    const atributosMap = await buildAtributosMap(params.ambientes);
    return gerarOrcamentoHtmlV2({ ...params, atributosMap });
  }
  return gerarOrcamentoHtmlV1(params);
}
