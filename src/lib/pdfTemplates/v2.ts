/**
 * Template v2 — PDF editorial Apple-like.
 * Phase 5 / PDF-01..04. Decisões locked: CONTEXT.md Áreas A+B; Áreas C+D = defaults do RESEARCH.
 *
 * Hierarquia 5-níveis: Doc → Ambiente → Local → Sistema → Componente.
 * Paleta: neutro + laranja Luminatti (#E68601) como acento.
 * Tipografia: Playfair Display (títulos) + Inter (corpo) — via @fontsource carregado pelo call site.
 */

import type { Ambiente, ItemLuminaria, SistemaIluminacao } from "@/types/orcamento";
import {
  calcularDemandaFita,
  calcularConsumoW,
  calcularQtdDrivers,
  calcularSubtotalLuminaria,
  calcularSubtotalPerfilSistema,
  calcularSubtotalDriverSistema,
  calcularTotalAmbienteSemFita,
  calcularRolosPorGrupo,
  calcularTotalGeral,
  formatarMoeda,
} from "@/types/orcamento";

export interface PdfParamsV2 {
  clienteNome: string;
  projetoNome: string;
  colaborador: string;
  tipo: string;
  ambientes: Ambiente[];
  logoBase64?: string;
}

/* ──────────────────────────────────────────────────────────────
   Helpers
   ────────────────────────────────────────────────────────────── */

function formatarData(): string {
  return new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

/** Escapa texto pra HTML — defensivo contra nomes de cliente/projeto/local com `<` ou `&`. */
function esc(s: string | null | undefined): string {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Chip Inter 9px usado para specs secundárias. */
function chip(text: string, variant: "neutral" | "orange" = "neutral"): string {
  const bg = variant === "orange" ? "#fff4e0" : "#f4f6f8";
  const color = variant === "orange" ? "#E68601" : "#5a6475";
  return `<span class="chip" style="background:${bg};color:${color}">${esc(text)}</span>`;
}

/** Thumbnail 48×48 com fallback (espaço em branco) quando imagemUrl ausente. */
function thumb(url: string | undefined): string {
  if (!url) return `<div class="thumb-empty"></div>`;
  return `<img src="${esc(url)}" alt="" class="thumb" />`;
}

/** Agrupa sistemas de um ambiente por `local`. Sistemas com local null/undefined/"" caem em "Geral". */
function agruparPorLocal(sistemas: SistemaIluminacao[]): Array<{ local: string | null; sistemas: SistemaIluminacao[] }> {
  // Map preserva ordem de inserção (importante: respeita ordem que o usuário criou)
  const grupos = new Map<string | null, SistemaIluminacao[]>();
  for (const sis of sistemas) {
    const key = sis.local && sis.local.trim() ? sis.local.trim() : null;
    const arr = grupos.get(key) ?? [];
    arr.push(sis);
    grupos.set(key, arr);
  }
  return Array.from(grupos.entries()).map(([local, sistemas]) => ({ local, sistemas }));
}

/* ──────────────────────────────────────────────────────────────
   Builders
   ────────────────────────────────────────────────────────────── */

/** Linha de item: thumbnail + nome + chips + colunas (qtd, W/V, preço, SKU). */
function rowLuminaria(item: ItemLuminaria): string {
  const subtotal = calcularSubtotalLuminaria(item);
  const wattsChip = item.potencia_watts ? chip(`${item.potencia_watts}W`) : "";
  const tensaoChip = item.tensao ? chip(`${item.tensao}V`) : "";
  const chipsHtml = [wattsChip, tensaoChip].filter(Boolean).join("");
  return `
    <tr class="item-row">
      <td class="thumb-cell">${thumb(item.imagemUrl)}</td>
      <td class="desc-cell">
        <div class="desc-name">${esc(item.descricao || "—")}</div>
        ${chipsHtml ? `<div class="chips">${chipsHtml}</div>` : ""}
      </td>
      <td class="qty-cell">${item.quantidade} un</td>
      <td class="watts-cell">${item.potencia_watts ?? "—"}${item.potencia_watts ? "W" : ""}${item.tensao ? ` / ${item.tensao}V` : ""}</td>
      <td class="price-cell">${formatarMoeda(item.precoUnitario)}</td>
      <td class="sku-cell"><span class="code-tag">RV${esc(item.codigo)}</span></td>
      <td class="subtotal-cell">${formatarMoeda(subtotal)}</td>
    </tr>`;
}

/** Linha de fita dentro de um sistema. Quantidade calculada em metros (demanda). */
function rowFita(sis: SistemaIluminacao): string {
  const demanda = calcularDemandaFita(sis);
  const consumo = calcularConsumoW(sis);
  const chipsHtml = [
    chip(`${sis.fita.wm}W/m`, "orange"),
    sis.fita.voltagem ? chip(`${sis.fita.voltagem}V`, "orange") : "",
    chip(`${consumo.toFixed(1)}W total`),
  ].filter(Boolean).join("");
  return `
    <tr class="item-row">
      <td class="thumb-cell">${thumb(sis.fita.imagemUrl)}</td>
      <td class="desc-cell">
        <div class="desc-name"><span class="comp-tag comp-fita">Fita</span> ${esc(sis.fita.descricao || "—")}</div>
        <div class="chips">${chipsHtml}</div>
      </td>
      <td class="qty-cell">${demanda} m</td>
      <td class="watts-cell">${sis.fita.wm}W/m${sis.fita.voltagem ? ` / ${sis.fita.voltagem}V` : ""}</td>
      <td class="price-cell">${formatarMoeda(sis.fita.precoUnitario)}</td>
      <td class="sku-cell"><span class="code-tag">RV${esc(sis.fita.codigo)}</span></td>
      <td class="subtotal-cell muted">— global —</td>
    </tr>`;
}

/** Linha de perfil (opcional). */
function rowPerfil(sis: SistemaIluminacao): string {
  if (!sis.perfil) return "";
  const subtotal = calcularSubtotalPerfilSistema(sis);
  const metragem = sis.perfil.comprimentoPeca * sis.perfil.quantidade;
  const chipsHtml = [
    chip(`${sis.perfil.comprimentoPeca}m × ${sis.perfil.quantidade}`),
    chip(`${metragem}m total`),
    chip(`${sis.perfil.passadas}× passada${sis.perfil.passadas > 1 ? "s" : ""}`),
  ].join("");
  return `
    <tr class="item-row">
      <td class="thumb-cell">${thumb(sis.perfil.imagemUrl)}</td>
      <td class="desc-cell">
        <div class="desc-name"><span class="comp-tag">Perfil</span> ${esc(sis.perfil.descricao || "—")}</div>
        <div class="chips">${chipsHtml}</div>
      </td>
      <td class="qty-cell">${sis.perfil.quantidade} un</td>
      <td class="watts-cell">—</td>
      <td class="price-cell">${formatarMoeda(sis.perfil.precoUnitario)}</td>
      <td class="sku-cell"><span class="code-tag">RV${esc(sis.perfil.codigo)}</span></td>
      <td class="subtotal-cell">${formatarMoeda(subtotal)}</td>
    </tr>`;
}

/** Linha de driver — quantidade calculada por calcularQtdDrivers. */
function rowDriver(sis: SistemaIluminacao): string {
  const qtd = calcularQtdDrivers(sis);
  const subtotal = calcularSubtotalDriverSistema(sis);
  const chipsHtml = [
    chip(`${sis.driver.potencia}W`),
    chip(`${sis.driver.voltagem}V`),
  ].join("");
  return `
    <tr class="item-row">
      <td class="thumb-cell">${thumb(sis.driver.imagemUrl)}</td>
      <td class="desc-cell">
        <div class="desc-name"><span class="comp-tag">Driver</span> ${esc(sis.driver.descricao || "—")}</div>
        <div class="chips">${chipsHtml}</div>
      </td>
      <td class="qty-cell">${qtd} un</td>
      <td class="watts-cell">${sis.driver.potencia}W / ${sis.driver.voltagem}V</td>
      <td class="price-cell">${formatarMoeda(sis.driver.precoUnitario)}</td>
      <td class="sku-cell"><span class="code-tag">RV${esc(sis.driver.codigo)}</span></td>
      <td class="subtotal-cell">${formatarMoeda(subtotal)}</td>
    </tr>`;
}

/** Bloco de Sistema: header "SISTEMA N" + tabela com fita + perfil(?) + driver. */
function blocoSistema(sis: SistemaIluminacao, indexNoLocal: number): string {
  return `
    <div class="system-block">
      <div class="system-label">SISTEMA ${indexNoLocal + 1}</div>
      <table class="items-table">
        <tbody>
          ${rowFita(sis)}
          ${rowPerfil(sis)}
          ${rowDriver(sis)}
        </tbody>
      </table>
    </div>`;
}

/** Bloco de Local: header em Playfair italic + sistemas dentro. Local null = sem header. */
function blocoLocal(local: string | null, sistemas: SistemaIluminacao[]): string {
  const header = local
    ? `<div class="local-name">${esc(local)}</div>`
    : "";
  const sistemasHtml = sistemas.map((sis, i) => blocoSistema(sis, i)).join("");
  return `<div class="local-block">${header}${sistemasHtml}</div>`;
}

/** Bloco de Ambiente: header "AMBIENTE NOME" com regra horizontal + luminárias + grupos de Local com sistemas. */
function blocoAmbiente(amb: Ambiente): string {
  const luminariasHtml = amb.luminarias.length
    ? `<table class="items-table"><tbody>${amb.luminarias.map(rowLuminaria).join("")}</tbody></table>`
    : "";
  const grupos = agruparPorLocal(amb.sistemas);
  const gruposHtml = grupos.map(g => blocoLocal(g.local, g.sistemas)).join("");
  const subtotal = calcularTotalAmbienteSemFita(amb);
  const empty = !amb.luminarias.length && !amb.sistemas.length;
  return `
    <section class="amb-section">
      <div class="amb-header">
        <span class="amb-name">${esc(amb.nome)}</span>
        <span class="amb-rule"></span>
        <span class="amb-subtotal">Subtotal s/ fita: ${formatarMoeda(subtotal)}</span>
      </div>
      ${luminariasHtml}
      ${gruposHtml}
      ${empty ? '<p class="empty-note">Nenhum item neste ambiente.</p>' : ""}
    </section>`;
}
