import type { Ambiente } from "@/types/orcamento";
import {
  calcularMetragemTotal,
  calcularWTotal,
  calcularQtdRolos,
  calcularSubtotalLuminaria,
  calcularSubtotalPerfil,
  calcularSubtotalFita,
  calcularTotalAmbiente,
  calcularTotalGeral,
  formatarMoeda,
} from "@/types/orcamento";

export interface PdfParams {
  clienteNome: string;
  projetoNome: string;
  colaborador: string;
  tipo: string;
  ambientes: Ambiente[];
  logoBase64?: string;
}

/* ── helpers ── */

function formatarData(): string {
  return new Date().toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function splitMoeda(valor: number): { symbol: string; amount: string } {
  const f = formatarMoeda(valor);
  return { symbol: "R$", amount: f.replace("R$", "").trim() };
}

function imgCell(url?: string): string {
  if (!url) return "";
  return `<td style="width:44px;padding:6px 8px"><img src="${url}" alt="" style="width:40px;height:40px;object-fit:cover;border-radius:6px" /></td>`;
}

/* ── table builders ── */

function tabelaLuminarias(items: Ambiente["luminarias"]): string {
  if (!items.length) return "";
  const hasImg = items.some((i) => i.imagemUrl);
  const rows = items
    .map(
      (i) => `<tr>
      ${hasImg ? imgCell(i.imagemUrl) : ""}
      <td><span class="code-tag">RV${i.codigo}</span></td>
      <td><span class="desc-main">${i.descricao}</span></td>
      <td class="c"><span class="qty-circle">${i.quantidade}</span></td>
      <td class="r"><span class="price-unit">${formatarMoeda(i.precoUnitario)}</span></td>
      <td class="r"><span class="price-total">${formatarMoeda(calcularSubtotalLuminaria(i))}</span></td>
    </tr>`
    )
    .join("");
  return `
  <div class="table-container" style="margin-bottom:10px">
    <table>
      <thead><tr>
        ${hasImg ? '<th style="width:44px"></th>' : ""}
        <th>Código</th><th>Descrição</th><th class="c">Qtd</th><th class="r">Preço Un.</th><th class="r">Subtotal</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

function tabelaPerfis(items: Ambiente["perfis"]): string {
  if (!items.length) return "";
  const hasImg = items.some((i) => i.imagemUrl);
  const rows = items
    .map(
      (i) => `<tr>
      ${hasImg ? imgCell(i.imagemUrl) : ""}
      <td><span class="code-tag">RV${i.codigo}</span></td>
      <td><span class="desc-main">${i.descricao}</span></td>
      <td class="r"><span class="price-unit">${i.metragem}</span></td>
      <td class="c"><span class="qty-circle">${i.quantidade}</span></td>
      <td class="r"><span class="price-total">${calcularMetragemTotal(i).toFixed(2)}</span></td>
      <td class="r"><span class="price-unit">${formatarMoeda(i.precoUnitario)}</span></td>
      <td class="r"><span class="price-total">${formatarMoeda(calcularSubtotalPerfil(i))}</span></td>
    </tr>`
    )
    .join("");
  return `
  <div class="table-container" style="margin-bottom:10px">
    <table>
      <thead><tr>
        ${hasImg ? '<th style="width:44px"></th>' : ""}
        <th>Código</th><th>Descrição</th><th class="r">Metragem</th><th class="c">Qtd</th><th class="r">Total (m)</th><th class="r">Preço Un.</th><th class="r">Subtotal</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

function tabelaFitas(items: Ambiente["fitasLed"]): string {
  if (!items.length) return "";
  const hasImg = items.some((i) => i.imagemUrl);
  const rows = items
    .map(
      (i) => `<tr>
      ${hasImg ? imgCell(i.imagemUrl) : ""}
      <td><span class="code-tag">RV${i.codigo}</span></td>
      <td><span class="desc-main">${i.descricao}</span></td>
      <td class="r"><span class="price-unit">${i.passadas}</span></td>
      <td class="r"><span class="price-unit">${i.wm}</span></td>
      <td class="r"><span class="price-total">${calcularWTotal(i).toFixed(1)}</span></td>
      <td class="r"><span class="price-unit">${i.metragemRolo}</span></td>
      <td class="c"><span class="qty-circle">${calcularQtdRolos(i)}</span></td>
      <td class="r"><span class="price-unit">${formatarMoeda(i.precoUnitario)}</span></td>
      <td class="r"><span class="price-total">${formatarMoeda(calcularSubtotalFita(i))}</span></td>
    </tr>`
    )
    .join("");
  return `
  <div class="table-container" style="margin-bottom:10px">
    <table>
      <thead><tr>
        ${hasImg ? '<th style="width:44px"></th>' : ""}
        <th>Código</th><th>Descrição</th><th class="r">Passadas</th><th class="r">W/M</th><th class="r">W Total</th><th class="r">Rolo (m)</th><th class="c">Rolos</th><th class="r">Preço Un.</th><th class="r">Subtotal</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

/* ── main ── */

export function gerarOrcamentoHtml(params: PdfParams): string {
  const { clienteNome, projetoNome, colaborador, tipo, ambientes, logoBase64 } = params;
  const data = formatarData();
  const totalGeral = calcularTotalGeral(ambientes);
  const total = splitMoeda(totalGeral);

  const logoHtml = logoBase64
    ? `<img src="${logoBase64}" alt="Aura" style="height:68px;width:auto" />`
    : `<span style="font-family:'Playfair Display',serif;font-size:32px;font-weight:500;color:#2E78A6">AURA</span>`;

  const logoFooter = logoBase64
    ? `<img src="${logoBase64}" alt="Aura" style="height:36px;width:auto;opacity:0.55;filter:grayscale(0.3)" />`
    : `<span style="font-family:'Playfair Display',serif;font-size:18px;color:#9aa3b0">AURA</span>`;

  const ambientesHtml = ambientes
    .map((amb, idx) => {
      const num = pad(idx + 1);
      const subtotal = formatarMoeda(calcularTotalAmbiente(amb));
      const empty =
        !amb.luminarias.length && !amb.perfis.length && !amb.fitasLed.length;
      return `
      <div class="section-header">
        <span class="section-num">${num}</span>
        <div class="section-info">
          <div class="section-title">${amb.nome}</div>
          <div class="section-sub">Subtotal: ${subtotal}</div>
        </div>
        <div class="section-line"></div>
      </div>
      ${tabelaLuminarias(amb.luminarias)}
      ${tabelaPerfis(amb.perfis)}
      ${tabelaFitas(amb.fitasLed)}
      ${empty ? '<p style="color:#9aa3b0;font-style:italic;font-size:12px;margin-bottom:16px">Nenhum item neste ambiente.</p>' : ""}`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>Proposta Comercial — ${clienteNome} — ${projetoNome}</title>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;1,400&family=Outfit:wght@300;400;500;600&display=swap" rel="stylesheet">
<style>
:root{--blue:#2E78A6;--blue-mid:#4a93c0;--blue-soft:#c8e2f0;--blue-pale:#eef6fb;--orange:#E68601;--orange-soft:#fff4e0;--gray-900:#1a1f2e;--gray-600:#5a6475;--gray-400:#9aa3b0;--gray-200:#e8ecf0;--gray-100:#f4f6f8;--white:#ffffff;--cream:#fdfcfb}
*{margin:0;padding:0;box-sizing:border-box}
body{background:var(--gray-200);font-family:'Outfit',sans-serif;font-weight:300;color:var(--gray-900);-webkit-print-color-adjust:exact;print-color-adjust:exact}
.page{max-width:920px;margin:0 auto;background:var(--white);position:relative;overflow:hidden}
.page::before{content:'';position:absolute;left:0;top:0;bottom:0;width:4px;background:linear-gradient(180deg,var(--orange) 0%,var(--blue) 60%,var(--blue-soft) 100%);z-index:10}

.header{padding:44px 52px 36px 68px;display:grid;grid-template-columns:1fr auto;align-items:start;gap:24px;background:var(--cream);border-bottom:1px solid var(--gray-200)}
.doc-label{display:inline-flex;align-items:center;gap:8px;font-size:9px;letter-spacing:.38em;text-transform:uppercase;color:var(--orange);font-weight:600}
.doc-label::before{content:'';display:block;width:20px;height:1px;background:var(--orange)}
.meta-grid{display:grid;grid-template-columns:auto auto;column-gap:28px;row-gap:10px}
.meta-field{display:flex;flex-direction:column;gap:2px;text-align:right}
.meta-label{font-size:8.5px;letter-spacing:.22em;text-transform:uppercase;color:var(--gray-400);font-weight:500}
.meta-value{font-size:12.5px;color:var(--blue);font-weight:500;letter-spacing:.02em}

.tagline-strip{padding:0 68px;background:var(--cream)}
.tagline-inner{border-top:1px solid var(--gray-200);padding:14px 0;display:flex;align-items:center;justify-content:space-between}
.tagline-text{font-family:'Playfair Display',serif;font-style:italic;font-size:13px;color:var(--gray-400);letter-spacing:.02em}
.pill{display:flex;align-items:center;gap:6px;background:var(--orange-soft);border:1px solid rgba(230,134,1,.2);border-radius:20px;padding:4px 10px 4px 8px;font-size:10px;color:var(--orange);font-weight:500;white-space:nowrap}
.pill-dot{width:5px;height:5px;border-radius:50%;background:var(--orange);flex-shrink:0}
.pill.blue{background:var(--blue-pale);border-color:rgba(46,120,166,.2);color:var(--blue)}
.pill.blue .pill-dot{background:var(--blue)}
.validity-pills{display:flex;gap:10px;align-items:center}

.body{padding:0 68px 52px}

.section-header{display:flex;align-items:baseline;gap:16px;padding:36px 0 18px}
.section-num{font-family:'Playfair Display',serif;font-size:42px;color:var(--gray-200);line-height:1;font-weight:400;letter-spacing:-.02em;flex-shrink:0}
.section-info{flex:0 0 auto}
.section-title{font-size:11px;letter-spacing:.3em;text-transform:uppercase;color:var(--blue);font-weight:600}
.section-sub{font-size:11px;color:var(--gray-400);margin-top:2px;font-weight:300}
.section-line{flex:1;height:1px;background:linear-gradient(90deg,var(--blue-soft),transparent);margin-left:8px;align-self:center}

.table-container{border:1px solid var(--gray-200);border-radius:10px;overflow:hidden}
table{width:100%;border-collapse:collapse}
thead tr{background:var(--gray-100);border-bottom:2px solid var(--gray-200)}
thead th{font-size:8.5px;letter-spacing:.22em;text-transform:uppercase;color:var(--gray-600);font-weight:600;padding:13px 16px;text-align:left}
thead th.r{text-align:right}
thead th.c{text-align:center}
tbody tr{border-bottom:1px solid var(--gray-200)}
tbody tr:last-child{border-bottom:none}
tbody td{padding:13px 16px;vertical-align:middle}
td.r{text-align:right}
td.c{text-align:center}

.code-tag{display:inline-block;font-family:'Outfit',monospace;font-size:9.5px;font-weight:600;letter-spacing:.04em;color:var(--orange);background:var(--orange-soft);border:1px solid rgba(230,134,1,.18);border-radius:4px;padding:3px 7px;white-space:nowrap}
.desc-main{font-size:12px;color:var(--gray-900);font-weight:400;line-height:1.45}
.qty-circle{width:28px;height:28px;border-radius:50%;background:var(--blue-pale);border:1.5px solid var(--blue-soft);display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:500;color:var(--blue)}
.price-unit{font-size:12px;color:var(--gray-600);font-weight:300}
.price-total{font-size:13px;color:var(--gray-900);font-weight:500}

.total-area{display:flex;justify-content:flex-end;margin-top:16px}
.total-card{display:flex;align-items:stretch;border-radius:10px;overflow:hidden;box-shadow:0 4px 20px rgba(46,120,166,.12);min-width:320px}
.total-accent{width:5px;background:linear-gradient(180deg,var(--orange),var(--blue));flex-shrink:0}
.total-inner{background:var(--gray-900);flex:1;display:flex;justify-content:space-between;align-items:center;padding:18px 24px;gap:32px}
.total-label{font-size:8.5px;letter-spacing:.3em;text-transform:uppercase;color:rgba(255,255,255,.45);font-weight:500}
.total-value{font-family:'Playfair Display',serif;font-size:28px;color:var(--white);font-weight:400;letter-spacing:.01em;white-space:nowrap}
.total-value span{font-size:14px;opacity:.65;font-family:'Outfit',sans-serif;font-weight:300;margin-right:2px}

.info-section{margin-top:48px}
.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.info-card{background:var(--gray-100);border:1px solid var(--gray-200);border-radius:8px;padding:16px 18px 16px 14px;display:flex;gap:12px;align-items:flex-start}
.info-icon{width:28px;height:28px;border-radius:6px;background:var(--blue-pale);border:1px solid var(--blue-soft);display:flex;align-items:center;justify-content:center;flex-shrink:0;color:var(--blue);font-size:12px}
.info-text{font-size:11px;color:var(--gray-600);line-height:1.6;font-weight:300}
.info-text strong{color:var(--gray-900);font-weight:500}

.footer{margin-top:0;background:var(--cream);border-top:1px solid var(--gray-200);padding:28px 68px;display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:32px}
.footer-note{font-family:'Playfair Display',serif;font-style:italic;font-size:12px;color:var(--gray-400)}
.footer-url{font-size:10px;color:var(--blue-mid);letter-spacing:.05em;margin-top:3px;font-weight:400}
.warranty-row{display:flex;align-items:center;gap:8px}
.warranty-badge{font-family:'Playfair Display',serif;font-size:22px;color:var(--blue);font-weight:400;line-height:1}
.warranty-text{font-size:9px;letter-spacing:.18em;text-transform:uppercase;color:var(--gray-400);font-weight:500;line-height:1.3}

.terms-section{margin-top:40px;background:var(--gray-100);border:1px solid var(--gray-200);border-radius:10px;padding:28px 32px}
.terms-header{display:flex;align-items:center;gap:12px;margin-bottom:18px}
.terms-icon{width:32px;height:32px;border-radius:8px;background:var(--blue-pale);border:1px solid var(--blue-soft);display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0}
.terms-title{font-size:9px;letter-spacing:.3em;text-transform:uppercase;color:var(--blue);font-weight:600}
.terms-list{list-style:none;padding:0;margin:0}
.terms-list li{position:relative;padding:6px 0 6px 18px;font-size:10px;color:var(--gray-600);line-height:1.65;font-weight:300}
.terms-list li::before{content:'';position:absolute;left:0;top:13px;width:5px;height:5px;border-radius:50%;background:var(--blue-soft)}
.terms-list li.sub{padding-left:36px;font-size:9.5px}
.terms-list li.sub::before{left:18px;width:4px;height:4px;background:var(--gray-400)}
.terms-list li.thanks{margin-top:10px;font-style:italic;color:var(--blue);font-weight:400}
.terms-list li.thanks::before{background:var(--orange)}

.no-print-btn{background:var(--blue);color:#fff;border:none;padding:12px 28px;border-radius:8px;font-size:14px;cursor:pointer;font-family:'Outfit',sans-serif;font-weight:500;letter-spacing:.02em}

@media print{
  body{background:white}
  .page{box-shadow:none;max-width:100%}
  .no-print{display:none!important}
}
@page{size:A4;margin:0}
</style>
</head>
<body>
<div class="page">

  <!-- HEADER -->
  <div class="header">
    <div>${logoHtml}</div>
    <div style="display:flex;flex-direction:column;gap:16px;align-items:flex-end">
      <div class="doc-label">Proposta Comercial</div>
      <div class="meta-grid">
        <div class="meta-field"><div class="meta-label">Cliente</div><div class="meta-value">${clienteNome}</div></div>
        <div class="meta-field"><div class="meta-label">Projeto</div><div class="meta-value">${projetoNome}</div></div>
        <div class="meta-field"><div class="meta-label">Data</div><div class="meta-value">${data}</div></div>
        <div class="meta-field"><div class="meta-label">Colaborador</div><div class="meta-value">${colaborador || "—"}</div></div>
      </div>
    </div>
  </div>

  <!-- TAGLINE -->
  <div class="tagline-strip">
    <div class="tagline-inner">
      <span class="tagline-text">Iluminação que transforma ambientes</span>
      <div class="validity-pills">
        <div class="pill"><span class="pill-dot"></span>Validade: 15 dias</div>
        <div class="pill blue"><span class="pill-dot"></span>${tipo || "Orçamento"}</div>
      </div>
    </div>
  </div>

  <!-- BODY -->
  <div class="body">
    ${ambientesHtml}

    <!-- TOTAL -->
    <div class="total-area">
      <div class="total-card">
        <div class="total-accent"></div>
        <div class="total-inner">
          <div class="total-label">Total Geral</div>
          <div class="total-value"><span>${total.symbol}</span>${total.amount}</div>
        </div>
      </div>
    </div>

    <!-- INFO -->
    <div class="info-section">
      <div class="info-grid">
        <div class="info-card">
          <div class="info-icon">📦</div>
          <div class="info-text"><strong>Prazo de entrega</strong><br/>A consultar conforme disponibilidade de estoque.</div>
        </div>
        <div class="info-card">
          <div class="info-icon">🛡</div>
          <div class="info-text"><strong>Garantia</strong><br/>Produtos com garantia de fábrica conforme especificações do fabricante.</div>
        </div>
        <div class="info-card">
          <div class="info-icon">💳</div>
          <div class="info-text"><strong>Condições de pagamento</strong><br/>A definir em negociação comercial.</div>
        </div>
        <div class="info-card">
          <div class="info-icon">📋</div>
          <div class="info-text"><strong>Observações</strong><br/>Valores sujeitos a alteração sem aviso prévio. Proposta válida por 15 dias.</div>
        </div>
      </div>
    </div>

    <!-- TERMOS -->
    <div class="terms-section">
      <div class="terms-header">
        <div class="terms-icon">⚖</div>
        <div class="terms-title">Informações Importantes</div>
      </div>
      <ul class="terms-list">
        <li>Levando em consideração que a iluminação do projeto faz parte da arte e tem um aspecto decorativo e funcional ao mesmo tempo, gerando assim uma variedade infinita de efeitos e usos, não existe um padrão único. Portanto a nossa proposta de aplicação é uma sugestão particular, que obviamente deve ser validada com arquiteto ou especialista.</li>
        <li>A garantia dos produtos se aplica unicamente ao funcionamento e desempenho do mesmo, não entrando no mérito do efeito gerado.</li>
        <li>Para ter o melhor desempenho de nossos produtos recomendamos usar profissionais capacitados de instalação, pois a forma de instalação e aplicação pode comprometer totalmente o efeito esperado.</li>
        <li>Não estão inclusos neste orçamento o acompanhamento, suporte e visitas a obra. Estes serviços podem ser cotados e tratados de forma separada e individual.</li>
        <li>Os projetos luminotécnicos de autoria da AURA podem ser alterados até 3 vezes.</li>
        <li>Não aceitamos Devolução.</li>
        <li>Não enviamos projetos luminotécnicos com especificações antes de fechar o pedido.</li>
        <li>Deverão ser conferidos no ato do recebimento, junto ao entregador:</li>
        <li class="sub">A quantidade de caixas, suas etiquetas e a quantidade de produtos.</li>
        <li class="sub">O estado físico da mercadoria, se há sinais de avaria e se o conteúdo está de acordo com a nota fiscal.</li>
        <li class="sub">O estado físico dos lacres (fita personalizada). Caso seja observado sinais de violação ou recolagem, todo o conteúdo das caixas deverá ser revisado.</li>
        <li>Nossos produtos têm garantia de 1 ano. Em caso de dúvidas, entre em contato conosco antes de abrir ou utilizar os produtos.</li>
        <li class="thanks">Agradecemos a sua compreensão!</li>
      </ul>
    </div>
  </div>

  <!-- FOOTER -->
  <div class="footer">
    <div>${logoFooter}</div>
    <div style="text-align:center">
      <div class="footer-note">Iluminação com propósito — cada detalhe faz a diferença</div>
      <div class="footer-url">Documento gerado em ${data}</div>
    </div>
    <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
      <div class="warranty-row">
        <span class="warranty-badge">5</span>
        <span class="warranty-text">Anos de<br/>Garantia</span>
      </div>
    </div>
  </div>

</div>

<div class="no-print" style="text-align:center;margin:24px">
  <button class="no-print-btn" onclick="window.print()">Salvar como PDF (Ctrl+P)</button>
</div>
</body>
</html>`;
}
