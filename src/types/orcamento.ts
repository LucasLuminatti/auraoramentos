export interface Produto {
  id: string;
  codigo: string;
  descricao: string;
  preco_tabela: number;
  preco_minimo: number;
  imagem_url?: string | null;
}

export interface ItemLuminaria {
  id: string;
  codigo: string;
  descricao: string;
  quantidade: number;
  precoUnitario: number;
  precoMinimo: number;
  imagemUrl?: string;
}

export interface ItemPerfil {
  id: string;
  codigo: string;
  descricao: string;
  metragem: number;
  quantidade: number;
  precoUnitario: number;
  precoMinimo: number;
  imagemUrl?: string;
}

export interface ItemFitaLED {
  id: string;
  codigo: string;
  descricao: string;
  passadas: number;
  wm: number;
  metragemRolo: number;
  precoUnitario: number;
  precoMinimo: number;
  imagemUrl?: string;
}

export interface Ambiente {
  id: string;
  nome: string;
  luminarias: ItemLuminaria[];
  perfis: ItemPerfil[];
  fitasLed: ItemFitaLED[];
}

export interface DadosOrcamento {
  colaborador: string;
  tipo: 'Primeiro Orçamento' | 'Revisão 01' | 'Revisão 02' | 'Revisão 03' | 'Revisão 04' | 'Revisão 05' | '';
}

export interface Orcamento {
  dados: DadosOrcamento;
  ambientes: Ambiente[];
}

// Computed helpers
export function calcularMetragemTotal(item: ItemPerfil): number {
  return item.metragem * item.quantidade;
}

export function calcularWTotal(item: ItemFitaLED): number {
  return item.passadas * item.wm;
}

export function calcularTotalFita(item: ItemFitaLED): number {
  return item.passadas;
}

export function calcularQtdRolos(item: ItemFitaLED): number {
  if (item.metragemRolo <= 0) return 0;
  return Math.ceil(item.passadas / item.metragemRolo);
}

export function calcularSubtotalLuminaria(item: ItemLuminaria): number {
  return item.precoUnitario * item.quantidade;
}

export function calcularSubtotalPerfil(item: ItemPerfil): number {
  return item.precoUnitario * item.quantidade;
}

export function calcularSubtotalFita(item: ItemFitaLED): number {
  return item.precoUnitario * calcularQtdRolos(item);
}

export function calcularTotalAmbiente(amb: Ambiente): number {
  const totalLum = amb.luminarias.reduce((s, i) => s + calcularSubtotalLuminaria(i), 0);
  const totalPerf = amb.perfis.reduce((s, i) => s + calcularSubtotalPerfil(i), 0);
  const totalFita = amb.fitasLed.reduce((s, i) => s + calcularSubtotalFita(i), 0);
  return totalLum + totalPerf + totalFita;
}

export function calcularTotalGeral(ambientes: Ambiente[]): number {
  return ambientes.reduce((s, a) => s + calcularTotalAmbiente(a), 0);
}

export function formatarMoeda(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
