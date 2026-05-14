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
import { construirDescricaoRica } from "@/lib/produtoDescricao";

/** Map de atributos ricos por código de produto — populado via batch lookup antes de chamar o builder v2 (WIZ-05 D-23). */
export type AtributosMap = Record<string, { atributos: Record<string, unknown> | null; potencia_watts: number | null }>;

export interface PdfParamsV2 {
  clienteNome: string;
  projetoNome: string;
  colaborador: string;
  tipo: string;
  ambientes: Ambiente[];
  logoBase64?: string;
  /** WIZ-05: map de atributos por código para descrição rica nas row functions. Opcional — ausente = descrição crua. */
  atributosMap?: AtributosMap;
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

/**
 * PDF-01: Sistema é considerado "vazio" quando não tem nenhum elemento físico real
 * (sem fita LED demandada, sem consumo em watts, sem driver). Perfil é ignorado de propósito
 * (D-02 CONTEXT.md Phase 11): perfil isolado não é um "sistema" no domínio AURA.
 * Sistemas vazios são filtrados antes de renderizar para não vazar placeholders no PDF do cliente.
 */
function isSistemaVazio(sis: SistemaIluminacao): boolean {
  return calcularDemandaFita(sis) === 0
    && calcularConsumoW(sis) === 0
    && calcularQtdDrivers(sis) === 0;
}

/* ──────────────────────────────────────────────────────────────
   Builders
   ────────────────────────────────────────────────────────────── */

/** Linha de item: thumbnail + nome + chips + colunas (qtd, W/V, preço, SKU). */
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

/** Linha de fita dentro de um sistema. Quantidade calculada em metros (demanda). */
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
    potenciaWatts: null, // fita usa W/m (wm), não potência absoluta
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

/** Linha de perfil (opcional). */
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

/** Linha de driver — quantidade calculada por calcularQtdDrivers. */
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

/** Bloco de Sistema: header "SISTEMA N" + tabela com fita + perfil(?) + driver. */
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

/** Bloco de Local: header em Playfair italic + sistemas dentro. Local null = sem header. */
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

/** Bloco de Ambiente: header "AMBIENTE NOME" com regra horizontal + luminárias + grupos de Local com sistemas. */
function blocoAmbiente(amb: Ambiente, atributosMap: AtributosMap): string {
  const luminariasHtml = amb.luminarias.length
    ? `<table class="items-table"><tbody>${amb.luminarias.map(l => rowLuminaria(l, atributosMap)).join("")}</tbody></table>`
    : "";
  const grupos = agruparPorLocal(amb.sistemas);
  const gruposHtml = grupos.map(g => blocoLocal(g.local, g.sistemas, atributosMap)).join("");
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

/** Resumo de Fitas LED por código (mesmo cálculo do v1, layout editorial). */
function blocoResumoFitas(ambientes: Ambiente[]): string {
  const grupos = calcularRolosPorGrupo(ambientes);
  if (!grupos.length) return "";
  const totalFitas = grupos.reduce((s, g) => s + g.subtotal, 0);
  const rows = grupos.map(g => {
    const rolosStr = g.rolos.map(r => `${r.quantidade}×${r.tamanho}m`).join(" + ");
    const chipsHtml = [chip(`${g.demandaTotal}m demanda`, "orange"), chip(rolosStr), chip(`${g.qtdRolosTotal} rolos`)].join("");
    return `
      <tr class="item-row">
        <td class="thumb-cell"><div class="thumb-empty"></div></td>
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

/** Card TOTAL GERAL editorial (Área D default — Pattern 5 do RESEARCH). */
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

/**
 * Bloco prose final substituindo as 4 caixas (Área C default — Pattern 4 do RESEARCH).
 * Conteúdo das 4 caixas (Prazo / Garantia / Pagamento / Observações) reformatado como
 * parágrafos com headers em Playfair small-caps, sem cards/borders. PDF-03 + PDF-04.
 */
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
        <p>Valores sujeitos a alteração sem aviso prévio. Proposta válida por 15 dias a partir da data de emissão.</p>
        <p>Levando em consideração que a iluminação faz parte da arte e tem aspecto decorativo e funcional simultâneos, gerando variedade infinita de efeitos e usos, nossa proposta é uma sugestão particular que deve ser validada com arquiteto ou especialista.</p>
        <p>Recomendamos profissionais capacitados para a instalação — a forma de aplicação pode comprometer totalmente o efeito esperado. Não estão inclusos acompanhamento, suporte ou visitas à obra (cotados separadamente). Não aceitamos devolução. Não enviamos projetos luminotécnicos com especificações antes do fechamento do pedido. Os projetos luminotécnicos de autoria da AURA podem ser alterados até 3 vezes.</p>
        <p>No recebimento, conferir junto ao entregador: (a) quantidade de caixas, etiquetas e produtos; (b) estado físico da mercadoria e correspondência com a nota fiscal; (c) integridade dos lacres — em caso de violação ou recolagem, todo o conteúdo deve ser revisado.</p>
      </div>
    </section>`;
}

/* ──────────────────────────────────────────────────────────────
   Main
   ────────────────────────────────────────────────────────────── */

/**
 * Template v2 — entry point.
 * Recebe params + Ambiente[] (já com base64 e local quando aplicáveis) e devolve HTML para html2pdf.
 */
export function gerarOrcamentoHtmlV2(params: PdfParamsV2): string {
  const { clienteNome, projetoNome, colaborador, tipo, ambientes, logoBase64, atributosMap = {} } = params;
  const data = formatarData();
  const totalGeral = calcularTotalGeral(ambientes);

  const logoHtml = logoBase64
    ? `<img src="${logoBase64}" alt="Aura" class="logo" />`
    : `<span class="logo-text">AURA</span>`;

  const ambientesHtml = ambientes.map(amb => blocoAmbiente(amb, atributosMap)).join("");
  const resumoFitasHtml = blocoResumoFitas(ambientes);

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<title>Proposta Comercial — ${esc(clienteNome)} — ${esc(projetoNome)}</title>
<style>
/* Phase 5 PDF v2 — editorial Apple-like. Paleta neutro + laranja Luminatti. Tipografia Playfair + Inter. */
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-weight:400;color:#1a1f2e;-webkit-print-color-adjust:exact;print-color-adjust:exact;background:#ffffff}
.page{max-width:920px;margin:0 auto;background:#ffffff;padding:48px 64px 64px}

/* ─── Header ─── */
.doc-header{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:32px;border-bottom:1px solid #e8ecf0;margin-bottom:48px}
.logo{height:64px;width:auto}
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

@page{size:A4;margin:0}
@media print{body{background:#ffffff}.page{max-width:100%}}
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
