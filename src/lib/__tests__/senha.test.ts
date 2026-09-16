import { describe, it, expect } from 'vitest';
import { senhaAtendeRequisitos, getPasswordStrength } from '@/lib/senha';

// Mesma regra configurada no Supabase Auth (mínimo 8, minúscula, maiúscula e número). Antes as
// telas aceitavam quaisquer 3 dos 5 critérios — "abcdefgh1" passava aqui e seria recusada lá.
describe('senhaAtendeRequisitos — espelho da regra do Supabase Auth', () => {
  it('aceita 8+ caracteres com minúscula, maiúscula e número (símbolo é opcional)', () => {
    expect(senhaAtendeRequisitos('Abcdefg1')).toBe(true);
    expect(senhaAtendeRequisitos('Senha-Forte-123!')).toBe(true);
  });

  it('recusa o que antes passava com 3 de 5 critérios', () => {
    expect(senhaAtendeRequisitos('abcdefgh1')).toBe(false); // sem maiúscula
    expect(senhaAtendeRequisitos('ABCDEFGH1')).toBe(false); // sem minúscula
    expect(senhaAtendeRequisitos('Abcdefgh!')).toBe(false); // sem número
    expect(senhaAtendeRequisitos('Ab1!xyz')).toBe(false);   // 7 caracteres
  });

  it('a força exibida continua contando o símbolo', () => {
    expect(getPasswordStrength('Abcdefg1').score).toBe(4);
    expect(getPasswordStrength('Abcdefg1!').score).toBe(5);
  });
});
