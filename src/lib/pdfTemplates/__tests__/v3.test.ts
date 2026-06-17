/**
 * Testes do template v3 — PDF com sistemas compostos.
 * Phase 22 / PDF-03.
 *
 * Cobre:
 *  - Teste 1: bloco composto renderiza rótulo SYSTEM MOLD + SKU do trilho + SKUs dos componentes + subtotal
 *  - Teste 2: mapa de rótulos (magneto_48v → MAGNETO 48V, tiny_magneto → TINY 24V)
 *  - Teste 3: resumo do sistema (carga W + metragem de fita)
 *  - Teste 4: escape de HTML (T-22-01 — XSS via descricao com <script>)
 *  - Teste 5: GUARD v2 inalterado — fita_modular em composicao[] NÃO aparece no RESUMO DE FITAS do v2 (D-04)
 *  - Teste 6: gerarOrcamentoHtmlV3 é exportado e produz HTML distinto do v2 para ambiente com composto
 */

import { describe, it, expect } from 'vitest';
import { gerarOrcamentoHtmlV3 } from '../v3';
import { gerarOrcamentoHtmlV2 } from '../v2';
import type { Ambiente, ItemLuminaria, ItemComposicao } from '@/types/orcamento';
import { calcularCargaComposicao, calcularMetragemModulosDifusos } from '@/types/orcamento';

/* ──────────────────────────────────────────────────────────────
   Fixtures
   ────────────────────────────────────────────────────────────── */

function makeComp(overrides: Partial<ItemComposicao> & Pick<ItemComposicao, 'papel'>): ItemComposicao {
  return {
    id: `c-${Math.random()}`,
    codigo: 'LM0001',
    descricao: 'Módulo Difuso 132mm',
    quantidade: 1,
    precoUnitario: 150,
    precoMinimo: 120,
    obrigatorio: true,
    ...overrides,
  };
}

function makeAncora(overrides?: Partial<ItemLuminaria>): ItemLuminaria {
  return {
    id: 'lum-anchor',
    codigo: 'LM2300',
    descricao: 'TRILHO SYSTEM MOLD 1m',
    quantidade: 1,
    precoUnitario: 350,
    precoMinimo: 280,
    sistema: 's_mode',
    composicao: [
      makeComp({ papel: 'modulo', codigo: 'LM2310', descricao: 'Módulo Difuso 400mm', quantidade: 2, comprimento: 0.4, potenciaW: 6 }),
      makeComp({ papel: 'fita_modular', codigo: 'LM2320', descricao: 'Fita Modular 24V 10W/m', quantidade: 1, comprimento: 0.8 }),
      makeComp({ papel: 'driver_recomendado', codigo: 'LM2343', descricao: 'Driver 100W 48V', quantidade: 1, precoUnitario: 200 }),
    ],
    ...overrides,
  };
}

function makeAmbienteComComposto(ancora?: Partial<ItemLuminaria>): Ambiente {
  return {
    id: 'amb-1',
    nome: 'Sala',
    luminarias: [makeAncora(ancora)],
    sistemas: [],
  };
}

const BASE_PARAMS = {
  clienteNome: 'Cliente Teste',
  projetoNome: 'Projeto Demo',
  colaborador: 'João',
  tipo: 'Primeiro Orçamento',
  atributosMap: {},
};

/* ──────────────────────────────────────────────────────────────
   Teste 1: bloco composto renderiza elementos obrigatórios (SYSTEM MOLD)
   ────────────────────────────────────────────────────────────── */

describe('gerarOrcamentoHtmlV3 — bloco composto (SYSTEM MOLD)', () => {
  it('contém "Sistema Composto 1 — SYSTEM MOLD"', () => {
    const html = gerarOrcamentoHtmlV3({
      ...BASE_PARAMS,
      ambientes: [makeAmbienteComComposto()],
    });
    expect(html).toContain('Sistema Composto 1 — SYSTEM MOLD');
  });

  it('contém o SKU do trilho âncora (RV + codigo)', () => {
    const html = gerarOrcamentoHtmlV3({
      ...BASE_PARAMS,
      ambientes: [makeAmbienteComComposto()],
    });
    expect(html).toContain('RVLM2300');
  });

  it('contém os SKUs dos componentes (módulo, fita, driver)', () => {
    const html = gerarOrcamentoHtmlV3({
      ...BASE_PARAMS,
      ambientes: [makeAmbienteComComposto()],
    });
    expect(html).toContain('RVLM2310'); // módulo
    expect(html).toContain('RVLM2320'); // fita modular
    expect(html).toContain('RVLM2343'); // driver
  });

  it('contém "Subtotal do sistema"', () => {
    const html = gerarOrcamentoHtmlV3({
      ...BASE_PARAMS,
      ambientes: [makeAmbienteComComposto()],
    });
    expect(html).toContain('Subtotal do sistema');
  });
});

/* ──────────────────────────────────────────────────────────────
   Teste 2: mapa de rótulos de tipo
   ────────────────────────────────────────────────────────────── */

describe('gerarOrcamentoHtmlV3 — rótulos de tipo (D-01)', () => {
  it('sistema magneto_48v → MAGNETO 48V', () => {
    const html = gerarOrcamentoHtmlV3({
      ...BASE_PARAMS,
      ambientes: [makeAmbienteComComposto({ sistema: 'magneto_48v', descricao: 'TRILHO MAGNETO 48V' })],
    });
    expect(html).toContain('MAGNETO 48V');
  });

  it('sistema tiny_magneto → TINY 24V', () => {
    const html = gerarOrcamentoHtmlV3({
      ...BASE_PARAMS,
      ambientes: [makeAmbienteComComposto({ sistema: 'tiny_magneto', descricao: 'TRILHO TINY 24V' })],
    });
    expect(html).toContain('TINY 24V');
  });

  it('sistema s_mode → SYSTEM MOLD', () => {
    const html = gerarOrcamentoHtmlV3({
      ...BASE_PARAMS,
      ambientes: [makeAmbienteComComposto({ sistema: 's_mode' })],
    });
    expect(html).toContain('SYSTEM MOLD');
  });

  it('sistema null → SISTEMA COMPOSTO (fallback)', () => {
    const html = gerarOrcamentoHtmlV3({
      ...BASE_PARAMS,
      ambientes: [makeAmbienteComComposto({ sistema: null })],
    });
    expect(html).toContain('SISTEMA COMPOSTO');
  });
});

/* ──────────────────────────────────────────────────────────────
   Teste 3: resumo do sistema (carga W + metragem de fita)
   ────────────────────────────────────────────────────────────── */

describe('gerarOrcamentoHtmlV3 — resumo de sistema (D-03)', () => {
  it('exibe carga total em Watts quando > 0', () => {
    const ancora = makeAncora();
    const cargaW = calcularCargaComposicao(ancora.composicao);
    // modulo: 6W × 2 = 12W
    expect(cargaW).toBe(12);

    const html = gerarOrcamentoHtmlV3({
      ...BASE_PARAMS,
      ambientes: [{ id: 'amb-1', nome: 'Sala', luminarias: [ancora], sistemas: [] }],
    });
    expect(html).toContain('12W total');
  });

  it('exibe metragem de fita derivada quando > 0 (SYSTEM MOLD)', () => {
    const ancora = makeAncora();
    const metragem = calcularMetragemModulosDifusos(ancora.composicao);
    // modulo: 0.4m × 2 = 0.8m
    expect(metragem).toBe(0.8);

    const html = gerarOrcamentoHtmlV3({
      ...BASE_PARAMS,
      ambientes: [{ id: 'amb-1', nome: 'Sala', luminarias: [ancora], sistemas: [] }],
    });
    expect(html).toContain('fita 0,8m');
  });

  it('NÃO exibe resumo de fita quando metragem = 0 (sistema magnético sem comprimento)', () => {
    const ancora = makeAncora({
      sistema: 'magneto_48v',
      composicao: [
        makeComp({ papel: 'modulo', codigo: 'LM2400', quantidade: 3, potenciaW: 8 }), // sem comprimento
      ],
    });
    const html = gerarOrcamentoHtmlV3({
      ...BASE_PARAMS,
      ambientes: [{ id: 'amb-1', nome: 'Sala', luminarias: [ancora], sistemas: [] }],
    });
    // deve ter "W total" mas não "fita"
    expect(html).toContain('W total');
    expect(html).not.toContain('fita 0m');
  });
});

/* ──────────────────────────────────────────────────────────────
   Teste 4: escape de HTML — T-22-01 (XSS via descricao)
   ────────────────────────────────────────────────────────────── */

describe('gerarOrcamentoHtmlV3 — escape de HTML (T-22-01)', () => {
  it('escapa <script> na descricao da luminária âncora', () => {
    const html = gerarOrcamentoHtmlV3({
      ...BASE_PARAMS,
      ambientes: [makeAmbienteComComposto({ descricao: 'Trilho <script>alert("xss")</script> & cia' })],
    });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&amp;');
  });

  it('escapa <script> na descricao de um componente da composicao', () => {
    const ancora = makeAncora({
      composicao: [
        makeComp({ papel: 'modulo', codigo: 'LM0001', descricao: '<img src=x onerror=alert(1)>', quantidade: 1 }),
      ],
    });
    const html = gerarOrcamentoHtmlV3({
      ...BASE_PARAMS,
      ambientes: [{ id: 'amb-1', nome: 'Sala', luminarias: [ancora], sistemas: [] }],
    });
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img');
  });

  it('escapa caracteres especiais no clienteNome e projetoNome', () => {
    const html = gerarOrcamentoHtmlV3({
      ...BASE_PARAMS,
      clienteNome: 'João <b>Injeção</b> & CIA',
      projetoNome: 'Projeto "XSS"',
      ambientes: [makeAmbienteComComposto()],
    });
    expect(html).not.toContain('<b>Injeção</b>');
    expect(html).toContain('&lt;b&gt;');
    expect(html).toContain('&amp;');
    expect(html).toContain('&quot;');
  });
});

/* ──────────────────────────────────────────────────────────────
   Teste 5: GUARD v2 inalterado — fita modular NÃO entra no RESUMO DE FITAS (D-04)
   ────────────────────────────────────────────────────────────── */

describe('gerarOrcamentoHtmlV2 — GUARD D-04 (fita_modular não aparece no RESUMO DE FITAS)', () => {
  it('v2 NÃO gera RESUMO DE FITAS quando só há fita_modular em composicao[] e nenhum sistemas[].fita', () => {
    // Ambiente com composto que tem fita_modular, MAS sem sistemas[].fita
    const ancora: ItemLuminaria = {
      id: 'lum-1',
      codigo: 'LM2300',
      descricao: 'TRILHO SYSTEM MOLD',
      quantidade: 1,
      precoUnitario: 350,
      precoMinimo: 280,
      sistema: 's_mode',
      composicao: [
        makeComp({ papel: 'fita_modular', codigo: 'LM2320', descricao: 'Fita Modular 10W/m', quantidade: 1 }),
      ],
    };
    const amb: Ambiente = { id: 'amb-1', nome: 'Sala', luminarias: [ancora], sistemas: [] };

    const htmlV2 = gerarOrcamentoHtmlV2({ ...BASE_PARAMS, ambientes: [amb] });

    // blocoResumoFitas no v2 itera calcularRolosPorGrupo(ambientes) que depende de sistemas[].fita
    // fita_modular em composicao[] NÃO alimenta calcularRolosPorGrupo → RESUMO DE FITAS não aparece
    expect(htmlV2).not.toContain('RESUMO DE FITAS');
  });

  it('v2 gera RESUMO DE FITAS normalmente quando há sistemas[].fita (Fita Padrão)', () => {
    const sistemaFita = {
      id: 'sis-1',
      fita: { id: 'f-1', codigo: 'LM9000', descricao: 'Fita LED 10W/m', wm: 10, voltagem: 24 as const, metragemRolo: 5 as const, precoUnitario: 100, precoMinimo: 80 },
      driver: { id: 'd-1', codigo: 'LM8000', descricao: 'Driver 100W 24V', potencia: 100, voltagem: 24 as const, precoUnitario: 200, precoMinimo: 160 },
      perfil: null,
      metragemManual: 5,
      passadasManual: 1 as const,
    };
    const amb: Ambiente = { id: 'amb-1', nome: 'Sala', luminarias: [], sistemas: [sistemaFita] };

    const htmlV2 = gerarOrcamentoHtmlV2({ ...BASE_PARAMS, ambientes: [amb] });
    expect(htmlV2).toContain('RESUMO DE FITAS');
  });

  it('v3 também NÃO gera RESUMO DE FITAS quando só há fita_modular em composicao[] (D-04)', () => {
    const ancora: ItemLuminaria = {
      id: 'lum-1',
      codigo: 'LM2300',
      descricao: 'TRILHO SYSTEM MOLD',
      quantidade: 1,
      precoUnitario: 350,
      precoMinimo: 280,
      sistema: 's_mode',
      composicao: [
        makeComp({ papel: 'fita_modular', codigo: 'LM2320', descricao: 'Fita Modular 10W/m', quantidade: 1 }),
      ],
    };
    const amb: Ambiente = { id: 'amb-1', nome: 'Sala', luminarias: [ancora], sistemas: [] };

    const htmlV3 = gerarOrcamentoHtmlV3({ ...BASE_PARAMS, ambientes: [amb] });
    expect(htmlV3).not.toContain('RESUMO DE FITAS');
  });
});

/* ──────────────────────────────────────────────────────────────
   Teste 6: gerarOrcamentoHtmlV3 exportado + HTML distinto do v2 para composto
   ────────────────────────────────────────────────────────────── */

describe('gerarOrcamentoHtmlV3 — distinção v2 vs v3 para ambiente com composto', () => {
  it('é uma função exportada que retorna string HTML', () => {
    const result = gerarOrcamentoHtmlV3({ ...BASE_PARAMS, ambientes: [makeAmbienteComComposto()] });
    expect(typeof result).toBe('string');
    expect(result).toContain('<!DOCTYPE html>');
  });

  it('gera HTML diferente do v2 para o mesmo ambiente com composto', () => {
    const amb = makeAmbienteComComposto();
    const htmlV2 = gerarOrcamentoHtmlV2({ ...BASE_PARAMS, ambientes: [amb] });
    const htmlV3 = gerarOrcamentoHtmlV3({ ...BASE_PARAMS, ambientes: [amb] });

    // v3 tem o bloco composto estruturado
    expect(htmlV3).toContain('Sistema Composto 1');
    expect(htmlV3).toContain('composto-block');

    // v2 não tem o bloco composto (ignora composicao[])
    expect(htmlV2).not.toContain('Sistema Composto');
    expect(htmlV2).not.toContain('composto-block');
  });

  it('múltiplos compostos no mesmo ambiente são numerados 1-based', () => {
    const amb: Ambiente = {
      id: 'amb-1',
      nome: 'Sala',
      luminarias: [
        makeAncora({ id: 'lum-1', codigo: 'LM2300' }),
        makeAncora({ id: 'lum-2', codigo: 'LM2301', descricao: 'TRILHO SYSTEM MOLD 2m' }),
      ],
      sistemas: [],
    };
    const html = gerarOrcamentoHtmlV3({ ...BASE_PARAMS, ambientes: [amb] });
    expect(html).toContain('Sistema Composto 1');
    expect(html).toContain('Sistema Composto 2');
  });
});
