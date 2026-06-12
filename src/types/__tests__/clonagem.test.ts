import { describe, it, expect } from 'vitest';
import { clonarSistema, clonarSistemaParaAmbiente, clonarAmbiente } from '@/types/orcamento';
import type { SistemaIluminacao, Ambiente, ItemFitaLED, ItemDriver, ItemPerfil, ItemLuminaria } from '@/types/orcamento';

// ─── Fixtures mínimos ───

function makeFita(id: string): ItemFitaLED {
  return { id, codigo: 'LM0001', descricao: 'Fita LED 24V', wm: 8, voltagem: 24, metragemRolo: 5, precoUnitario: 100, precoMinimo: 80 };
}

function makeDriver(id: string): ItemDriver {
  return { id, codigo: 'LM0100', descricao: 'Driver 24V 60W', potencia: 60, voltagem: 24, precoUnitario: 150, precoMinimo: 120 };
}

function makePerfil(id: string): ItemPerfil {
  return { id, codigo: 'LM0200', descricao: 'Perfil Embutir 2m', comprimentoPeca: 2, quantidade: 3, passadas: 1, precoUnitario: 80, precoMinimo: 60 };
}

function makeLuminaria(id: string): ItemLuminaria {
  return { id, codigo: 'LM0300', descricao: 'Spot GU10', quantidade: 2, precoUnitario: 50, precoMinimo: 40 };
}

function makeSistema(overrides?: Partial<SistemaIluminacao>): SistemaIluminacao {
  return {
    id: 'sis-orig',
    perfil: makePerfil('perfil-orig'),
    fita: makeFita('fita-orig'),
    driver: makeDriver('driver-orig'),
    metragemManual: null,
    passadasManual: 1,
    local: 'Sanca',
    ...overrides,
  };
}

function makeAmbiente(overrides?: Partial<Ambiente>): Ambiente {
  return {
    id: 'amb-orig',
    nome: 'Sala de Estar',
    luminarias: [makeLuminaria('lum-orig')],
    sistemas: [makeSistema()],
    ...overrides,
  };
}

// ─── clonarSistema ───

describe('clonarSistema', () => {
  it('gera novo id no sistema (≠ original)', () => {
    const orig = makeSistema();
    const clone = clonarSistema(orig);
    expect(clone.id).not.toBe(orig.id);
  });

  it('gera novo id na fita (≠ original)', () => {
    const orig = makeSistema();
    const clone = clonarSistema(orig);
    expect(clone.fita.id).not.toBe(orig.fita.id);
  });

  it('gera novo id no driver (≠ original)', () => {
    const orig = makeSistema();
    const clone = clonarSistema(orig);
    expect(clone.driver.id).not.toBe(orig.driver.id);
  });

  it('gera novo id no perfil (≠ original)', () => {
    const orig = makeSistema();
    const clone = clonarSistema(orig);
    expect(clone.perfil).not.toBeNull();
    expect(clone.perfil!.id).not.toBe(orig.perfil!.id);
  });

  it('perfil null permanece null', () => {
    const orig = makeSistema({ perfil: null });
    const clone = clonarSistema(orig);
    expect(clone.perfil).toBeNull();
  });

  it('local com valor recebe sufixo " (cópia)"', () => {
    const orig = makeSistema({ local: 'Sanca' });
    const clone = clonarSistema(orig);
    expect(clone.local).toBe('Sanca (cópia)');
  });

  it('local vazio/null fica como "(cópia)"', () => {
    const origNull = makeSistema({ local: null });
    expect(clonarSistema(origNull).local).toBe('(cópia)');

    const origEmpty = makeSistema({ local: '' });
    expect(clonarSistema(origEmpty).local).toBe('(cópia)');
  });

  it('demais campos preservados', () => {
    const orig = makeSistema();
    const clone = clonarSistema(orig);
    expect(clone.fita.codigo).toBe(orig.fita.codigo);
    expect(clone.driver.codigo).toBe(orig.driver.codigo);
    expect(clone.perfil!.codigo).toBe(orig.perfil!.codigo);
    expect(clone.metragemManual).toBe(orig.metragemManual);
    expect(clone.passadasManual).toBe(orig.passadasManual);
  });
});

// ─── clonarSistemaParaAmbiente ───

describe('clonarSistemaParaAmbiente', () => {
  it('gera novo id no sistema (≠ original)', () => {
    const orig = makeSistema();
    const clone = clonarSistemaParaAmbiente(orig);
    expect(clone.id).not.toBe(orig.id);
  });

  it('gera novo id na fita (≠ original)', () => {
    const orig = makeSistema();
    const clone = clonarSistemaParaAmbiente(orig);
    expect(clone.fita.id).not.toBe(orig.fita.id);
  });

  it('gera novo id no driver (≠ original)', () => {
    const orig = makeSistema();
    const clone = clonarSistemaParaAmbiente(orig);
    expect(clone.driver.id).not.toBe(orig.driver.id);
  });

  it('gera novo id no perfil (≠ original)', () => {
    const orig = makeSistema();
    const clone = clonarSistemaParaAmbiente(orig);
    expect(clone.perfil!.id).not.toBe(orig.perfil!.id);
  });

  it('preserva o local original SEM sufixo', () => {
    const orig = makeSistema({ local: 'Sanca' });
    const clone = clonarSistemaParaAmbiente(orig);
    expect(clone.local).toBe('Sanca');
  });

  it('local null permanece null', () => {
    const orig = makeSistema({ local: null });
    const clone = clonarSistemaParaAmbiente(orig);
    expect(clone.local).toBeNull();
  });
});

// ─── clonarAmbiente ───

describe('clonarAmbiente', () => {
  it('gera novo id no ambiente (≠ original)', () => {
    const orig = makeAmbiente();
    const clone = clonarAmbiente(orig);
    expect(clone.id).not.toBe(orig.id);
  });

  it('nome recebe sufixo " (cópia)"', () => {
    const orig = makeAmbiente({ nome: 'Sala de Estar' });
    const clone = clonarAmbiente(orig);
    expect(clone.nome).toBe('Sala de Estar (cópia)');
  });

  it('cada luminária recebe novo id (≠ original)', () => {
    const orig = makeAmbiente({ luminarias: [makeLuminaria('lum-1'), makeLuminaria('lum-2')] });
    const clone = clonarAmbiente(orig);
    const origIds = new Set(orig.luminarias.map(l => l.id));
    for (const lum of clone.luminarias) {
      expect(origIds.has(lum.id)).toBe(false);
    }
  });

  it('cada sistema recebe novos UUIDs em todos os níveis — nenhum id do original reutilizado', () => {
    const orig = makeAmbiente();
    const clone = clonarAmbiente(orig);

    // Coleta todos os ids do original
    const origIds = new Set<string>();
    origIds.add(orig.id);
    orig.luminarias.forEach(l => origIds.add(l.id));
    orig.sistemas.forEach(sis => {
      origIds.add(sis.id);
      origIds.add(sis.fita.id);
      origIds.add(sis.driver.id);
      if (sis.perfil) origIds.add(sis.perfil.id);
    });

    // Coleta todos os ids do clone
    const cloneIds: string[] = [];
    cloneIds.push(clone.id);
    clone.luminarias.forEach(l => cloneIds.push(l.id));
    clone.sistemas.forEach(sis => {
      cloneIds.push(sis.id);
      cloneIds.push(sis.fita.id);
      cloneIds.push(sis.driver.id);
      if (sis.perfil) cloneIds.push(sis.perfil.id);
    });

    for (const id of cloneIds) {
      expect(origIds.has(id)).toBe(false);
    }
  });

  it('local dos sistemas é preservado sem sufixo (usa clonarSistemaParaAmbiente)', () => {
    const sis = makeSistema({ local: 'Rasgo' });
    const orig = makeAmbiente({ sistemas: [sis] });
    const clone = clonarAmbiente(orig);
    expect(clone.sistemas[0].local).toBe('Rasgo');
  });

  it('preserva dados dos sistemas além dos ids', () => {
    const orig = makeAmbiente();
    const clone = clonarAmbiente(orig);
    expect(clone.sistemas[0].fita.codigo).toBe(orig.sistemas[0].fita.codigo);
    expect(clone.luminarias[0].descricao).toBe(orig.luminarias[0].descricao);
  });
});
