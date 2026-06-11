import { describe, it, expect } from 'vitest';
import { aplicarSufixoMetragem } from '@/types/orcamento';

// Cobre CALC-02 (D-09): helper de sufixo de metragem em pt-BR.
// Anti-Pitfall 3: a reaplicação do sufixo não deve duplicar o texto — idempotência garantida
// pelo strip da regex / — \d+(,\d+)?m$/ antes de re-anexar.

describe('aplicarSufixoMetragem', () => {
  it('metragem inteira: comprimento 2, quantidade 1 → sufixo " — 2m" (sem vírgula)', () => {
    expect(aplicarSufixoMetragem('PERFIL X', 2, 1)).toBe('PERFIL X — 2m');
  });

  it('metragem inteira: comprimento 1, quantidade 2 → " — 2m"', () => {
    expect(aplicarSufixoMetragem('PERFIL X', 1, 2)).toBe('PERFIL X — 2m');
  });

  it('metragem fracionária: comprimento 2.5, quantidade 1 → " — 2,5m" (vírgula decimal pt-BR)', () => {
    expect(aplicarSufixoMetragem('PERFIL X', 2.5, 1)).toBe('PERFIL X — 2,5m');
  });

  it('metragem fracionária: comprimento 1.5, quantidade 2 → " — 3m" (inteiro)', () => {
    expect(aplicarSufixoMetragem('PERFIL X', 1.5, 2)).toBe('PERFIL X — 3m');
  });

  it('idempotência (anti-Pitfall 3): reaplicar com novos parâmetros substitui sufixo anterior', () => {
    const primeira = aplicarSufixoMetragem('PERFIL X', 2, 1);    // 'PERFIL X — 2m'
    const segunda  = aplicarSufixoMetragem(primeira, 3, 1);       // deve ser 'PERFIL X — 3m'
    expect(segunda).toBe('PERFIL X — 3m');
  });

  it('idempotência: aplicar com mesmo parâmetro não duplica sufixo', () => {
    const primeira = aplicarSufixoMetragem('PERFIL X', 2, 1);
    const segunda  = aplicarSufixoMetragem(primeira, 2, 1);
    expect(segunda).toBe('PERFIL X — 2m');
  });

  it('preservação de texto manual: texto antes do sufixo é mantido intacto', () => {
    // Usuário pode ter texto como "PERFIL EMBUTIR SALA" — deve preservar "EMBUTIR SALA"
    expect(aplicarSufixoMetragem('PERFIL EMBUTIR SALA — 2m', 2, 2)).toBe('PERFIL EMBUTIR SALA — 4m');
  });

  it('preservação de texto manual fracionário', () => {
    expect(aplicarSufixoMetragem('PERFIL RASGO CORREDOR — 1,5m', 1.5, 1)).toBe('PERFIL RASGO CORREDOR — 1,5m');
  });

  it('sem sufixo prévio + metragem inteira não inclui vírgula', () => {
    const result = aplicarSufixoMetragem('PERFIL Z', 3, 3);
    expect(result).not.toContain(',');
    expect(result).toBe('PERFIL Z — 9m');
  });

  it('usa travessão em dash (U+2014) — não hífen simples', () => {
    const result = aplicarSufixoMetragem('PERFIL X', 1, 1);
    expect(result).toContain(' — ');  // U+2014 literal
  });
});
