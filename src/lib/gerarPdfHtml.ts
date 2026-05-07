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
import { gerarOrcamentoHtmlV2 } from "./pdfTemplates/v2";

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

export function gerarOrcamentoHtml(params: PdfParams): string {
  const v = params.templateVersion ?? 2;
  if (v >= 2) {
    return gerarOrcamentoHtmlV2(params);
  }
  return gerarOrcamentoHtmlV1(params);
}
