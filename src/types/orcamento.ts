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
  /** Largura da fita em mm (RULE-013) — usada na validação perfil×fita da edge. */
  largura_mm?: number | null;
  /** Tamanho do rolo da fita em metros (RULE-005) — catálogo real: 5/10/25/50. */
  tamanho_rolo_m?: number | null;
  /** Cor do produto no catálogo: 'preto' | 'branco' | 'dourado' | null (RULE-054/055/110). */
  cor?: string | null;
  /** Fator multiplicador de lâmpadas do spot: 1=simples, 2=duplo, 3=triplo, 4=quádruplo (RULE-111). */
  fator_spot?: number | null;
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
  /** Sub-itens de um sistema composto (MAGNETO/TINY/MODULAR). Phase 19 / D-01.
   *  Opcional — snapshots antigos têm undefined e continuam funcionando. */
  composicao?: ItemComposicao[];
}

/** Sub-item de um sistema composto (módulo, driver, conector, kit, acessório).
 *  Forward-complete (Phase 19 / D-02): inclui comprimento (SYSTEM MOLD, Phase 21)
 *  e potenciaW (auto-load magnético, Phase 20), ambos opcionais → zero quebra.
 *  Campos técnicos e preço são SNAPSHOT do catálogo no add-time (D-03). */
export interface ItemComposicao {
  id: string;
  codigo: string;
  descricao: string;
  quantidade: number;
  precoUnitario: number;
  precoMinimo: number;
  imagemUrl?: string;
  papel: 'modulo' | 'driver_recomendado' | 'driver_obrigatorio' | 'conector_energia' | 'kit_fixacao' | 'acessorio_opcional' | 'fita_modular' | 'lampada';
  obrigatorio: boolean;
  /** Comprimento em metros do módulo (SYSTEM MOLD deriva fita de Σ(comprimento × qtd)). Phase 21. */
  comprimento?: number;
  /** Potência individual em watts do módulo (auto-load magnético deriva carga total). Phase 20. */
  potenciaW?: number;
  /** W/m da fita (só em `papel: 'fita_modular'`). Guardado para o consumo do SYSTEM MOLD poder
   *  ser recalculado a cada render — sem ele, o aviso de driver alojado congelava no valor
   *  da última busca e não acompanhava a remoção de módulos. Opcional (snapshots antigos). */
  wm?: number;
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
  /** Máximo de passadas válidas para a família do perfil (CALC-03 / D-11).
   *  Opcional — backwards-compatible com snapshots antigos; fallback de UI: ?? 3. */
  passadasPadrao?: 1 | 2 | 3;
}

export interface ItemFitaLED {
  id: string;
  codigo: string;
  descricao: string;
  wm: number;
  voltagem?: 12 | 24 | 48;
  /** Tamanho do rolo em metros (RULE-005): vem do catálogo (`produtos.tamanho_rolo_m`)
   *  no add-time — catálogo real tem 5/10/25/50 m. Fallback 5 quando o produto não tem
   *  o campo preenchido. Snapshots antigos carregam 5/10/15 e continuam válidos. */
  metragemRolo: number;
  precoUnitario: number;
  precoMinimo: number;
  imagemUrl?: string;
  is_baby?: boolean | null;
  /** Largura da fita em mm (RULE-013). Snapshot do catálogo no add-time.
   *  Opcional — snapshots antigos têm undefined; payload da edge envia null e a validação é pulada. */
  largura_mm?: number | null;
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
  /** Sub-ambiente / agrupamento opcional (ex: "Sanca", "Rasgo", "Pé-direito"). Phase 5 / PDF-01. */
  local?: string | null;
  /** Override manual da quantidade de drivers cobrada (RULE-001 — tudo editável).
   *  Opcional — null/undefined = usar o cálculo automático (retrocompatível com snapshots antigos). */
  qtdDriversManual?: number | null;
  /** Categoria de fita à qual este sistema está vinculado (RULE-016).
   *  Ao vincular, a fita da categoria é copiada para `fita` (snapshot) e a metragem deste
   *  sistema passa a somar na fita da categoria. Opcional — sistema sem categoria continua
   *  consolidando por código de fita (retrocompatível). */
  categoriaId?: string | null;
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
  /** RULE-069/072: "Primeiro Orçamento" é a revisão inicial (exibida como R00); até 15 por
   *  projeto (R00…R14). O valor gravado no banco não muda para não invalidar histórico. */
  tipo: 'Primeiro Orçamento' | 'Revisão 01' | 'Revisão 02' | 'Revisão 03' | 'Revisão 04' | 'Revisão 05'
      | 'Revisão 06' | 'Revisão 07' | 'Revisão 08' | 'Revisão 09' | 'Revisão 10' | 'Revisão 11'
      | 'Revisão 12' | 'Revisão 13' | 'Revisão 14' | '';
}

/** Categoria de fita (RULE-014/015): nome livre dado pelo colaborador (ex.: "sanca quente",
 *  "marcenaria") + a fita que a categoria carrega. NÃO tem perfil — o perfil é escolhido caso a
 *  caso no ambiente e vinculado à categoria (RULE-016).
 *  Escopo: por orçamento, sem padrões globais (RULE-019 / CONF-11). */
export interface CategoriaFita {
  id: string;
  nome: string;
  fita: ItemFitaLED;
}

export interface Orcamento {
  dados: DadosOrcamento;
  ambientes: Ambiente[];
  /** Categorias de fita do orçamento (RULE-014). Opcional — orçamentos anteriores ao
   *  modelo de categorias não têm o campo e continuam agrupando a fita por código. */
  categorias?: CategoriaFita[];
}

// Status do orçamento — alinhado com CHECK constraint da Phase 7 (D-25)
export type StatusOrcamento = 'rascunho' | 'aprovado' | 'perdido' | 'pendente';

// ─── Cálculos do Sistema Fita→Driver (com perfil opcional) ───

/**
 * Margem de segurança aplicada sobre a potência consumida ao dimensionar drivers.
 * RULE-026 — decisão da equipe (Luis/Paolla, 2026-08-12): folga de 20%.
 * Mantém paridade com a edge function `validar-sistema-orcamento` e as RPCs SQL
 * (`calcular_driver_recomendado`/`validar_sistema_iluminacao`) — mudar aqui exige
 * espelhar nas outras duas camadas no MESMO deploy.
 */
export const MARGEM_SEGURANCA_DRIVER = 1.20;

/**
 * Sobra (perda) de fita considerada POR ROLO ao converter demanda em rolos.
 * RULE-006 — decisão da equipe (Luis/Paolla, 2026-08-12): 5% sobre cada rolo,
 * i.e. de um rolo de 5 m consideram-se ~4,75 m aproveitáveis.
 * Paridade com a edge `validar-sistema-orcamento` (otimizarRolos) e a RPC SQL
 * `otimizar_rolos_fita` — mudar aqui exige espelhar nas outras duas camadas.
 */
export const SOBRA_ROLO_FITA = 0.05;

/** RULE-072 — teto de revisões por projeto. Vale no ponto de gravação, para cobrir
 *  também o caminho "Duplicar como nova revisão".
 *  Número confirmado pela equipe (Luis/Paolla, 2026-08-12, 2ª rodada): 15 (R00…R14). */
export const LIMITE_ORCAMENTOS_POR_PROJETO = 15;

/** Rótulo da última revisão permitida ("R14") — derivado da constante para que os textos
 *  de UI nunca divirjam do guard (lição do rótulo "× 1,05" hardcoded no WP-B). */
export function rotuloUltimaRevisao(): string {
  return `R${String(LIMITE_ORCAMENTOS_POR_PROJETO - 1).padStart(2, '0')}`;
}

/** Opções do seletor de revisão (RULE-069/072), na ordem exibida no Step 1.
 *  O `valor` é o que já era gravado em `orcamentos.tipo` — só o rótulo mudou. */
export function opcoesRevisao(): Array<{ valor: DadosOrcamento['tipo']; rotulo: string }> {
  const opcoes: Array<{ valor: DadosOrcamento['tipo']; rotulo: string }> = [
    { valor: 'Primeiro Orçamento', rotulo: 'Revisão 00 (R00) — primeiro orçamento' },
  ];
  for (let i = 1; i < LIMITE_ORCAMENTOS_POR_PROJETO; i++) {
    const nn = String(i).padStart(2, '0');
    opcoes.push({ valor: `Revisão ${nn}` as DadosOrcamento['tipo'], rotulo: `Revisão ${nn} (R${nn})` });
  }
  return opcoes;
}

/** Tamanhos de rolo praticados no catálogo (RULE-005, conferido em 2026-08-12:
 *  186 fitas com `tamanho_rolo_m` → 5 m, 10 m, 25 m e 50 m).
 *  Usado só como opções do seletor manual — o valor real vem do produto. */
export const TAMANHOS_ROLO_CATALOGO = [5, 10, 25, 50];

/** Regras de conector/kit obrigatório por família de sistema composto (Phase 19 / D-07).
 *  Vive no código (3 famílias fixas, regra estrutural estável), NÃO na tabela produto_composicao.
 *  A produto_composicao fica reservada para sugestões SKU↔SKU. Consumido pelo validador da Phase 20 (COMP-01).
 *  `sistema` corresponde a product_variants.sistema ('magneto_48v' | 'tiny_magneto' | 's_mode'). */
export const REGRAS_COMPOSICAO: Record<string, {
  conectoresObrigatorios: string[];
  kitFixacaoEmbutir?: string;
  descricao: string;
}> = {
  magneto_48v: {
    conectoresObrigatorios: ['LM2338'],
    kitFixacaoEmbutir: 'LM2987',
    descricao: 'MAGNETO 48V — conector de energia direcional LM2338; versão embutir requer kit LM2987.',
  },
  tiny_magneto: {
    conectoresObrigatorios: ['LM3168', 'LM3169'],
    kitFixacaoEmbutir: 'LM2987',
    descricao: 'TINY MAGNETO 24V — conector LM3168 (preto) ou LM3169 (branco); versão embutir requer kit LM2987.',
  },
};

// ─── Helpers product-first Phase 20 ───

export type TipoAncora = 'luminaria' | 'fita' | 'perfil' | 'magneto_48v' | 'tiny_magneto' | 'modular';

/** Roteamento product-first (Phase 20 / D-02). Detecta o fluxo a partir do produto âncora.
 *  Prioridade: 'fita' ANTES do fallback (fita tem sistema_magnetico null — Pitfall 1). */
export function detectarTipoAncora(produto: Produto): TipoAncora {
  if (produto.tipo_produto === 'fita') return 'fita';
  if (produto.sistema_magnetico === 'magneto_48v') return 'magneto_48v';
  if (produto.sistema_magnetico === 'tiny_magneto') return 'tiny_magneto';
  if (produto.sistema_magnetico === 's_mode') return 'modular';
  // RULE-062 / BUG-09: perfil é um SISTEMA (perfil + fita + driver), não um item avulso.
  // Sem esta linha, buscar um perfil na busca do ambiente criava uma linha solta — e as
  // validações perfil×fita (largura, Baby, IP) nunca chegavam a rodar.
  // Vem DEPOIS dos magnéticos: trilho magnético cadastrado como perfil abre composição.
  if (produto.tipo_produto === 'perfil') return 'perfil';
  return 'luminaria'; // fallback gracioso D-03 — nunca interrompe
}

/** Carga total (W) de uma composição = Σ(potenciaW × quantidade) dos módulos (Phase 20 / D-06).
 *  Apenas papel==='modulo'; potenciaW ausente conta como 0. */
export function calcularCargaComposicao(composicao: ItemComposicao[] | undefined): number {
  if (!composicao?.length) return 0;
  return composicao
    .filter(c => c.papel === 'modulo')
    .reduce((s, c) => s + (c.potenciaW ?? 0) * c.quantidade, 0);
}

/** Metragem de fita derivada dos módulos difusos de um SYSTEM MOLD (Phase 21 / D-01).
 *  = Σ(comprimento × quantidade) dos itens papel==='modulo' com comprimento definido. */
export function calcularMetragemModulosDifusos(composicao: ItemComposicao[] | undefined): number {
  if (!composicao?.length) return 0;
  return composicao
    .filter(c => c.papel === 'modulo' && c.comprimento != null)
    .reduce((s, c) => s + (c.comprimento ?? 0) * c.quantidade, 0);
}

/** Parse do comprimento (m) do módulo difuso a partir da descrição. Snapshot no add-time.
 *  Verificado contra os 15 difusos: 132MM→0.132 ... 660MM→0.66, 1MT→1.0, 2MT→2.0. Phase 21 / D-01. */
export function parsearComprimentoModulo(descricao: string): number | undefined {
  const mmMatch = descricao.match(/FITA LED\s+(\d+(?:[,.]\d+)?)\s*MM/i);
  if (mmMatch) return parseFloat(mmMatch[1].replace(',', '.')) / 1000;
  const mtMatch = descricao.match(/FITA LED\s+(\d+(?:[,.]\d+)?)\s*MT/i);
  if (mtMatch) return parseFloat(mtMatch[1].replace(',', '.'));
  return undefined;
}

// ─── Capacidade do trilho e tampa cega (WP-B: RULE-056/099 + RULE-037/038) ───

/** Parse GENÉRICO do comprimento (m) na descrição de trilho/perfil/tampa/módulo.
 *  Ordem de tentativa (da mais específica para a mais genérica):
 *  1. "FITA LED 132MM" / "FITA LED 1MT" — difusos (parsearComprimentoModulo);
 *  2. token de metros: "TAMANHO 2M", "TAM: 1M", "PT 2M - MAX. 48V", "1MT BRANCO",
 *     "0,50M PRETO", "2 METROS" — trilhos âncora e tampas cegas;
 *  3. token ÚNICO de milímetros: "300MM PT" (módulos magnéticos/concentrados).
 *     Com mais de um token MM (ex.: "LARGURA 26,2MM ALTURA 46MM") a medida é
 *     ambígua → undefined (fica fora da soma — RULE-056).
 *  Retorna undefined quando nada é parseável. */
export function parsearComprimentoDescricao(descricao: string): number | undefined {
  const d = descricao ?? '';
  const viaModulo = parsearComprimentoModulo(d);
  if (viaModulo != null) return viaModulo;
  // "1MT" / "2 METROS" primeiro; depois "2M" isolado (M\b não casa dentro de "46MM")
  const metros = d.match(/(\d+(?:[,.]\d+)?)\s*(?:MT|METROS?)\b/i) ?? d.match(/(\d+(?:[,.]\d+)?)M\b/i);
  if (metros) return parseFloat(metros[1].replace(',', '.'));
  const mms = d.match(/\d+(?:[,.]\d+)?\s*MM\b/gi);
  if (mms?.length === 1) {
    const mm = mms[0].match(/(\d+(?:[,.]\d+)?)/);
    if (mm) return parseFloat(mm[1].replace(',', '.')) / 1000;
  }
  return undefined;
}

/** Detecta tampa cega pela descrição (RULE-099: tampa cega "passa sempre"). */
export function ehTampaCega(descricao: string): boolean {
  return /TAMPA\s+CEGA/i.test(descricao ?? '');
}

export interface OcupacaoTrilho {
  /** Capacidade total do trilho âncora: comprimento parseado × quantidade do item. */
  trilhoM: number;
  /** Σ (comprimento × qtd) dos componentes que ocupam o trilho, INCLUINDO tampas
   *  cegas — base do AVISO de capacidade (RULE-056). RULE-099 resolvida pela
   *  equipe em 2026-08-12: tampa cega que excede AVISA mesmo assim. */
  ocupadoM: number;
  /** Σ (comprimento × qtd) incluindo tampas cegas — base da sobra para a sugestão
   *  de tampa cega por subtração (RULE-037). Hoje idêntico a ocupadoM; mantido
   *  separado caso a isenção volte. */
  ocupadoComTampasM: number;
}

/** Ocupação do trilho âncora de um sistema composto (RULE-056 / RULE-037).
 *  Somam apenas componentes que fisicamente ocupam o trilho (papel 'modulo' e
 *  'acessorio_opcional'); driver/conector/kit/fita_modular ficam fora.
 *  Comprimento do componente: snapshot `comprimento` ou parse da descrição;
 *  componentes sem comprimento parseável ficam fora da soma.
 *  Retorna null quando o comprimento do trilho âncora não é parseável
 *  (snapshots antigos/descrições sem medida → nenhum aviso, zero quebra). */
export function calcularOcupacaoTrilho(item: ItemLuminaria): OcupacaoTrilho | null {
  const trilhoUnitario = parsearComprimentoDescricao(item.descricao);
  if (trilhoUnitario == null || trilhoUnitario <= 0) return null;
  const trilhoM = trilhoUnitario * Math.max(1, item.quantidade || 1);
  let ocupadoM = 0;
  let ocupadoComTampasM = 0;
  for (const c of item.composicao ?? []) {
    if (c.papel !== 'modulo' && c.papel !== 'acessorio_opcional') continue;
    const comp = c.comprimento ?? parsearComprimentoDescricao(c.descricao);
    if (comp == null || comp <= 0) continue; // sem comprimento parseável: fora da soma
    const total = comp * Math.max(1, c.quantidade || 1);
    ocupadoComTampasM += total;
    ocupadoM += total; // tampa cega conta no aviso (decisão da equipe 2026-08-12, RULE-099)
  }
  return { trilhoM, ocupadoM, ocupadoComTampasM };
}

/** Escolhe a tampa cega para cobrir uma sobra (RULE-038): a MENOR com
 *  comprimento >= sobra; se nenhuma
 *  cobre, a MAIOR disponível (`cobre: false` → chamador avisa).
 *  Empates de comprimento preservam a ordem de entrada (permite pré-ordenar
 *  candidatas por preferência, ex.: cor do trilho). */
export function escolherTampaCega<T extends { comprimentoM: number }>(
  tampas: T[],
  sobraM: number,
): { tampa: T; cobre: boolean } | null {
  if (!tampas.length) return null;
  let melhor: T | null = null;
  let maior: T = tampas[0];
  for (const t of tampas) {
    if (t.comprimentoM > maior.comprimentoM) maior = t;
    if (t.comprimentoM >= sobraM - 1e-9 && (melhor == null || t.comprimentoM < melhor.comprimentoM)) {
      melhor = t;
    }
  }
  return melhor ? { tampa: melhor, cobre: true } : { tampa: maior, cobre: false };
}

export type RecomendacaoDriver48V =
  | { estado: 'sem_carga' }
  | { estado: 'recomendado'; sku: 'LM2343' | 'LM2344'; potenciaW: 100 | 200; potenciaSeguraW: number }
  | { estado: 'excede_200w'; potenciaSeguraW: number };

/** Bucket de driver 48V (Phase 20 / D-07): LM2343 100W até 100W, LM2344 200W até 200W.
 *  > 200W: D-08 — avisa para dividir em N circuitos, NÃO auto-insere. Margem ×1.05. */
export function recomendarDriver48V(cargaTotalW: number): RecomendacaoDriver48V {
  if (cargaTotalW <= 0) return { estado: 'sem_carga' };
  // Bucket no valor CRU (não arredondado): arredondar antes da comparação pode empurrar
  // uma carga marginalmente acima de 100/200W para o driver menor (subdimensionado por centésimos).
  const seguraRaw = cargaTotalW * MARGEM_SEGURANCA_DRIVER;
  const potenciaSeguraW = Math.round(seguraRaw * 100) / 100; // só para exibição
  if (seguraRaw <= 100) return { estado: 'recomendado', sku: 'LM2343', potenciaW: 100, potenciaSeguraW };
  if (seguraRaw <= 200) return { estado: 'recomendado', sku: 'LM2344', potenciaW: 200, potenciaSeguraW };
  return { estado: 'excede_200w', potenciaSeguraW };
}

/** Metragem total do perfil (se existir) */
export function calcularMetragemTotal(perfil: ItemPerfil): number {
  return perfil.comprimentoPeca * perfil.quantidade;
}

/**
 * Aplica/regenera o sufixo de metragem na descrição do perfil (CALC-02 / D-09).
 * Remove qualquer sufixo " — N,Nm" anterior antes de re-anexar, preservando o texto manual.
 * Formato pt-BR: " — 2,5m" (travessão em dash + espaço, vírgula decimal, sem espaço antes de "m").
 */
export function aplicarSufixoMetragem(descricaoBase: string, comprimentoPeca: number, quantidade: number): string {
  const baseStripped = descricaoBase.replace(/ — \d+(,\d+)?m$/, '').trimEnd();
  const metragem = comprimentoPeca * quantidade;
  const metragemFormatada = metragem % 1 === 0
    ? `${metragem}m`
    : `${metragem.toString().replace('.', ',')}m`;
  return `${baseStripped} — ${metragemFormatada}`;
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
  const qtdPorPotencia = Math.ceil((consumo * MARGEM_SEGURANCA_DRIVER) / driver.potencia);
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
  const qtdPot = Math.ceil((consumo * MARGEM_SEGURANCA_DRIVER) / driver.potencia);
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

/** Subtotal dos sub-itens de composição de uma luminária (Phase 19 / D-01).
 *  Guard ?.length → retorna 0 para snapshots antigos sem composicao (backward-compat). */
export function calcularSubtotalComposicao(item: ItemLuminaria): number {
  if (!item.composicao?.length) return 0;
  return item.composicao.reduce((s, c) => s + c.precoUnitario * c.quantidade, 0);
}

export function calcularSubtotalPerfilSistema(sistema: SistemaIluminacao): number {
  if (!sistema.perfil) return 0;
  return sistema.perfil.precoUnitario * sistema.perfil.quantidade;
}

/** Quantidade EFETIVA de drivers do sistema (RULE-001): override manual quando
 *  presente e válido (inteiro ≥ 0), senão fallback no cálculo automático.
 *  Snapshots antigos sem qtdDriversManual caem sempre no cálculo. */
export function calcularQtdDriversEfetiva(sistema: SistemaIluminacao): number {
  const manual = sistema.qtdDriversManual;
  if (manual != null && Number.isFinite(manual) && manual >= 0) {
    return Math.floor(manual);
  }
  return calcularQtdDrivers(sistema);
}

export function calcularSubtotalDriverSistema(sistema: SistemaIluminacao): number {
  const qtd = calcularQtdDriversEfetiva(sistema);
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

  const potenciaSeguraW = potenciaTotalW * MARGEM_SEGURANCA_DRIVER;
  let driverRecomendado: ResumoMagneto48V['driverRecomendado'];
  if (potenciaSeguraW <= 100) driverRecomendado = 'LM2343 (100W)';
  else if (potenciaSeguraW <= 200) driverRecomendado = 'LM2344 (200W)';
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
    codigo: string;
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
      // Chave composta codigo+voltagem — mesmo driver em voltagens diferentes = linhas distintas (D-08/C-4)
      const chave = `${sis.driver.codigo}|${sis.driver.voltagem}`;
      const consumo = calcularConsumoW(sis);
      const demanda = calcularDemandaFita(sis);
      const existing = grupos.get(chave);
      if (existing) {
        existing.totalConsumoW += consumo;
        existing.totalDemandaM += demanda;
        existing.qtdSomaIndividual += calcularQtdDrivers(sis);
      } else {
        grupos.set(chave, {
          codigo: sis.driver.codigo,
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
  for (const [, g] of grupos) {
    const driverCodigo = g.codigo;
    const limite = limiteExtensaoMetros(g.voltagem);
    const qtdPorPotencia = Math.ceil((g.totalConsumoW * MARGEM_SEGURANCA_DRIVER) / g.potenciaDriverW);
    const qtdPorExtensao = limite ? Math.ceil(g.totalDemandaM / limite) : 0;
    const qtdGlobal = Math.max(qtdPorPotencia, qtdPorExtensao);
    resultado.push({
      driverCodigo,
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

export interface LocalBreakdown {
  /** Identificador de origem da fita: "Ambiente — Local" (com local) OU "Ambiente" (sem local) */
  label: string;
  /** Metragem de fita demandada nesse Ambiente — Local */
  demanda: number;
}

export interface GrupoFita {
  codigo: string;
  descricao: string;
  demandaTotal: number;
  /** Tamanho do rolo do grupo (RULE-005) — vem do snapshot da fita; fallback 5. */
  metragemRolo: number;
  precoUnitario: number;
  precoMinimo: number;
  rolos: { tamanho: number; quantidade: number }[];
  qtdRolosTotal: number;
  subtotal: number;
  /** NOVO (Phase 17 / RES-01 D-04/D-05): breakdown da demanda por "Ambiente — Local" */
  localBreakdown?: LocalBreakdown[];
  /** NOVO (Phase 17 / RES-01 D-08): URL da imagem/thumbnail da fita para o Resumo de Fitas do PDF */
  imagemUrl?: string;
  /** Categoria que originou o grupo (RULE-017). Ausente em grupos consolidados por código. */
  categoriaId?: string;
  /** Nome da categoria — vai na etiqueta da fábrica (RULE-018). */
  categoriaNome?: string;
}

/** Consolida a fita do orçamento inteiro em grupos de compra.
 *
 *  Chave do grupo (RULE-017): a CATEGORIA, quando o sistema está vinculado a uma; senão o
 *  código da fita (comportamento anterior, mantido para orçamentos sem categorias).
 *  Consolidar por categoria é o que garante as RULE-020 (mesma fita em categorias diferentes
 *  = grupos separados) e RULE-021 (rolo de uma categoria não é reaproveitado em outra).
 *
 *  `categorias` é opcional só para não quebrar chamadores antigos (o template v1 é congelado);
 *  sem ela, os grupos por categoria ficam sem nome na etiqueta. */
export function calcularRolosPorGrupo(ambientes: Ambiente[], categorias?: CategoriaFita[]): GrupoFita[] {
  const nomePorCategoria = new Map((categorias ?? []).map(c => [c.id, c.nome]));
  const grupos = new Map<string, {
    codigoFita: string;
    categoriaId?: string;
    descricao: string;
    demanda: number;
    metragemRolo: number;
    precoUnitario: number;
    precoMinimo: number;
    imagemUrl?: string;
    localAcc: Map<string, number>;
  }>();

  for (const amb of ambientes) {
    for (const sis of amb.sistemas) {
      if (!sis.fita.codigo) continue;
      // Categoria removida depois de vinculada deixa `categoriaId` órfão no sistema. Sem este
      // fallback o grupo fantasma continuaria separado do grupo da mesma fita — dois pedidos
      // de rolo para a mesma fita, sem nome de categoria em nenhum dos dois.
      const categoriaValida = sis.categoriaId && (categorias == null || nomePorCategoria.has(sis.categoriaId));
      const key = categoriaValida ? `cat:${sis.categoriaId}` : sis.fita.codigo;
      const demanda = calcularDemandaFita(sis);
      const label = (sis.local && sis.local.trim())
        ? `${amb.nome} — ${sis.local.trim()}`
        : amb.nome;
      const existing = grupos.get(key);
      if (existing) {
        existing.demanda += demanda;
        existing.localAcc.set(label, (existing.localAcc.get(label) ?? 0) + demanda);
        // Mesmo código de fita com tamanhos de rolo divergentes (ex.: sistema de snapshot
        // antigo + sistema novo do catálogo): fica o MAIOR, senão a ordem dos ambientes
        // decidiria o preço. O maior é o que veio do catálogo — o menor é o default legado.
        existing.metragemRolo = Math.max(existing.metragemRolo, sis.fita.metragemRolo || 0);
      } else {
        grupos.set(key, {
          codigoFita: sis.fita.codigo,
          categoriaId: categoriaValida ? sis.categoriaId! : undefined,
          descricao: sis.fita.descricao,
          demanda,
          metragemRolo: sis.fita.metragemRolo,
          precoUnitario: sis.fita.precoUnitario,
          precoMinimo: sis.fita.precoMinimo,
          imagemUrl: sis.fita.imagemUrl,
          localAcc: new Map([[label, demanda]]),
        });
      }
    }
  }

  const resultado: GrupoFita[] = [];
  for (const g of grupos.values()) {
    // RULE-005: rolo único por produto (tamanho do catálogo via snapshot); fallback 5 m.
    // RULE-006: 5% de sobra POR ROLO — de um rolo de 5 m aproveitam-se ~4,75 m.
    // Ceil no valor CRU (WR-03); epsilon compensa 5×0.95 ≠ 4.75 em ponto flutuante.
    const tamanhoRolo = g.metragemRolo > 0 ? g.metragemRolo : 5;
    const metrosUteisPorRolo = tamanhoRolo * (1 - SOBRA_ROLO_FITA);
    const qtdRolosTotal = g.demanda > 0 ? Math.ceil(g.demanda / metrosUteisPorRolo - 1e-9) : 0;
    const rolos = qtdRolosTotal > 0 ? [{ tamanho: tamanhoRolo, quantidade: qtdRolosTotal }] : [];
    resultado.push({
      codigo: g.codigoFita,
      categoriaId: g.categoriaId,
      categoriaNome: g.categoriaId ? nomePorCategoria.get(g.categoriaId) : undefined,
      descricao: g.descricao,
      demandaTotal: g.demanda,
      metragemRolo: tamanhoRolo, // valor EFETIVO (já com fallback) — o mesmo que precifica `rolos`
      precoUnitario: g.precoUnitario,
      precoMinimo: g.precoMinimo,
      rolos,
      qtdRolosTotal,
      subtotal: g.precoUnitario * qtdRolosTotal,
      localBreakdown: Array.from(g.localAcc.entries()).map(([label, demanda]) => ({ label, demanda })),
      imagemUrl: g.imagemUrl,
    });
  }

  return resultado;
}

// ─── Totais ───

export function calcularTotalAmbienteSemFita(amb: Ambiente): number {
  const totalLum = amb.luminarias.reduce(
    (s, i) => s + calcularSubtotalLuminaria(i) + calcularSubtotalComposicao(i),
    0
  );
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

// ─── Clonagem de sistemas e ambientes (Phase 18 — RES-04 / UX-04) ───
// Regenera TODOS os UUIDs da árvore para evitar colisão de key em re-render e snapshot/PDF.

/** Duplica um sistema dentro do MESMO ambiente (RES-04). Novos UUIDs + sufixo " (cópia)" no local. */
export function clonarSistema(sis: SistemaIluminacao): SistemaIluminacao {
  return {
    ...sis,
    id: crypto.randomUUID(),
    local: sis.local ? `${sis.local} (cópia)` : '(cópia)',
    fita: { ...sis.fita, id: crypto.randomUUID() },
    driver: { ...sis.driver, id: crypto.randomUUID() },
    perfil: sis.perfil ? { ...sis.perfil, id: crypto.randomUUID() } : null,
  };
}

/** Duplica um sistema para dentro de um ambiente clonado (UX-04). Novos UUIDs, local PRESERVADO. */
export function clonarSistemaParaAmbiente(sis: SistemaIluminacao): SistemaIluminacao {
  return {
    ...sis,
    id: crypto.randomUUID(),
    fita: { ...sis.fita, id: crypto.randomUUID() },
    driver: { ...sis.driver, id: crypto.randomUUID() },
    perfil: sis.perfil ? { ...sis.perfil, id: crypto.randomUUID() } : null,
  };
}

/** Clona um ItemLuminaria com novos UUIDs em TODA a árvore (raiz + composicao[]).
 *  composicao ausente → permanece undefined (backward-compat). Phase 21 / D-06. */
export function clonarItemLuminaria(item: ItemLuminaria): ItemLuminaria {
  return {
    ...item,
    id: crypto.randomUUID(),
    composicao: item.composicao?.map(c => ({ ...c, id: crypto.randomUUID() })),
  };
}

/** Duplica um ambiente inteiro (UX-04). Novos UUIDs em toda a árvore + sufixo " (cópia)" no nome. */
export function clonarAmbiente(amb: Ambiente): Ambiente {
  return {
    ...amb,
    id: crypto.randomUUID(),
    nome: `${amb.nome} (cópia)`,
    luminarias: amb.luminarias.map(clonarItemLuminaria),
    sistemas: amb.sistemas.map((sis) => clonarSistemaParaAmbiente(sis)),
  };
}

// ─── Detector unificado de itens suspeitos do checklist (Phase 18 — UX-05) ───

export function luminariaPrecisaLampada(descricao: string): boolean {
  const d = (descricao ?? '').toUpperCase();
  const temBaseLampada = /\b(GU10|E27|MR11|MR16|AR70|AR111|PAR20|PAR30|DICROICA|DICRO)\b/.test(d);
  const temLedIntegrado = /LED\s+INTEGRADO|COM\s+LED/.test(d);
  // A própria lâmpada casa "GU10/DICROICA/..." — sem esta guarda, adicionar a lâmpada
  // gerava um novo item "precisa de lâmpada" (RULE-046).
  if (ehLampadaAvulsa(descricao)) return false;
  return temBaseLampada && !temLedIntegrado;
}

/** O item É uma lâmpada (e não um produto que a recebe)?
 *  Duas assinaturas no catálogo real: a descrição começa com o TIPO ("DICROICA GU10 LED
 *  4,5W", "PAR20 LED IP65 6W") ou com a própria palavra ("LÂMPADA LED TUBULAR G13").
 *  A palavra no MEIO é sempre do receptor ("PLAFON ... PARA LÂMPADAS DICROICA") — era
 *  o que fazia o checklist dar por satisfeito só de existir o spot no ambiente. */
function itemEhLampada(descricao?: string | null, tipoProduto?: string | null): boolean {
  if (tipoProduto === 'lampada') return true;
  if (ehLampadaAvulsa(descricao)) return true;
  return /^\s*L[ÂA]MPADAS?\b/i.test(descricao ?? '');
}

export function ambienteTemLampada(amb: Ambiente): boolean {
  // As lâmpadas de spot do catálogo NÃO trazem a palavra "lâmpada" no nome
  // ("DICROICA GU10 LED 4,5W") e só 12 das 115 estão com `tipo_produto='lampada'` —
  // por isso o detector é o do nome, e não a coluna.
  return amb.luminarias.some(
    (l) =>
      itemEhLampada(l.descricao, (l as any).tipo_produto) ||
      (l.composicao ?? []).some(
        (c) => c.papel === 'lampada' || itemEhLampada(c.descricao)
      )
  );
}

// ─── P6: lâmpadas de spot (RULE-044/045/046/111/112) ───

/** Tipos de lâmpada que os spots do catálogo pedem pelo nome (R6 final RF6.16: o critério
 *  de compatibilidade é o tipo indicado no NOME do spot). */
export type TipoLampada = 'MR11' | 'MR16' | 'AR70' | 'AR111' | 'PAR16' | 'PAR20' | 'PAR30';

/** Como cada tipo aparece no INÍCIO da descrição de uma lâmpada do catálogo.
 *  Conferido no catálogo real (2026-08-12): as 115 lâmpadas de spot começam pelo tipo
 *  ("DICROICA GU10 LED 4,5W", "MR11 4W 3000K", "PAR20 LED IP65 6W"), enquanto os spots
 *  trazem o tipo no meio, depois de "PARA LÂMPADA". Por isso o filtro é por PREFIXO. */
const PREFIXOS_LAMPADA: Record<TipoLampada, string[]> = {
  MR11: ['MR11', 'MR-11', 'MINI DICROICA'],
  MR16: ['DICROICA', 'MR16', 'MR-16'],
  AR70: ['AR70', 'AR-70'],
  AR111: ['AR111', 'AR-111'],
  PAR16: ['PAR16', 'PAR-16'],
  PAR20: ['PAR20', 'PAR-20'],
  PAR30: ['PAR30', 'PAR-30'],
};

/** Prefixos ilike ("DICROICA%") para montar a busca das lâmpadas de um tipo. */
export function prefixosDeBuscaLampada(tipo: TipoLampada): string[] {
  return PREFIXOS_LAMPADA[tipo].map((p) => `${p}%`);
}

/** A descrição é de uma LÂMPADA avulsa (e não de um spot/módulo que a recebe)?
 *  Critério: começa com o tipo. "MINI DICROICA MR11..." conta; "SPOT ... PARA LAMPADA
 *  DICROICA MR16" não. Zero falso positivo nos 4.974 produtos ativos. */
export function ehLampadaAvulsa(descricao?: string | null): boolean {
  return tipoDaLampada(descricao) != null;
}

/** Tipo da lâmpada avulsa (pelo prefixo do nome), ou null se não for lâmpada. */
export function tipoDaLampada(descricao?: string | null): TipoLampada | null {
  const d = (descricao ?? '').trim().toUpperCase();
  if (!d) return null;
  // MR11/mini dicroica ANTES de MR16/dicroica: "MINI DICROICA" começa com... "MINI",
  // mas "DICROICA" sozinha é MR16 — a ordem evita classificar mini como comum.
  const ordem: TipoLampada[] = ['MR11', 'MR16', 'AR111', 'AR70', 'PAR16', 'PAR20', 'PAR30'];
  for (const tipo of ordem) {
    for (const p of PREFIXOS_LAMPADA[tipo]) {
      if (d.startsWith(p)) return tipo;
    }
  }
  return null;
}

/** RULE-044 — tipo de lâmpada que ESTE spot/módulo pede, lido do nome dele.
 *  Retorna null para luminária com LED integrado ou sem tipo declarado (nada é ofertado). */
export function tipoLampadaDoSpot(descricao?: string | null): TipoLampada | null {
  const d = (descricao ?? '').toUpperCase();
  if (!d) return null;
  if (ehLampadaAvulsa(d)) return null;               // é a lâmpada, não quem a recebe
  if (/LED\s+INTEGRADO|COM\s+LED\b/.test(d)) return null;
  // Mesma ordem do detector acima; aqui o tipo aparece no meio da descrição.
  if (/\bMR-?11\b|MINI\s+DICROICA/.test(d)) return 'MR11';
  if (/\bMR-?16\b|\bDICROICA\b|\bDICRO\b/.test(d)) return 'MR16';
  if (/\bAR-?111\b/.test(d)) return 'AR111';
  if (/\bAR-?70\b/.test(d)) return 'AR70';
  if (/\bPAR-?16\b/.test(d)) return 'PAR16';
  if (/\bPAR-?20\b/.test(d)) return 'PAR20';
  if (/\bPAR-?30\b/.test(d)) return 'PAR30';
  return null;
}

/** RULE-111 — quantos fachos (lâmpadas) o spot leva: duplo = 2, triplo = 3, quádruplo = 4,
 *  "2 FOCOS" = 2. Default 1. O catálogo atual não tem spot multifoco cadastrado; o helper
 *  fica pronto para quando tiver, e a quantidade sugerida já sai multiplicada. */
export function fachosDoSpot(descricao?: string | null): number {
  const d = (descricao ?? '').toUpperCase();
  const nFocos = d.match(/\b(\d+)\s*FOCOS?\b/);
  if (nFocos) return Math.max(1, parseInt(nFocos[1], 10) || 1);
  if (/\bQU[AÁ]D(R)?UPLO\b|\bQUADUPLO\b/.test(d)) return 4;
  if (/\bTRIPLO\b/.test(d)) return 3;
  if (/\bDUPLO\b/.test(d)) return 2;
  return 1;
}

/** RULE-112 — acessório de junção do SPOT CONNECT NO FRAME, escolhido pelo tipo de lâmpada.
 *  Códigos conferidos no catálogo em 2026-08-12 (a SPEC trazia LM1231/LM1232, que são da
 *  linha antiga — os da linha CONNECT são estes):
 *   - LM2657: "PARA LAMPADAS MR111, MR16, AR70, PAR20"
 *   - LM2658: "PARA LAMPADAS AR111, PAR30" */
export const SKU_JUNCAO_CONNECT: Record<'menor' | 'maior', string> = {
  menor: 'LM2657',
  maior: 'LM2658',
};

/** SKU do acessório de junção para o tipo de lâmpada, ou null quando não se aplica. */
export function skuJuncaoConnect(tipo: TipoLampada | null): string | null {
  if (!tipo) return null;
  if (tipo === 'AR111' || tipo === 'PAR30') return SKU_JUNCAO_CONNECT.maior;
  return SKU_JUNCAO_CONNECT.menor;
}

/** O produto é da linha SPOT CONNECT NO FRAME (a única com acessório de junção por tipo)? */
export function ehSpotConnectNoFrame(descricao?: string | null): boolean {
  return /SPOT\s+CONNECT\s+NO\s+FRAME/i.test(descricao ?? '');
}

// ─── WP-F: cor, família de perfil e restrições físicas ───
// RULE-029/031/054/055/100/103/104/110. Helpers PUROS (sem Supabase, sem React) —
// consumidos por ComposicaoCard/AmbienteCard e espelhados na edge `validar-sistema-orcamento`.
// Todos aceitam campos ausentes (snapshots antigos): entrada vazia → resposta neutra.

export type CorProduto = 'preto' | 'branco' | 'dourado';

/** Normaliza a cor livre do catálogo (`produtos.cor` vem do master como texto solto:
 *  "Preto", "BRANCO", "Dourado"...). Retorna null para vazio/desconhecido — nunca lança. */
export function normalizarCor(raw?: string | null): CorProduto | null {
  const s = (raw ?? '').trim().toUpperCase();
  if (!s) return null;
  if (/^PRET[OA]?$|^PT$/.test(s)) return 'preto';
  if (/^BRANC[OA]?$|^BC$|^BR$/.test(s)) return 'branco';
  if (/^DOURAD[OA]?$|^DR$/.test(s)) return 'dourado';
  return null;
}

/** RULE-054/110: cor do produto deduzida do CÓDIGO e da DESCRIÇÃO.
 *  Convenção confirmada na R5: sufixo "PT" = preto (ex.: TINIMAG-PT, LM3168PT);
 *  "BC"/"BR"/"BRANCO" = branco. Sinais contraditórios (preto E branco no mesmo texto)
 *  ou ausência de marcador → null (chamador cai no default atual, sem inventar cor). */
export function corDoProduto(codigo?: string | null, descricao?: string | null): 'preto' | 'branco' | null {
  const texto = (descricao ?? '').toUpperCase();
  const cod = (codigo ?? '').toUpperCase();

  let preto = /\bPT\b|\bPRET[OA]\b/.test(texto);
  let branco = /\bBC\b|\bBR\b|\bBRANC[OA]\b/.test(texto);

  // Sufixo do código só desempata quando a descrição não disse nada
  if (!preto && !branco) {
    preto = /PT$/.test(cod);
    branco = /(BC|BR)$/.test(cod);
  }

  if (preto === branco) return null; // nenhum marcador OU marcadores conflitantes
  return preto ? 'preto' : 'branco';
}

// ─── Tampa cega COM FURO do sistema modular (RULE-039/040) ───

/** Códigos da tampa cega COM FURO do SYSTEM MOLD (RULE-039). Cores confirmadas pela
 *  equipe (Luis/Paolla, 2026-08-12, 2ª rodada): LM2561 = BRANCO, LM2562 = PRETO —
 *  o catálogo confirma nas descrições ("...0,133M BRANCO" / "...0,133M PRETO"). */
export const SKU_TAMPA_FURO_MODULAR: Record<'branco' | 'preto', string> = {
  branco: 'LM2561',
  preto: 'LM2562',
};

/** RULE-040 — a tampa com furo do modular tem medida única de 13,3 cm.
 *  Usada só como fallback: o comprimento real vem do parse da descrição do produto. */
export const COMPRIMENTO_TAMPA_FURO_M = 0.133;

/** Módulo de SPOT ou PENDENTE do sistema modular (RULE-039) — é o que dispara a oferta
 *  de tampa com furo. Casa "MODULO SPOT ..." / "MODULO PENDENTE ..." (grafia do catálogo,
 *  com e sem acento). NÃO casa a própria tampa ("TAMPA C/FURO PARA SPOT"), nem o módulo
 *  difuso, nem o concentrado — esses não levam tampa com furo. */
export function ehModuloSpotOuPendente(descricao?: string | null): boolean {
  return /\bM[OÓ]DULO\s+(SPOT|PENDENTE)\b/i.test(descricao ?? '');
}

/** A peça é uma tampa COM FURO? (por código ou pela descrição, cobrindo snapshots
 *  antigos e as duas variações do catálogo: "TAMPA CEGA COM FURO" e "TAMPA C/FURO"). */
export function ehTampaComFuro(codigo?: string | null, descricao?: string | null): boolean {
  const cod = (codigo ?? '').toUpperCase();
  if (cod === SKU_TAMPA_FURO_MODULAR.branco || cod === SKU_TAMPA_FURO_MODULAR.preto) return true;
  return /TAMPA\s+(CEGA\s+)?(COM|C\/)\s*FURO/i.test(descricao ?? '');
}

/** RULE-039 — quantas tampas com furo ainda faltam na composição: uma por módulo de
 *  spot/pendente (contando a quantidade de cada módulo), menos as que já estão lá.
 *  Nunca negativo — colaborador que adiciona tampas a mais não vira aviso. */
export function contarTampasFuroFaltantes(composicao?: ItemComposicao[]): number {
  let modulos = 0;
  let tampas = 0;
  for (const c of composicao ?? []) {
    const qtd = Math.max(1, c.quantidade || 1);
    if (c.papel === 'modulo' && ehModuloSpotOuPendente(c.descricao)) modulos += qtd;
    else if (ehTampaComFuro(c.codigo, c.descricao)) tampas += qtd;
  }
  return Math.max(0, modulos - tampas);
}

/** Limite físico do driver que fica ALOJADO dentro do trilho/perfil (RULE-029/100):
 *  acima disso o driver não cabe. Espelhado na edge `validar-sistema-orcamento`
 *  e no seed `regras_compatibilidade_perfil` (trik/fk/alojamento = 72 W). */
export const LIMITE_W_DRIVER_ALOJADO = 72;

/** Famílias (coluna `familia_perfil`) cujo driver fica alojado dentro do perfil. */
const FAMILIAS_DRIVER_ALOJADO = ['trik', 'trick', 'fk', 'alojamento'];

/** RULE-029 + RULE-100: o driver deste sistema fica ALOJADO dentro do perfil/trilho?
 *  Verdadeiro para as famílias Trick/Alojamento (por `familia_perfil` OU pelo nome do
 *  produto, que é como o colaborador reconhece a linha) e para o modular de SOBREPOR.
 *  Sem descrição nem família → false (nada bloqueia em snapshot antigo). */
export function exigeDriverAlojado(params: {
  descricao?: string | null;
  familiaPerfil?: string | null;
  sistema?: string | null;
}): boolean {
  const d = (params.descricao ?? '').toUpperCase();
  const familia = (params.familiaPerfil ?? '').trim().toLowerCase();
  if (familia && FAMILIAS_DRIVER_ALOJADO.includes(familia)) return true;
  if (/\bTRICK\b|\bTRIK\b|\bTRICKY\b|ALOJAMENTO/.test(d)) return true;
  // Modular (SYSTEM MOLD) de sobrepor: o driver vai escondido dentro do trilho
  if (params.sistema === 's_mode' && /SOBREPOR/.test(d)) return true;
  return false;
}

/** RULE-100: o driver é "Slim"? Três respostas, porque o dado pode faltar:
 *  - 'slim': `subtipo === 'slim'` OU "SLIM" no nome;
 *  - 'nao_slim': `subtipo` preenchido com outro valor (contradição explícita → BLOQUEIA);
 *  - 'indeterminado': sem `subtipo` e sem "SLIM" no nome (→ AVISA, não bloqueia:
 *    o catálogo ainda não classifica todos os drivers). */
export function classificarDriverSlim(params: {
  driverTipo?: string | null;
  descricao?: string | null;
}): 'slim' | 'nao_slim' | 'indeterminado' {
  const tipo = (params.driverTipo ?? '').trim().toLowerCase();
  if (tipo === 'slim') return 'slim';
  if (/\bSLIM\b/i.test(params.descricao ?? '')) return 'slim';
  if (tipo) return 'nao_slim';
  return 'indeterminado';
}

/** RULE-100: driver "Slim"? Atalho positivo de `classificarDriverSlim`. */
export function ehDriverSlim(params: { driverTipo?: string | null; descricao?: string | null }): boolean {
  return classificarDriverSlim(params) === 'slim';
}

/** RULE-031: driver de TRILHO (magnético) — não é driver de fita LED.
 *  Critérios, do mais confiável ao mais frouxo: `sistema` do catálogo
 *  ('tiny_magneto' | 'magneto_48v' | 'trilha'), `subtipo === 'magnetico'`,
 *  e por fim o nome ("DRIVER ... TRILHO MAGNETICO", padrão dos LM2343/LM2344). */
export function ehDriverDeTrilho(params: {
  sistema?: string | null;
  subtipo?: string | null;
  descricao?: string | null;
}): boolean {
  const sistema = (params.sistema ?? '').trim().toLowerCase();
  if (sistema === 'tiny_magneto' || sistema === 'magneto_48v' || sistema === 'trilha') return true;
  if ((params.subtipo ?? '').trim().toLowerCase() === 'magnetico') return true;
  const d = (params.descricao ?? '').toUpperCase();
  return /TRILHO\s+MAGNETIC[OA]|MAGNETIC[OA]\s+TRILHO|TRILHO\s+MAGNETO/.test(d);
}

/** RULE-103: perfis Light Mini e Ripado só aceitam fita Baby (não cabe outra).
 *  `somenteBaby` (flag do catálogo) tem precedência; o nome cobre o que ainda não
 *  está cadastrado. */
export function perfilSomenteFitaBaby(params: {
  descricao?: string | null;
  familiaPerfil?: string | null;
  somenteBaby?: boolean | null;
}): boolean {
  if (params.somenteBaby === true) return true;
  const familia = (params.familiaPerfil ?? '').trim().toLowerCase();
  if (familia.startsWith('light_mini') || familia === 'ripado') return true;
  const d = (params.descricao ?? '').toUpperCase();
  return /LIGHT\s*MINI|\bRIPAD[OA]\b/.test(d);
}

/** RULE-104: perfis Nano e Cantoneira não aceitam fita com IP (não cabe). */
export function perfilRejeitaFitaIP(params: {
  descricao?: string | null;
  familiaPerfil?: string | null;
}): boolean {
  const familia = (params.familiaPerfil ?? '').trim().toLowerCase();
  if (familia.includes('nano') || familia.includes('cantoneira')) return true;
  const d = (params.descricao ?? '').toUpperCase();
  return /\bNANO\b|CANTONEIRA/.test(d);
}

/** RULE-104: fita com proteção IP — "vai estar escrito no nome IP65".
 *  Só conta vedação real (IP44 ou mais): o catálogo escreve "IP20" em 102 das 316 fitas, e
 *  IP20 é justamente a fita SEM capa — a que cabe no perfil. Tratar IP20 como "fita IP"
 *  bloquearia um terço do catálogo nos perfis Nano/Cantoneira. */
export function fitaEhIP(descricao?: string | null): boolean {
  const m = /\bIP\s?(\d{2})\b/i.exec(descricao ?? '');
  return m ? Number(m[1]) >= 44 : false;
}

/** RULE-103: fita Baby — flag do catálogo (`somente_baby`) ou nome. */
export function fitaEhBaby(params: { descricao?: string | null; isBaby?: boolean | null }): boolean {
  if (params.isBaby === true) return true;
  return /\bBABY\b/i.test(params.descricao ?? '');
}

export interface ChecklistIssue {
  id: string;
  level: 'error' | 'warning';
  ambienteNome: string;
  mensagem: string;
}

/** Detecta itens suspeitos em todos os ambientes. Pura — sem async, sem Supabase.
 *  Erros (fita 0m) vêm antes dos avisos. Consumido por Step2 (advisory) e Step3 (checklist). */
export function detectarChecklistIssues(ambientes: Ambiente[]): ChecklistIssue[] {
  const erros: ChecklistIssue[] = [];
  const avisos: ChecklistIssue[] = [];
  for (const amb of ambientes) {
    for (const sis of amb.sistemas) {
      const fitaVazia = !sis.fita.codigo;
      const driverVazio = !sis.driver.codigo;
      // erro: fita sem perfil com metragem 0m (gate CALC-01)
      if (sis.fita.codigo && !sis.perfil && (!sis.metragemManual || sis.metragemManual <= 0)) {
        erros.push({
          id: `${amb.id}-${sis.id}-fita0m`,
          level: 'error',
          ambienteNome: amb.nome,
          mensagem: `${amb.nome} — Fita sem metragem (0m): o orçamento ficará R$ 0,00`,
        });
      }
      if (sis.fita.codigo && driverVazio) {
        avisos.push({
          id: `${amb.id}-${sis.id}-semdriver`,
          level: 'warning',
          ambienteNome: amb.nome,
          mensagem: `${amb.nome} — Sistema sem driver`,
        });
      }
      if (sis.driver.codigo && fitaVazia) {
        avisos.push({
          id: `${amb.id}-${sis.id}-driversemfita`,
          level: 'warning',
          ambienteNome: amb.nome,
          mensagem: `${amb.nome} — Driver sem fita LED`,
        });
      }
      if (sis.perfil && fitaVazia) {
        avisos.push({
          id: `${amb.id}-${sis.id}-perfilsemfita`,
          level: 'warning',
          ambienteNome: amb.nome,
          mensagem: `${amb.nome} — Perfil sem fita LED`,
        });
      }
      const fv = sis.fita.voltagem;
      const dv = sis.driver.voltagem;
      if (sis.fita.codigo && sis.driver.codigo && fv !== undefined && fv !== null && fv !== dv) {
        avisos.push({
          id: `${amb.id}-${sis.id}-voltagem`,
          level: 'warning',
          ambienteNome: amb.nome,
          mensagem: `${amb.nome} — Voltagem divergente: fita ${fv}V × driver ${dv}V`,
        });
      }
    }
    if (!ambienteTemLampada(amb)) {
      for (const lum of amb.luminarias) {
        if (luminariaPrecisaLampada(lum.descricao)) {
          avisos.push({
            id: `${amb.id}-${lum.id}-semlampada`,
            level: 'warning',
            ambienteNome: amb.nome,
            mensagem: `${amb.nome} — Peça sem lâmpada: ${lum.descricao}`,
          });
        }
      }
    }
  }
  return [...erros, ...avisos];
}
