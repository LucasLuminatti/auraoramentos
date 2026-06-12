import { describe, it, expect } from 'vitest';
import {
  calcularSubtotalComposicao,
  calcularTotalAmbienteSemFita,
  REGRAS_COMPOSICAO,
} from '@/types/orcamento';
import type { ItemLuminaria, ItemComposicao, Ambiente } from '@/types/orcamento';

function makeLuminaria(overrides?: Partial<ItemLuminaria>): ItemLuminaria {
  return { id: 'lum-1', codigo: 'LM0300', descricao: 'Spot GU10', quantidade: 2, precoUnitario: 50, precoMinimo: 40, ...overrides };
}

function makeComp(overrides?: Partial<ItemComposicao>): ItemComposicao {
  return { id: 'c-1', codigo: 'LM0001', descricao: 'Módulo', quantidade: 1, precoUnitario: 100, precoMinimo: 80, papel: 'modulo', obrigatorio: false, ...overrides };
}

function makeAmbiente(luminarias: ItemLuminaria[]): Ambiente {
  return { id: 'amb-1', nome: 'Sala', luminarias, sistemas: [] };
}

describe('calcularSubtotalComposicao', () => {
  it('retorna 0 quando composicao é undefined (snapshot antigo)', () => {
    expect(calcularSubtotalComposicao(makeLuminaria())).toBe(0);
  });
  it('retorna 0 quando composicao é array vazio', () => {
    expect(calcularSubtotalComposicao(makeLuminaria({ composicao: [] }))).toBe(0);
  });
  it('soma Σ(qtd × precoUnitario) dos sub-itens', () => {
    const item = makeLuminaria({ composicao: [makeComp({ quantidade: 2, precoUnitario: 50 }), makeComp({ id: 'c-2', quantidade: 1, precoUnitario: 100 })] });
    expect(calcularSubtotalComposicao(item)).toBe(200);
  });
});

describe('calcularTotalAmbienteSemFita — backward-compat', () => {
  it('ambiente sem composicao soma exatamente subtotal das luminárias (igual a antes)', () => {
    const amb = makeAmbiente([makeLuminaria({ quantidade: 2, precoUnitario: 50 }), makeLuminaria({ id: 'lum-2', quantidade: 1, precoUnitario: 30 })]);
    expect(calcularTotalAmbienteSemFita(amb)).toBe(2 * 50 + 1 * 30);
  });
  it('snapshot literal sem a chave composicao não quebra', () => {
    const snapshotAntigo = { id: 'l', codigo: 'X', descricao: 'd', quantidade: 3, precoUnitario: 10, precoMinimo: 8 } as ItemLuminaria;
    expect(calcularTotalAmbienteSemFita(makeAmbiente([snapshotAntigo]))).toBe(30);
  });
  it('luminária composta adiciona o subtotal da composição', () => {
    const composta = makeLuminaria({ quantidade: 1, precoUnitario: 200, composicao: [makeComp({ quantidade: 2, precoUnitario: 50 })] });
    expect(calcularTotalAmbienteSemFita(makeAmbiente([composta]))).toBe(200 + 100);
  });
});

describe('REGRAS_COMPOSICAO', () => {
  it('magneto_48v exige conector LM2338', () => {
    expect(REGRAS_COMPOSICAO['magneto_48v'].conectoresObrigatorios).toContain('LM2338');
  });
  it('tiny_magneto aceita LM3168 ou LM3169', () => {
    expect(REGRAS_COMPOSICAO['tiny_magneto'].conectoresObrigatorios).toEqual(expect.arrayContaining(['LM3168', 'LM3169']));
  });
  it('versão embutir referencia kit LM2987', () => {
    expect(REGRAS_COMPOSICAO['magneto_48v'].kitFixacaoEmbutir).toBe('LM2987');
  });
});
