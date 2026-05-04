/**
 * Phase 3 / Plan 04 — IMP-04
 *
 * Gera template XLSX baixável para CSV diário de produtos.
 * Inclui aba "Produtos" (1 linha de exemplo) + aba "Instruções" (lista de colunas).
 *
 * preco_tabela e preco_minimo aparecem como DEFERIDO (D-18 / IMP-02 não cobre nesta phase).
 */

import * as XLSX from "xlsx";

export function downloadProdutosTemplate(): void {
  const data = [
    {
      codigo: "LM9999",
      nome: "VISION 5W",
      descricao: "Spot LED VISION 5W 24V",
      categoria: "Sistemas Lineares",
      tipologia: "Spot",
      tensao: 24,
      watts_por_metro: "",
      potencia_watts: 5,
      cor: "Preto",
      imagem_url: "https://exemplo.com/img.jpg ou nome-do-arquivo.jpg",
      preco_tabela: "",
      preco_minimo: "",
    },
  ];

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Produtos");

  const instrucoes = [
    ["Coluna", "Obrigatório?", "Formato", "Notas"],
    ["codigo", "SIM", "string", "Chave única (SKU). Ex: LM2847. Apenas letras, números, hífen, underscore."],
    ["nome", "SIM (criar)", "string", "Nome curto da variante (ex: VISION 5W). Obrigatório só para criar produto novo."],
    ["descricao", "SIM", "string", "Descrição completa do produto."],
    ["categoria", "NÃO", "string", "Ex: Sistemas Lineares, Fitas e Drivers."],
    ["tipologia", "NÃO", "string", "Ex: Spot, Arandela, Fita LED."],
    ["tensao", "NÃO", "integer", "Apenas 12, 24 ou 48 (DC). Outros valores vão para atributos.tensao_raw."],
    ["watts_por_metro", "NÃO", "numeric", "Para fitas LED apenas."],
    ["potencia_watts", "NÃO", "numeric", "Potência total do produto."],
    ["cor", "NÃO", "string", "Ex: Preto, Branco, Dourado."],
    ["imagem_url", "NÃO", "string", "URL pública (https://...) OU nome do arquivo (subir depois em 'Importar imagens')."],
    ["preco_tabela", "DEFERIDO", "—", "NÃO importado nesta versão (D-18 — preço entra em phase futura). Use a tela 'Atualizar preços' quando disponível."],
    ["preco_minimo", "DEFERIDO", "—", "Idem preco_tabela."],
  ];
  const wsInstr = XLSX.utils.aoa_to_sheet(instrucoes);
  XLSX.utils.book_append_sheet(wb, wsInstr, "Instruções");

  XLSX.writeFile(wb, "template-produtos.xlsx");
}
