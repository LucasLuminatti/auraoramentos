import { describe, it, expect } from 'vitest';
import { detectarChecklistIssues } from '@/types/orcamento';
import type { Ambiente, SistemaIluminacao, ItemFitaLED, ItemDriver, ItemPerfil, ItemLuminaria } from '@/types/orcamento';

// ─── Fixtures mínimos ───

function makeFita(overrides?: Partial<ItemFitaLED>): ItemFitaLED {
  return {
    id: 'fita-1',
    codigo: 'LM0001',
    descricao: 'Fita LED 24V',
    wm: 8,
    voltagem: 24,
    metragemRolo: 5,
    precoUnitario: 100,
    precoMinimo: 80,
    ...overrides,
  };
}

function makeDriver(overrides?: Partial<ItemDriver>): ItemDriver {
  return {
    id: 'driver-1',
    codigo: 'LM0100',
    descricao: 'Driver 24V 60W',
    potencia: 60,
    voltagem: 24,
    precoUnitario: 150,
    precoMinimo: 120,
    ...overrides,
  };
}

function makePerfil(overrides?: Partial<ItemPerfil>): ItemPerfil {
  return {
    id: 'perfil-1',
    codigo: 'LM0200',
    descricao: 'Perfil Embutir 2m',
    comprimentoPeca: 2,
    quantidade: 3,
    passadas: 1,
    precoUnitario: 80,
    precoMinimo: 60,
    ...overrides,
  };
}

function makeSistema(overrides?: Partial<SistemaIluminacao>): SistemaIluminacao {
  return {
    id: 'sis-1',
    perfil: null,
    fita: makeFita(),
    driver: makeDriver(),
    metragemManual: 5,
    passadasManual: 1,
    local: null,
    ...overrides,
  };
}

function makeLuminaria(overrides?: Partial<ItemLuminaria>): ItemLuminaria {
  return {
    id: 'lum-1',
    codigo: 'LM0300',
    descricao: 'Spot GU10',
    quantidade: 1,
    precoUnitario: 50,
    precoMinimo: 40,
    ...overrides,
  };
}

function makeAmbiente(overrides?: Partial<Ambiente>): Ambiente {
  return {
    id: 'amb-1',
    nome: 'Sala',
    luminarias: [],
    sistemas: [makeSistema()],
    ...overrides,
  };
}

// ─── Testes ───

describe('detectarChecklistIssues', () => {
  it('array vazio → retorna []', () => {
    expect(detectarChecklistIssues([])).toEqual([]);
  });

  it('sistema completo e válido → 0 issues', () => {
    const amb = makeAmbiente();
    expect(detectarChecklistIssues([amb])).toHaveLength(0);
  });

  it('fita 0m sem perfil → 1 issue de level "error" com mensagem correta', () => {
    const sis = makeSistema({ metragemManual: 0, perfil: null });
    const amb = makeAmbiente({ sistemas: [sis] });
    const issues = detectarChecklistIssues([amb]);
    expect(issues).toHaveLength(1);
    expect(issues[0].level).toBe('error');
    expect(issues[0].mensagem).toContain('Fita sem metragem (0m): o orçamento ficará R$ 0,00');
  });

  it('fita null metragemManual sem perfil → 1 issue de level "error"', () => {
    const sis = makeSistema({ metragemManual: null, perfil: null });
    const amb = makeAmbiente({ sistemas: [sis] });
    const issues = detectarChecklistIssues([amb]);
    expect(issues).toHaveLength(1);
    expect(issues[0].level).toBe('error');
  });

  it('sistema com fita mas driver vazio → 1 issue "warning" (sem driver)', () => {
    const sis = makeSistema({ driver: makeDriver({ codigo: '' }) });
    const amb = makeAmbiente({ sistemas: [sis] });
    const issues = detectarChecklistIssues([amb]);
    expect(issues).toHaveLength(1);
    expect(issues[0].level).toBe('warning');
    expect(issues[0].mensagem).toContain('Sistema sem driver');
  });

  it('driver com fita vazia → 1 issue "warning" (driver sem fita)', () => {
    const sis = makeSistema({ fita: makeFita({ codigo: '' }), metragemManual: 5 });
    const amb = makeAmbiente({ sistemas: [sis] });
    const issues = detectarChecklistIssues([amb]);
    expect(issues).toHaveLength(1);
    expect(issues[0].level).toBe('warning');
    expect(issues[0].mensagem).toContain('Driver sem fita LED');
  });

  it('perfil com fita vazia → 1 issue "warning" (perfil sem fita)', () => {
    const sis = makeSistema({
      fita: makeFita({ codigo: '' }),
      perfil: makePerfil(),
      metragemManual: 5,
    });
    const amb = makeAmbiente({ sistemas: [sis] });
    const issues = detectarChecklistIssues([amb]);
    // Espera "Perfil sem fita LED" + "Driver sem fita LED"
    const perfilIssue = issues.find(i => i.mensagem.includes('Perfil sem fita LED'));
    expect(perfilIssue).toBeDefined();
    expect(perfilIssue!.level).toBe('warning');
  });

  it('voltagem divergente fita × driver → 1 issue "warning"', () => {
    const sis = makeSistema({
      fita: makeFita({ voltagem: 12 }),
      driver: makeDriver({ voltagem: 24 }),
    });
    const amb = makeAmbiente({ sistemas: [sis] });
    const issues = detectarChecklistIssues([amb]);
    const voltIssue = issues.find(i => i.mensagem.includes('Voltagem divergente'));
    expect(voltIssue).toBeDefined();
    expect(voltIssue!.level).toBe('warning');
    expect(voltIssue!.mensagem).toContain('fita 12V × driver 24V');
  });

  it('peça GU10 sem lâmpada no ambiente → 1 issue "warning" (peça sem lâmpada)', () => {
    const lumGU10 = makeLuminaria({ descricao: 'Spot GU10 Dicróica', codigo: 'LM0300' });
    const amb = makeAmbiente({ luminarias: [lumGU10], sistemas: [] });
    const issues = detectarChecklistIssues([amb]);
    const lampadaIssue = issues.find(i => i.mensagem.includes('Peça sem lâmpada'));
    expect(lampadaIssue).toBeDefined();
    expect(lampadaIssue!.level).toBe('warning');
  });

  it('peça GU10 num ambiente que JÁ TEM lâmpada → sem issue de lâmpada', () => {
    const lumGU10 = makeLuminaria({ descricao: 'Spot GU10', codigo: 'LM0300' });
    const lumLampada = makeLuminaria({ id: 'lum-lamp', descricao: 'Lâmpada LED GU10 7W', codigo: 'LM9999' });
    const amb = makeAmbiente({ luminarias: [lumGU10, lumLampada], sistemas: [] });
    const issues = detectarChecklistIssues([amb]);
    const lampadaIssue = issues.find(i => i.mensagem.includes('Peça sem lâmpada'));
    expect(lampadaIssue).toBeUndefined();
  });

  it('erros aparecem antes dos avisos no retorno', () => {
    // Sistema com fita 0m (erro) E fita com driver vazio (aviso)
    const sisComErro = makeSistema({ metragemManual: 0, perfil: null });
    const sisComAviso = makeSistema({ id: 'sis-2', driver: makeDriver({ codigo: '' }) });
    const amb = makeAmbiente({ sistemas: [sisComErro, sisComAviso] });
    const issues = detectarChecklistIssues([amb]);
    expect(issues.length).toBeGreaterThanOrEqual(2);
    expect(issues[0].level).toBe('error');
  });

  it('múltiplos ambientes → issues de todos coletados', () => {
    const amb1 = makeAmbiente({ id: 'amb-1', nome: 'Sala', sistemas: [makeSistema({ metragemManual: 0, perfil: null })] });
    const amb2 = makeAmbiente({ id: 'amb-2', nome: 'Quarto', sistemas: [makeSistema({ id: 'sis-q', driver: makeDriver({ codigo: '' }) })] });
    const issues = detectarChecklistIssues([amb1, amb2]);
    const names = issues.map(i => i.ambienteNome);
    expect(names).toContain('Sala');
    expect(names).toContain('Quarto');
  });
});
