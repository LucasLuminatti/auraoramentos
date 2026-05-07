/**
 * Pre-resolve URLs de thumbnails de produto (luminária / fita / driver / perfil) para
 * data: URLs base64 antes de gerar o PDF.
 *
 * Phase 5 / PDF-01. Resolve Pitfall 2 do RESEARCH:
 * html2canvas + URL externa com CORS frágil (signed URL Supabase) = espaço em branco silencioso.
 * Pre-converter para base64 evita totalmente esse risco.
 */

import type { Ambiente } from "@/types/orcamento";

/** Faz fetch de uma URL e retorna data:URL base64. Retorna null em caso de erro. */
async function urlToBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { credentials: "omit" });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("FileReader error"));
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * Pre-resolve TODOS os imagemUrl de um snapshot Ambiente[] em paralelo.
 * Retorna um deep-clone com imagemUrl trocado por base64 quando o fetch funcionou;
 * mantém URL original quando falhou (template v2 lida graciosamente com URL que vira espaço em branco
 * no fallback — mas a maioria dos casos vai converter com sucesso).
 *
 * Não muta o input. Não fetcha URLs já em data: (idempotente).
 */
export async function inlineImagensSnapshot(ambientes: Ambiente[]): Promise<Ambiente[]> {
  // Coleta URLs únicas
  const urls = new Map<string, Promise<string | null>>();
  const enqueue = (url?: string) => {
    if (!url || url.startsWith("data:")) return;
    if (!urls.has(url)) urls.set(url, urlToBase64(url));
  };
  for (const amb of ambientes) {
    for (const l of amb.luminarias) enqueue(l.imagemUrl);
    for (const s of amb.sistemas) {
      enqueue(s.fita.imagemUrl);
      enqueue(s.driver.imagemUrl);
      if (s.perfil) enqueue(s.perfil.imagemUrl);
    }
  }

  // Aguarda todos em paralelo
  const resolved = new Map<string, string>();
  await Promise.all(
    Array.from(urls.entries()).map(async ([url, p]) => {
      const v = await p;
      if (v) resolved.set(url, v);
    }),
  );

  // Deep-clone trocando imagemUrl pelos base64 quando disponíveis
  const swap = (url?: string): string | undefined => (url && resolved.get(url)) || url;
  return ambientes.map((amb) => ({
    ...amb,
    luminarias: amb.luminarias.map((l) => ({ ...l, imagemUrl: swap(l.imagemUrl) })),
    sistemas: amb.sistemas.map((s) => ({
      ...s,
      fita: { ...s.fita, imagemUrl: swap(s.fita.imagemUrl) },
      driver: { ...s.driver, imagemUrl: swap(s.driver.imagemUrl) },
      perfil: s.perfil ? { ...s.perfil, imagemUrl: swap(s.perfil.imagemUrl) } : null,
    })),
  }));
}
