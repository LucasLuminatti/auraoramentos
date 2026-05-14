/**
 * Phase 10 — WIZ-05 (D-19, D-20, D-24)
 *
 * Builder puro de descrição rica de produto para Step 3 + PDF v2.
 * Formato: `Nome | <temperatura_k>K | <potencia_watts>W | IRC <irc> | <nicho>`
 *
 * Atributo ausente é suprimido (não aparece `—` nem placeholder). Distinção entre
 * "ausência" (null/undefined/string vazia) e "valor zero" — apenas o primeiro é suprimido.
 *
 * Step 2 (AmbienteCard) e PDF v1 NÃO consomem este builder — mantêm descrição crua (D-21).
 */

export interface AtributosRicos {
  nome: string;
  atributos?: Record<string, unknown> | null;
  potenciaWatts?: number | null;
}

function asNumberOrNull(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}

function asStringOrNull(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length > 0 ? s : null;
}

/**
 * Constrói a descrição rica suprimindo atributos ausentes.
 *
 * @example
 *   construirDescricaoRica({ nome: "Plafon X", atributos: { temperatura_k: 4000, irc: 90, nicho: "embutir" }, potenciaWatts: 12 })
 *   // → "Plafon X | 4000K | 12W | IRC 90 | embutir"
 *
 *   construirDescricaoRica({ nome: "Plafon X" })
 *   // → "Plafon X"
 */
export function construirDescricaoRica({ nome, atributos, potenciaWatts }: AtributosRicos): string {
  const partes: string[] = [nome.trim()];

  const tempK = asNumberOrNull(atributos?.temperatura_k);
  if (tempK != null) partes.push(`${tempK}K`);

  if (potenciaWatts != null) partes.push(`${potenciaWatts}W`);

  const irc = asNumberOrNull(atributos?.irc);
  if (irc != null) partes.push(`IRC ${irc}`);

  const nicho = asStringOrNull(atributos?.nicho);
  if (nicho != null) partes.push(nicho);

  return partes.join(" | ");
}
