import type { Ambiente } from "@/types/orcamento";

/** True quando o orçamento contém ao menos um sistema composto.
 *  Expressão travada (Phase 22 / SC #2): composto = luminária com composicao?.length. */
export function temSistemaComposto(ambientes: Ambiente[]): boolean {
  return ambientes.some(a => a.luminarias.some(l => !!l.composicao?.length));
}

/** Resolve a versão do template do PDF para um orçamento.
 *  3 = tem composto (v3); 2 = sem composto (v2 editorial). Nunca retorna 1 (writer novo). */
export function resolverTemplateVersion(ambientes: Ambiente[]): 2 | 3 {
  return temSistemaComposto(ambientes) ? 3 : 2;
}
