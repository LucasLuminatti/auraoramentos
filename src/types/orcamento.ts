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
  comprimentoPeca: 1 | 2 | 3;
  quantidade: number;
  passadas: 1 | 2 | 3;
  precoUnitario: number;
  precoMinimo: number;
  imagemUrl?: string;
}

export interface ItemFitaLED {
  id: string;
  codigo: string;
  descricao: string;
  wm: number;
  metragemRolo: 5 | 10 | 15;
  precoUnitario: number;
  precoMinimo: number;
  imagemUrl?: string;
}

export interface ItemDriver {
  id: string;
  codigo: string;
  descricao: string;
  potencia: number;
  voltagem: 12 | 24;
  precoUnitario: number;
  precoMinimo: number;
  imagemUrl?: string;
}

export interface SistemaPerfil {
  id: string;
  perfil: ItemPerfil;
  fita: ItemFitaLED | null;
  driver: ItemDriver | null;
}

export interface Ambiente {
  id: string;
  nome: string;
  luminarias: ItemLuminaria[];
  sistemas: SistemaPerfil[];
}

export interface DadosOrcamento {
  colaborador: string;
  tipo: 'Primeiro Orçamento' | 'Revisão 01' | 'Revisão 02' | 'Revisão 03' | 'Revisão 04' | 'Revisão 05' | '';
}

export interface Orcamento {
  dados: DadosOrcamento;
  ambientes: Ambiente[];
}

// ─── Cálculos do Sistema Perfil→Fita→Driver ───

export function calcularMetragemTotal(perfil: ItemPerfil): number {
  return perfil.comprimentoPeca * perfil.quantidade;
}

export function calcularDemandaFita(perfil: ItemPerfil): number {
  return calcularMetragemTotal(perfil) * perfil.passadas;
}

export function calcularConsumoW(perfil: ItemPerfil, fita: ItemFitaLED): number {
  return calcularDemandaFita(perfil) * fita.wm;
}

export function calcularQtdDrivers(perfil: ItemPerfil, fita: ItemFitaLED, driver: ItemDriver): number {
  const demanda = calcularDemandaFita(perfil);
  const consumo = calcularConsumoW(perfil, fita);
  if (driver.potencia <= 0) return 0;
  const limiteMetros = driver.voltagem === 12 ? 5 : 10;
  const qtdByPotencia = Math.ceil(consumo / driver.potencia);
  const qtdByComprimento = Math.ceil(demanda / limiteMetros);
  return Math.max(qtdByPotencia, qtdByComprimento);
}

// ─── Subtotais por sistema (perfil + driver, sem fita que é global) ───

export function calcularSubtotalLuminaria(item: ItemLuminaria): number {
  return item.precoUnitario * item.quantidade;
}

export function calcularSubtotalPerfilSistema(sistema: SistemaPerfil): number {
  return sistema.perfil.precoUnitario * sistema.perfil.quantidade;
}

export function calcularSubtotalDriverSistema(sistema: SistemaPerfil): number {
  if (!sistema.fita || !sistema.driver) return 0;
  const qtd = calcularQtdDrivers(sistema.perfil, sistema.fita, sistema.driver);
  return sistema.driver.precoUnitario * qtd;
}

/** Subtotal do sistema SEM fita (perfil + driver apenas) */
export function calcularSubtotalSistemaSemFita(sistema: SistemaPerfil): number {
  return calcularSubtotalPerfilSistema(sistema) + calcularSubtotalDriverSistema(sistema);
}

// ─── Cálculo global de fitas (nível orçamento) ───

export interface GrupoFita {
  codigo: string;
  descricao: string;
  demandaTotal: number;
  metragemRolo: 5 | 10 | 15;
  precoUnitario: number;
  precoMinimo: number;
  rolos: { tamanho: number; quantidade: number }[];
  qtdRolosTotal: number;
  subtotal: number;
}

export function calcularRolosPorGrupo(ambientes: Ambiente[]): GrupoFita[] {
  const grupos = new Map<string, { descricao: string; demanda: number; metragemRolo: 5 | 10 | 15; precoUnitario: number; precoMinimo: number }>();

  for (const amb of ambientes) {
    for (const sis of amb.sistemas) {
      if (!sis.fita) continue;
      const key = sis.fita.codigo;
      const demanda = calcularDemandaFita(sis.perfil);
      const existing = grupos.get(key);
      if (existing) {
        existing.demanda += demanda;
      } else {
        grupos.set(key, {
          descricao: sis.fita.descricao,
          demanda,
          metragemRolo: sis.fita.metragemRolo,
          precoUnitario: sis.fita.precoUnitario,
          precoMinimo: sis.fita.precoMinimo,
        });
      }
    }
  }

  const resultado: GrupoFita[] = [];
  for (const [codigo, g] of grupos) {
    const rolos: { tamanho: number; quantidade: number }[] = [];
    let restante = g.demanda;
    const tamanhosDisponiveis = [15, 10, 5];

    for (const tam of tamanhosDisponiveis) {
      if (restante <= 0) break;
      const qtd = Math.floor(restante / tam);
      if (qtd > 0) {
        rolos.push({ tamanho: tam, quantidade: qtd });
        restante -= qtd * tam;
      }
    }
    // Sobrou fração → 1 rolo do menor tamanho que cubra
    if (restante > 0) {
      const melhorTam = tamanhosDisponiveis.find(t => t >= restante) || 5;
      const existente = rolos.find(r => r.tamanho === melhorTam);
      if (existente) {
        existente.quantidade += 1;
      } else {
        rolos.push({ tamanho: melhorTam, quantidade: 1 });
      }
    }

    const qtdRolosTotal = rolos.reduce((s, r) => s + r.quantidade, 0);
    resultado.push({
      codigo,
      descricao: g.descricao,
      demandaTotal: g.demanda,
      metragemRolo: g.metragemRolo,
      precoUnitario: g.precoUnitario,
      precoMinimo: g.precoMinimo,
      rolos,
      qtdRolosTotal,
      subtotal: g.precoUnitario * qtdRolosTotal,
    });
  }

  return resultado;
}

// ─── Totais ───

export function calcularTotalAmbienteSemFita(amb: Ambiente): number {
  const totalLum = amb.luminarias.reduce((s, i) => s + calcularSubtotalLuminaria(i), 0);
  const totalSistemas = amb.sistemas.reduce((s, sis) => s + calcularSubtotalSistemaSemFita(sis), 0);
  return totalLum + totalSistemas;
}

export function calcularTotalFitasGlobal(ambientes: Ambiente[]): number {
  return calcularRolosPorGrupo(ambientes).reduce((s, g) => s + g.subtotal, 0);
}

export function calcularTotalGeral(ambientes: Ambiente[]): number {
  const totalAmbientes = ambientes.reduce((s, a) => s + calcularTotalAmbienteSemFita(a), 0);
  return totalAmbientes + calcularTotalFitasGlobal(ambientes);
}

export function formatarMoeda(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
