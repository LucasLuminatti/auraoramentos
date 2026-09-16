/**
 * Auditoria de prontidão 2026-09-15, seção 2 (erros de valor):
 *  - a fita do SYSTEM MOLD era cobrada como 1 unidade, qualquer que fosse a metragem;
 *  - o driver de sistema composto entrava sempre com quantidade 1;
 *  - trocar a fita de uma categoria não chegava aos sistemas já vinculados, então o grupo de
 *    compra saía com o nome da categoria nova e o produto (e o preço) antigos.
 */
import { describe, it, expect } from 'vitest';
import {
  calcularRolosParaDemanda,
  calcularRolosFitaModular,
  calcularQtdDriversComposicao,
  calcularRolosPorGrupo,
  calcularTotalGeral,
  calcularTotalAmbienteSemFita,
  chaveGrupoFita,
  propagarFitaDasCategorias,
  motivoFitaNaoCabeNoPerfil,
  harmonizarPrecoFitaPorGrupo,
  calcularMetragemModulosDifusos,
  formatarMetros,
} from '../orcamento';
import type { Ambiente, CategoriaFita, ItemComposicao, ItemFitaLED, ItemPerfil, SistemaIluminacao } from '../orcamento';

describe('calcularRolosParaDemanda (RULE-005/006)', () => {
  it('desconta 5% de perda por rolo', () => {
    // rolo de 5 m rende 4,75 m
    expect(calcularRolosParaDemanda(4.75, 5)).toBe(1);
    expect(calcularRolosParaDemanda(4.76, 5)).toBe(2);
    expect(calcularRolosParaDemanda(12, 5)).toBe(3); // 12 / 4,75 = 2,53
  });

  it('usa o tamanho de rolo do produto', () => {
    expect(calcularRolosParaDemanda(12, 25)).toBe(1);
    expect(calcularRolosParaDemanda(60, 25)).toBe(3); // 25 m rende 23,75
    expect(calcularRolosParaDemanda(60, 50)).toBe(2);
  });

  it('cai em 5 m quando o cadastro não traz o rolo (snapshot antigo)', () => {
    expect(calcularRolosParaDemanda(12, null)).toBe(3);
    expect(calcularRolosParaDemanda(12, undefined)).toBe(3);
    expect(calcularRolosParaDemanda(12, 0)).toBe(3);
  });

  it('sem demanda não pede rolo', () => {
    expect(calcularRolosParaDemanda(0, 5)).toBe(0);
    expect(calcularRolosParaDemanda(-3, 5)).toBe(0);
  });
});

describe('calcularRolosFitaModular — fita do SYSTEM MOLD', () => {
  it('segue a conta de rolos', () => {
    expect(calcularRolosFitaModular(11, 5)).toBe(3);
    expect(calcularRolosFitaModular(1, 5)).toBe(1);
  });

  it('nunca zera enquanto a fita está no composto (metragem apagada ou difusos removidos)', () => {
    expect(calcularRolosFitaModular(0, 5)).toBe(1);
    expect(calcularRolosFitaModular(-1, 5)).toBe(1);
  });
});

describe('calcularQtdDriversComposicao (RULE-026)', () => {
  it('divide a carga com folga de 20% pela potência do driver', () => {
    expect(calcularQtdDriversComposicao(100, 100)).toBe(2); // 120W não cabe em um de 100W
    expect(calcularQtdDriversComposicao(80, 100)).toBe(1); // 96W cabe
    expect(calcularQtdDriversComposicao(300, 200)).toBe(2); // 360W
    expect(calcularQtdDriversComposicao(420, 200)).toBe(3); // 504W
  });

  it('sem carga não pede driver; potência desconhecida não inventa quantidade', () => {
    expect(calcularQtdDriversComposicao(0, 100)).toBe(0);
    expect(calcularQtdDriversComposicao(150, null)).toBe(1);
    expect(calcularQtdDriversComposicao(150, 0)).toBe(1);
  });
});

// ─── Fixtures de fita/sistema/categoria ───

const fita = (over: Partial<ItemFitaLED> = {}): ItemFitaLED => ({
  id: 'f', codigo: 'LM_ANTIGA', descricao: 'FITA ANTIGA', wm: 10, voltagem: 24,
  metragemRolo: 5, precoUnitario: 100, precoMinimo: 80, ...over,
});
const sistema = (over: Partial<SistemaIluminacao> = {}): SistemaIluminacao => ({
  id: 's1', perfil: null, fita: fita(),
  driver: { id: 'd', codigo: 'LM_D', descricao: 'DRIVER', potencia: 100, voltagem: 24, precoUnitario: 50, precoMinimo: 40 },
  metragemManual: 10, passadasManual: 1, local: null, ...over,
});
const ambiente = (sistemas: SistemaIluminacao[], nome = 'Sala'): Ambiente => ({
  id: nome, nome, luminarias: [], sistemas,
});
const perfil = (over: Partial<ItemPerfil>): ItemPerfil => ({
  id: 'p', codigo: 'LM_P', descricao: 'PERFIL', comprimentoPeca: 2, quantidade: 1, passadas: 1,
  precoUnitario: 50, precoMinimo: 40, ...over,
} as ItemPerfil);

describe('grupo de compra de fita × total geral', () => {
  it('produto e preço do grupo vêm do snapshot do sistema; a categoria dá o nome', () => {
    const categorias: CategoriaFita[] = [{ id: 'cat1', nome: 'Sanca', fita: fita() }];
    const [grupo] = calcularRolosPorGrupo([ambiente([sistema({ categoriaId: 'cat1' })])], categorias);
    expect(grupo.codigo).toBe('LM_ANTIGA');
    expect(grupo.categoriaNome).toBe('Sanca');
    expect(grupo.subtotal).toBe(300); // 10 m em rolos de 5 m = 3 × R$ 100
  });

  it('preço editado no sistema chega ao Resumo e ao TOTAL do mesmo jeito', () => {
    // revisão 2026-09-16: o Resumo lia o preço da categoria e o total, o do sistema — com
    // desconto no passo 3, o PDF imprimia R$ 600 na linha e R$ 450 no total
    const categorias: CategoriaFita[] = [{ id: 'cat1', nome: 'Sanca', fita: fita({ precoUnitario: 200 }) }];
    const ambientes = [ambiente([sistema({ categoriaId: 'cat1', fita: fita({ precoUnitario: 150 }) })])];
    const somaGrupos = calcularRolosPorGrupo(ambientes, categorias).reduce((s, g) => s + g.subtotal, 0);
    const semFita = ambientes.reduce((s, a) => s + calcularTotalAmbienteSemFita(a), 0);
    expect(somaGrupos).toBe(450);
    expect(calcularTotalGeral(ambientes, categorias)).toBe(semFita + somaGrupos);
  });

  it('categoria órfã agrupa igual no Resumo e no total', () => {
    // 2 m + 2 m da mesma fita: juntos cabem num rolo; separados seriam dois
    const ambientes = [
      ambiente([
        sistema({ id: 'a', metragemManual: 2, categoriaId: 'removida' }),
        sistema({ id: 'b', metragemManual: 2 }),
      ]),
    ];
    const grupos = calcularRolosPorGrupo(ambientes, []);
    expect(grupos).toHaveLength(1);
    expect(grupos[0].qtdRolosTotal).toBe(1);
    const semFita = calcularTotalAmbienteSemFita(ambientes[0]);
    expect(calcularTotalGeral(ambientes, []) - semFita).toBe(100);
  });

  it('chaveGrupoFita: categoria viva agrupa por categoria; sem lista, confia no vínculo', () => {
    const s = sistema({ categoriaId: 'cat1' });
    expect(chaveGrupoFita(s, [{ id: 'cat1', nome: 'X', fita: fita() }])).toBe('cat:cat1');
    expect(chaveGrupoFita(s, [])).toBe('LM_ANTIGA');
    expect(chaveGrupoFita(s)).toBe('cat:cat1');
    expect(chaveGrupoFita(sistema())).toBe('LM_ANTIGA');
  });
});

describe('propagarFitaDasCategorias (RULE-016/017)', () => {
  const nova = fita({ codigo: 'LM_NOVA', descricao: 'FITA NOVA', precoUnitario: 200, wm: 15 });

  it('troca a fita dos sistemas vinculados, preserva o id e zera o override de drivers', () => {
    const ambientes = [ambiente([sistema({ categoriaId: 'cat1', qtdDriversManual: 3, fita: fita({ id: 'meu-id' }) })])];
    const { ambientes: out, desvinculados } = propagarFitaDasCategorias(ambientes, [{ id: 'cat1', nome: 'Sanca', fita: nova }]);
    const s = out[0].sistemas[0];
    expect(s.fita.codigo).toBe('LM_NOVA');
    expect(s.fita.id).toBe('meu-id');
    expect(s.qtdDriversManual).toBeNull();
    expect(desvinculados).toEqual([]);
  });

  it('mesma fita: nada muda (preço editado no passo 3 fica) e devolve o mesmo array', () => {
    const ambientes = [ambiente([sistema({ categoriaId: 'cat1', fita: fita({ precoUnitario: 90 }) })])];
    const { ambientes: out } = propagarFitaDasCategorias(ambientes, [{ id: 'cat1', nome: 'Sanca', fita: fita() }]);
    expect(out).toBe(ambientes);
  });

  it('categoria removida: desvincula e mantém a fita', () => {
    const ambientes = [ambiente([sistema({ categoriaId: 'cat1' })])];
    const { ambientes: out } = propagarFitaDasCategorias(ambientes, []);
    expect(out[0].sistemas[0].categoriaId).toBeNull();
    expect(out[0].sistemas[0].fita.codigo).toBe('LM_ANTIGA');
  });

  it('fita nova que não cabe no perfil (Baby/IP): desvincula, mantém a antiga e avisa', () => {
    const lightMini = perfil({ descricao: 'PERFIL LIGHT MINI DE EMBUTIR 2M' });
    const babyAntiga = fita({ codigo: 'LM_BABY', descricao: 'FITA LED BABY 4,8W/M' });
    const ambientes = [ambiente([sistema({ categoriaId: 'cat1', perfil: lightMini, fita: babyAntiga, local: 'Rasgo' })], 'Suíte')];
    const { ambientes: out, desvinculados } = propagarFitaDasCategorias(ambientes, [{ id: 'cat1', nome: 'Sanca', fita: nova }]);
    expect(out[0].sistemas[0].categoriaId).toBeNull();
    expect(out[0].sistemas[0].fita.codigo).toBe('LM_BABY');
    expect(desvinculados).toEqual([
      { ambienteNome: 'Suíte', local: 'Rasgo', categoriaNome: 'Sanca', fitaCodigo: 'LM_NOVA', motivo: 'baby' },
    ]);
  });

  it('motivoFitaNaoCabeNoPerfil: Baby, IP e o caso que cabe', () => {
    const nano = perfil({ descricao: 'PERFIL NANO DE SOBREPOR 2M' });
    expect(motivoFitaNaoCabeNoPerfil(nano, fita({ descricao: 'FITA LED 10W/M IP65' }))).toBe('ip');
    expect(motivoFitaNaoCabeNoPerfil(nano, fita({ descricao: 'FITA LED 10W/M IP20' }))).toBeNull();
    expect(motivoFitaNaoCabeNoPerfil(perfil({ familia_perfil: 'ripado' }), fita())).toBe('baby');
    expect(motivoFitaNaoCabeNoPerfil(null, fita())).toBeNull();
    expect(motivoFitaNaoCabeNoPerfil(nano, fita({ codigo: '' }))).toBeNull();
  });
});

describe('harmonizarPrecoFitaPorGrupo — um preço por grupo de compra', () => {
  const precos = (ambs: Ambiente[]) => ambs.flatMap((a) => a.sistemas.map((s) => s.fita.precoUnitario));
  const totalFita = (ambs: Ambiente[], cats?: CategoriaFita[]) =>
    calcularRolosPorGrupo(ambs, cats).reduce((s, g) => s + g.subtotal, 0);

  it('preço digitado na fita do Quarto vale para a Sala (mesma fita, outro ambiente)', () => {
    // revisão 2026-09-16: o passo 2 editava só o sistema; o grupo cobrava o preço do primeiro
    const antes = [ambiente([sistema({ id: 'sala' })], 'Sala'), ambiente([sistema({ id: 'quarto' })], 'Quarto')];
    const depois = [antes[0], ambiente([sistema({ id: 'quarto', fita: fita({ precoUnitario: 80 }) })], 'Quarto')];
    const out = harmonizarPrecoFitaPorGrupo(antes, depois);
    expect(precos(out)).toEqual([80, 80]);
    expect(totalFita(out)).toBe(80 * 5); // 20 m ÷ 4,75 m úteis = 5 rolos
  });

  it('sistema que entra no grupo herda o desconto vigente em vez do preço de catálogo', () => {
    const cats: CategoriaFita[] = [{ id: 'cat1', nome: 'Sanca', fita: fita() }];
    const comDesconto = sistema({ id: 'a', categoriaId: 'cat1', fita: fita({ precoUnitario: 70 }) });
    const antes = [ambiente([comDesconto, sistema({ id: 'b', fita: fita({ codigo: 'OUTRA' }) })])];
    // `vincularCategoria` copia a fita da categoria (preço 100) para o sistema b
    const depois = [ambiente([comDesconto, sistema({ id: 'b', categoriaId: 'cat1', fita: fita() })])];
    const out = harmonizarPrecoFitaPorGrupo(antes, depois, cats);
    expect(precos(out)).toEqual([70, 70]);
  });

  it('sistema novo, em qualquer posição, também herda', () => {
    const existente = sistema({ id: 'a', fita: fita({ precoUnitario: 70 }) });
    const antes = [ambiente([existente])];
    const depois = [ambiente([sistema({ id: 'novo' }), existente])]; // novo fica PRIMEIRO
    const out = harmonizarPrecoFitaPorGrupo(antes, depois);
    expect(precos(out)).toEqual([70, 70]);
    expect(totalFita(out)).toBe(70 * 5);
  });

  it('grupos diferentes não se misturam; nada muda → mesmo array', () => {
    const antes = [ambiente([sistema({ id: 'a' }), sistema({ id: 'b', fita: fita({ codigo: 'OUTRA', precoUnitario: 55 }) })])];
    const depois = [ambiente([sistema({ id: 'a', fita: fita({ precoUnitario: 90 }) }), antes[0].sistemas[1]])];
    expect(precos(harmonizarPrecoFitaPorGrupo(antes, depois))).toEqual([90, 55]);
    expect(harmonizarPrecoFitaPorGrupo(antes, antes)).toBe(antes);
  });

  it('troca de fita para um produto sem grupo mantém o preço de catálogo dele', () => {
    const antes = [ambiente([sistema({ id: 'a' })])];
    const depois = [ambiente([sistema({ id: 'a', fita: fita({ codigo: 'NOVA', precoUnitario: 130 }) })])];
    expect(precos(harmonizarPrecoFitaPorGrupo(antes, depois))).toEqual([130]);
  });
});

describe('metragem dos difusos sem ruído de ponto flutuante', () => {
  const difuso = (comprimento: number, quantidade: number): ItemComposicao => ({
    id: `m${comprimento}`, codigo: 'LM2273', descricao: 'DIFUSO', quantidade, comprimento,
    precoUnitario: 1, precoMinimo: 1, papel: 'modulo', obrigatorio: false,
  });

  it('10 × 0,66 m = 6,6 m (e não 6.6000000000000005)', () => {
    expect(calcularMetragemModulosDifusos([difuso(0.66, 10)])).toBe(6.6);
    expect(calcularMetragemModulosDifusos([difuso(0.132, 3), difuso(0.264, 1)])).toBe(0.66);
  });

  it('formatarMetros usa vírgula e corta o ruído', () => {
    expect(formatarMetros(6.6000000000000005)).toBe('6,6');
    expect(formatarMetros(12)).toBe('12');
    expect(formatarMetros(0.132)).toBe('0,132');
  });
});
