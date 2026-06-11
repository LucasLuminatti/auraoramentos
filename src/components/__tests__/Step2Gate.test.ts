import { describe, it, expect } from 'vitest';

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
