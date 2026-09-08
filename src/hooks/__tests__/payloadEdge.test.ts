import { describe, it, expect } from 'vitest';
import { sistemaParaPayload } from '@/hooks/useValidarSistemas';
import type { SistemaIluminacao } from '@/types/orcamento';

// O payload é o CONTRATO com a edge `validar-sistema-orcamento`. Campo que falta aqui
// não quebra nada visivelmente — só desliga a validação do lado do servidor, calada.
// Foi exatamente o que aconteceu com `codigo_fita`: a edge usa esse campo para saber se
// já existe fita escolhida (`temFita`), e sem ele as checagens de fita Baby (RULE-103) e
// de fita com IP (RULE-104) nunca disparavam no servidor.

const sistema = (over: Partial<SistemaIluminacao> = {}): SistemaIluminacao => ({
  id: 's1',
  perfil: {
    id: 'p', codigo: 'LM1987', descricao: 'PERFIL DE EMBUTIR RIPADO, LARG: 10,6MM',
    comprimentoPeca: 1, quantidade: 2, passadas: 1, precoUnitario: 35, precoMinimo: 30,
  },
  fita: {
    id: 'f', codigo: 'LM1149', descricao: 'FITA LED 110W 2700K 12V, 22W/M', wm: 22,
    voltagem: 12, metragemRolo: 5, precoUnitario: 136, precoMinimo: 120,
  },
  driver: { id: 'd', codigo: 'LM1474', descricao: 'DRIVER 60W', potencia: 60, voltagem: 12, precoUnitario: 117, precoMinimo: 100 },
  metragemManual: null, passadasManual: 1, local: null,
  ...over,
});

describe('sistemaParaPayload — contrato com a edge', () => {
  it('manda o código da fita (sem ele a edge não valida Baby nem IP)', () => {
    expect(sistemaParaPayload(sistema()).codigo_fita).toBe('LM1149');
  });

  it('manda null quando ainda não há fita escolhida', () => {
    const semFita = sistema({
      fita: { id: 'f', codigo: '', descricao: '', wm: 0, voltagem: 24, metragemRolo: 5, precoUnitario: 0, precoMinimo: 0 },
    });
    const p = sistemaParaPayload(semFita);
    expect(p.codigo_fita).toBeNull();
    // e o subtipo também: "padrao" faria a edge concluir "não é Baby" sem fita nenhuma
    expect(p.subtipo_fita).toBeNull();
  });

  it('leva descrição de perfil e fita, que é como a edge identifica família e Baby', () => {
    const p = sistemaParaPayload(sistema());
    expect(p.descricao_perfil).toMatch(/RIPADO/);
    expect(p.descricao_fita).toMatch(/FITA LED/);
  });

  it('passadas vêm do perfil quando ele existe, e do manual quando não existe', () => {
    expect(sistemaParaPayload(sistema()).passadas).toBe(1);
    expect(sistemaParaPayload(sistema({ perfil: null, passadasManual: 2 })).passadas).toBe(2);
  });
});
