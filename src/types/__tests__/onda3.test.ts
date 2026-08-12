import { describe, it, expect } from 'vitest';
import {
  larguraCanalDeclarada,
  avisoConferirPassadas,
  calcularSubtotalAcessoriosSistema,
  calcularSubtotalSistemaSemFita,
  clonarSistema,
} from '@/types/orcamento';
import type { SistemaIluminacao, ItemComposicao, ItemPerfil } from '@/types/orcamento';
import { gerarOrcamentoHtmlV3 } from '@/lib/pdfTemplates/v3';
import { gerarOrcamentoHtmlV2 } from '@/lib/pdfTemplates/v2';

// Descrições reais do catálogo (2026-08-12)
const PERFIS = {
  fino12: 'PERFIL DE SOBREPOR FINO PARA FITAS DE LED COM LARGURA ATÉ 12MM, TAMANHO: 2M',
  largo30: 'PERFIL DE SOBREPOR LARGO PARA FITAS DE LED COM LARGURA ATÉ 30MM, TAMANHO: 3M',
  interno30: 'PERFIL DE SOBREPOR LARGO, INTERNO ATE 30MM, TAM: 3M (ACRILICO)',
  sanca37: 'PERFIL DE SOBREPOR SANCA LARG: 37MM ALT: 42MM BC/BC TAM: 1M',
  cantoneira10: 'PERFIL DE SOBREPOR, CANTONEIRA,  PARA FITAS DE LED COM LARGURA ATÉ 10MM',
  semMedida: 'PERFIL DE EMBUTIR NO FRAME BRANCO',
};

const perfil = (descricao: string, extra: Partial<ItemPerfil> = {}): ItemPerfil => ({
  id: 'p', codigo: 'LM1', descricao, comprimentoPeca: 1, quantidade: 1, passadas: 1,
  precoUnitario: 100, precoMinimo: 80, ...extra,
});

describe('larguraCanalDeclarada — lê a largura de fita do nome do perfil', () => {
  it('pega a largura do canal nas duas grafias do catálogo', () => {
    expect(larguraCanalDeclarada(PERFIS.fino12)).toBe(12);
    expect(larguraCanalDeclarada(PERFIS.largo30)).toBe(30);
    expect(larguraCanalDeclarada(PERFIS.interno30)).toBe(30);
    expect(larguraCanalDeclarada(PERFIS.cantoneira10)).toBe(10);
  });

  it('IGNORA a largura externa do perfil — "LARG: 37MM" é a caixa, não o canal', () => {
    expect(larguraCanalDeclarada(PERFIS.sanca37)).toBeNull();
  });

  it('sem medida no nome → null', () => {
    expect(larguraCanalDeclarada(PERFIS.semMedida)).toBeNull();
    expect(larguraCanalDeclarada('')).toBeNull();
  });
});

describe('avisoConferirPassadas (RULE-009/105) — só avisa, nunca muda o preço', () => {
  it('avisa em perfil de canal largo sem família cadastrada e com 1 passada', () => {
    expect(avisoConferirPassadas(perfil(PERFIS.largo30))).toContain('30mm');
  });

  it('avisa na sanca com o texto da RULE-105 (1 ou 2, a critério do projeto)', () => {
    expect(avisoConferirPassadas(perfil(PERFIS.sanca37))).toContain('1 ou 2 passadas');
  });

  it('não avisa quando o catálogo tem a regra da família', () => {
    expect(avisoConferirPassadas(perfil(PERFIS.largo30, { familia_perfil: 'light_30' }))).toBeNull();
  });

  it('não avisa em perfil estreito (1 passada é o certo)', () => {
    expect(avisoConferirPassadas(perfil(PERFIS.fino12))).toBeNull();
    expect(avisoConferirPassadas(perfil(PERFIS.cantoneira10))).toBeNull();
  });

  it('não insiste depois de o vendedor ajustar as passadas', () => {
    expect(avisoConferirPassadas(perfil(PERFIS.largo30, { passadas: 2 }))).toBeNull();
  });

  it('perfil vazio / ausente não gera aviso', () => {
    expect(avisoConferirPassadas(null)).toBeNull();
    expect(avisoConferirPassadas(perfil(PERFIS.largo30, { codigo: '' }))).toBeNull();
  });
});

describe('peças avulsas do sistema (RULE-106)', () => {
  const acessorio = (id: string, preco: number, qtd = 1): ItemComposicao => ({
    id, codigo: 'LM9', descricao: 'TAMPA CEGA 1M', quantidade: qtd,
    precoUnitario: preco, precoMinimo: preco - 5, papel: 'acessorio_opcional', obrigatorio: false,
  });

  const sistema = (acessorios?: ItemComposicao[]): SistemaIluminacao => ({
    id: 's',
    perfil: perfil(PERFIS.largo30, { precoUnitario: 100, quantidade: 2 }),
    fita: { id: 'f', codigo: 'F1', descricao: 'FITA', wm: 10, voltagem: 24, metragemRolo: 5, precoUnitario: 50, precoMinimo: 40 },
    driver: { id: 'd', codigo: '', descricao: '', potencia: 0, voltagem: 24, precoUnitario: 0, precoMinimo: 0 },
    metragemManual: null, passadasManual: 1, local: null,
    acessorios,
  });

  it('soma quantidade × preço', () => {
    expect(calcularSubtotalAcessoriosSistema(sistema([acessorio('a', 20, 3)]))).toBe(60);
  });

  it('sistema sem o campo continua valendo (snapshot antigo)', () => {
    expect(calcularSubtotalAcessoriosSistema(sistema(undefined))).toBe(0);
  });

  it('entra no subtotal do sistema', () => {
    const semPecas = calcularSubtotalSistemaSemFita(sistema(undefined));
    const comPecas = calcularSubtotalSistemaSemFita(sistema([acessorio('a', 20, 3)]));
    expect(comPecas - semPecas).toBe(60);
  });

  it('quantidade negativa não vira desconto', () => {
    expect(calcularSubtotalAcessoriosSistema(sistema([acessorio('a', 20, -5)]))).toBe(0);
  });

  it('duplicar o sistema leva as peças com ids próprios', () => {
    const original = sistema([acessorio('a', 20, 2)]);
    const copia = clonarSistema(original);
    expect(copia.acessorios).toHaveLength(1);
    expect(copia.acessorios![0].id).not.toBe('a');
    expect(copia.acessorios![0].codigo).toBe('LM9');
  });
});

// ─── RULE-106 no PDF: o que é cobrado precisa aparecer ───

describe('peças avulsas nos templates de PDF (RULE-106 × RULE-067)', () => {
  const ambienteComPeca = () => {
    const sis: SistemaIluminacao = {
      id: 's1',
      perfil: perfil(PERFIS.largo30, { codigo: 'LM1110', precoUnitario: 100, quantidade: 1 }),
      fita: { id: 'f', codigo: 'LM3827', descricao: 'FITA BABY', wm: 7, voltagem: 12, metragemRolo: 5, precoUnitario: 50, precoMinimo: 40 },
      driver: { id: 'd', codigo: 'LM1116', descricao: 'DRIVER SLIM 18W', potencia: 18, voltagem: 12, precoUnitario: 42, precoMinimo: 35 },
      metragemManual: null, passadasManual: 1, local: null,
      acessorios: [{
        id: 'ac1', codigo: 'LM2561', descricao: 'TAMPA CEGA COM FURO 0,133M BRANCO',
        quantidade: 2, precoUnitario: 16.67, precoMinimo: 13, papel: 'acessorio_opcional', obrigatorio: false,
      }],
    };
    return [{ id: 'a1', nome: 'Sala', luminarias: [], sistemas: [sis] }];
  };

  const params = () => ({
    clienteNome: 'Cliente', projetoNome: 'Projeto', colaborador: 'Eu',
    tipo: 'Primeiro Orçamento', ambientes: ambienteComPeca(), logoBase64: '',
  });

  it('v3 mostra o código e o subtotal da peça', () => {
    const html = gerarOrcamentoHtmlV3(params() as never);
    expect(html).toContain('LM2561');
    expect(html).toContain('33,34'); // 2 × 16,67
  });

  it('v2 também mostra (orçamentos antigos reabertos usam o v2)', () => {
    const html = gerarOrcamentoHtmlV2(params() as never);
    expect(html).toContain('LM2561');
  });

  it('sistema SÓ com peça avulsa não some do PDF', () => {
    const soPeca: SistemaIluminacao = {
      id: 's2', perfil: null,
      fita: { id: 'f', codigo: '', descricao: '', wm: 0, voltagem: 24, metragemRolo: 5, precoUnitario: 0, precoMinimo: 0 },
      driver: { id: 'd', codigo: '', descricao: '', potencia: 0, voltagem: 24, precoUnitario: 0, precoMinimo: 0 },
      metragemManual: null, passadasManual: 1, local: null,
      acessorios: [{
        id: 'ac2', codigo: 'LM9999', descricao: 'SUPORTE', quantidade: 1,
        precoUnitario: 10, precoMinimo: 8, papel: 'acessorio_opcional', obrigatorio: false,
      }],
    };
    const html = gerarOrcamentoHtmlV3({
      ...params(), ambientes: [{ id: 'a2', nome: 'Copa', luminarias: [], sistemas: [soPeca] }],
    } as never);
    expect(html).toContain('LM9999');
  });
});
