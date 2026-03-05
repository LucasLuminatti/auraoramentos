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

/** Sistema de Iluminação: fita + driver obrigatórios, perfil opcional */
export interface SistemaIluminacao {
  id: string;
  perfil: ItemPerfil | null;
  fita: ItemFitaLED;
  driver: ItemDriver;
  metragemManual: number | null;   // usado quando perfil = null
  passadasManual: 1 | 2 | 3;       // usado quando perfil = null
}

/** @deprecated Use SistemaIluminacao */
export type SistemaPerfil = SistemaIluminacao;

export interface Ambiente {
  id: string;
  nome: string;
  luminarias: ItemLuminaria[];
  sistemas: SistemaIluminacao[];
}

export interface DadosOrcamento {
  colaborador: string;
  tipo: 'Primeiro Orçamento' | 'Revisão 01' | 'Revisão 02' | 'Revisão 03' | 'Revisão 04' | 'Revisão 05' | '';
}

export interface Orcamento {
  dados: DadosOrcamento;
  ambientes: Ambiente[];
}

// ─── Cálculos do Sistema Fita→Driver (com perfil opcional) ───

/** Metragem total do perfil (se existir) */
export function calcularMetragemTotal(perfil: ItemPerfil): number {
  return perfil.comprimentoPeca * perfil.quantidade;
}

/** Metragem de fita necessária para o sistema */
export function calcularDemandaFita(sistema: SistemaIluminacao): number;
export function calcularDemandaFita(perfil: ItemPerfil): number;
export function calcularDemandaFita(arg: SistemaIluminacao | ItemPerfil): number {
  if ('fita' in arg) {
    // SistemaIluminacao
    const sis = arg as SistemaIluminacao;
    if (sis.perfil) {
      return calcularMetragemTotal(sis.perfil) * sis.perfil.passadas;
    }
    return (sis.metragemManual || 0) * (sis.passadasManual || 1);
  }
  // Legacy: ItemPerfil diretamente
  const perfil = arg as ItemPerfil;
  return calcularMetragemTotal(perfil) * perfil.passadas;
}

/** Consumo em Watts do sistema */
export function calcularConsumoW(sistema: SistemaIluminacao): number;
export function calcularConsumoW(perfil: ItemPerfil, fita: ItemFitaLED): number;
export function calcularConsumoW(arg1: SistemaIluminacao | ItemPerfil, arg2?: ItemFitaLED): number {
  if ('fita' in arg1 && !arg2) {
    const sis = arg1 as SistemaIluminacao;
    return calcularDemandaFita(sis) * sis.fita.wm;
  }
  const perfil = arg1 as ItemPerfil;
  const fita = arg2!;
  return calcularDemandaFita(perfil) * fita.wm;
}

/** Quantidade de drivers necessários */
export function calcularQtdDrivers(sistema: SistemaIluminacao): number;
export function calcularQtdDrivers(perfil: ItemPerfil, fita: ItemFitaLED, driver: ItemDriver): number;
export function calcularQtdDrivers(arg1: SistemaIluminacao | ItemPerfil, arg2?: ItemFitaLED, arg3?: ItemDriver): number {
  let demanda: number;
  let consumo: number;
  let driver: ItemDriver;

  if ('fita' in arg1 && !arg2) {
    const sis = arg1 as SistemaIluminacao;
    demanda = calcularDemandaFita(sis);
    consumo = calcularConsumoW(sis);
    driver = sis.driver;
  } else {
    const perfil = arg1 as ItemPerfil;
    const fita = arg2!;
    driver = arg3!;
    demanda = calcularDemandaFita(perfil);
    consumo = calcularConsumoW(perfil, fita);
  }

  if (driver.potencia <= 0) return 0;
  const limiteMetros = driver.voltagem === 12 ? 5 : 10;
  return Math.max(Math.ceil(consumo / driver.potencia), Math.ceil(demanda / limiteMetros));
}

// ─── Subtotais por sistema ───

export function calcularSubtotalLuminaria(item: ItemLuminaria): number {
  return item.precoUnitario * item.quantidade;
}

export function calcularSubtotalPerfilSistema(sistema: SistemaIluminacao): number {
  if (!sistema.perfil) return 0;
  return sistema.perfil.precoUnitario * sistema.perfil.quantidade;
}

export function calcularSubtotalDriverSistema(sistema: SistemaIluminacao): number {
  const qtd = calcularQtdDrivers(sistema);
  return sistema.driver.precoUnitario * qtd;
}

/** Subtotal do sistema SEM fita (perfil + driver apenas) */
export function calcularSubtotalSistemaSemFita(sistema: SistemaIluminacao): number {
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
      const key = sis.fita.codigo;
      if (!key) continue;
      const demanda = calcularDemandaFita(sis);
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
