import { describe, it, expect } from 'vitest';
import { detectarAvisosComposto } from '@/components/Step2Ambientes';
import type { Ambiente, ItemComposicao, ItemLuminaria } from '@/types/orcamento';

// ─── Helpers de fixture ───

function makeItemComposicao(overrides: Partial<ItemComposicao> = {}): ItemComposicao {
  return {
    id: crypto.randomUUID(),
    codigo: 'SKU-XXX',
    descricao: 'Item',
    quantidade: 1,
    precoUnitario: 100,
    precoMinimo: 80,
    papel: 'modulo',
    obrigatorio: false,
    ...overrides,
  };
}

function makeLuminaria(overrides: Partial<ItemLuminaria> = {}): ItemLuminaria {
  return {
    id: crypto.randomUUID(),
    codigo: 'LUM-001',
    descricao: 'Luminaria teste',
    quantidade: 1,
    precoUnitario: 100,
    precoMinimo: 80,
    ...overrides,
  };
}

function makeAmbiente(luminarias: ItemLuminaria[]): Ambiente {
  return {
    id: crypto.randomUUID(),
    nome: 'Sala',
    luminarias,
    sistemas: [],
  };
}

// ─── D-03.1: composto-sem-driver ───

describe('detectarAvisosComposto — composto-sem-driver', () => {
  it('magneto_48v com módulos mas sem driver_recomendado → gera aviso composto-sem-driver', () => {
    const lum = makeLuminaria({
      sistema: 'magneto_48v',
      composicao: [
        makeItemComposicao({ papel: 'modulo', codigo: 'LM1234' }),
      ],
    });
    const avisos = detectarAvisosComposto(makeAmbiente([lum]));
    expect(avisos.some(a => a.tipo === 'composto-sem-driver')).toBe(true);
  });

  it('tiny_magneto com módulos mas sem driver_recomendado → gera aviso composto-sem-driver', () => {
    const lum = makeLuminaria({
      sistema: 'tiny_magneto',
      composicao: [
        makeItemComposicao({ papel: 'modulo', codigo: 'LM9999' }),
      ],
    });
    const avisos = detectarAvisosComposto(makeAmbiente([lum]));
    expect(avisos.some(a => a.tipo === 'composto-sem-driver')).toBe(true);
  });

  it('magneto_48v COM driver_recomendado → NÃO gera composto-sem-driver', () => {
    const lum = makeLuminaria({
      sistema: 'magneto_48v',
      composicao: [
        makeItemComposicao({ papel: 'modulo', codigo: 'LM1234' }),
        makeItemComposicao({ papel: 'driver_recomendado', codigo: 'LM2343' }),
      ],
    });
    const avisos = detectarAvisosComposto(makeAmbiente([lum]));
    expect(avisos.some(a => a.tipo === 'composto-sem-driver')).toBe(false);
  });
});

// ─── D-03.2: composto-sem-conector ───

describe('detectarAvisosComposto — composto-sem-conector', () => {
  it('magneto_48v sem LM2338 → gera aviso composto-sem-conector', () => {
    const lum = makeLuminaria({
      sistema: 'magneto_48v',
      composicao: [
        makeItemComposicao({ papel: 'modulo', codigo: 'LM1234' }),
        makeItemComposicao({ papel: 'driver_recomendado', codigo: 'LM2343' }),
      ],
    });
    const avisos = detectarAvisosComposto(makeAmbiente([lum]));
    expect(avisos.some(a => a.tipo === 'composto-sem-conector')).toBe(true);
  });

  it('magneto_48v COM LM2338 → NÃO gera composto-sem-conector', () => {
    const lum = makeLuminaria({
      sistema: 'magneto_48v',
      composicao: [
        makeItemComposicao({ papel: 'modulo', codigo: 'LM1234' }),
        makeItemComposicao({ papel: 'driver_recomendado', codigo: 'LM2343' }),
        makeItemComposicao({ papel: 'conector_energia', codigo: 'LM2338' }),
      ],
    });
    const avisos = detectarAvisosComposto(makeAmbiente([lum]));
    expect(avisos.some(a => a.tipo === 'composto-sem-conector')).toBe(false);
  });

  it('tiny_magneto sem LM3168 nem LM3169 → gera aviso composto-sem-conector', () => {
    const lum = makeLuminaria({
      sistema: 'tiny_magneto',
      composicao: [
        makeItemComposicao({ papel: 'modulo', codigo: 'LM9999' }),
        makeItemComposicao({ papel: 'driver_recomendado', codigo: 'LM5000' }),
      ],
    });
    const avisos = detectarAvisosComposto(makeAmbiente([lum]));
    expect(avisos.some(a => a.tipo === 'composto-sem-conector')).toBe(true);
  });

  it('tiny_magneto com LM3168 → NÃO gera composto-sem-conector', () => {
    const lum = makeLuminaria({
      sistema: 'tiny_magneto',
      composicao: [
        makeItemComposicao({ papel: 'modulo', codigo: 'LM9999' }),
        makeItemComposicao({ papel: 'driver_recomendado', codigo: 'LM5000' }),
        makeItemComposicao({ papel: 'conector_energia', codigo: 'LM3168' }),
      ],
    });
    const avisos = detectarAvisosComposto(makeAmbiente([lum]));
    expect(avisos.some(a => a.tipo === 'composto-sem-conector')).toBe(false);
  });
});

// ─── D-03.3: modular-sem-fita ───

describe('detectarAvisosComposto — modular-sem-fita', () => {
  it('s_mode com módulos difusos (metragem > 0) sem fita_modular → gera aviso modular-sem-fita', () => {
    const lum = makeLuminaria({
      sistema: 's_mode',
      composicao: [
        makeItemComposicao({ papel: 'modulo', codigo: 'LM2270', comprimento: 0.264, quantidade: 2 }),
      ],
    });
    const avisos = detectarAvisosComposto(makeAmbiente([lum]));
    expect(avisos.some(a => a.tipo === 'modular-sem-fita')).toBe(true);
  });

  it('s_mode COM fita_modular → NÃO gera modular-sem-fita', () => {
    const lum = makeLuminaria({
      sistema: 's_mode',
      composicao: [
        makeItemComposicao({ papel: 'modulo', codigo: 'LM2270', comprimento: 0.264, quantidade: 2 }),
        makeItemComposicao({ papel: 'fita_modular', codigo: 'FITA-24V' }),
      ],
    });
    const avisos = detectarAvisosComposto(makeAmbiente([lum]));
    expect(avisos.some(a => a.tipo === 'modular-sem-fita')).toBe(false);
  });
});

// ─── Comportamento com composicao ausente/vazia ───

describe('detectarAvisosComposto — composicao ausente', () => {
  it('luminaria sem composicao (undefined) → não gera nenhum aviso de composto', () => {
    const lum = makeLuminaria({ sistema: 'magneto_48v', composicao: undefined });
    const avisos = detectarAvisosComposto(makeAmbiente([lum]));
    expect(avisos).toHaveLength(0);
  });

  it('luminaria com composicao vazia ([]) → não gera nenhum aviso de composto', () => {
    const lum = makeLuminaria({ sistema: 'magneto_48v', composicao: [] });
    const avisos = detectarAvisosComposto(makeAmbiente([lum]));
    expect(avisos).toHaveLength(0);
  });

  it('s_mode com módulo sem comprimento (metragem derivada = 0) → NÃO gera modular-sem-fita', () => {
    const lum = makeLuminaria({
      sistema: 's_mode',
      composicao: [
        makeItemComposicao({ papel: 'modulo', codigo: 'LM2270', comprimento: undefined }),
      ],
    });
    const avisos = detectarAvisosComposto(makeAmbiente([lum]));
    expect(avisos.some(a => a.tipo === 'modular-sem-fita')).toBe(false);
  });
});
