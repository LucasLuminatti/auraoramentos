export interface Produto {
  id: string;
  codigo: string;
  descricao: string;
  preco_tabela: number;
  preco_minimo: number;
  imagem_url?: string | null;
  // Campos técnicos (vindos do banco)
  voltagem?: number | null;
  wm?: number | null;
  passadas?: number | null;
  familia_perfil?: string | null;
  driver_tipo?: string | null;
  driver_potencia_w?: number | null;
  driver_restr_tipo?: string | null;
  driver_restr_max_w?: number | null;
  sistema_magnetico?: string | null;
  is_baby?: boolean | null;
  somente_baby?: boolean | null;
  tipo_produto?: string | null;
  subtipo?: string | null;
}
export interface ItemLuminaria {
  id: string;
  codigo: string;
  descricao: string;
  quantidade: number;
  precoUnitario: number;
  precoMinimo: number;
  imagemUrl?: string;
  sistema?: string | null;
  potencia_watts?: number | null;
  tensao?: number | null;
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
  familia_perfil?: string | null;
  driver_restr_tipo?: string | null;
  driver_restr_max_w?: number | null;
  somente_baby?: boolean | null;
}

export interface ItemFitaLED {
  id: string;
  codigo: string;
  descricao: string;
  wm: number;
  voltagem?: 12 | 24 | 48;
  metragemRolo: 5 | 10 | 15;
  precoUnitario: number;
  precoMinimo: number;
  imagemUrl?: string;
  is_baby?: boolean | null;
}

export interface ItemDriver {
  id: string;
  codigo: string;
  descricao: string;
  potencia: number;
  voltagem: 12 | 24 | 48;
  precoUnitario: number;
  precoMinimo: number;
  imagemUrl?: string;
  driver_tipo?: string | null;
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
  const limite = limiteExtensaoMetros(driver.voltagem);
  const qtdPorPotencia = Math.ceil(consumo / driver.potencia);
  const qtdPorExtensao = limite ? Math.ceil(demanda / limite) : 0;
  return Math.max(qtdPorPotencia, qtdPorExtensao);
}

/** Limite de extensão de fita por driver (regras 3 e 4). 48V = sem limite fixo (depende do driver). */
export function limiteExtensaoMetros(voltagem: 12 | 24 | 48): number | null {
  if (voltagem === 12) return 5;
  if (voltagem === 24) return 10;
  return null;
}

/** Motivo da quantidade de drivers: potência, extensão ou ambos. */
export function motivoQtdDrivers(sistema: SistemaIluminacao): {
  qtd: number;
  motivo: 'ok' | 'potencia' | 'extensao' | 'potencia_e_extensao';
  consumoW: number;
  demandaM: number;
  limiteM: number | null;
} {
  const { driver, fita } = sistema;
  const demanda = calcularDemandaFita(sistema);
  const consumo = calcularConsumoW(sistema);
  const limite = limiteExtensaoMetros(driver.voltagem);
  if (driver.potencia <= 0 || !fita.wm) {
    return { qtd: 0, motivo: 'ok', consumoW: consumo, demandaM: demanda, limiteM: limite };
  }
  const qtdPot = Math.ceil(consumo / driver.potencia);
  const qtdExt = limite ? Math.ceil(demanda / limite) : 0;
  const qtd = Math.max(qtdPot, qtdExt);
  const excedePot = qtdPot > 1;
  const excedeExt = qtdExt > 1;
  let motivo: 'ok' | 'potencia' | 'extensao' | 'potencia_e_extensao' = 'ok';
  if (excedePot && excedeExt) motivo = 'potencia_e_extensao';
  else if (excedePot) motivo = 'potencia';
  else if (excedeExt) motivo = 'extensao';
  return { qtd, motivo, consumoW: consumo, demandaM: demanda, limiteM: limite };
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

// ─── Sistema 48V magnético (regra 8) ───

export interface ResumoMagneto48V {
  potenciaTotalW: number;
  qtdModulos: number;
  driverRecomendado: 'LM2343 (100W)' | 'LM2344 (200W)' | 'múltiplos drivers';
  temDriver: boolean;
  temConector: boolean;
  avisos: string[];
}

export function analisarMagneto48V(amb: Ambiente): ResumoMagneto48V | null {
  const modulos = amb.luminarias.filter(l => l.sistema === 'magneto_48v' && l.potencia_watts && !/TRILHO|CONECTOR|DRIVER|KIT/i.test(l.descricao));
  if (modulos.length === 0) return null;

  const potenciaTotalW = modulos.reduce((s, m) => s + (m.potencia_watts || 0) * m.quantidade, 0);
  const qtdModulos = modulos.reduce((s, m) => s + m.quantidade, 0);

  let driverRecomendado: ResumoMagneto48V['driverRecomendado'];
  if (potenciaTotalW <= 100) driverRecomendado = 'LM2343 (100W)';
  else if (potenciaTotalW <= 200) driverRecomendado = 'LM2344 (200W)';
  else driverRecomendado = 'múltiplos drivers';

  const temDriver = amb.luminarias.some(l => /LM2343|LM2344/.test(l.codigo) || /DRIVER.*TRILHO\s+MAGNETICO/i.test(l.descricao));
  const temConector = amb.luminarias.some(l => /LM2338/.test(l.codigo) || /CONECTOR.*DIRECIONAVEL.*MAGNETICO/i.test(l.descricao));

  const avisos: string[] = [];
  if (!temConector) avisos.push('Conector de Energia Direcional LM2338 não encontrado no ambiente.');
  if (!temDriver) avisos.push(`Driver ${driverRecomendado} não encontrado no ambiente.`);
  if (potenciaTotalW > 200) avisos.push(`Potência total ${potenciaTotalW}W excede 200W — é necessário dividir em múltiplos circuitos/drivers.`);

  return { potenciaTotalW, qtdModulos, driverRecomendado, temDriver, temConector, avisos };
}

// ─── Cálculo global de drivers (nível projeto — regra 26) ───

export interface ResumoDriverProjeto {
  driverCodigo: string;
  driverDescricao: string;
  potenciaDriverW: number;
  voltagem: 12 | 24 | 48;
  totalConsumoW: number;
  totalDemandaM: number;
  limiteExtensaoM: number | null;
  qtdGlobal: number;
  qtdSomaIndividual: number;
  economiaDrivers: number;
}

export function calcularDriversPorProjeto(ambientes: Ambiente[]): ResumoDriverProjeto[] {
  const grupos = new Map<string, {
    descricao: string;
    potenciaDriverW: number;
    voltagem: 12 | 24 | 48;
    totalConsumoW: number;
    totalDemandaM: number;
    qtdSomaIndividual: number;
  }>();

  for (const amb of ambientes) {
    for (const sis of amb.sistemas) {
      const cod = sis.driver.codigo;
      if (!cod || sis.driver.potencia <= 0 || !sis.fita.wm) continue;
      const consumo = calcularConsumoW(sis);
      const demanda = calcularDemandaFita(sis);
      const existing = grupos.get(cod);
      if (existing) {
        existing.totalConsumoW += consumo;
        existing.totalDemandaM += demanda;
        existing.qtdSomaIndividual += calcularQtdDrivers(sis);
      } else {
        grupos.set(cod, {
          descricao: sis.driver.descricao,
          potenciaDriverW: sis.driver.potencia,
          voltagem: sis.driver.voltagem,
          totalConsumoW: consumo,
          totalDemandaM: demanda,
          qtdSomaIndividual: calcularQtdDrivers(sis),
        });
      }
    }
  }

  const resultado: ResumoDriverProjeto[] = [];
  for (const [cod, g] of grupos) {
    const limite = limiteExtensaoMetros(g.voltagem);
    const qtdPorPotencia = Math.ceil(g.totalConsumoW / g.potenciaDriverW);
    const qtdPorExtensao = limite ? Math.ceil(g.totalDemandaM / limite) : 0;
    const qtdGlobal = Math.max(qtdPorPotencia, qtdPorExtensao);
    resultado.push({
      driverCodigo: cod,
      driverDescricao: g.descricao,
      potenciaDriverW: g.potenciaDriverW,
      voltagem: g.voltagem,
      totalConsumoW: g.totalConsumoW,
      totalDemandaM: g.totalDemandaM,
      limiteExtensaoM: limite,
      qtdGlobal,
      qtdSomaIndividual: g.qtdSomaIndividual,
      economiaDrivers: Math.max(0, g.qtdSomaIndividual - qtdGlobal),
    });
  }
  return resultado;
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
