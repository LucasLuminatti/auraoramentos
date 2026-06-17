import { describe, it, expect } from 'vitest';
import { temSistemaComposto, resolverTemplateVersion } from '@/lib/pdfTemplateVersion';
import type { Ambiente, ItemLuminaria, ItemComposicao } from '@/types/orcamento';

function makeComp(overrides?: Partial<ItemComposicao>): ItemComposicao {
  return {
    id: 'c-1',
    codigo: 'LM2338',
    descricao: 'Conector Magneto',
    quantidade: 1,
    precoUnitario: 45,
    precoMinimo: 36,
    papel: 'conector',
    obrigatorio: true,
    ...overrides,
  };
}

function makeLuminaria(overrides?: Partial<ItemLuminaria>): ItemLuminaria {
  return {
    id: 'lum-1',
    codigo: 'LM2300',
    descricao: 'Módulo MAGNETO',
    quantidade: 1,
    precoUnitario: 200,
    precoMinimo: 160,
    ...overrides,
  };
}

function makeAmbiente(luminarias: ItemLuminaria[]): Ambiente {
  return { id: 'amb-1', nome: 'Sala', luminarias, sistemas: [] };
}

// Caso 1: luminária com composicao preenchida → composto
describe('temSistemaComposto', () => {
  it('retorna true quando há luminária com composicao não vazia', () => {
    const amb = makeAmbiente([
      makeLuminaria({ composicao: [makeComp()] }),
    ]);
    expect(temSistemaComposto([amb])).toBe(true);
  });

  // Caso 2: só Fita Padrão em sistemas[] e/ou luminárias avulsas sem composicao → false
  it('retorna false quando luminárias não têm composicao (fita padrão / avulsa)', () => {
    const amb = makeAmbiente([
      makeLuminaria(), // sem composicao
    ]);
    expect(temSistemaComposto([amb])).toBe(false);
  });

  // Caso 3: composicao: [] (array vazio, length 0, falsy) → false
  it('retorna false quando composicao é array vazio', () => {
    const amb = makeAmbiente([
      makeLuminaria({ composicao: [] }),
    ]);
    expect(temSistemaComposto([amb])).toBe(false);
  });

  // Caso 4: composicao: undefined (snapshot antigo) → false
  it('retorna false quando composicao é undefined (snapshot antigo)', () => {
    const lum = { id: 'lum-1', codigo: 'LM0001', descricao: 'Spot', quantidade: 1, precoUnitario: 50, precoMinimo: 40 } as unknown as ItemLuminaria;
    const amb = makeAmbiente([lum]);
    expect(temSistemaComposto([amb])).toBe(false);
  });

  // Caso 5: mistura — 1 ambiente sem composto + 1 ambiente com composto → true (some atravessa todos)
  it('retorna true quando ao menos um ambiente tem composto (mistura)', () => {
    const semComposto = makeAmbiente([makeLuminaria()]);
    const comComposto = makeAmbiente([
      makeLuminaria({ id: 'lum-2', composicao: [makeComp()] }),
    ]);
    comComposto.id = 'amb-2';
    expect(temSistemaComposto([semComposto, comComposto])).toBe(true);
  });
});

describe('resolverTemplateVersion', () => {
  it('retorna 3 quando há composto', () => {
    const amb = makeAmbiente([makeLuminaria({ composicao: [makeComp()] })]);
    expect(resolverTemplateVersion([amb])).toBe(3);
  });

  it('retorna 2 quando não há composto (sem composicao)', () => {
    const amb = makeAmbiente([makeLuminaria()]);
    expect(resolverTemplateVersion([amb])).toBe(2);
  });

  it('retorna 2 quando composicao é array vazio', () => {
    const amb = makeAmbiente([makeLuminaria({ composicao: [] })]);
    expect(resolverTemplateVersion([amb])).toBe(2);
  });

  it('retorna 2 quando composicao é undefined (snapshot antigo)', () => {
    const lum = { id: 'lum-1', codigo: 'LM0001', descricao: 'Spot', quantidade: 1, precoUnitario: 50, precoMinimo: 40 } as unknown as ItemLuminaria;
    const amb = makeAmbiente([lum]);
    expect(resolverTemplateVersion([amb])).toBe(2);
  });

  it('retorna 3 com mistura de ambientes (um com composto)', () => {
    const semComposto = makeAmbiente([makeLuminaria()]);
    const comComposto = makeAmbiente([
      makeLuminaria({ id: 'lum-2', composicao: [makeComp()] }),
    ]);
    comComposto.id = 'amb-2';
    expect(resolverTemplateVersion([semComposto, comComposto])).toBe(3);
  });
});
