/**
 * Template v3 — PDF editorial com suporte a sistemas compostos (MAGNETO 48V / TINY 24V / SYSTEM MOLD).
 * Phase 22 / PDF-03.
 *
 * Estende o v2 com blocoComposto inline dentro do ambiente:
 *   - Trilho/perfil no topo (luminária âncora)
 *   - Sub-linhas dos componentes (módulos → fita modular → driver → acessórios)
 *   - Chip técnico relevante por papel (D-03)
 *   - Preço unitário por linha + subtotal do sistema (D-02)
 *   - Rótulo de tipo via item.sistema (D-01, Claude's Discretion)
 *
 * Compatibilidade: NÃO modifica v1.ts nem v2.ts. CSS do v2 é copiado integralmente
 * (não importado) para que a renderização seja self-contained. blocoResumoFitas continua
 * iterando SÓ sistemas[].fita (D-04 — fita modular fica dentro do bloco composto).
 *
 * SEGURANÇA (T-22-01): toda string de catálogo/snapshot passa por esc() antes de entrar no HTML.
 */

import type { Ambiente, ItemLuminaria, SistemaIluminacao, ItemComposicao } from "@/types/orcamento";
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
  calcularSubtotalComposicao,
  calcularCargaComposicao,
  calcularMetragemModulosDifusos,
  formatarMoeda,
} from "@/types/orcamento";
import { construirDescricaoRica } from "@/lib/produtoDescricao";
import type { AtributosMap, PdfParamsV2 } from "./v2";

/* ──────────────────────────────────────────────────────────────
   Re-export do tipo (permite gerarPdfHtml.ts importar de cá)
   ────────────────────────────────────────────────────────────── */

export type { AtributosMap, PdfParamsV2 };

/* ──────────────────────────────────────────────────────────────
   Mapa de rótulo por sistema (D-01 / Claude's Discretion)
   ────────────────────────────────────────────────────────────── */

const LABELS_SISTEMA: Record<string, string> = {
  magneto_48v: "MAGNETO 48V",
  tiny_magneto: "TINY 24V",
  s_mode: "SYSTEM MOLD",
};

function labelSistema(sistema: string | null | undefined): string {
  if (!sistema) return "SISTEMA COMPOSTO";
  return LABELS_SISTEMA[sistema] ?? "SISTEMA COMPOSTO";
}

/* ──────────────────────────────────────────────────────────────
   Helpers (cópia byte-idêntica do v2 — Alternativa: zero-toque absoluto em v2.ts)
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
  const grupos = new Map<string | null, SistemaIluminacao[]>();
  for (const sis of sistemas) {
    const key = sis.local && sis.local.trim() ? sis.local.trim() : null;
    const arr = grupos.get(key) ?? [];
    arr.push(sis);
    grupos.set(key, arr);
  }
  return Array.from(grupos.entries()).map(([local, sistemas]) => ({ local, sistemas }));
}

function isSistemaVazio(sis: SistemaIluminacao): boolean {
  return calcularDemandaFita(sis) === 0
    && calcularConsumoW(sis) === 0
    && calcularQtdDrivers(sis) === 0;
}

/* ──────────────────────────────────────────────────────────────
   Builders — Fita Padrão (idênticos ao v2)
   ────────────────────────────────────────────────────────────── */

function rowLuminaria(item: ItemLuminaria, atributosMap: AtributosMap): string {
  const subtotal = calcularSubtotalLuminaria(item);
  const wattsChip = item.potencia_watts ? chip(`${item.potencia_watts}W`) : "";
  const tensaoChip = item.tensao ? chip(`${item.tensao}V`) : "";
  const chipsHtml = [wattsChip, tensaoChip].filter(Boolean).join("");
  const lookup = atributosMap[item.codigo];
  const descRica = construirDescricaoRica({
    nome: item.descricao || "—",
    atributos: lookup?.atributos ?? null,
    potenciaWatts: lookup?.potencia_watts ?? item.potencia_watts ?? null,
  });
  return `
    <tr class="item-row">
      <td class="thumb-cell">${thumb(item.imagemUrl)}</td>
      <td class="desc-cell">
        <div class="desc-name">${esc(descRica)}</div>
        ${chipsHtml ? `<div class="chips">${chipsHtml}</div>` : ""}
      </td>
      <td class="qty-cell">${item.quantidade} un</td>
      <td class="watts-cell">${item.potencia_watts ?? "—"}${item.potencia_watts ? "W" : ""}${item.tensao ? ` / ${item.tensao}V` : ""}</td>
      <td class="price-cell">${formatarMoeda(item.precoUnitario)}</td>
      <td class="sku-cell"><span class="code-tag">RV${esc(item.codigo)}</span></td>
      <td class="subtotal-cell">${formatarMoeda(subtotal)}</td>
    </tr>`;
}

function rowFita(sis: SistemaIluminacao, atributosMap: AtributosMap): string {
  const demanda = calcularDemandaFita(sis);
  const consumo = calcularConsumoW(sis);
  const chipsHtml = [
    chip(`${sis.fita.wm}W/m`, "orange"),
    sis.fita.voltagem ? chip(`${sis.fita.voltagem}V`, "orange") : "",
    chip(`${consumo.toFixed(1)}W total`),
  ].filter(Boolean).join("");
  const lookup = atributosMap[sis.fita.codigo];
  const descRica = construirDescricaoRica({
    nome: sis.fita.descricao || "—",
    atributos: lookup?.atributos ?? null,
    potenciaWatts: null,
  });
  return `
    <tr class="item-row">
      <td class="thumb-cell">${thumb(sis.fita.imagemUrl)}</td>
      <td class="desc-cell">
        <div class="desc-name"><span class="comp-tag comp-fita">Fita</span> ${esc(descRica)}</div>
        <div class="chips">${chipsHtml}</div>
      </td>
      <td class="qty-cell">${demanda} m</td>
      <td class="watts-cell">${sis.fita.wm}W/m${sis.fita.voltagem ? ` / ${sis.fita.voltagem}V` : ""}</td>
      <td class="price-cell">${formatarMoeda(sis.fita.precoUnitario)}</td>
      <td class="sku-cell"><span class="code-tag">RV${esc(sis.fita.codigo)}</span></td>
      <td class="subtotal-cell muted">— global —</td>
    </tr>`;
}

function rowPerfil(sis: SistemaIluminacao, atributosMap: AtributosMap): string {
  if (!sis.perfil) return "";
  const subtotal = calcularSubtotalPerfilSistema(sis);
  const metragem = sis.perfil.comprimentoPeca * sis.perfil.quantidade;
  const chipsHtml = [
    chip(`${sis.perfil.comprimentoPeca}m × ${sis.perfil.quantidade}`),
    chip(`${metragem}m total`),
    chip(`${sis.perfil.passadas}× passada${sis.perfil.passadas > 1 ? "s" : ""}`),
  ].join("");
  const lookup = atributosMap[sis.perfil.codigo];
  const descRica = construirDescricaoRica({
    nome: sis.perfil.descricao || "—",
    atributos: lookup?.atributos ?? null,
    potenciaWatts: lookup?.potencia_watts ?? null,
  });
  return `
    <tr class="item-row">
      <td class="thumb-cell">${thumb(sis.perfil.imagemUrl)}</td>
      <td class="desc-cell">
        <div class="desc-name"><span class="comp-tag">Perfil</span> ${esc(descRica)}</div>
        <div class="chips">${chipsHtml}</div>
      </td>
      <td class="qty-cell">${sis.perfil.quantidade} un</td>
      <td class="watts-cell">—</td>
      <td class="price-cell">${formatarMoeda(sis.perfil.precoUnitario)}</td>
      <td class="sku-cell"><span class="code-tag">RV${esc(sis.perfil.codigo)}</span></td>
      <td class="subtotal-cell">${formatarMoeda(subtotal)}</td>
    </tr>`;
}

function rowDriver(sis: SistemaIluminacao, atributosMap: AtributosMap): string {
  const qtd = calcularQtdDrivers(sis);
  const subtotal = calcularSubtotalDriverSistema(sis);
  const chipsHtml = [
    chip(`${sis.driver.potencia}W`),
    chip(`${sis.driver.voltagem}V`),
  ].join("");
  const lookup = atributosMap[sis.driver.codigo];
  const descRica = construirDescricaoRica({
    nome: sis.driver.descricao || "—",
    atributos: lookup?.atributos ?? null,
    potenciaWatts: lookup?.potencia_watts ?? null,
  });
  return `
    <tr class="item-row">
      <td class="thumb-cell">${thumb(sis.driver.imagemUrl)}</td>
      <td class="desc-cell">
        <div class="desc-name"><span class="comp-tag">Driver</span> ${esc(descRica)}</div>
        <div class="chips">${chipsHtml}</div>
      </td>
      <td class="qty-cell">${qtd} un</td>
      <td class="watts-cell">${sis.driver.potencia}W / ${sis.driver.voltagem}V</td>
      <td class="price-cell">${formatarMoeda(sis.driver.precoUnitario)}</td>
      <td class="sku-cell"><span class="code-tag">RV${esc(sis.driver.codigo)}</span></td>
      <td class="subtotal-cell">${formatarMoeda(subtotal)}</td>
    </tr>`;
}

function blocoSistema(sis: SistemaIluminacao, indexNoLocal: number, atributosMap: AtributosMap): string {
  return `
    <div class="system-block">
      <div class="system-label">SISTEMA ${indexNoLocal + 1}</div>
      <table class="items-table">
        <tbody>
          ${rowFita(sis, atributosMap)}
          ${rowPerfil(sis, atributosMap)}
          ${rowDriver(sis, atributosMap)}
        </tbody>
      </table>
    </div>`;
}

function blocoLocal(local: string | null, sistemas: SistemaIluminacao[], atributosMap: AtributosMap): string {
  const header = local
    ? `<div class="local-name">${esc(local)}</div>`
    : "";
  const sistemasHtml = sistemas
    .filter(sis => !isSistemaVazio(sis))
    .map((sis, i) => blocoSistema(sis, i, atributosMap))
    .join("");
  return `<div class="local-block">${header}${sistemasHtml}</div>`;
}

/* ──────────────────────────────────────────────────────────────
   Builders — Bloco Composto (v3-only)
   ────────────────────────────────────────────────────────────── */

/** Chip técnico relevante por papel do componente (D-03). */
function chipsPorPapel(c: ItemComposicao, atributosMap: AtributosMap): string {
  const lookup = atributosMap[c.codigo];
  switch (c.papel) {
    case "modulo": {
      const parts: string[] = [];
      if (c.potenciaW != null && c.potenciaW > 0) parts.push(chip(`${c.potenciaW}W`));
      if (c.comprimento != null && c.comprimento > 0) parts.push(chip(`${c.comprimento}m`));
      return parts.join("");
    }
    case "fita_modular": {
      const parts: string[] = [];
      if (lookup?.atributos) {
        const wm = (lookup.atributos as Record<string, unknown>)["wm"];
        if (wm != null) parts.push(chip(`${wm}W/m`, "orange"));
        const volt = (lookup.atributos as Record<string, unknown>)["voltagem"];
        if (volt != null) parts.push(chip(`${volt}V`, "orange"));
      }
      if (c.comprimento != null && c.comprimento > 0) parts.push(chip(`${c.comprimento}m`));
      return parts.join("");
    }
    case "driver_recomendado":
    case "driver_obrigatorio": {
      const parts: string[] = [];
      const potW = lookup?.potencia_watts ?? (lookup?.atributos as Record<string, unknown> | null | undefined)?.["potencia_w"];
      if (potW != null) parts.push(chip(`${potW}W`));
      const volt = (lookup?.atributos as Record<string, unknown> | null | undefined)?.["voltagem"];
      if (volt != null) parts.push(chip(`${volt}V`));
      return parts.join("");
    }
    // conector_energia, kit_fixacao, acessorio_opcional — só descrição (D-03)
    default:
      return "";
  }
}

/** Sub-linha de um componente do composto (D-02: preço unitário + SKU). */
function rowComponente(c: ItemComposicao, atributosMap: AtributosMap): string {
  const subtotal = c.precoUnitario * c.quantidade;
  const lookup = atributosMap[c.codigo];
  const descRica = construirDescricaoRica({
    nome: c.descricao || "—",
    atributos: lookup?.atributos ?? null,
    potenciaWatts: null, // chip técnico específico por papel (chipsPorPapel)
  });
  const chipsHtml = chipsPorPapel(c, atributosMap);
  const labelPapel = c.papel === "modulo" ? "Módulo"
    : c.papel === "fita_modular" ? "Fita"
    : c.papel === "driver_recomendado" || c.papel === "driver_obrigatorio" ? "Driver"
    : c.papel === "conector_energia" ? "Conector"
    : c.papel === "kit_fixacao" ? "Kit"
    : "Acessório";

  return `
    <tr class="item-row comp-sub-row">
      <td class="thumb-cell">${thumb(c.imagemUrl)}</td>
      <td class="desc-cell">
        <div class="desc-name"><span class="comp-tag">${esc(labelPapel)}</span> ${esc(descRica)}</div>
        ${chipsHtml ? `<div class="chips">${chipsHtml}</div>` : ""}
      </td>
      <td class="qty-cell">${c.quantidade} un</td>
      <td class="watts-cell">—</td>
      <td class="price-cell">${formatarMoeda(c.precoUnitario)}</td>
      <td class="sku-cell"><span class="code-tag">RV${esc(c.codigo)}</span></td>
      <td class="subtotal-cell">${formatarMoeda(subtotal)}</td>
    </tr>`;
}

/** Ordena os componentes por prioridade de papel (D-03: módulos → fita → driver → acessórios). */
function ordenarComponentes(composicao: ItemComposicao[]): ItemComposicao[] {
  const ORDEM: Record<string, number> = {
    modulo: 0,
    fita_modular: 1,
    driver_recomendado: 2,
    driver_obrigatorio: 2,
    conector_energia: 3,
    kit_fixacao: 4,
    acessorio_opcional: 5,
  };
  return [...composicao].sort((a, b) => (ORDEM[a.papel] ?? 9) - (ORDEM[b.papel] ?? 9));
}

/**
 * Bloco de Sistema Composto (D-01/D-02/D-03/D-04).
 * Trilho/perfil (âncora) no topo + sub-linhas dos componentes + subtotal do sistema.
 *
 * SEGURANÇA (T-22-01): todas as strings de catálogo passam por esc() antes de entrar no HTML.
 *
 * @param item - Luminária âncora com composicao?.length > 0
 * @param indexComposto - Índice 1-based do composto dentro do ambiente
 * @param atributosMap - Map de atributos por código de produto
 */
export function blocoComposto(item: ItemLuminaria, indexComposto: number, atributosMap: AtributosMap): string {
  const label = labelSistema(item.sistema);
  const composicao = item.composicao ?? [];

  // Resumo do sistema: carga total (W) e metragem de fita derivada (D-03, SYSTEM MOLD)
  const cargaW = calcularCargaComposicao(composicao);
  const metragemFita = calcularMetragemModulosDifusos(composicao);
  const resumoParts: string[] = [];
  if (cargaW > 0) resumoParts.push(`${cargaW}W total`);
  if (metragemFita > 0) {
    const metragemFmt = metragemFita % 1 === 0 ? `${metragemFita}m` : `${metragemFita.toString().replace(".", ",")}m`;
    resumoParts.push(`fita ${metragemFmt}`);
  }
  const resumoHtml = resumoParts.length
    ? `<div class="composto-resumo">${esc(resumoParts.join(" · "))}</div>`
    : "";

  // Trilho/perfil no topo = a própria luminária âncora (D-01)
  const lookup = atributosMap[item.codigo];
  const descRicaAncora = construirDescricaoRica({
    nome: item.descricao || "—",
    atributos: lookup?.atributos ?? null,
    potenciaWatts: null,
  });
  const subtotalAncora = calcularSubtotalLuminaria(item);
  const ancoraCampoTecnico = item.potencia_watts
    ? `${item.potencia_watts}W${item.tensao ? ` / ${item.tensao}V` : ""}`
    : "—";

  const linhaAncora = `
    <tr class="item-row">
      <td class="thumb-cell">${thumb(item.imagemUrl)}</td>
      <td class="desc-cell">
        <div class="desc-name"><span class="comp-tag comp-trilho">Trilho</span> ${esc(descRicaAncora)}</div>
      </td>
      <td class="qty-cell">${item.quantidade} un</td>
      <td class="watts-cell">${ancoraCampoTecnico}</td>
      <td class="price-cell">${formatarMoeda(item.precoUnitario)}</td>
      <td class="sku-cell"><span class="code-tag">RV${esc(item.codigo)}</span></td>
      <td class="subtotal-cell">${formatarMoeda(subtotalAncora)}</td>
    </tr>`;

  // Sub-linhas dos componentes ordenados por papel
  const componentesOrdenados = ordenarComponentes(composicao);
  const componentesHtml = componentesOrdenados.map(c => rowComponente(c, atributosMap)).join("");

  // Subtotal do sistema = âncora + composição (D-02)
  const subtotalSistema = calcularSubtotalLuminaria(item) + calcularSubtotalComposicao(item);

  return `
    <div class="composto-block">
      <div class="composto-label">Sistema Composto ${indexComposto} — ${esc(label)}</div>
      ${resumoHtml}
      <table class="items-table">
        <tbody>
          ${linhaAncora}
          ${componentesHtml}
        </tbody>
      </table>
      <div class="composto-subtotal">Subtotal do sistema: ${esc(formatarMoeda(subtotalSistema))}</div>
    </div>`;
}

/* ──────────────────────────────────────────────────────────────
   Bloco de Ambiente v3 (detect composto vs simples)
   ────────────────────────────────────────────────────────────── */

function blocoAmbienteV3(amb: Ambiente, atributosMap: AtributosMap): string {
  let compostoIdx = 0;

  // Para cada luminária: composto → blocoComposto; simples → rowLuminaria dentro de tabela
  // Agrupamos luminárias simples consecutivas em uma única tabela para manter visual
  const luminariasHtmlParts: string[] = [];
  let simplesBuf: ItemLuminaria[] = [];

  function flushSimples() {
    if (!simplesBuf.length) return;
    luminariasHtmlParts.push(
      `<table class="items-table"><tbody>${simplesBuf.map(l => rowLuminaria(l, atributosMap)).join("")}</tbody></table>`
    );
    simplesBuf = [];
  }

  for (const l of amb.luminarias) {
    if (l.composicao?.length) {
      flushSimples();
      compostoIdx++;
      luminariasHtmlParts.push(blocoComposto(l, compostoIdx, atributosMap));
    } else {
      simplesBuf.push(l);
    }
  }
  flushSimples();

  const luminariasHtml = luminariasHtmlParts.join("");

  // Fita Padrão — renderizada EXATAMENTE como no v2 (por Local/Sistema)
  const grupos = agruparPorLocal(amb.sistemas);
  const gruposHtml = grupos.map(g => blocoLocal(g.local, g.sistemas, atributosMap)).join("");

  const subtotal = calcularTotalAmbienteSemFita(amb);
  const empty = !amb.luminarias.length && !amb.sistemas.length;

  return `
    <section class="amb-section">
      <div class="amb-header">
        <span class="amb-name">${esc(amb.nome)}</span>
        <span class="amb-rule"></span>
        <span class="amb-subtotal">Subtotal s/ fita: ${esc(formatarMoeda(subtotal))}</span>
      </div>
      ${luminariasHtml}
      ${gruposHtml}
      ${empty ? '<p class="empty-note">Nenhum item neste ambiente.</p>' : ""}
    </section>`;
}

/* ──────────────────────────────────────────────────────────────
   blocoResumoFitas — idêntico ao v2 (D-04: SÓ sistemas[].fita)
   ────────────────────────────────────────────────────────────── */

function blocoResumoFitas(ambientes: Ambiente[]): string {
  const grupos = calcularRolosPorGrupo(ambientes);
  if (!grupos.length) return "";
  const totalFitas = grupos.reduce((s, g) => s + g.subtotal, 0);
  const rows = grupos.map(g => {
    const rolosStr = g.rolos.map(r => `${r.quantidade}×${r.tamanho}m`).join(" + ");
    const localChips = (g.localBreakdown ?? [])
      .map(lb => chip(`${lb.label} · ${lb.demanda}m`))
      .join("");
    const chipsHtml = [chip(`${g.demandaTotal}m demanda`, "orange"), chip(rolosStr), chip(`${g.qtdRolosTotal} rolos`), localChips].filter(Boolean).join("");
    return `
      <tr class="item-row">
        <td class="thumb-cell">${thumb(g.imagemUrl)}</td>
        <td class="desc-cell">
          <div class="desc-name">${esc(g.descricao)}</div>
          <div class="chips">${chipsHtml}</div>
        </td>
        <td class="qty-cell">${g.qtdRolosTotal} un</td>
        <td class="watts-cell">—</td>
        <td class="price-cell">${formatarMoeda(g.precoUnitario)}</td>
        <td class="sku-cell"><span class="code-tag">RV${esc(g.codigo)}</span></td>
        <td class="subtotal-cell">${formatarMoeda(g.subtotal)}</td>
      </tr>`;
  }).join("");
  return `
    <section class="amb-section">
      <div class="amb-header">
        <span class="amb-name">RESUMO DE FITAS</span>
        <span class="amb-rule"></span>
        <span class="amb-subtotal">Subtotal: ${formatarMoeda(totalFitas)}</span>
      </div>
      <table class="items-table"><tbody>${rows}</tbody></table>
    </section>`;
}

function blocoTotal(totalGeral: number): string {
  return `
    <div class="total-area">
      <div class="total-card">
        <div class="total-accent"></div>
        <div class="total-body">
          <div class="total-label">TOTAL GERAL</div>
          <div class="total-value">${formatarMoeda(totalGeral)}</div>
        </div>
      </div>
    </div>`;
}

function blocoTermos(): string {
  return `
    <section class="terms-section">
      <h2 class="terms-title">Termos e Condições</h2>

      <div class="term-block">
        <h3 class="term-header">Prazo de entrega</h3>
        <p>A consultar conforme disponibilidade de estoque, com prazo médio de 20 dias úteis. Pedidos confirmados após aprovação da proposta.</p>
      </div>

      <div class="term-block">
        <h3 class="term-header">Garantia</h3>
        <p>Produtos com garantia de fábrica de 1 ano conforme especificações do fabricante. Aplicável ao funcionamento e desempenho dos produtos — não ao efeito luminotécnico desejado, que é de natureza decorativa e funcional simultaneamente.</p>
      </div>

      <div class="term-block">
        <h3 class="term-header">Condições de pagamento</h3>
        <p>A definir em negociação comercial.</p>
      </div>

      <div class="term-block">
        <h3 class="term-header">Observações</h3>
        <p>Valores sujeitos a alteração sem aviso prévio. Proposta válida por 10 dias a partir da data de emissão.</p>
        <p>Levando em consideração que a iluminação faz parte da arte e tem aspecto decorativo e funcional simultâneos, gerando variedade infinita de efeitos e usos, nossa proposta é uma sugestão particular que deve ser validada com arquiteto ou especialista.</p>
        <p>Recomendamos profissionais capacitados para a instalação — a forma de aplicação pode comprometer totalmente o efeito esperado. Não estão inclusos acompanhamento, suporte ou visitas à obra (cotados separadamente). Não aceitamos devolução. Não enviamos projetos luminotécnicos com especificações antes do fechamento do pedido. Os projetos luminotécnicos de autoria da AURA podem ser alterados até 3 vezes.</p>
        <p>No recebimento, conferir junto ao entregador: (a) quantidade de caixas, etiquetas e produtos; (b) estado físico da mercadoria e correspondência com a nota fiscal; (c) integridade dos lacres — em caso de violação ou recolagem, todo o conteúdo deve ser revisado.</p>
      </div>
    </section>`;
}

/* ──────────────────────────────────────────────────────────────
   CSS — base do v2 + classes novas do bloco composto
   ────────────────────────────────────────────────────────────── */

const CSS_V3 = `
/* Phase 5 PDF v2 — editorial Apple-like. Paleta neutro + laranja Luminatti. Tipografia Playfair + Inter. */
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-weight:400;color:#1a1f2e;-webkit-print-color-adjust:exact;print-color-adjust:exact;background:#ffffff}
.page{max-width:920px;margin:0 auto;background:#ffffff;padding:48px 64px 64px}

/* ─── Header ─── */
.doc-header{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:32px;border-bottom:1px solid #e8ecf0;margin-bottom:48px}
.logo{height:104px;width:auto}
.doc-conditions{margin:-32px 0 40px;padding-bottom:24px;border-bottom:1px solid #e8ecf0}
.doc-conditions p{font-family:'Inter',sans-serif;font-size:10px;font-weight:500;color:#5a6475;letter-spacing:.02em;line-height:1.7}
.logo-text{font-family:'Playfair Display',serif;font-size:28px;font-weight:500;color:#1a1f2e;letter-spacing:.02em}
.doc-meta{text-align:right}
.doc-title{font-family:'Playfair Display',serif;font-size:32px;font-weight:400;color:#1a1f2e;letter-spacing:-.01em;line-height:1.1;margin-bottom:16px}
.doc-meta-row{font-family:'Inter',sans-serif;font-size:10px;color:#5a6475;letter-spacing:.04em;line-height:1.7}
.doc-meta-row strong{color:#1a1f2e;font-weight:500}

/* ─── Nível 2: Ambiente ─── */
.amb-section{margin-bottom:40px;break-inside:auto}
.amb-header{display:flex;align-items:baseline;gap:12px;margin:32px 0 16px;break-inside:avoid}
.amb-name{font-family:'Inter',sans-serif;font-size:11px;font-weight:700;letter-spacing:.3em;text-transform:uppercase;color:#E68601;flex-shrink:0}
.amb-rule{flex:1;height:1px;background:linear-gradient(90deg,#E68601 0%,transparent 100%)}
.amb-subtotal{font-family:'Inter',sans-serif;font-size:9px;color:#9aa3b0;letter-spacing:.08em;text-transform:uppercase;flex-shrink:0}

/* ─── Nível 3: Local ─── */
.local-block{margin-top:20px}
.local-name{font-family:'Playfair Display',serif;font-style:italic;font-weight:400;font-size:18px;color:#5a6475;margin:24px 0 8px 16px;break-inside:avoid}

/* ─── Nível 4: Sistema ─── */
.system-block{margin:12px 0 12px 32px;break-inside:avoid}
.system-label{font-family:'Inter',sans-serif;font-size:9px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:#9aa3b0;margin-bottom:6px}

/* ─── Nível 5: Tabela de itens (híbrida tabela + chips) ─── */
.items-table{width:100%;border-collapse:collapse;margin-bottom:8px}
.items-table .item-row{border-bottom:1px solid #f4f6f8}
.items-table .item-row:last-child{border-bottom:none}
.items-table td{padding:10px 8px;vertical-align:top;font-size:11px;color:#1a1f2e}
.thumb-cell{width:56px}
.thumb,.thumb-empty{width:48px;height:48px;border-radius:6px;object-fit:cover;background:#f4f6f8;display:block}
.desc-cell{padding-left:0;padding-right:12px}
.desc-name{font-family:'Inter',sans-serif;font-size:12px;font-weight:500;color:#1a1f2e;line-height:1.4}
.desc-name .comp-tag{display:inline-block;font-size:8.5px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:#9aa3b0;margin-right:6px;vertical-align:middle}
.desc-name .comp-tag.comp-fita{color:#E68601}
.chips{margin-top:4px;line-height:1.6}
.chip{display:inline-flex;align-items:center;font-family:'Inter',sans-serif;font-size:9px;font-weight:500;letter-spacing:.04em;background:#f4f6f8;color:#5a6475;border-radius:10px;padding:2px 8px;margin:2px 4px 0 0}
.qty-cell,.watts-cell{font-family:'Inter',sans-serif;font-size:11px;color:#5a6475;text-align:right;white-space:nowrap;width:80px}
.price-cell{font-family:'Inter',sans-serif;font-size:11px;color:#5a6475;text-align:right;white-space:nowrap;width:96px}
.sku-cell{text-align:right;width:88px}
.subtotal-cell{font-family:'Inter',sans-serif;font-size:12px;font-weight:500;color:#1a1f2e;text-align:right;white-space:nowrap;width:104px}
.subtotal-cell.muted{color:#9aa3b0;font-style:italic;font-weight:400}
.code-tag{display:inline-block;font-family:'Inter',monospace;font-size:9px;font-weight:600;letter-spacing:.04em;color:#5a6475;background:#f4f6f8;border-radius:3px;padding:2px 6px;white-space:nowrap}

/* ─── Total geral (Área D — Pattern 5) ─── */
.total-area{display:flex;justify-content:flex-end;margin-top:40px;break-inside:avoid}
.total-card{display:flex;align-items:stretch;background:#ffffff;border-bottom:1px solid #e8ecf0;min-width:340px}
.total-accent{width:4px;background:#E68601;flex-shrink:0}
.total-body{flex:1;padding:16px 0 16px 20px;display:flex;flex-direction:column;align-items:flex-end}
.total-label{font-family:'Inter',sans-serif;font-size:9px;font-weight:600;letter-spacing:.3em;text-transform:uppercase;color:#9aa3b0;margin-bottom:6px}
.total-value{font-family:'Playfair Display',serif;font-size:36px;font-weight:400;color:#1a1f2e;letter-spacing:-.01em;line-height:1}

/* ─── Termos prose (Área C — Pattern 4) ─── */
.terms-section{margin-top:64px;break-before:page}
.terms-title{font-family:'Playfair Display',serif;font-size:24px;font-weight:400;color:#1a1f2e;letter-spacing:-.01em;margin-bottom:24px;padding-bottom:12px;border-bottom:1px solid #e8ecf0}
.term-block{margin-bottom:24px;break-inside:avoid}
.term-header{font-family:'Playfair Display',serif;font-size:11px;font-weight:500;letter-spacing:.22em;text-transform:uppercase;color:#E68601;margin-bottom:6px}
.term-block p{font-family:'Inter',sans-serif;font-size:11px;font-weight:400;color:#5a6475;line-height:1.65;margin-bottom:8px}
.term-block p:last-child{margin-bottom:0}

.empty-note{font-family:'Inter',sans-serif;font-size:11px;color:#9aa3b0;font-style:italic;padding:12px 0}

/* ─── Bloco Composto v3 (Phase 22 / PDF-03) ─── */
.composto-block{margin:16px 0 20px 0;border-left:3px solid #E68601;padding-left:16px;break-inside:avoid}
.composto-label{font-family:'Inter',sans-serif;font-size:10px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:#E68601;margin-bottom:4px}
.composto-resumo{font-family:'Inter',sans-serif;font-size:9px;color:#9aa3b0;letter-spacing:.06em;margin-bottom:8px}
.composto-subtotal{font-family:'Inter',sans-serif;font-size:11px;font-weight:600;color:#1a1f2e;text-align:right;padding:8px 0 0;border-top:1px solid #e8ecf0;margin-top:4px}
.comp-sub-row td{padding-left:16px}
.desc-name .comp-tag.comp-trilho{color:#E68601}

@page{size:A4;margin:0}
@media print{body{background:#ffffff}.page{max-width:100%}}
`;

/* ──────────────────────────────────────────────────────────────
   Main — Entry point v3
   ────────────────────────────────────────────────────────────── */

/**
 * Template v3 — entry point.
 * Reusar PdfParamsV2 + AtributosMap do v2; renderiza sistemas compostos inline (D-01/D-02/D-03/D-04).
 * Call site: gerarPdfHtml.ts branch `v >= 3`.
 */
export function gerarOrcamentoHtmlV3(params: PdfParamsV2): string {
  const { clienteNome, projetoNome, colaborador, tipo, ambientes, logoBase64, atributosMap = {} } = params;
  const data = formatarData();
  const totalGeral = calcularTotalGeral(ambientes);

  const logoHtml = logoBase64
    ? `<img src="${logoBase64}" alt="Aura" class="logo" />`
    : `<span class="logo-text">AURA</span>`;

  const ambientesHtml = ambientes.map(amb => blocoAmbienteV3(amb, atributosMap)).join("");
  const resumoFitasHtml = blocoResumoFitas(ambientes);

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<title>Proposta Comercial — ${esc(clienteNome)} — ${esc(projetoNome)}</title>
<style>
${CSS_V3}
</style>
</head>
<body>
<div class="page">

  <!-- HEADER -->
  <header class="doc-header">
    <div>${logoHtml}</div>
    <div class="doc-meta">
      <h1 class="doc-title">Proposta Comercial</h1>
      <div class="doc-meta-row"><strong>Cliente:</strong> ${esc(clienteNome)}</div>
      <div class="doc-meta-row"><strong>Projeto:</strong> ${esc(projetoNome)}</div>
      <div class="doc-meta-row"><strong>Colaborador:</strong> ${esc(colaborador || "—")}</div>
      <div class="doc-meta-row"><strong>Data:</strong> ${data}</div>
      <div class="doc-meta-row"><strong>Tipo:</strong> ${esc(tipo || "Orçamento")}</div>
    </div>
  </header>

  <!-- CONDIÇÕES -->
  <div class="doc-conditions">
    <p>*FRETE GRÁTIS EM PEDIDOS ACIMA DE R$1.200,00</p>
    <p>*A data de validade está condicionada a existência dos produtos em nosso estoque no momento da confirmação deste orçamento</p>
  </div>

  <!-- AMBIENTES -->
  ${ambientesHtml}

  <!-- RESUMO FITAS -->
  ${resumoFitasHtml}

  <!-- TOTAL GERAL -->
  ${blocoTotal(totalGeral)}

  <!-- TERMOS (substitui as 4 caixas — PDF-03 + PDF-04) -->
  ${blocoTermos()}

</div>
</body>
</html>`;
}
