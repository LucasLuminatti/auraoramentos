import { describe, it, expect } from 'vitest';
import { contarTampasFuroFaltantes, ehModuloSpotOuPendente, ehTampaComFuro, opcoesRevisao, rotuloUltimaRevisao, LIMITE_ORCAMENTOS_POR_PROJETO, calcularDriversPorProjeto, calcularRolosPorGrupo, detectarTipoAncora, calcularCargaComposicao, recomendarDriver48V, calcularDemandaFita, calcularConsumoW, calcularSubtotalSistemaSemFita, calcularMetragemModulosDifusos, parsearComprimentoModulo, parsearComprimentoDescricao, calcularOcupacaoTrilho, escolherTampaCega, ehTampaCega, clonarItemLuminaria, clonarAmbiente, calcularQtdDrivers, calcularQtdDriversEfetiva, calcularSubtotalDriverSistema } from '@/types/orcamento';
import type { Ambiente, SistemaIluminacao, ItemFitaLED, ItemDriver, LocalBreakdown, Produto, ItemComposicao, ItemLuminaria } from '@/types/orcamento';

// ─── Helpers mínimos para montar fixtures ───

function makeDriver(codigo: string, voltagem: 12 | 24 | 48, potencia = 100): ItemDriver {
  return {
    id: `driver-${codigo}-${voltagem}`,
    codigo,
    descricao: `Driver ${codigo} ${voltagem}V`,
    potencia,
    voltagem,
    precoUnitario: 100,
    precoMinimo: 80,
  };
}

function makeFita(wm = 10): ItemFitaLED {
  return {
    id: 'fita-01',
    codigo: 'FX1000',
    descricao: 'Fita LED 10W/m',
    wm,
    metragemRolo: 5,
    precoUnitario: 50,
    precoMinimo: 40,
  };
}

function makeSistema(
  driver: ItemDriver,
  fita: ItemFitaLED,
  metragemManual = 5,
): SistemaIluminacao {
  return {
    id: `sis-${Math.random().toString(36).slice(2)}`,
    perfil: null,
    fita,
    driver,
    metragemManual,
    passadasManual: 1,
  };
}

function makeAmbiente(sistemas: SistemaIluminacao[]): Ambiente {
  return {
    id: `amb-${Math.random().toString(36).slice(2)}`,
    nome: 'Ambiente Teste',
    luminarias: [],
    sistemas,
  };
}

// ─── Helpers para calcularRolosPorGrupo ───

function makeFitaComImagem(codigo: string, imagemUrl?: string): ItemFitaLED {
  return {
    id: `fita-${codigo}`,
    codigo,
    descricao: `Fita LED ${codigo}`,
    wm: 10,
    metragemRolo: 5,
    precoUnitario: 50,
    precoMinimo: 40,
    imagemUrl,
  };
}

function makeSistemaComLocal(
  fita: ItemFitaLED,
  driver: ItemDriver,
  metragemManual: number,
  local?: string,
): SistemaIluminacao {
  return {
    id: `sis-${Math.random().toString(36).slice(2)}`,
    perfil: null,
    fita,
    driver,
    metragemManual,
    passadasManual: 1,
    local,
  };
}

function makeAmbienteNomeado(nome: string, sistemas: SistemaIluminacao[]): Ambiente {
  return {
    id: `amb-${Math.random().toString(36).slice(2)}`,
    nome,
    luminarias: [],
    sistemas,
  };
}

// ─── Testes: calcularRolosPorGrupo — localBreakdown e imagemUrl ───

describe('calcularRolosPorGrupo — localBreakdown e imagemUrl (Phase 17 / RES-01)', () => {
  const driverPadrao = makeDriver('DR001', 24);

  it('Teste 1: 2 sistemas da mesma fita em locais diferentes → breakdown separado, demandaTotal correto', () => {
    const fita = makeFitaComImagem('FX1000');
    const ambientes: Ambiente[] = [
      makeAmbienteNomeado('Sala', [makeSistemaComLocal(fita, driverPadrao, 12, 'Sanca')]),
      makeAmbienteNomeado('Cozinha', [makeSistemaComLocal(fita, driverPadrao, 8, 'Marcenaria')]),
    ];

    const resultado = calcularRolosPorGrupo(ambientes);

    expect(resultado).toHaveLength(1);
    const grupo = resultado[0];
    expect(grupo.demandaTotal).toBe(20);
    expect(grupo.localBreakdown).toBeDefined();
    expect(grupo.localBreakdown).toHaveLength(2);
    expect(grupo.localBreakdown).toContainEqual({ label: 'Sala — Sanca', demanda: 12 });
    expect(grupo.localBreakdown).toContainEqual({ label: 'Cozinha — Marcenaria', demanda: 8 });
  });

  it('Teste 2: sistema sem local → label = nome do ambiente apenas', () => {
    const fita = makeFitaComImagem('FX2000');
    const ambientes: Ambiente[] = [
      makeAmbienteNomeado('Lavabo', [makeSistemaComLocal(fita, driverPadrao, 6)]),
    ];

    const resultado = calcularRolosPorGrupo(ambientes);

    expect(resultado).toHaveLength(1);
    const grupo = resultado[0];
    expect(grupo.localBreakdown).toBeDefined();
    expect(grupo.localBreakdown).toHaveLength(1);
    expect(grupo.localBreakdown![0].label).toBe('Lavabo');
    expect(grupo.localBreakdown![0].demanda).toBe(6);
  });

  it('Teste 3: dois sistemas com mesmo label são somados (não duplicam entrada)', () => {
    const fita = makeFitaComImagem('FX3000');
    const ambientes: Ambiente[] = [
      makeAmbienteNomeado('Quarto', [
        makeSistemaComLocal(fita, driverPadrao, 4, 'Sanca'),
        makeSistemaComLocal(fita, driverPadrao, 6, 'Sanca'),
      ]),
    ];

    const resultado = calcularRolosPorGrupo(ambientes);

    expect(resultado).toHaveLength(1);
    const grupo = resultado[0];
    expect(grupo.localBreakdown).toBeDefined();
    expect(grupo.localBreakdown).toHaveLength(1);
    expect(grupo.localBreakdown![0].label).toBe('Quarto — Sanca');
    expect(grupo.localBreakdown![0].demanda).toBe(10);
  });

  it('Teste 4: rolo do catálogo + 5% de sobra por rolo (RULE-005/006)', () => {
    const fita = makeFitaComImagem('FX4000');
    fita.metragemRolo = 5;
    const ambientes: Ambiente[] = [
      makeAmbienteNomeado('Sala', [makeSistemaComLocal(fita, driverPadrao, 12, 'Sanca')]),
      makeAmbienteNomeado('Cozinha', [makeSistemaComLocal(fita, driverPadrao, 8, 'Marcenaria')]),
    ];

    const resultado = calcularRolosPorGrupo(ambientes);

    expect(resultado).toHaveLength(1);
    const grupo = resultado[0];
    // 20m de demanda / 4,75m úteis por rolo de 5m = 4,21 → 5 rolos (todos do mesmo tamanho)
    expect(grupo.qtdRolosTotal).toBe(5);
    expect(grupo.rolos).toEqual([{ tamanho: 5, quantidade: 5 }]);
    expect(grupo.subtotal).toBe(fita.precoUnitario * grupo.qtdRolosTotal);
    expect(grupo.demandaTotal).toBe(20);
  });

  it('Teste 5: fita com imagemUrl → grupo.imagemUrl reflete o valor; sem imagemUrl → undefined', () => {
    const fitaComImagem = makeFitaComImagem('FX5000', 'https://cdn.example.com/fita.jpg');
    const fitaSemImagem = makeFitaComImagem('FX5001');

    const ambientes: Ambiente[] = [
      makeAmbienteNomeado('Sala', [makeSistemaComLocal(fitaComImagem, driverPadrao, 5)]),
      makeAmbienteNomeado('Quarto', [makeSistemaComLocal(fitaSemImagem, driverPadrao, 5)]),
    ];

    const resultado = calcularRolosPorGrupo(ambientes);

    expect(resultado).toHaveLength(2);
    const grupoComImg = resultado.find(g => g.codigo === 'FX5000');
    const grupoSemImg = resultado.find(g => g.codigo === 'FX5001');
    expect(grupoComImg?.imagemUrl).toBe('https://cdn.example.com/fita.jpg');
    expect(grupoSemImg?.imagemUrl).toBeUndefined();
  });

  it('RULE-005: cada fita usa o tamanho de rolo do próprio catálogo (5/10/25/50)', () => {
    const fita50 = makeFitaComImagem('FX50');
    fita50.metragemRolo = 50;
    const fita25 = makeFitaComImagem('FX25');
    fita25.metragemRolo = 25;

    const resultado = calcularRolosPorGrupo([
      makeAmbienteNomeado('Sala', [
        makeSistemaComLocal(fita50, driverPadrao, 60),
        makeSistemaComLocal(fita25, driverPadrao, 60),
      ]),
    ]);

    // 60m / (50×0,95=47,5) = 1,26 → 2 rolos de 50m
    expect(resultado.find(g => g.codigo === 'FX50')?.rolos).toEqual([{ tamanho: 50, quantidade: 2 }]);
    // 60m / (25×0,95=23,75) = 2,52 → 3 rolos de 25m
    expect(resultado.find(g => g.codigo === 'FX25')?.rolos).toEqual([{ tamanho: 25, quantidade: 3 }]);
  });

  it('RULE-006: demanda exatamente igual aos metros úteis não estoura para um rolo a mais', () => {
    const fita = makeFitaComImagem('FX4750');
    fita.metragemRolo = 5;
    // 4,75m = exatamente o aproveitável de 1 rolo de 5m (5 × 0,95, sujeito a erro de ponto flutuante)
    const resultado = calcularRolosPorGrupo([
      makeAmbienteNomeado('Sala', [makeSistemaComLocal(fita, driverPadrao, 4.75)]),
    ]);
    expect(resultado[0].qtdRolosTotal).toBe(1);

    // Um centímetro acima já exige o segundo rolo
    const acima = calcularRolosPorGrupo([
      makeAmbienteNomeado('Sala', [makeSistemaComLocal(fita, driverPadrao, 4.76)]),
    ]);
    expect(acima[0].qtdRolosTotal).toBe(2);
  });

  it('Mesma fita com rolos divergentes: vale o maior, independente da ordem', () => {
    const fitaLegado = makeFitaComImagem('FXMIX');   // snapshot antigo: default 5m
    const fitaCatalogo = makeFitaComImagem('FXMIX'); // adicionada hoje: 50m do catálogo
    fitaCatalogo.metragemRolo = 50;

    // 60m no total → com rolo de 50m são 2 rolos; se o 5m vencesse seriam 13
    const ordemA = calcularRolosPorGrupo([
      makeAmbienteNomeado('Sala', [
        makeSistemaComLocal(fitaLegado, driverPadrao, 30),
        makeSistemaComLocal(fitaCatalogo, driverPadrao, 30),
      ]),
    ]);
    const ordemB = calcularRolosPorGrupo([
      makeAmbienteNomeado('Sala', [
        makeSistemaComLocal(fitaCatalogo, driverPadrao, 30),
        makeSistemaComLocal(fitaLegado, driverPadrao, 30),
      ]),
    ]);

    expect(ordemA[0].rolos).toEqual([{ tamanho: 50, quantidade: 2 }]);
    expect(ordemA[0].qtdRolosTotal).toBe(ordemB[0].qtdRolosTotal);
    expect(ordemA[0].subtotal).toBe(ordemB[0].subtotal);
  });

  it('grupo.metragemRolo devolve o tamanho EFETIVO (o mesmo que precifica)', () => {
    const fita = makeFitaComImagem('FXEFET');
    (fita as { metragemRolo: number }).metragemRolo = 0;
    const [grupo] = calcularRolosPorGrupo([
      makeAmbienteNomeado('Sala', [makeSistemaComLocal(fita, driverPadrao, 10)]),
    ]);
    expect(grupo.metragemRolo).toBe(5);
    expect(grupo.metragemRolo).toBe(grupo.rolos[0].tamanho);
  });

  it('Backward-compat: snapshot antigo sem tamanho de rolo válido usa 5m', () => {
    const fita = makeFitaComImagem('FXLEGADO');
    // snapshots muito antigos podem carregar 0/undefined no campo
    (fita as { metragemRolo: number }).metragemRolo = 0;
    const resultado = calcularRolosPorGrupo([
      makeAmbienteNomeado('Sala', [makeSistemaComLocal(fita, driverPadrao, 10)]),
    ]);
    // 10m / 4,75 = 2,10 → 3 rolos de 5m
    expect(resultado[0].rolos).toEqual([{ tamanho: 5, quantidade: 3 }]);
  });

  it('RULE-017: sistemas de ambientes diferentes na MESMA categoria viram um só grupo', () => {
    const fita = makeFitaComImagem('FXCAT');
    const catId = 'cat-sanca';
    const sisA = makeSistemaComLocal(fita, driverPadrao, 6, 'Sanca');
    const sisB = makeSistemaComLocal(fita, driverPadrao, 9, 'Sanca');
    sisA.categoriaId = catId;
    sisB.categoriaId = catId;

    const resultado = calcularRolosPorGrupo(
      [makeAmbienteNomeado('Sala', [sisA]), makeAmbienteNomeado('Quarto', [sisB])],
      [{ id: catId, nome: 'Sanca quente', fita }],
    );

    expect(resultado).toHaveLength(1);
    expect(resultado[0].demandaTotal).toBe(15);
    expect(resultado[0].categoriaNome).toBe('Sanca quente'); // RULE-018: etiqueta da fábrica
    expect(resultado[0].codigo).toBe('FXCAT');
  });

  it('RULE-020/021: mesma fita em categorias diferentes NÃO compartilha rolo', () => {
    const fita = makeFitaComImagem('FXTOM');
    const sisTeto = makeSistemaComLocal(fita, driverPadrao, 3);
    const sisMarcenaria = makeSistemaComLocal(fita, driverPadrao, 3);
    sisTeto.categoriaId = 'cat-teto';
    sisMarcenaria.categoriaId = 'cat-marcenaria';

    const resultado = calcularRolosPorGrupo(
      [makeAmbienteNomeado('Sala', [sisTeto, sisMarcenaria])],
      [
        { id: 'cat-teto', nome: 'Embutido no teto', fita },
        { id: 'cat-marcenaria', nome: 'Marcenaria', fita },
      ],
    );

    // 3m + 3m juntos caberiam em 1 rolo de 5m; separados por categoria são 2 rolos
    expect(resultado).toHaveLength(2);
    expect(resultado.every(g => g.qtdRolosTotal === 1)).toBe(true);
    expect(resultado.map(g => g.categoriaNome).sort()).toEqual(['Embutido no teto', 'Marcenaria']);
  });

  it('Sistema sem categoria continua consolidando por código (retrocompat)', () => {
    const fita = makeFitaComImagem('FXSEMCAT');
    const resultado = calcularRolosPorGrupo([
      makeAmbienteNomeado('Sala', [makeSistemaComLocal(fita, driverPadrao, 4)]),
      makeAmbienteNomeado('Quarto', [makeSistemaComLocal(fita, driverPadrao, 4)]),
    ]);
    expect(resultado).toHaveLength(1);
    expect(resultado[0].demandaTotal).toBe(8);
    expect(resultado[0].categoriaId).toBeUndefined();
    expect(resultado[0].categoriaNome).toBeUndefined();
  });

  it('Categoria sem nome resolvido (lista não passada) ainda agrupa por categoria', () => {
    const fita = makeFitaComImagem('FXORFA');
    const sis = makeSistemaComLocal(fita, driverPadrao, 5);
    sis.categoriaId = 'cat-x';
    const [grupo] = calcularRolosPorGrupo([makeAmbienteNomeado('Sala', [sis])]);
    expect(grupo.categoriaId).toBe('cat-x');
    expect(grupo.categoriaNome).toBeUndefined();
    expect(grupo.codigo).toBe('FXORFA');
  });

  it('Categoria removida: sistema órfão volta a consolidar pelo código da fita', () => {
    const fita = makeFitaComImagem('FXORF');
    const sisOrfao = makeSistemaComLocal(fita, driverPadrao, 2);
    sisOrfao.categoriaId = 'cat-removida';
    const sisLivre = makeSistemaComLocal(fita, driverPadrao, 2);

    // A lista de categorias existe, mas não contém mais a categoria apontada pelo sistema
    const resultado = calcularRolosPorGrupo(
      [makeAmbienteNomeado('Sala', [sisOrfao, sisLivre])],
      [{ id: 'cat-outra', nome: 'Outra', fita }],
    );

    // 2m + 2m = 4m → 1 rolo. Sem o fallback seriam 2 grupos = 2 rolos cobrados.
    expect(resultado).toHaveLength(1);
    expect(resultado[0].qtdRolosTotal).toBe(1);
    expect(resultado[0].categoriaId).toBeUndefined();
  });

  it('Invariante: soma do localBreakdown === demandaTotal', () => {
    const fita = makeFitaComImagem('FX6000');
    const ambientes: Ambiente[] = [
      makeAmbienteNomeado('Sala', [makeSistemaComLocal(fita, driverPadrao, 7, 'Sanca')]),
      makeAmbienteNomeado('Quarto', [makeSistemaComLocal(fita, driverPadrao, 3)]),
      makeAmbienteNomeado('Quarto', [makeSistemaComLocal(fita, driverPadrao, 5, 'Sanca')]),
    ];

    const resultado = calcularRolosPorGrupo(ambientes);

    for (const grupo of resultado) {
      const somaBreakdown = (grupo.localBreakdown ?? []).reduce((s, b) => s + b.demanda, 0);
      expect(somaBreakdown).toBe(grupo.demandaTotal);
    }
  });
});

// ─── Testes: calcularDriversPorProjeto ───

describe('calcularDriversPorProjeto — grouping por (codigo + voltagem)', () => {
  it('Teste 1: mesmo código em voltagens diferentes → 2 itens distintos', () => {
    const driver12 = makeDriver('LM2130', 12);
    const driver24 = makeDriver('LM2130', 24);
    const fita = makeFita(10);

    const ambientes: Ambiente[] = [
      makeAmbiente([makeSistema(driver12, fita)]),
      makeAmbiente([makeSistema(driver24, fita)]),
    ];

    const resultado = calcularDriversPorProjeto(ambientes);

    expect(resultado).toHaveLength(2);
    expect(resultado.find((r) => r.voltagem === 12)).toBeDefined();
    expect(resultado.find((r) => r.voltagem === 24)).toBeDefined();
    // Ambos devem ter driverCodigo igual a "LM2130" (sem a voltagem)
    expect(resultado.every((r) => r.driverCodigo === 'LM2130')).toBe(true);
  });

  it('Teste 2: mesmo código, mesma voltagem → 1 item com qtdSomaIndividual somado', () => {
    const driver24a = makeDriver('LM1462', 24, 200);
    const driver24b = makeDriver('LM1462', 24, 200);
    const fita = makeFita(10);

    // 2 sistemas separados, cada um em seu ambiente
    const ambientes: Ambiente[] = [
      makeAmbiente([makeSistema(driver24a, fita, 5)]),
      makeAmbiente([makeSistema(driver24b, fita, 5)]),
    ];

    const resultado = calcularDriversPorProjeto(ambientes);

    expect(resultado).toHaveLength(1);
    expect(resultado[0].driverCodigo).toBe('LM1462');
    expect(resultado[0].voltagem).toBe(24);
    // qtdSomaIndividual deve ser a soma de ambos os sistemas
    expect(resultado[0].qtdSomaIndividual).toBeGreaterThanOrEqual(2);
  });

  it('Teste 3: driverCodigo no resultado nunca contém o caractere "|"', () => {
    const driver12 = makeDriver('LM2130', 12);
    const driver24 = makeDriver('LM2130', 24);
    const driver48 = makeDriver('LM3475', 48);
    const fita = makeFita(10);

    const ambientes: Ambiente[] = [
      makeAmbiente([
        makeSistema(driver12, fita),
        makeSistema(driver24, fita),
        makeSistema(driver48, fita),
      ]),
    ];

    const resultado = calcularDriversPorProjeto(ambientes);

    for (const r of resultado) {
      expect(r.driverCodigo).not.toContain('|');
    }
  });

  it('Edge: sistema com driver codigo vazio é ignorado', () => {
    const driverVazio = makeDriver('', 24);
    const fita = makeFita(10);

    const ambientes: Ambiente[] = [makeAmbiente([makeSistema(driverVazio, fita)])];
    const resultado = calcularDriversPorProjeto(ambientes);

    expect(resultado).toHaveLength(0);
  });

  it('Edge: sistema com potencia <= 0 é ignorado', () => {
    const driverSemPotencia = makeDriver('LM9999', 24, 0);
    const fita = makeFita(10);

    const ambientes: Ambiente[] = [makeAmbiente([makeSistema(driverSemPotencia, fita)])];
    const resultado = calcularDriversPorProjeto(ambientes);

    expect(resultado).toHaveLength(0);
  });
});

// ─── Helpers para testes Phase 20 ───

function makeProduto(overrides: Partial<Produto>): Produto {
  return {
    id: 'prod-01',
    codigo: 'LM0001',
    descricao: 'Produto Teste',
    preco_tabela: 100,
    preco_minimo: 80,
    ...overrides,
  };
}

function makeItemComposicao(overrides: Partial<ItemComposicao>): ItemComposicao {
  return {
    id: 'item-01',
    codigo: 'LM0001',
    descricao: 'Item Teste',
    quantidade: 1,
    precoUnitario: 100,
    precoMinimo: 80,
    papel: 'modulo',
    obrigatorio: false,
    ...overrides,
  };
}

// ─── Testes: detectarTipoAncora (Phase 20 / D-02) ───

describe('detectarTipoAncora — roteamento product-first (Phase 20 / D-02)', () => {
  it('fita antes do fallback — tipo_produto=fita retorna "fita" mesmo com sistema_magnetico null (Pitfall 1)', () => {
    const produto = makeProduto({ tipo_produto: 'fita', sistema_magnetico: null });
    expect(detectarTipoAncora(produto)).toBe('fita');
  });

  it('fita com sistema_magnetico presente ainda retorna "fita" (prioridade tipo_produto)', () => {
    const produto = makeProduto({ tipo_produto: 'fita', sistema_magnetico: 'magneto_48v' });
    expect(detectarTipoAncora(produto)).toBe('fita');
  });

  it('sistema_magnetico=magneto_48v → retorna "magneto_48v"', () => {
    const produto = makeProduto({ tipo_produto: 'spot', sistema_magnetico: 'magneto_48v' });
    expect(detectarTipoAncora(produto)).toBe('magneto_48v');
  });

  it('sistema_magnetico=tiny_magneto → retorna "tiny_magneto"', () => {
    const produto = makeProduto({ tipo_produto: null, sistema_magnetico: 'tiny_magneto' });
    expect(detectarTipoAncora(produto)).toBe('tiny_magneto');
  });

  it('sistema_magnetico=s_mode → retorna "modular"', () => {
    const produto = makeProduto({ tipo_produto: null, sistema_magnetico: 's_mode' });
    expect(detectarTipoAncora(produto)).toBe('modular');
  });

  it('RULE-062/BUG-09: tipo_produto=perfil → "perfil" (abre sistema, não item avulso)', () => {
    const produto = makeProduto({ tipo_produto: 'perfil', sistema_magnetico: null });
    expect(detectarTipoAncora(produto)).toBe('perfil');
  });

  it('perfil de sistema magnético continua roteando pelo sistema (magneto vence)', () => {
    const produto = makeProduto({ tipo_produto: 'perfil', sistema_magnetico: 'magneto_48v' });
    expect(detectarTipoAncora(produto)).toBe('magneto_48v');
  });

  it('produto sem sistema_magnetico e tipo_produto=spot → fallback "luminaria"', () => {
    const produto = makeProduto({ tipo_produto: 'spot', sistema_magnetico: null });
    expect(detectarTipoAncora(produto)).toBe('luminaria');
  });

  it('produto com sistema_magnetico=null e tipo_produto=null → fallback "luminaria"', () => {
    const produto = makeProduto({ tipo_produto: null, sistema_magnetico: null });
    expect(detectarTipoAncora(produto)).toBe('luminaria');
  });
});

// ─── Testes: calcularCargaComposicao (Phase 20 / D-06) ───

describe('calcularCargaComposicao — carga derivada dos módulos (Phase 20 / D-06)', () => {
  it('composicao vazia → 0', () => {
    expect(calcularCargaComposicao([])).toBe(0);
  });

  it('composicao undefined → 0', () => {
    expect(calcularCargaComposicao(undefined)).toBe(0);
  });

  it('módulo com potenciaW=undefined conta como 0', () => {
    const composicao = [makeItemComposicao({ papel: 'modulo', potenciaW: undefined, quantidade: 3 })];
    expect(calcularCargaComposicao(composicao)).toBe(0);
  });

  it('soma potenciaW × quantidade só dos papel="modulo"', () => {
    const composicao = [
      makeItemComposicao({ id: '1', papel: 'modulo', potenciaW: 10, quantidade: 3 }),
      makeItemComposicao({ id: '2', papel: 'modulo', potenciaW: 5, quantidade: 2 }),
    ];
    expect(calcularCargaComposicao(composicao)).toBe(40); // 10×3 + 5×2
  });

  it('ignora itens papel=driver_recomendado na soma', () => {
    const composicao = [
      makeItemComposicao({ id: '1', papel: 'modulo', potenciaW: 20, quantidade: 2 }),
      makeItemComposicao({ id: '2', papel: 'driver_recomendado', potenciaW: 100, quantidade: 1 }),
    ];
    expect(calcularCargaComposicao(composicao)).toBe(40); // só módulos: 20×2
  });

  it('ignora itens papel=conector_energia e kit_fixacao', () => {
    const composicao = [
      makeItemComposicao({ id: '1', papel: 'modulo', potenciaW: 15, quantidade: 2 }),
      makeItemComposicao({ id: '2', papel: 'conector_energia', potenciaW: 5, quantidade: 1 }),
      makeItemComposicao({ id: '3', papel: 'kit_fixacao', potenciaW: 0, quantidade: 1 }),
    ];
    expect(calcularCargaComposicao(composicao)).toBe(30); // só módulos: 15×2
  });
});

// ─── Testes: recomendarDriver48V (Phase 20 / D-07/D-08) ───

describe('recomendarDriver48V — buckets 48V com margem ×1.20 (RULE-026, decisão 2026-08-12)', () => {
  it('carga 0 → estado sem_carga', () => {
    const resultado = recomendarDriver48V(0);
    expect(resultado.estado).toBe('sem_carga');
  });

  it('carga negativa → estado sem_carga', () => {
    const resultado = recomendarDriver48V(-10);
    expect(resultado.estado).toBe('sem_carga');
  });

  it('carga 80W → bucket LM2343 (80×1.20=96 ≤ 100)', () => {
    const resultado = recomendarDriver48V(80);
    expect(resultado.estado).toBe('recomendado');
    if (resultado.estado === 'recomendado') {
      expect(resultado.sku).toBe('LM2343');
      expect(resultado.potenciaW).toBe(100);
    }
  });

  it('carga 83.33W → bucket LM2343 (83.33×1.20=99.996 ≤ 100, fronteira real)', () => {
    const resultado = recomendarDriver48V(83.33);
    expect(resultado.estado).toBe('recomendado');
    if (resultado.estado === 'recomendado') {
      expect(resultado.sku).toBe('LM2343');
    }
  });

  it('carga 83.34W → bucket LM2344 (83.34×1.20=100.008 > 100 — WR-03: bucket no valor cru)', () => {
    // Regressão WR-03: arredondar (→100.01→100.0) escondia que a carga real
    // excede 100W e atribuía um driver subdimensionado. Deve ser LM2344.
    const resultado = recomendarDriver48V(83.34);
    expect(resultado.estado).toBe('recomendado');
    if (resultado.estado === 'recomendado') {
      expect(resultado.sku).toBe('LM2344');
      expect(resultado.potenciaW).toBe(200);
    }
  });

  it('carga 150W → bucket LM2344 (150×1.20=180 ≤ 200)', () => {
    const resultado = recomendarDriver48V(150);
    expect(resultado.estado).toBe('recomendado');
    if (resultado.estado === 'recomendado') {
      expect(resultado.sku).toBe('LM2344');
      expect(resultado.potenciaW).toBe(200);
    }
  });

  it('carga 90W → bucket LM2344 (90×1.20=108 > 100, mas ≤ 200) — caso que MUDOU com a folga 20%', () => {
    const resultado = recomendarDriver48V(90);
    expect(resultado.estado).toBe('recomendado');
    if (resultado.estado === 'recomendado') {
      expect(resultado.sku).toBe('LM2344');
    }
  });

  it('carga 170W → estado excede_200w (170×1.20=204 > 200) — D-08: não auto-divide', () => {
    const resultado = recomendarDriver48V(170);
    expect(resultado.estado).toBe('excede_200w');
  });

  it('potenciaSeguraW exposta e correta quando recomendado', () => {
    const resultado = recomendarDriver48V(90);
    if (resultado.estado === 'recomendado') {
      expect(resultado.potenciaSeguraW).toBeCloseTo(108, 1);
    }
  });
});

// ─── Guard: 5 calc sites de Fita Padrão byte-idênticos ───

describe('Guard: 5 calc sites de Fita Padrão — assinaturas inalteradas (Phase 20)', () => {
  it('calcularDemandaFita existe e aceita SistemaIluminacao', () => {
    const fita = makeFita(10);
    const driver = makeDriver('DR001', 24);
    const sistema: SistemaIluminacao = {
      id: 'sis-01', perfil: null, fita, driver, metragemManual: 5, passadasManual: 1,
    };
    expect(typeof calcularDemandaFita).toBe('function');
    expect(calcularDemandaFita(sistema)).toBe(5);
  });

  it('calcularConsumoW existe e aceita SistemaIluminacao', () => {
    const fita = makeFita(10);
    const driver = makeDriver('DR001', 24);
    const sistema: SistemaIluminacao = {
      id: 'sis-01', perfil: null, fita, driver, metragemManual: 5, passadasManual: 1,
    };
    expect(typeof calcularConsumoW).toBe('function');
    expect(calcularConsumoW(sistema)).toBe(50); // 5m × 10W/m
  });

  it('calcularSubtotalSistemaSemFita existe e retorna número', () => {
    const fita = makeFita(10);
    const driver = makeDriver('DR001', 24);
    const sistema: SistemaIluminacao = {
      id: 'sis-01', perfil: null, fita, driver, metragemManual: 5, passadasManual: 1,
    };
    expect(typeof calcularSubtotalSistemaSemFita).toBe('function');
    expect(typeof calcularSubtotalSistemaSemFita(sistema)).toBe('number');
  });
});

// ─── Testes RULE-001: qtdDriversManual — override opcional da qtd de drivers ───

describe('calcularQtdDriversEfetiva / calcularSubtotalDriverSistema — override manual (RULE-001)', () => {
  // Fixture: fita 10W/m × 5m = 50W; driver 100W/24V → calcularQtdDrivers = 1
  function makeSistemaBase(): SistemaIluminacao {
    return makeSistema(makeDriver('DR001', 24, 100), makeFita(10), 5);
  }

  it('sem override (undefined) → fallback no cálculo automático (retrocompat snapshots antigos)', () => {
    const sis = makeSistemaBase();
    expect(sis.qtdDriversManual).toBeUndefined();
    expect(calcularQtdDriversEfetiva(sis)).toBe(calcularQtdDrivers(sis));
    expect(calcularSubtotalDriverSistema(sis)).toBe(sis.driver.precoUnitario * calcularQtdDrivers(sis));
  });

  it('override null → fallback no cálculo automático (input limpo pelo usuário)', () => {
    const sis: SistemaIluminacao = { ...makeSistemaBase(), qtdDriversManual: null };
    expect(calcularQtdDriversEfetiva(sis)).toBe(calcularQtdDrivers(sis));
  });

  it('override = 3 → qtd efetiva 3 e subtotal = preço × 3', () => {
    const sis: SistemaIluminacao = { ...makeSistemaBase(), qtdDriversManual: 3 };
    expect(calcularQtdDriversEfetiva(sis)).toBe(3);
    expect(calcularSubtotalDriverSistema(sis)).toBe(sis.driver.precoUnitario * 3);
  });

  it('override = 0 → qtd efetiva 0 e subtotal 0 (RULE-001: tudo editável, inclusive zerar)', () => {
    const sis: SistemaIluminacao = { ...makeSistemaBase(), qtdDriversManual: 0 };
    expect(calcularQtdDriversEfetiva(sis)).toBe(0);
    expect(calcularSubtotalDriverSistema(sis)).toBe(0);
  });

  it('override negativo (inválido) → fallback no cálculo automático', () => {
    const sis: SistemaIluminacao = { ...makeSistemaBase(), qtdDriversManual: -2 };
    expect(calcularQtdDriversEfetiva(sis)).toBe(calcularQtdDrivers(sis));
  });

  it('override fracionário → floor (drivers são unidades inteiras)', () => {
    const sis: SistemaIluminacao = { ...makeSistemaBase(), qtdDriversManual: 2.7 };
    expect(calcularQtdDriversEfetiva(sis)).toBe(2);
  });

  it('override menor que o calculado também vale (usuário manda — RULE-001)', () => {
    // Consumo 30m × 10W/m = 300W com driver 100W → cálculo daria ≥3; manual = 1 prevalece
    const sis: SistemaIluminacao = { ...makeSistema(makeDriver('DR001', 24, 100), makeFita(10), 30), qtdDriversManual: 1 };
    expect(calcularQtdDrivers(sis)).toBeGreaterThan(1);
    expect(calcularQtdDriversEfetiva(sis)).toBe(1);
    expect(calcularSubtotalDriverSistema(sis)).toBe(sis.driver.precoUnitario * 1);
  });
});

// ─── Testes Phase 21: calcularMetragemModulosDifusos ───

describe('calcularMetragemModulosDifusos — metragem derivada dos módulos difusos (Phase 21 / D-01)', () => {
  it('soma comprimento × quantidade dos módulos difusos', () => {
    const composicao: ItemComposicao[] = [
      { id: '1', codigo: 'LM2270', descricao: 'DIFUSO 264MM', quantidade: 2, precoUnitario: 100, precoMinimo: 80, papel: 'modulo', obrigatorio: false, comprimento: 0.264 },
      { id: '2', codigo: 'LM2274', descricao: 'DIFUSO 1MT', quantidade: 1, precoUnitario: 120, precoMinimo: 96, papel: 'modulo', obrigatorio: false, comprimento: 1.0 },
    ];
    // 0.264×2 + 1.0×1 = 0.528 + 1.0 = 1.528
    expect(calcularMetragemModulosDifusos(composicao)).toBeCloseTo(1.528, 5);
  });

  it('undefined → 0', () => {
    expect(calcularMetragemModulosDifusos(undefined)).toBe(0);
  });

  it('array vazio → 0', () => {
    expect(calcularMetragemModulosDifusos([])).toBe(0);
  });

  it('ignora itens com papel !== modulo', () => {
    const composicao: ItemComposicao[] = [
      { id: '1', codigo: 'LM2270', descricao: 'DIFUSO 264MM', quantidade: 2, precoUnitario: 100, precoMinimo: 80, papel: 'modulo', obrigatorio: false, comprimento: 0.264 },
      { id: '2', codigo: 'DR001', descricao: 'Driver 24V', quantidade: 1, precoUnitario: 200, precoMinimo: 160, papel: 'driver_recomendado', obrigatorio: false, comprimento: 0 },
      { id: '3', codigo: 'CONN1', descricao: 'Conector', quantidade: 1, precoUnitario: 50, precoMinimo: 40, papel: 'conector_energia', obrigatorio: true, comprimento: 5.0 },
    ];
    // Only modulo item: 0.264×2 = 0.528
    expect(calcularMetragemModulosDifusos(composicao)).toBeCloseTo(0.528, 5);
  });

  it('ignora módulos com comprimento null/undefined', () => {
    const composicao: ItemComposicao[] = [
      { id: '1', codigo: 'LM2270', descricao: 'DIFUSO 264MM', quantidade: 2, precoUnitario: 100, precoMinimo: 80, papel: 'modulo', obrigatorio: false, comprimento: 0.264 },
      { id: '2', codigo: 'LM0001', descricao: 'Módulo sem comprimento', quantidade: 3, precoUnitario: 50, precoMinimo: 40, papel: 'modulo', obrigatorio: false },
    ];
    // Only first item counts: 0.264×2 = 0.528
    expect(calcularMetragemModulosDifusos(composicao)).toBeCloseTo(0.528, 5);
  });
});

// ─── Testes Phase 21: parsearComprimentoModulo ───

describe('parsearComprimentoModulo — parse de comprimento do módulo (Phase 21 / D-01)', () => {
  it('132MM → 0.132', () => {
    expect(parsearComprimentoModulo('MODULO DIFUSO PARA FITA LED 132MM BRANCO')).toBeCloseTo(0.132, 5);
  });

  it('264MM → 0.264', () => {
    expect(parsearComprimentoModulo('MODULO DIFUSO PARA FITA LED 264MM BRANCO')).toBeCloseTo(0.264, 5);
  });

  it('396MM → 0.396', () => {
    expect(parsearComprimentoModulo('SYSTEM MOLD MODULO DIFUSO FITA LED 396MM')).toBeCloseTo(0.396, 5);
  });

  it('528MM → 0.528', () => {
    expect(parsearComprimentoModulo('SYSTEM MOLD MODULO DIFUSO FITA LED 528MM')).toBeCloseTo(0.528, 5);
  });

  it('660MM → 0.66', () => {
    expect(parsearComprimentoModulo('SYSTEM MOLD MODULO DIFUSO FITA LED 660MM')).toBeCloseTo(0.66, 5);
  });

  it('1MT → 1.0', () => {
    expect(parsearComprimentoModulo('SYSTEM MOLD MODULO DIFUSO PARA FITA LED 1MT BRANCO')).toBeCloseTo(1.0, 5);
  });

  it('2MT → 2.0', () => {
    expect(parsearComprimentoModulo('SYSTEM MOLD MODULO DIFUSO PARA FITA LED 2MT BRANCO')).toBeCloseTo(2.0, 5);
  });

  it('sem match → undefined', () => {
    expect(parsearComprimentoModulo('PERFIL NOFRAME MODULAR 1M BRANCO')).toBeUndefined();
  });

  it('case-insensitive (fita led minúsculas)', () => {
    expect(parsearComprimentoModulo('modulo difuso para fita led 264mm branco')).toBeCloseTo(0.264, 5);
  });
});

// ─── Testes Phase 21: clonarItemLuminaria ───

function makeItemLuminaria(overrides: Partial<ItemLuminaria> = {}): ItemLuminaria {
  return {
    id: 'lum-original',
    codigo: 'LM1998',
    descricao: 'SYSTEM MOLD PERFIL NOFRAME MODULAR 1M BRANCO',
    quantidade: 1,
    precoUnitario: 429.48,
    precoMinimo: 362.37,
    sistema: 's_mode',
    composicao: [
      { id: 'comp-01', codigo: 'LM2270', descricao: 'DIFUSO 264MM', quantidade: 2, precoUnitario: 100, precoMinimo: 80, papel: 'modulo', obrigatorio: false, comprimento: 0.264 },
      { id: 'comp-02', codigo: 'LM2274', descricao: 'DIFUSO 1MT', quantidade: 1, precoUnitario: 120, precoMinimo: 96, papel: 'modulo', obrigatorio: false, comprimento: 1.0 },
    ],
    ...overrides,
  };
}

describe('clonarItemLuminaria — clone deep com novos UUIDs (Phase 21 / D-06)', () => {
  it('root.id é diferente do original', () => {
    const original = makeItemLuminaria();
    const clone = clonarItemLuminaria(original);
    expect(clone.id).not.toBe(original.id);
  });

  it('cada composicao[i].id é diferente do original', () => {
    const original = makeItemLuminaria();
    const clone = clonarItemLuminaria(original);
    expect(clone.composicao).toBeDefined();
    expect(clone.composicao!.length).toBe(2);
    expect(clone.composicao![0].id).not.toBe(original.composicao![0].id);
    expect(clone.composicao![1].id).not.toBe(original.composicao![1].id);
  });

  it('demais campos da composicao são preservados', () => {
    const original = makeItemLuminaria();
    const clone = clonarItemLuminaria(original);
    expect(clone.composicao![0].codigo).toBe(original.composicao![0].codigo);
    expect(clone.composicao![0].comprimento).toBe(original.composicao![0].comprimento);
    expect(clone.composicao![0].quantidade).toBe(original.composicao![0].quantidade);
  });

  it('composicao undefined → clone mantém undefined (backward-compat)', () => {
    const original = makeItemLuminaria({ composicao: undefined });
    const clone = clonarItemLuminaria(original);
    expect(clone.composicao).toBeUndefined();
  });

  it('demais campos do ItemLuminaria são preservados', () => {
    const original = makeItemLuminaria();
    const clone = clonarItemLuminaria(original);
    expect(clone.codigo).toBe(original.codigo);
    expect(clone.descricao).toBe(original.descricao);
    expect(clone.sistema).toBe(original.sistema);
    expect(clone.precoUnitario).toBe(original.precoUnitario);
  });
});

// ─── Testes Phase 21: clonarAmbiente deep-clona composicao[] (regressão Pitfall 2) ───

describe('clonarAmbiente — deep-clona composicao[] sem compartilhar referências (Phase 21 / D-06)', () => {
  function makeAmbienteComComposto(): Ambiente {
    return {
      id: 'amb-original',
      nome: 'Sala',
      luminarias: [makeItemLuminaria()],
      sistemas: [],
    };
  }

  it('nenhum id de ItemComposicao do clone colide com o original', () => {
    const original = makeAmbienteComComposto();
    const clone = clonarAmbiente(original);

    const idsOriginal = original.luminarias.flatMap(l => (l.composicao ?? []).map(c => c.id));
    const idsClone = clone.luminarias.flatMap(l => (l.composicao ?? []).map(c => c.id));

    expect(idsClone.length).toBe(idsOriginal.length);
    for (const id of idsClone) {
      expect(idsOriginal).not.toContain(id);
    }
  });

  it('luminaria root id do clone é diferente do original', () => {
    const original = makeAmbienteComComposto();
    const clone = clonarAmbiente(original);
    expect(clone.luminarias[0].id).not.toBe(original.luminarias[0].id);
  });

  it('clone não compartilha referência de objeto com original', () => {
    const original = makeAmbienteComComposto();
    const clone = clonarAmbiente(original);
    // Mutating clone should not affect original
    clone.luminarias[0].composicao![0].quantidade = 99;
    expect(original.luminarias[0].composicao![0].quantidade).toBe(2);
  });
});

// ─── Testes WP-B: parsearComprimentoDescricao (RULE-056/037) ───

describe('parsearComprimentoDescricao — parse genérico de comprimento (WP-B / RULE-056)', () => {
  it('trilho magneto "PT 2M - MAX. 48V" → 2', () => {
    expect(parsearComprimentoDescricao('MAGNETO22 TRILHO DE EMBUTIR MAGNETICO PT 2M - MAX. 48V')).toBeCloseTo(2, 5);
  });

  it('trilho TINY "BC 3M MAX. 24V" → 3', () => {
    expect(parsearComprimentoDescricao('TINY MAG TRILHO DE SOBREPOR MAGNETICO BC 3M MAX. 24V')).toBeCloseTo(3, 5);
  });

  it('perfil modular "TAMANHO 1M" (ignora LARGURA/ALTURA em MM) → 1', () => {
    expect(parsearComprimentoDescricao('SYSTEM MOLD 22 PERFIL NOFRAME MODULAR LARGURA 26,2MM ALTURA 46MM TAMANHO 1M BRANCO')).toBeCloseTo(1, 5);
  });

  it('perfil modular "TAM: 2M" → 2', () => {
    expect(parsearComprimentoDescricao('SYSTEM MOLD 22 PERFIL DE EMBUTIR MODULAR LARGURA 33,8MM ALTURA 48,9MM TAM: 2M BRANCO')).toBeCloseTo(2, 5);
  });

  it('tampa cega "0,50M BRANCO" (decimal pt-BR) → 0.5', () => {
    expect(parsearComprimentoDescricao('SYSTEM MOLD 22 TAMPA CEGA SISTEMA PERFIL MODULAR 0,50M BRANCO')).toBeCloseTo(0.5, 5);
  });

  it('tampa cega "0,133M PRETO" → 0.133', () => {
    expect(parsearComprimentoDescricao('SYSTEM MOLD 22 TAMPA CEGA SISTEMA PERFIL MODULAR 0,133M PRETO')).toBeCloseTo(0.133, 5);
  });

  it('tampa DINAMIC "30MM 1MT BRANCO" → 1 (MT vence o MM de largura)', () => {
    expect(parsearComprimentoDescricao('TAMPA CEGA SISTEMA PERFIL EMB/SOBR 30MM 1MT BRANCO')).toBeCloseTo(1, 5);
  });

  it('difuso "FITA LED 264MM" → 0.264 (delega ao parsearComprimentoModulo)', () => {
    expect(parsearComprimentoDescricao('SYSTEM MOLD 22 MODULO DIFUSO PARA FITA LED 264MM PARA USO NO PERFIL MODULAR BRANCO')).toBeCloseTo(0.264, 5);
  });

  it('módulo magnético com token MM único "222MM PT" → 0.222', () => {
    expect(parsearComprimentoDescricao('MAGNETO22 MODULO CONCENTRADO MAGNETICO 12W 2700K 48V 222MM PT PARA USO NO TRILHO MAGNETICO')).toBeCloseTo(0.222, 5);
  });

  it('módulo concentrado modular "132MM PT" → 0.132', () => {
    expect(parsearComprimentoDescricao('SYSTEM MOLD 22 MODULO CONCENTRADO 5W 100LM 2700K 132MM PT PARA USO NO PERFIL MODULAR')).toBeCloseTo(0.132, 5);
  });

  it('mais de um token MM sem token de metros → undefined (medida ambígua)', () => {
    expect(parsearComprimentoDescricao('CONECTOR LARGURA 26,2MM ALTURA 46MM')).toBeUndefined();
  });

  it('sem medida → undefined', () => {
    expect(parsearComprimentoDescricao('MAGNETO22 DRIVER PARA TRILHO MAGNETICO 100W AC127-220V DC48V')).toBeUndefined();
  });

  it('string vazia/undefined-like → undefined', () => {
    expect(parsearComprimentoDescricao('')).toBeUndefined();
  });
});

// ─── Testes WP-B: calcularOcupacaoTrilho (RULE-056/099/037) ───

describe('calcularOcupacaoTrilho — capacidade do trilho âncora (WP-B / RULE-056)', () => {
  function makeComposto(overrides: Partial<ItemLuminaria> = {}): ItemLuminaria {
    return makeItemLuminaria({
      descricao: 'SYSTEM MOLD 22 PERFIL NOFRAME MODULAR LARGURA 26,2MM ALTURA 46MM TAMANHO 2M BRANCO',
      quantidade: 1,
      composicao: [],
      ...overrides,
    });
  }

  it('trilho sem comprimento parseável → null (retrocompat: nenhum aviso)', () => {
    const item = makeComposto({ descricao: 'TRILHO MAGNETICO SEM MEDIDA' });
    expect(calcularOcupacaoTrilho(item)).toBeNull();
  });

  it('soma comprimento × qtd dos módulos contra o trilho', () => {
    const item = makeComposto({
      composicao: [
        { id: '1', codigo: 'LM2270', descricao: 'DIFUSO 264MM', quantidade: 2, precoUnitario: 100, precoMinimo: 80, papel: 'modulo', obrigatorio: false, comprimento: 0.264 },
        { id: '2', codigo: 'LM2274', descricao: 'DIFUSO 1MT', quantidade: 1, precoUnitario: 120, precoMinimo: 96, papel: 'modulo', obrigatorio: false, comprimento: 1.0 },
      ],
    });
    const r = calcularOcupacaoTrilho(item)!;
    expect(r.trilhoM).toBeCloseTo(2, 5);
    expect(r.ocupadoM).toBeCloseTo(1.528, 5);
    expect(r.ocupadoComTampasM).toBeCloseTo(1.528, 5);
  });

  it('quantidade do trilho âncora multiplica a capacidade', () => {
    const item = makeComposto({
      quantidade: 2,
      composicao: [
        { id: '1', codigo: 'LM2274', descricao: 'DIFUSO 1MT', quantidade: 3, precoUnitario: 120, precoMinimo: 96, papel: 'modulo', obrigatorio: false, comprimento: 1.0 },
      ],
    });
    const r = calcularOcupacaoTrilho(item)!;
    expect(r.trilhoM).toBeCloseTo(4, 5); // 2M × 2
    expect(r.ocupadoM).toBeCloseTo(3, 5);
  });

  it('driver/conector/kit/fita_modular NÃO ocupam o trilho', () => {
    const item = makeComposto({
      composicao: [
        { id: '1', codigo: 'LM2270', descricao: 'DIFUSO 264MM', quantidade: 1, precoUnitario: 100, precoMinimo: 80, papel: 'modulo', obrigatorio: false, comprimento: 0.264 },
        { id: '2', codigo: 'DR001', descricao: 'DRIVER 24V 2M', quantidade: 1, precoUnitario: 200, precoMinimo: 160, papel: 'driver_recomendado', obrigatorio: false, comprimento: 2 },
        { id: '3', codigo: 'CONN1', descricao: 'CONECTOR COMP:130MM', quantidade: 1, precoUnitario: 50, precoMinimo: 40, papel: 'conector_energia', obrigatorio: true },
        { id: '4', codigo: 'KIT1', descricao: 'KIT PENDENTE CABO: 2M', quantidade: 1, precoUnitario: 50, precoMinimo: 40, papel: 'kit_fixacao', obrigatorio: true },
        { id: '5', codigo: 'FT1', descricao: 'FITA LED 24V', quantidade: 1, precoUnitario: 50, precoMinimo: 40, papel: 'fita_modular', obrigatorio: false, comprimento: 1.5 },
      ],
    });
    const r = calcularOcupacaoTrilho(item)!;
    expect(r.ocupadoM).toBeCloseTo(0.264, 5);
    expect(r.ocupadoComTampasM).toBeCloseTo(0.264, 5);
  });

  it('componente sem comprimento parseável fica fora da soma', () => {
    const item = makeComposto({
      composicao: [
        { id: '1', codigo: 'LM2270', descricao: 'DIFUSO 264MM FITA LED 264MM', quantidade: 1, precoUnitario: 100, precoMinimo: 80, papel: 'modulo', obrigatorio: false, comprimento: 0.264 },
        { id: '2', codigo: 'X1', descricao: 'MODULO SEM MEDIDA', quantidade: 5, precoUnitario: 10, precoMinimo: 8, papel: 'modulo', obrigatorio: false },
      ],
    });
    expect(calcularOcupacaoTrilho(item)!.ocupadoM).toBeCloseTo(0.264, 5);
  });

  it('módulo magnético sem snapshot de comprimento parseia da descrição (222MM)', () => {
    const item = makeComposto({
      descricao: 'MAGNETO22 TRILHO DE EMBUTIR MAGNETICO PT 2M - MAX. 48V',
      composicao: [
        { id: '1', codigo: 'LM2812', descricao: 'MAGNETO22 MODULO CONCENTRADO MAGNETICO 12W 2700K 48V 222MM PT PARA USO NO TRILHO MAGNETICO', quantidade: 4, precoUnitario: 100, precoMinimo: 80, papel: 'modulo', obrigatorio: false },
      ],
    });
    const r = calcularOcupacaoTrilho(item)!;
    expect(r.trilhoM).toBeCloseTo(2, 5);
    expect(r.ocupadoM).toBeCloseTo(0.888, 5);
  });

  it('RULE-099 (resolvida 2026-08-12): tampa cega CONTA em ocupadoM — excedeu, avisa mesmo assim', () => {
    const item = makeComposto({
      composicao: [
        { id: '1', codigo: 'LM2274', descricao: 'DIFUSO 1MT', quantidade: 1, precoUnitario: 120, precoMinimo: 96, papel: 'modulo', obrigatorio: false, comprimento: 1.0 },
        { id: '2', codigo: 'LM2005', descricao: 'SYSTEM MOLD 22 TAMPA CEGA SISTEMA PERFIL MODULAR 1M BRANCO', quantidade: 2, precoUnitario: 30, precoMinimo: 24, papel: 'acessorio_opcional', obrigatorio: false, comprimento: 1.0 },
      ],
    });
    const r = calcularOcupacaoTrilho(item)!;
    expect(r.ocupadoM).toBeCloseTo(3.0, 5);          // difuso 1m + tampas 2×1m — tudo conta no aviso
    expect(r.ocupadoComTampasM).toBeCloseTo(3.0, 5); // base da sobra idem
  });

  it('acessório opcional que NÃO é tampa cega conta no aviso', () => {
    const item = makeComposto({
      composicao: [
        { id: '1', codigo: 'AC1', descricao: 'ACESSORIO QUALQUER 0,50M', quantidade: 1, precoUnitario: 10, precoMinimo: 8, papel: 'acessorio_opcional', obrigatorio: false, comprimento: 0.5 },
      ],
    });
    const r = calcularOcupacaoTrilho(item)!;
    expect(r.ocupadoM).toBeCloseTo(0.5, 5);
  });
});

// ─── Testes WP-B: escolherTampaCega (RULE-038) ───

describe('escolherTampaCega — menor tampa que cobre a sobra (WP-B / RULE-038)', () => {
  const tampas = [
    { codigo: 'T053', comprimentoM: 0.053 },
    { codigo: 'T100', comprimentoM: 0.1 },
    { codigo: 'T133', comprimentoM: 0.133 },
    { codigo: 'T050', comprimentoM: 0.5 },
    { codigo: 'T1', comprimentoM: 1 },
    { codigo: 'T2', comprimentoM: 2 },
  ];

  it('escolhe a MENOR tampa com comprimento >= sobra', () => {
    const r = escolherTampaCega(tampas, 0.4)!;
    expect(r.tampa.codigo).toBe('T050');
    expect(r.cobre).toBe(true);
  });

  it('sobra exatamente igual a uma medida comercial → essa medida', () => {
    const r = escolherTampaCega(tampas, 0.5)!;
    expect(r.tampa.codigo).toBe('T050');
    expect(r.cobre).toBe(true);
  });

  it('nenhuma cobre → a MAIOR disponível com cobre=false', () => {
    const r = escolherTampaCega(tampas, 3)!;
    expect(r.tampa.codigo).toBe('T2');
    expect(r.cobre).toBe(false);
  });

  it('lista vazia → null', () => {
    expect(escolherTampaCega([], 1)).toBeNull();
  });

  it('empate de comprimento preserva a ordem de entrada (preferência de cor)', () => {
    const r = escolherTampaCega(
      [
        { codigo: 'PRETA-1M', comprimentoM: 1 },
        { codigo: 'BRANCA-1M', comprimentoM: 1 },
      ],
      0.8,
    )!;
    expect(r.tampa.codigo).toBe('PRETA-1M');
  });
});

// ─── Testes WP-B: ehTampaCega ───

describe('ehTampaCega — detecção por descrição (RULE-099)', () => {
  it('detecta "TAMPA CEGA" case-insensitive', () => {
    expect(ehTampaCega('SYSTEM MOLD 22 TAMPA CEGA SISTEMA PERFIL MODULAR 1M BRANCO')).toBe(true);
    expect(ehTampaCega('tampa cega dinamic')).toBe(true);
  });

  it('não confunde com outros produtos', () => {
    expect(ehTampaCega('MODULO DIFUSO PARA FITA LED 264MM')).toBe(false);
    expect(ehTampaCega('')).toBe(false);
  });
});

// ─── Testes WP-I: RULE-039/040 — tampa cega COM FURO do modular ───

describe('ehModuloSpotOuPendente — gatilho da oferta de tampa com furo (RULE-039)', () => {
  it('detecta módulo de spot e de pendente (descrições reais do catálogo)', () => {
    expect(ehModuloSpotOuPendente('SYSTEM MOLD 22 MODULO SPOT PARA DICROICA ATE 8W 132MM PT GU10')).toBe(true);
    expect(ehModuloSpotOuPendente('SYSTEM MOLD 22 MÓDULO PENDENTE PARA USO NO PERFIL MODULAR')).toBe(true);
  });

  it('não confunde com difuso, concentrado nem com a própria tampa', () => {
    expect(ehModuloSpotOuPendente('SYSTEM MOLD 22 MODULO DIFUSO PARA FITA LED 132MM')).toBe(false);
    expect(ehModuloSpotOuPendente('SYSTEM MOLD 22 MODULO CONCENTRADO 5W 100LM 2700K 132MM PT')).toBe(false);
    expect(ehModuloSpotOuPendente('SYSTEM MOLD 22 TAMPA C/FURO PARA SPOT USO PERFIL MODULAR 10CM BRANCO')).toBe(false);
    expect(ehModuloSpotOuPendente('')).toBe(false);
  });
});

describe('ehTampaComFuro — por código e por descrição', () => {
  it('reconhece LM2561/LM2562 pelo código', () => {
    expect(ehTampaComFuro('LM2561')).toBe(true);
    expect(ehTampaComFuro('lm2562', 'descrição qualquer')).toBe(true);
  });

  it('reconhece as duas grafias do catálogo pela descrição', () => {
    expect(ehTampaComFuro(null, 'SYSTEM MOLD 22 TAMPA CEGA COM FURO SISTEMA PERFIL MODULAR 0,133M BRANCO')).toBe(true);
    expect(ehTampaComFuro(null, 'SYSTEM MOLD 22 TAMPA C/FURO PARA SPOT USO PERFIL MODULAR 10CM PRETO')).toBe(true);
  });

  it('tampa cega SEM furo não conta', () => {
    expect(ehTampaComFuro('LM2999', 'SYSTEM MOLD 22 TAMPA CEGA SISTEMA PERFIL MODULAR 1M BRANCO')).toBe(false);
  });
});

describe('contarTampasFuroFaltantes — uma tampa por módulo de spot/pendente (RULE-039)', () => {
  const mod = (codigo: string, descricao: string, quantidade = 1, papel: ItemComposicao['papel'] = 'modulo'): ItemComposicao => ({
    id: codigo, codigo, descricao, quantidade, precoUnitario: 10, precoMinimo: 8, papel, obrigatorio: false,
  });
  const SPOT = 'SYSTEM MOLD 22 MODULO SPOT PARA DICROICA ATE 8W 132MM PT GU10';
  const TAMPA = 'SYSTEM MOLD 22 TAMPA CEGA COM FURO SISTEMA PERFIL MODULAR 0,133M BRANCO';

  it('sem spot → nada a sugerir', () => {
    expect(contarTampasFuroFaltantes([mod('LM2107', 'MODULO DIFUSO PARA FITA LED 132MM')])).toBe(0);
    expect(contarTampasFuroFaltantes(undefined)).toBe(0);
  });

  it('conta a QUANTIDADE de cada módulo, não a linha', () => {
    expect(contarTampasFuroFaltantes([mod('LM2010', SPOT, 3)])).toBe(3);
  });

  it('desconta as tampas já presentes', () => {
    const comp = [mod('LM2010', SPOT, 3), mod('LM2561', TAMPA, 2, 'acessorio_opcional')];
    expect(contarTampasFuroFaltantes(comp)).toBe(1);
  });

  it('tampas a mais não viram número negativo', () => {
    const comp = [mod('LM2010', SPOT, 1), mod('LM2561', TAMPA, 5, 'acessorio_opcional')];
    expect(contarTampasFuroFaltantes(comp)).toBe(0);
  });

  it('a tampa cega comum (sem furo) não desconta', () => {
    const comp = [
      mod('LM2010', SPOT, 2),
      mod('LM2500', 'SYSTEM MOLD 22 TAMPA CEGA SISTEMA PERFIL MODULAR 1M BRANCO', 1, 'acessorio_opcional'),
    ];
    expect(contarTampasFuroFaltantes(comp)).toBe(2);
  });
});

// ─── Testes WP-I: RULE-072 — teto de revisões ───

describe('opcoesRevisao / rotuloUltimaRevisao (RULE-069/072)', () => {
  it('gera exatamente LIMITE_ORCAMENTOS_POR_PROJETO opções, começando na R00', () => {
    const ops = opcoesRevisao();
    expect(ops).toHaveLength(LIMITE_ORCAMENTOS_POR_PROJETO);
    expect(ops[0].valor).toBe('Primeiro Orçamento');
    expect(ops[1].valor).toBe('Revisão 01');
  });

  it('a última opção casa com o rótulo usado nas mensagens do guard', () => {
    const ops = opcoesRevisao();
    const ultima = ops[ops.length - 1];
    expect(ultima.rotulo).toContain(rotuloUltimaRevisao());
  });

  it('rótulos são zero-padded de dois dígitos', () => {
    expect(rotuloUltimaRevisao()).toMatch(/^R\d{2}$/);
  });
});
