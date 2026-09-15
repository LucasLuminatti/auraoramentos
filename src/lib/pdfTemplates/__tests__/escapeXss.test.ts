/**
 * Auditoria de segurança 2026-09-15 — XSS armazenado no PDF.
 *
 * O HTML dos templates vai para `container.innerHTML` dentro da própria app (Step3Revisao e
 * OrcamentoDetalhe → "Re-emitir PDF"). O snapshot `ambientes` é JSON gravado pelo cliente, então
 * qualquer campo — inclusive os "numéricos" — pode chegar com HTML. Um orçamento com
 * `<img src=x onerror=...>` no nome do cliente executava script no navegador de quem abrisse.
 */
import { describe, it, expect } from 'vitest';
import { gerarOrcamentoHtmlV1 } from '../v1';
import { gerarOrcamentoHtmlV2 } from '../v2';
import { gerarOrcamentoHtmlV3 } from '../v3';
import type { Ambiente } from '@/types/orcamento';

const XSS = '<img src=x onerror=alert(1)>';
const XSS_ESCAPADO = '&lt;img src=x onerror=alert(1)&gt;';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const malicioso = (): Ambiente => ({
  id: 'amb-xss',
  nome: XSS,
  luminarias: [
    {
      id: 'lum-1',
      codigo: `LM1${XSS}`,
      descricao: XSS,
      quantidade: XSS,
      precoUnitario: 10,
      precoMinimo: 5,
      potencia_watts: XSS,
      tensao: XSS,
      imagemUrl: `javascript:alert(1)" onerror="alert(2)`,
    },
    {
      id: 'lum-2',
      codigo: 'LM2300',
      descricao: 'TRILHO SYSTEM MOLD 1m',
      quantidade: 1,
      precoUnitario: 350,
      precoMinimo: 280,
      sistema: 's_mode',
      composicao: [
        { id: 'c1', codigo: 'LM2310', descricao: XSS, quantidade: XSS, precoUnitario: 10, precoMinimo: 5, obrigatorio: true, papel: 'modulo' },
      ],
    },
  ],
  sistemas: [
    {
      id: 'sis-1',
      fita: { id: 'f', codigo: 'LM2029', descricao: XSS, wm: XSS, voltagem: XSS, metragemRolo: 5, precoUnitario: 50, precoMinimo: 40 },
      driver: { id: 'd', codigo: 'LM1463', descricao: XSS, potencia: XSS, voltagem: XSS, precoUnitario: 50, precoMinimo: 40 },
      perfil: { id: 'p', codigo: 'LM1997', descricao: XSS, comprimentoPeca: XSS, quantidade: XSS, passadas: XSS, precoUnitario: 80, precoMinimo: 60 },
    },
  ],
} as unknown as Ambiente);

const PARAMS = {
  clienteNome: XSS,
  projetoNome: XSS,
  colaborador: XSS,
  tipo: XSS,
};

function semHtmlInjetado(html: string) {
  expect(html).not.toContain(XSS);
  expect(html).not.toContain('onerror="alert(2)');
  expect(html).not.toContain('src="javascript:');
  expect(html).toContain(XSS_ESCAPADO);
}

describe('templates de PDF escapam todo dado do snapshot (XSS armazenado)', () => {
  it('v1 (legado, usado quando pdf_template_version é nulo)', () => {
    semHtmlInjetado(gerarOrcamentoHtmlV1({ ...PARAMS, ambientes: [malicioso()] }));
  });

  it('v2', () => {
    semHtmlInjetado(gerarOrcamentoHtmlV2({ ...PARAMS, ambientes: [malicioso()], atributosMap: {} }));
  });

  it('v3', () => {
    semHtmlInjetado(gerarOrcamentoHtmlV3({ ...PARAMS, ambientes: [malicioso()], atributosMap: {} }));
  });

  // Revisão do diff (2026-09-15): `formatarMoeda` chamava `valor.toLocaleString()`, e em texto
  // isso devolve o próprio texto — preço vindo como string passava cru para o HTML.
  it('preço em texto com HTML não vaza por formatarMoeda (v1, v2, v3)', () => {
    const comPrecoMalicioso = (): Ambiente => {
      const amb = malicioso() as unknown as {
        luminarias: Array<{ precoUnitario: unknown; composicao?: Array<{ precoUnitario: unknown }> }>;
        sistemas: Array<{ fita: { precoUnitario: unknown }; driver: { precoUnitario: unknown }; perfil: { precoUnitario: unknown } }>;
      };
      for (const l of amb.luminarias) {
        l.precoUnitario = XSS;
        for (const c of l.composicao ?? []) c.precoUnitario = XSS;
      }
      for (const s of amb.sistemas) {
        s.fita.precoUnitario = XSS;
        s.driver.precoUnitario = XSS;
        s.perfil.precoUnitario = XSS;
      }
      return amb as unknown as Ambiente;
    };
    for (const html of [
      gerarOrcamentoHtmlV1({ ...PARAMS, clienteNome: 'C', projetoNome: 'P', ambientes: [comPrecoMalicioso()] }),
      gerarOrcamentoHtmlV2({ ...PARAMS, clienteNome: 'C', projetoNome: 'P', ambientes: [comPrecoMalicioso()], atributosMap: {} }),
      gerarOrcamentoHtmlV3({ ...PARAMS, clienteNome: 'C', projetoNome: 'P', ambientes: [comPrecoMalicioso()], atributosMap: {} }),
    ]) {
      expect(html).not.toContain(XSS);
    }
  });

  it('texto legítimo com & e aspas continua legível (só muda a forma no HTML)', () => {
    const html = gerarOrcamentoHtmlV3({
      ...PARAMS,
      clienteNome: 'Casa & Jardim "Premium"',
      ambientes: [],
      atributosMap: {},
    });
    expect(html).toContain('Casa &amp; Jardim &quot;Premium&quot;');
  });
});
