import { describe, it, expect } from 'vitest';
import { passadasPorCanal } from '@/types/orcamento';

// CALC-03 revisto na 2ª rodada de respostas (2026-09-08, resposta 4):
// "faça calcular sozinho, mas que não fique travado e se necessário a gente edite".
// O seletor de passadas DEIXOU de ser limitado por `passadasPadrao` — o número que entra
// é calculado pelo canal (passadasPorCanal) e as três opções ficam sempre abertas, porque
// travar o range impedia a equipe de corrigir um perfil cujo cadastro está errado.
//
// Espelho da expressão de AmbienteCard.tsx:
//   {[1, 2, 3].map((n) => <SelectItem ... />)}
const opcoesPassadas = (): number[] => [1, 2, 3];

describe('opcoesPassadas — seletor destravado (CALC-03 / resposta 4)', () => {
  it('sempre oferece 1, 2 e 3 — independente do padrão do catálogo', () => {
    expect(opcoesPassadas()).toEqual([1, 2, 3]);
  });

  it('permite CORRIGIR para baixo o número que o sistema calculou', () => {
    // canal de 30mm entra com 2 passadas, mas o vendedor pode voltar para 1
    expect(passadasPorCanal('PERFIL PARA FITAS DE LED COM LARGURA ATÉ 30MM', 1)).toBe(2);
    expect(opcoesPassadas()).toContain(1);
  });

  it('permite subir para 3 mesmo em perfil cujo cadastro diz 1', () => {
    expect(passadasPorCanal('PERFIL DE EMBUTIR NO FRAME', 1)).toBe(1);
    expect(opcoesPassadas()).toContain(3);
  });
});
