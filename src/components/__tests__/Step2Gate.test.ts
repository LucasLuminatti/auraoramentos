import { describe, it, expect } from 'vitest';
import { errosBloqueantes } from '@/hooks/useValidarSistemas';

// Cobre CALC-01 (D-01..D-06): lógica do gate de avanço do Step 2.
// Fonte: src/components/Step2Ambientes.tsx — handleNext (linhas 34–82)
//
// Os predicados abaixo espelham EXATAMENTE o que está implementado no componente:
//   metragemInvalida: aplicado a sistemas com fita, sem perfil
//   totalmenteVazio: detecta sistemas a remover (não bloqueia)

// Replicando os predicados do gate (mirror de Step2Ambientes.tsx handleNext)
const metragemInvalida = (sis: {
  fita: { codigo: string };
  driver: { codigo: string };
  perfil: unknown;
  metragemManual: number | null;
}): boolean => {
  // Só aplicado quando fita.codigo preenchido E sem perfil
  if (!sis.fita.codigo || sis.perfil) return false;
  return !sis.metragemManual || sis.metragemManual <= 0;
};

const totalmenteVazio = (sis: {
  fita: { codigo: string };
  driver: { codigo: string };
  perfil: unknown;
}): boolean => {
  return !sis.fita.codigo && !sis.driver.codigo && !sis.perfil;
};

// ─── Fixtures de SistemaIluminacao mínimos ───

const sistemaFitaSemPerfil = (metragemManual: number | null) => ({
  fita: { codigo: 'FITA-001' },
  driver: { codigo: 'DRIVER-001' },
  perfil: null,
  metragemManual,
});

const sistemaComPerfil = (metragemManual: number | null) => ({
  fita: { codigo: 'FITA-001' },
  driver: { codigo: 'DRIVER-001' },
  perfil: { codigo: 'PERFIL-001' },  // perfil presente
  metragemManual,
});

const sistemaVazio = () => ({
  fita: { codigo: '' },
  driver: { codigo: '' },
  perfil: null,
  metragemManual: null,
});

describe('Gate CALC-01 — metragemInvalida', () => {
  // D-03: null ≡ 0 — ambos devem bloquear
  it('metragemManual=null com fita e sem perfil → inválido (bloqueia)', () => {
    expect(metragemInvalida(sistemaFitaSemPerfil(null))).toBe(true);
  });

  it('metragemManual=0 com fita e sem perfil → inválido (bloqueia) — null ≡ 0 (D-03)', () => {
    expect(metragemInvalida(sistemaFitaSemPerfil(0))).toBe(true);
  });

  it('metragemManual=12 com fita e sem perfil → válido (não bloqueia)', () => {
    expect(metragemInvalida(sistemaFitaSemPerfil(12))).toBe(false);
  });

  it('metragemManual=0.5 (fracionário positivo) → válido', () => {
    expect(metragemInvalida(sistemaFitaSemPerfil(0.5))).toBe(false);
  });

  // D-05: sistema com perfil NÃO exige metragemManual
  it('sistema com perfil presente e metragemManual=null → NÃO bloqueia (metragem só exigida sem perfil)', () => {
    expect(metragemInvalida(sistemaComPerfil(null))).toBe(false);
  });

  it('sistema com perfil presente e metragemManual=0 → NÃO bloqueia', () => {
    expect(metragemInvalida(sistemaComPerfil(0))).toBe(false);
  });

  // D-04: rascunho antigo (metragemManual null, perfil null, fita preenchida) → cai em inválido sem crash
  it('rascunho antigo (metragemManual null, perfil null, fita preenchida) → detectado como inválido sem crash', () => {
    const rascunhoAntigo = {
      fita: { codigo: 'FITA-LEGADO-XYZ' },
      driver: { codigo: 'DRIVER-001' },
      perfil: null,
      metragemManual: null,  // campo antigo ausente
    };
    expect(() => metragemInvalida(rascunhoAntigo)).not.toThrow();
    expect(metragemInvalida(rascunhoAntigo)).toBe(true);
  });
});

describe('Gate CALC-01 — totalmenteVazio (D-06)', () => {
  it('sistema com apenas fita.codigo vazio, driver vazio, perfil null → vazio', () => {
    expect(totalmenteVazio(sistemaVazio())).toBe(true);
  });

  it('sistema com fita preenchida → não é vazio', () => {
    expect(totalmenteVazio(sistemaFitaSemPerfil(null))).toBe(false);
  });

  it('sistema com apenas driver preenchido → não é vazio (não todos vazios)', () => {
    expect(totalmenteVazio({ fita: { codigo: '' }, driver: { codigo: 'DRV-001' }, perfil: null })).toBe(false);
  });

  it('sistema com apenas perfil preenchido → não é vazio', () => {
    expect(totalmenteVazio({ fita: { codigo: '' }, driver: { codigo: '' }, perfil: { codigo: 'PRF-001' } })).toBe(false);
  });

  // D-06 vs D-03: vazio é tratado de forma distinta de inválido
  it('sistema totalmente vazio NÃO é detectado como metragemInvalida (distinção D-06)', () => {
    // vazio → totalmenteVazio=true, metragemInvalida=false (fita.codigo='')
    const vazio = sistemaVazio();
    expect(totalmenteVazio(vazio)).toBe(true);
    expect(metragemInvalida(vazio)).toBe(false);
  });
});

// ─── Gate dos erros da edge (auditoria 2026-09-15) ───
// Usa a função REAL que o passo 2 e o passo 3 chamam, com as mensagens reais da edge
// `validar-sistema-orcamento` — um espelho local passaria mesmo com o filtro quebrado.

const comFita = { fita: { codigo: 'LM2029' } } as Parameters<typeof errosBloqueantes>[0];
const semFita = { fita: { codigo: '' } } as Parameters<typeof errosBloqueantes>[0];

const MSG = {
  tensao: 'Tensão incompatível: fita é 12V mas o driver é 24V. Use driver 12V.',
  babyRegra15: 'Perfil light_mini aceita SOMENTE fita Baby. Selecione uma fita Baby (largura ≤ 5mm).',
  babyTransversal: 'Perfil ripado aceita SOMENTE fita Baby — outra fita não cabe no canal. Selecione uma fita Baby.',
  ip: 'Perfil nano não aceita fita com IP (LM1234) — não cabe no canal. Selecione uma fita sem IP.',
  slim: 'Perfil trik aceita SOMENTE driver Slim. Drivers Convencionais, PRO ou acima de 72W não cabem fisicamente.',
  tiny: 'Sistema Tiny Magneto requer driver 24V. Driver 12V é proibido.',
  // hoje é alerta na edge; se um dia virar erro, não pode escapar por conter "tensão"
  extensao: 'Extensão de fita (12m) excede o limite de 10m por driver para 24V.',
};

describe('errosBloqueantes — o que o validador do servidor trava', () => {
  it('incompatibilidade física com fita escolhida bloqueia', () => {
    expect(errosBloqueantes(comFita, [MSG.babyRegra15, MSG.babyTransversal, MSG.ip])).toHaveLength(3);
  });

  it('tensão fita × driver continua advisory (D-05/D-10)', () => {
    expect(errosBloqueantes(comFita, [MSG.tensao])).toEqual([]);
  });

  it('"extensão" não é confundida com tensão', () => {
    expect(errosBloqueantes(comFita, [MSG.extensao])).toEqual([MSG.extensao]);
  });

  it('driver errado bloqueia com ou sem fita', () => {
    expect(errosBloqueantes(comFita, [MSG.slim, MSG.tiny])).toEqual([MSG.slim, MSG.tiny]);
    expect(errosBloqueantes(semFita, [MSG.slim, MSG.tiny])).toEqual([MSG.slim, MSG.tiny]);
  });

  it('sistema ainda sem fita não trava por erro de fita (Light Mini só com driver)', () => {
    expect(errosBloqueantes(semFita, [MSG.babyRegra15, MSG.ip])).toEqual([]);
  });

  it('sem erro não bloqueia', () => {
    expect(errosBloqueantes(comFita, [])).toEqual([]);
  });
});
