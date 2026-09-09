import { describe, it, expect } from 'vitest';
import {
  ehTrilhoSobrepor,
  ehConectorTrilhoSobrepor,
  qtdTrilhosSobrepor,
  ambienteTemConectorTrilho,
  corDoTrilho,
} from '@/types/orcamento';
import type { Ambiente, ItemLuminaria } from '@/types/orcamento';

// RULE-057/058/059 — o trilho de 2 fios da R4. Ele só foi encontrado no catálogo depois que
// a Paolla mandou o número da página (176): o produto se chama "TRILHO DE SOBREPOR" e nunca
// casou com a busca por "TRILHO ELETRIFICADO", que é como as regras o chamavam.
// Descrições reais do catálogo (2026-09-09).
const TRILHOS = [
  'TRILHO DE SOBREPOR, BRANCO - 1 METRO',              // LM934
  'TRILHO DE SOBREPOR, PRETO - 1 METRO',               // LM935
  'TRILHO DE SOBREPOR, BRANCO - 1,5 METRO',            // LM936 (o da demonstração)
  'TRILHO DE SOBREPOR, PRETO - 2,0 METROS',            // LM939
];
const CONECTORES = [
  'CONECTOR MODELO T , PARA TRILHOS DE SOBREPOR, BRANCO',  // LM940
  'CONECTOR  MODELO L, PARA TRILHOS DE SOBREPOR, PRETO',   // LM943
  'CONECTOR MODELO X, PARA TRILHOS DE SOBREPOR, BRANCO',   // LM944
  'CONECTOR MODELO I, PARA TRILHOS DE SOBREPOR, PRETO',    // LM947
];

const lum = (codigo: string, descricao: string, quantidade = 1): ItemLuminaria => ({
  id: codigo, codigo, descricao, quantidade, precoUnitario: 100, precoMinimo: 80,
});
const amb = (luminarias: ItemLuminaria[]): Ambiente => ({ id: 'a', nome: 'Sala', luminarias, sistemas: [] });

describe('ehTrilhoSobrepor (RULE-058)', () => {
  it('reconhece os seis trilhos da página 176', () => {
    TRILHOS.forEach((d) => expect(ehTrilhoSobrepor(d), d).toBe(true));
  });

  it('NÃO confunde com a base de luminária de trilho (LM948…LM953)', () => {
    expect(ehTrilhoSobrepor('BASE DE SOBREPOR PARA LUMINARIA DE TRILHO, REDONDO, BRANCO')).toBe(false);
    expect(ehTrilhoSobrepor('BASE DE SOBREPOR PARA LUMINARIA DE TRILHO, OVAL, PRETO')).toBe(false);
  });

  it('deixa o trilho MAGNÉTICO de fora — ele tem fluxo próprio de composição', () => {
    expect(ehTrilhoSobrepor('TINY MAG TRILHO DE SOBREPOR MAGNETICO PT 1M MAX. 24V')).toBe(false);
    expect(ehTrilhoSobrepor('MAGNETO22 TRILHO DE SOBREPOR MAGNETICO BC 2M')).toBe(false);
  });

  it('ignora vazio e nulo', () => {
    expect(ehTrilhoSobrepor('')).toBe(false);
    expect(ehTrilhoSobrepor(null)).toBe(false);
  });
});

describe('ehConectorTrilhoSobrepor (RULE-057/059)', () => {
  it('reconhece os modelos T, L, X e I', () => {
    CONECTORES.forEach((d) => expect(ehConectorTrilhoSobrepor(d), d).toBe(true));
  });

  it('NÃO confunde com o kit de três spots, que cita conector no meio do nome', () => {
    expect(ehConectorTrilhoSobrepor('KIT TRES SPOTS PARA TRILHO DE SOBREPOR LED, CORPO PRETO, 10W, 3000K, COM CONECTOR')).toBe(false);
  });

  it('deixa o conector do trilho magnético de fora', () => {
    expect(ehConectorTrilhoSobrepor('CONECTOR DE ENERGIA "I" P/ TRILHO MAGNETICO PT - MAX 24V')).toBe(false);
  });
});

describe('quantidade de trilhos e presença de conector', () => {
  it('soma a quantidade de cada item, não o número de linhas', () => {
    expect(qtdTrilhosSobrepor(amb([lum('LM934', TRILHOS[0], 3)]))).toBe(3);
    expect(qtdTrilhosSobrepor(amb([lum('LM934', TRILHOS[0]), lum('LM939', TRILHOS[3], 2)]))).toBe(3);
  });

  it('um trilho só não conta como emenda (o aviso começa no segundo)', () => {
    expect(qtdTrilhosSobrepor(amb([lum('LM936', TRILHOS[2])]))).toBe(1);
  });

  it('não conta base nem trilho magnético', () => {
    const a = amb([
      lum('LM950', 'BASE DE SOBREPOR PARA LUMINARIA DE TRILHO, REDONDO, BRANCO', 4),
      lum('LM3145', 'TINY MAG TRILHO DE SOBREPOR MAGNETICO PT 1M MAX. 24V', 2),
    ]);
    expect(qtdTrilhosSobrepor(a)).toBe(0);
  });

  it('detecta o conector já incluído no ambiente', () => {
    expect(ambienteTemConectorTrilho(amb([lum('LM934', TRILHOS[0], 2)]))).toBe(false);
    expect(ambienteTemConectorTrilho(amb([lum('LM934', TRILHOS[0], 2), lum('LM940', CONECTORES[0])]))).toBe(true);
  });
});

describe('corDoTrilho (RULE-054 — o conector acompanha a cor)', () => {
  it('lê a cor do nome', () => {
    expect(corDoTrilho(TRILHOS[0])).toBe('branco');
    expect(corDoTrilho(TRILHOS[3])).toBe('preto');
  });

  it('devolve null quando o nome não diz', () => {
    expect(corDoTrilho('TRILHO DE SOBREPOR - 1 METRO')).toBeNull();
    expect(corDoTrilho(null)).toBeNull();
  });
});
