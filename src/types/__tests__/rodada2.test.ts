import { describe, it, expect } from 'vitest';
import {
  passadasPorCanal,
  ehSpotTiny,
  qtdSpotsTiny,
  potenciaSpotsTiny,
  ambienteTemDriver24V,
  potenciaMinimaDriverTiny,
} from '@/types/orcamento';
import type { Ambiente, ItemLuminaria, SistemaIluminacao } from '@/types/orcamento';

// Respostas da 2ª rodada (Paolla/Luis, 2026-09-08):
//  3 — largura de fita não será levantada produto a produto; só a relação com a Baby, em alerta.
//  4 — passadas: "faça calcular sozinho, mas que não fique travado e se necessário a gente edite".
//  6 — linha que exige driver 24V: "São as linhas SPOT TINY, MAG TINY (da página 17 à 25)".

describe('passadasPorCanal (RULE-009) — quantas fitas cabem lado a lado no canal', () => {
  const P = {
    fino12: 'PERFIL DE SOBREPOR FINO PARA FITAS DE LED COM LARGURA ATÉ 12MM, TAMANHO: 2M',
    largo30: 'PERFIL DE SOBREPOR LARGO PARA FITAS DE LED COM LARGURA ATÉ 30MM, TAMANHO: 3M',
    interno35: 'PERFIL DE EMBUTIR, INTERNO ATE 35MM, TAM: 2M',
    largo50: 'PERFIL DE SOBREPOR PARA FITAS DE LED COM LARGURA ATÉ 50MM',
    canal20: 'PERFIL DE SOBREPOR PARA FITAS DE LED COM LARGURA ATÉ 20MM',
    semMedida: 'PERFIL DE EMBUTIR NO FRAME BRANCO',
  };

  it('bate com os três números que a equipe confirmou: 12mm=1, 30mm=2, 50mm=3', () => {
    expect(passadasPorCanal(P.fino12, 1)).toBe(1);
    expect(passadasPorCanal(P.largo30, 1)).toBe(2);
    expect(passadasPorCanal(P.largo50, 1)).toBe(3);
  });

  it('35mm cabe 2 (35 ÷ 12) — é o que o catálogo já traz nesses perfis', () => {
    expect(passadasPorCanal(P.interno35, 1)).toBe(2);
  });

  it('20mm continua com 1 passada — não cabem duas fitas de 12mm', () => {
    expect(passadasPorCanal(P.canal20, 1)).toBe(1);
  });

  it('nunca REDUZ o que o catálogo cadastrou (não baixa preço sozinho)', () => {
    expect(passadasPorCanal(P.canal20, 2)).toBe(2);
    expect(passadasPorCanal(P.fino12, 3)).toBe(3);
  });

  it('teto de 3 passadas mesmo em canal muito largo', () => {
    expect(passadasPorCanal('PERFIL PARA FITAS DE LED COM LARGURA ATÉ 90MM', 1)).toBe(3);
  });

  it('sem medida no nome → mantém o padrão do catálogo', () => {
    expect(passadasPorCanal(P.semMedida, 1)).toBe(1);
    expect(passadasPorCanal(P.semMedida, 2)).toBe(2);
  });

  it('padrão ausente ou inválido cai em 1 (snapshots antigos)', () => {
    expect(passadasPorCanal(P.semMedida, null)).toBe(1);
    expect(passadasPorCanal(P.semMedida, undefined)).toBe(1);
    expect(passadasPorCanal(P.semMedida, 0)).toBe(1);
    expect(passadasPorCanal(P.semMedida, 9)).toBe(3);
  });
});

describe('RULE-108 — linha TINY exige driver 24V externo', () => {
  const lum = (codigo: string, descricao: string, extra: Partial<ItemLuminaria> = {}): ItemLuminaria => ({
    id: codigo, codigo, descricao, quantidade: 1, precoUnitario: 100, precoMinimo: 80, ...extra,
  });
  const amb = (luminarias: ItemLuminaria[], sistemas: SistemaIluminacao[] = []): Ambiente => ({
    id: 'a', nome: 'Sala', luminarias, sistemas,
  });
  const sistemaComDriver = (voltagem: 12 | 24 | 48): SistemaIluminacao => ({
    id: 's', perfil: null,
    fita: { id: 'f', codigo: 'LM1', descricao: 'FITA', wm: 10, voltagem, metragemRolo: 5, precoUnitario: 10, precoMinimo: 8 },
    driver: { id: 'd', codigo: 'LM2', descricao: 'DRIVER 100W', potencia: 100, voltagem, precoUnitario: 200, precoMinimo: 180 },
    metragemManual: 5, passadasManual: 1, local: null,
  });

  // Descrições reais do catálogo (2026-09-08)
  const SPOT_TINY = 'TINY SPOT DE EMBUTIR REDONDO COM HASTE 5W 3000K 24V IRC 90 PT';
  const TINY_MAG = 'TINY MAG SPOT P/ TRILHO MAGNETICO 9W 15° 3000K 24V IRC 90 BC';

  it('reconhece o spot TINY avulso', () => {
    expect(ehSpotTiny(SPOT_TINY)).toBe(true);
    expect(ehSpotTiny('TINY SPOT DE SOBREPOR REDONDO 1W 3000K 24V IRC 90 BC')).toBe(true);
  });

  it('NÃO trata o TINY MAG como spot avulso (ele vira sistema composto)', () => {
    expect(ehSpotTiny(TINY_MAG)).toBe(false);
    expect(ehSpotTiny('TINY MAG TRILHO DE SOBREPOR MAGNETICO PT 1M MAX. 24V')).toBe(false);
    // o catálogo já escreveu a mesma linha com a palavra do outro lado
    expect(ehSpotTiny('TINY MAGNETO SPOT P/ TRILHO 5W 24V')).toBe(false);
  });

  it('conta os spots TINY mesmo sem potência cadastrada', () => {
    const semPotencia = amb([lum('LM3182', SPOT_TINY, { quantidade: 3 })]);
    expect(qtdSpotsTiny(semPotencia)).toBe(3);
    expect(potenciaSpotsTiny(semPotencia)).toBe(0);
  });

  it('driver 48V do composto NÃO conta como driver 24V dos spots TINY', () => {
    const comMagneto48 = amb([
      lum('LM2337', 'TRILHO MAGNETICO DE EMBUTIR 48V 1M', {
        composicao: [
          {
            id: 'c', codigo: 'LM2343', descricao: 'DRIVER 100W 48V P/ TRILHO MAGNETICO', quantidade: 1,
            precoUnitario: 500, precoMinimo: 450, papel: 'driver_recomendado', obrigatorio: true,
          },
        ],
      }),
      lum('LM3182', SPOT_TINY, { potencia_watts: 5 }),
    ]);
    expect(ambienteTemDriver24V(comMagneto48)).toBe(false);
  });

  it('não confunde com produto que só cita TINY no meio do nome', () => {
    expect(ehSpotTiny('SPOT DE EMBUTIR PARA TINY MAG')).toBe(false);
    expect(ehSpotTiny('')).toBe(false);
    expect(ehSpotTiny(null)).toBe(false);
  });

  it('soma a potência dos spots TINY pela quantidade', () => {
    const a = amb([
      lum('LM3182', SPOT_TINY, { potencia_watts: 5, quantidade: 4 }),
      lum('LM3176', 'TINY SPOT DE EMBUTIR REDONDO 1W 3000K 24V IRC 90 PT', { potencia_watts: 1, quantidade: 10 }),
      lum('LM9999', 'SPOT DE EMBUTIR COMUM 7W', { potencia_watts: 7, quantidade: 3 }),
    ]);
    expect(potenciaSpotsTiny(a)).toBe(30);
    expect(potenciaMinimaDriverTiny(a)).toBe(36); // 30W × 1,20 de folga
  });

  it('ambiente sem spot TINY não soma nada', () => {
    expect(potenciaSpotsTiny(amb([lum('LM9999', 'SPOT COMUM 7W', { potencia_watts: 7 })]))).toBe(0);
  });

  it('detecta driver 24V no sistema, avulso ou dentro do composto', () => {
    expect(ambienteTemDriver24V(amb([], [sistemaComDriver(24)]))).toBe(true);
    expect(ambienteTemDriver24V(amb([], [sistemaComDriver(12)]))).toBe(false);
    expect(ambienteTemDriver24V(amb([lum('LM2350', 'DRIVER 100W 24V IP20')]))).toBe(true);
    expect(
      ambienteTemDriver24V(
        amb([
          lum('LM3145', 'TINY MAG TRILHO DE SOBREPOR MAGNETICO PT 1M MAX. 24V', {
            composicao: [
              {
                id: 'c', codigo: 'LM2350', descricao: 'DRIVER 100W 24V', quantidade: 1,
                precoUnitario: 200, precoMinimo: 180, papel: 'driver_recomendado', obrigatorio: true,
              },
            ],
          }),
        ]),
      ),
    ).toBe(true);
  });

  it('ambiente só com spot TINY e nenhum driver 24V fica sem alimentação', () => {
    expect(ambienteTemDriver24V(amb([lum('LM3182', SPOT_TINY, { potencia_watts: 5 })]))).toBe(false);
  });
});
