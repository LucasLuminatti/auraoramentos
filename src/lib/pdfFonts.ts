/**
 * Carrega Inter + Playfair Display via @fontsource (bundle local Vite — sem race com CDN).
 * Cada import roda os @font-face uma vez no document. Pesos baseados no template v2 do PDF.
 *
 * Phase 5 / PDF-01. Resolve Pitfall 1 do RESEARCH (Google Fonts CDN race condition em html2canvas).
 */

import "@fontsource/inter/300.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/playfair-display/400.css";
import "@fontsource/playfair-display/500.css";
import "@fontsource/playfair-display/400-italic.css";

/**
 * Aguarda todas as @font-face declaradas no document terminarem de carregar.
 * Use ANTES de chamar html2pdf() para garantir que html2canvas captura a fonte
 * correta em vez do fallback (Helvetica/Times). Cross-browser desde 2018.
 */
export async function ensureFontsReady(): Promise<void> {
  if (typeof document === "undefined" || !document.fonts) return;
  // Force-trigger load para os pesos críticos do template v2 ANTES de awaitar `.ready`.
  // Sem isso, `.ready` pode resolver instantaneamente se o browser ainda não começou
  // a carregar os @font-face injetados pelos imports CSS acima (race do CSSOM).
  await Promise.all([
    document.fonts.load("400 11px Inter"),
    document.fonts.load("600 11px Inter"),
    document.fonts.load("700 11px Inter"),
    document.fonts.load("400 18px \"Playfair Display\""),
    document.fonts.load("italic 400 18px \"Playfair Display\""),
  ]).catch(() => {
    // Fallback silencioso — se algum peso falhar, o template degrada para a fonte de fallback
    // do CSS sem quebrar a geração do PDF.
  });
  await document.fonts.ready;
}
