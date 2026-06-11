import { describe, it, expect } from 'vitest';

// Cobre CALC-03 (D-11, D-12): range de passadas restrito por passadasPadrao da família.
// Fonte: src/components/AmbienteCard.tsx — filtro de opções no Select de passadas:
//   [1, 2, 3].filter((n) => n <= (sis.perfil!.passadasPadrao ?? 3))
//
// Anti-Pitfall 4: garantir que o range respeita o limite da família e degrada com segurança
// para snapshots antigos (passadasPadrao undefined → fallback [1,2,3]).

// Espelho da expressão de AmbienteCard.tsx:
const opcoesPassadas = (passadasPadrao?: number): number[] =>
  [1, 2, 3].filter((n) => n <= (passadasPadrao ?? 3));

describe('opcoesPassadas — range por família (CALC-03)', () => {
  it('passadasPadrao=3 (light_50 e similares) → opções [1, 2, 3]', () => {
    expect(opcoesPassadas(3)).toEqual([1, 2, 3]);
  });

  it('passadasPadrao=2 → opções [1, 2] (3 excluído)', () => {
    expect(opcoesPassadas(2)).toEqual([1, 2]);
  });

  it('passadasPadrao=1 → opções [1] apenas', () => {
    expect(opcoesPassadas(1)).toEqual([1]);
  });

  // D-12 / Anti-Pitfall 4: snapshots antigos sem passadasPadrao → fallback seguro [1,2,3]
  it('passadasPadrao=undefined (snapshot antigo) → fallback [1, 2, 3] (não bloqueia)', () => {
    expect(opcoesPassadas(undefined)).toEqual([1, 2, 3]);
  });

  // Invariantes estruturais
  it('resultado nunca vazio: pelo menos 1 opção sempre disponível', () => {
    [1, 2, 3, undefined].forEach((pp) => {
      expect(opcoesPassadas(pp as number | undefined).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('opção 1 sempre presente independente de passadasPadrao', () => {
    [1, 2, 3, undefined].forEach((pp) => {
      expect(opcoesPassadas(pp as number | undefined)).toContain(1);
    });
  });

  it('passadasPadrao=2 → não contém 3', () => {
    expect(opcoesPassadas(2)).not.toContain(3);
  });

  it('passadasPadrao=1 → não contém 2 nem 3', () => {
    const opts = opcoesPassadas(1);
    expect(opts).not.toContain(2);
    expect(opts).not.toContain(3);
  });
});
