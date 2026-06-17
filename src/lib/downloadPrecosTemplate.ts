/**
 * Gera template XLSX baixável para importação de preços em massa (IMP-02).
 * Aba "Preços" (linhas de exemplo) + aba "Instruções".
 *
 * Colunas com acento são aceitas e auto-mapeadas pelo ImportMapper
 * (o cabeçalho casa pelo label "Código" / "Preço Tabela" / "Preço Mínimo").
 */

import * as XLSX from "xlsx";

export function downloadPrecosTemplate(): void {
  const data = [
    { "Código": "LM1664", "Preço Tabela": 89.9, "Preço Mínimo": 75 },
    { "Código": "LM2496", "Preço Tabela": 120.5, "Preço Mínimo": 99 },
  ];

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Preços");

  const instrucoes = [
    ["Coluna", "Obrigatório?", "Formato", "Notas"],
    ["Código", "SIM", "texto", "SKU do produto já cadastrado (ex: LM1664). Código inexistente é reportado como erro."],
    ["Preço Tabela", "Opcional*", "número", "Preço de lista. Use número (89,90 ou 89.90). Evite ponto de milhar."],
    ["Preço Mínimo", "Opcional*", "número", "Piso de venda. Garanta que seja ≤ Preço Tabela."],
    ["", "", "", "*Pelo menos um dos dois preços precisa estar preenchido na linha."],
    ["", "", "", "Preços editados manualmente no admin são PRESERVADOS (não sobrescritos)."],
    ["", "", "", "Só atualiza produtos já cadastrados — não cria produto novo."],
  ];
  const wsInstr = XLSX.utils.aoa_to_sheet(instrucoes);
  XLSX.utils.book_append_sheet(wb, wsInstr, "Instruções");

  XLSX.writeFile(wb, "template-precos.xlsx");
}
