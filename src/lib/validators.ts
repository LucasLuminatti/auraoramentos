import { unmask } from '@/lib/masks';

/**
 * Valida CPF brasileiro pelo algoritmo de dígitos verificadores.
 * Rejeita os 10 casos de dígitos repetidos (000... a 999...) — passam no
 * algoritmo mas são considerados inválidos pela Receita Federal.
 */
export function validateCPF(cpf: string): boolean {
  const digits = unmask(cpf);
  if (digits.length !== 11) return false;

  // Rejeita dígitos repetidos (000.000.000-00 etc.)
  if (/^(\d)\1{10}$/.test(digits)) return false;

  const calcDigit = (slice: string, factorStart: number): number => {
    let sum = 0;
    for (let i = 0; i < slice.length; i++) {
      sum += parseInt(slice[i], 10) * (factorStart - i);
    }
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };

  const d1 = calcDigit(digits.slice(0, 9), 10);
  if (d1 !== parseInt(digits[9], 10)) return false;

  const d2 = calcDigit(digits.slice(0, 10), 11);
  if (d2 !== parseInt(digits[10], 10)) return false;

  return true;
}

/**
 * Valida telefone celular BR: 11 dígitos, DDD entre 11 e 99 (D-10).
 */
export function validateTelefone(tel: string): boolean {
  const digits = unmask(tel);
  if (digits.length !== 11) return false;
  const ddd = parseInt(digits.slice(0, 2), 10);
  if (ddd < 11 || ddd > 99) return false;
  return true;
}
