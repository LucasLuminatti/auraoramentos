import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  salvarRascunho,
  lerRascunho,
  limparRascunho,
  rascunhoTemConteudo,
  descreverIdade,
  resumirRascunho,
  type RascunhoWizard,
} from '@/lib/rascunhoLocal';
import type { Ambiente } from '@/types/orcamento';

const ambiente = (nome: string, itens = 0): Ambiente => ({
  id: `amb-${nome}`,
  nome,
  luminarias: Array.from({ length: itens }, (_, i) => ({
    id: `l${i}`, codigo: 'LM1', descricao: 'Spot', quantidade: 1, precoUnitario: 10, precoMinimo: 8,
  })),
  sistemas: [],
});

const base = (ambientes: Ambiente[] = [ambiente('Sala', 2)]) => ({
  step: 3,
  dados: { colaborador: 'Lenny', tipo: 'Primeiro Orçamento' as const },
  ambientes,
  categorias: [],
  clienteId: 'c1',
  clienteNome: 'Ablim',
  projetoId: 'p1',
  projetoNome: 'ttb',
  orcamentoId: null,
});

describe('rascunho local do wizard (BUG-22)', () => {
  beforeEach(() => localStorage.clear());

  it('salva e devolve o estado do wizard', () => {
    salvarRascunho('user-1', base());
    const lido = lerRascunho('user-1');
    expect(lido?.clienteNome).toBe('Ablim');
    expect(lido?.step).toBe(3);
    expect(lido?.ambientes).toHaveLength(1);
  });

  it('não oferece o rascunho de outro usuário na mesma máquina', () => {
    salvarRascunho('user-1', base());
    expect(lerRascunho('user-2')).toBeNull();
  });

  it('wizard vazio não vira rascunho', () => {
    salvarRascunho('user-1', base([]));
    expect(lerRascunho('user-1')).toBeNull();
  });

  it('salvar vazio depois de ter conteúdo limpa o que estava lá', () => {
    salvarRascunho('user-1', base());
    salvarRascunho('user-1', base([]));
    expect(lerRascunho('user-1')).toBeNull();
  });

  it('limparRascunho apaga', () => {
    salvarRascunho('user-1', base());
    limparRascunho('user-1');
    expect(lerRascunho('user-1')).toBeNull();
  });

  it('rascunho com mais de 48h é descartado (preço defasado não volta)', () => {
    salvarRascunho('user-1', base());
    const bruto = JSON.parse(localStorage.getItem('aura:rascunho-wizard:user-1')!) as RascunhoWizard;
    bruto.salvoEm = Date.now() - 49 * 60 * 60 * 1000;
    localStorage.setItem('aura:rascunho-wizard:user-1', JSON.stringify(bruto));
    expect(lerRascunho('user-1')).toBeNull();
  });

  it('conteúdo corrompido não quebra a página', () => {
    localStorage.setItem('aura:rascunho-wizard:user-1', '{isso não é json');
    expect(lerRascunho('user-1')).toBeNull();
  });

  it('localStorage indisponível não propaga erro', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() => salvarRascunho('user-1', base())).not.toThrow();
    spy.mockRestore();
  });

  it('categorias sozinhas já contam como conteúdo', () => {
    expect(rascunhoTemConteudo({
      ambientes: [],
      categorias: [{ id: 'c', nome: 'Sanca quente', fita: { id: 'f', codigo: 'X', descricao: 'F', wm: 1, voltagem: 24, metragemRolo: 5, precoUnitario: 1, precoMinimo: 1 } }],
      dados: { colaborador: '', tipo: '' },
    })).toBe(true);
  });
});

describe('textos do banner de restauração', () => {
  const agora = 1_000_000_000_000;

  it('descreve a idade em português', () => {
    expect(descreverIdade(agora - 30_000, agora)).toBe('agora há pouco');
    expect(descreverIdade(agora - 5 * 60_000, agora)).toBe('há 5 minutos');
    expect(descreverIdade(agora - 60 * 60_000, agora)).toBe('há 1 hora');
    expect(descreverIdade(agora - 26 * 60 * 60_000, agora)).toBe('há 1 dia');
  });

  it('resume ambientes e itens com plural correto', () => {
    const r = { ...base([ambiente('Sala', 2), ambiente('Copa', 1)]), salvoEm: agora } as RascunhoWizard;
    expect(resumirRascunho(r)).toBe('2 ambientes · 3 itens');
    const um = { ...base([ambiente('Sala', 1)]), salvoEm: agora } as RascunhoWizard;
    expect(resumirRascunho(um)).toBe('1 ambiente · 1 item');
  });
});
