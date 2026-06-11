import { describe, it, expect } from 'vitest';
import { calcularDriversPorProjeto, calcularRolosPorGrupo } from '@/types/orcamento';
import type { Ambiente, SistemaIluminacao, ItemFitaLED, ItemDriver, LocalBreakdown } from '@/types/orcamento';

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

  it('Teste 4 (backward-compat): qtdRolosTotal e subtotal inalterados', () => {
    const fita = makeFitaComImagem('FX4000');
    fita.metragemRolo = 5;
    const ambientes: Ambiente[] = [
      makeAmbienteNomeado('Sala', [makeSistemaComLocal(fita, driverPadrao, 12, 'Sanca')]),
      makeAmbienteNomeado('Cozinha', [makeSistemaComLocal(fita, driverPadrao, 8, 'Marcenaria')]),
    ];

    const resultado = calcularRolosPorGrupo(ambientes);

    expect(resultado).toHaveLength(1);
    const grupo = resultado[0];
    // Algoritmo usa rolos 15/10/5: 20m → 1×15 + 1×5 = 2 rolos (mesma lógica anterior, não muda com extensão)
    expect(grupo.qtdRolosTotal).toBe(2);
    expect(grupo.subtotal).toBe(fita.precoUnitario * grupo.qtdRolosTotal);
    // demandaTotal deve ser 20 (soma das metragens manuais)
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
