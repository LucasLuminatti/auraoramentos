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

  /** Driver 24V de um sistema SEM fita: capacidade livre para os spots. */
  const sistemaSoDriver24V = (potencia: number): SistemaIluminacao => {
    const s = sistemaComDriver(24);
    return { ...s, fita: { ...s.fita, codigo: '' }, driver: { ...s.driver, potencia } };
  };

  /** Sistema com fita: fita 10 W/m × `metros` e driver 24V de `potencia`. */
  const sistemaComFita = (metros: number, potencia: number): SistemaIluminacao => {
    const s = sistemaComDriver(24);
    return { ...s, metragemManual: metros, driver: { ...s.driver, potencia } };
  };
  const spotsTiny = (qtd: number) => [lum('LM3182', SPOT_TINY, { potencia_watts: 5, quantidade: qtd })];
  const compostoTiny24V = (potenciaDriver: number | undefined, potenciaModulos: number): ItemLuminaria =>
    lum('LM3145', 'TINY MAG TRILHO DE SOBREPOR MAGNETICO PT 1M MAX. 24V', {
      composicao: [
        {
          id: 'm', codigo: 'LM3150', descricao: 'TINY MAG MODULO', quantidade: 1, potenciaW: potenciaModulos,
          precoUnitario: 100, precoMinimo: 90, papel: 'modulo', obrigatorio: false,
        },
        {
          id: 'c', codigo: 'LM2350', descricao: 'DRIVER 24V', quantidade: 1, potenciaW: potenciaDriver,
          precoUnitario: 200, precoMinimo: 180, papel: 'driver_recomendado', obrigatorio: true,
        },
      ],
    });

  it('driver 24V de sistema com fita só oferece a SOBRA aos spots TINY', () => {
    // fita 50 W × 1,20 = 60 W comprometidos num driver de 100 W → sobram 40 W
    expect(ambienteTemDriver24V(amb(spotsTiny(6), [sistemaComFita(5, 100)]))).toBe(true);  // mínimo 36
    expect(ambienteTemDriver24V(amb(spotsTiny(8), [sistemaComFita(5, 100)]))).toBe(false); // mínimo 48
  });

  it('driver 24V totalmente tomado pela fita não alimenta os spots, nem por presença', () => {
    // 50 W × 1,20 = 60 W num driver de 60 W: sobra zero (auditoria 2026-09-15 — antes qualquer
    // driver 24V calava o aviso)
    const semPotencia = [lum('LM3182', SPOT_TINY)];
    expect(ambienteTemDriver24V(amb(semPotencia, [sistemaComFita(5, 60)]))).toBe(false);
  });

  it('carga comprometida desconhecida não libera o driver (fita sem W/m, módulo ?W)', () => {
    const semWm = sistemaComFita(5, 100);
    const fitaSemWm = { ...semWm, fita: { ...semWm.fita, wm: 0 } };
    expect(ambienteTemDriver24V(amb(spotsTiny(6), [fitaSemWm]))).toBe(false);
    const moduloSemPotencia = compostoTiny24V(100, 15);
    moduloSemPotencia.composicao = moduloSemPotencia.composicao!.map((c) =>
      c.papel === 'modulo' ? { ...c, potenciaW: undefined } : c
    );
    expect(ambienteTemDriver24V(amb([...spotsTiny(6), moduloSemPotencia]))).toBe(false);
  });

  it('driver 24V livre precisa cobrir a potência mínima dos spots', () => {
    const spots = spotsTiny(6); // 30W → mínimo 36W
    expect(potenciaMinimaDriverTiny(amb(spots))).toBe(36);
    expect(ambienteTemDriver24V(amb(spots, [sistemaSoDriver24V(20)]))).toBe(false);
    expect(ambienteTemDriver24V(amb(spots, [sistemaSoDriver24V(60)]))).toBe(true);
  });

  it('driver 24V do composto conta só o que sobra dos módulos', () => {
    // 15 W × 1,20 = 18 W dos módulos: 20 W sobra 2 W; 100 W sobra 82 W
    expect(ambienteTemDriver24V(amb([...spotsTiny(6), compostoTiny24V(20, 15)]))).toBe(false);
    expect(ambienteTemDriver24V(amb([...spotsTiny(6), compostoTiny24V(100, 15)]))).toBe(true);
  });

  it('driver sem potência cadastrada vale pela presença, mesmo com spots de potência conhecida', () => {
    expect(ambienteTemDriver24V(amb([], [sistemaComDriver(12)]))).toBe(false);
    // avulso sem potência
    expect(ambienteTemDriver24V(amb([...spotsTiny(6), lum('LM2350', 'DRIVER 100W 24V IP20')]))).toBe(true);
    // do composto, sem potência
    expect(ambienteTemDriver24V(amb([...spotsTiny(6), compostoTiny24V(undefined, 15)]))).toBe(true);
  });

  it('ambiente só com spot TINY e nenhum driver 24V fica sem alimentação', () => {
    expect(ambienteTemDriver24V(amb([lum('LM3182', SPOT_TINY, { potencia_watts: 5 })]))).toBe(false);
  });
});
