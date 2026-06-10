import { describe, it, expect } from 'vitest';
import { calcularDriversPorProjeto } from '@/types/orcamento';
import type { Ambiente, SistemaIluminacao, ItemFitaLED, ItemDriver } from '@/types/orcamento';

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
