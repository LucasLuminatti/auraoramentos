import { describe, it, expect } from 'vitest';
import {
  tipoDaLampada,
  ehLampadaAvulsa,
  tipoLampadaDoSpot,
  fachosDoSpot,
  skuJuncaoConnect,
  ehSpotConnectNoFrame,
  prefixosDeBuscaLampada,
  luminariaPrecisaLampada,
  ambienteTemLampada,
} from '@/types/orcamento';
import type { Ambiente, ItemLuminaria } from '@/types/orcamento';

// Descrições REAIS do catálogo (conferidas em 2026-08-12) — o detector é por nome,
// então testar com string inventada não prova nada.
const SPOTS = {
  modularDicroica: 'SYSTEM MOLD 22 MODULO SPOT PARA DICROICA ATE 8W 132MM PT GU10 PARA USO NO PERFIL MODULAR',
  modularPar20: 'SYSTEM MOLD 22 MODULO SPOT PARA PAR20 ATE 8W 132MM PT E27 PARA USO NO PERFIL MODULAR',
  hubMr16: 'SPOT HUB MICRO BORDA RECUADO REDONDO PARA LAMPADA DICROICA MR16, BASE GU10 BRANCO',
  connectMr11: 'SPOT CONNECT NO FRAME QUADRADO PARA LAMPADA MINI DICROICA MR11, BASE GU10 BRANCO',
  connectAr111: 'SPOT CONNECT NO FRAME QUADRADO PARA LAMPADA AR111, BASE GU10 BRANCO - POT 15W',
  hubPar30: 'SPOT HUB MICRO BORDA RECUADO REDONDO PARA LAMPADA PAR30, BASE E27 PRETO',
};

const LAMPADAS = {
  dicroica: 'DICROICA GU10 LED 4,5W 2700K 127V/220V',
  mr11: 'MR11 LED 3,5W 3000K 127-220V IRC 90',
  ar70: 'AR70 LED REFLETORA 7W 2700K BASE GU10 127V/220V 12°',
  ar111: 'AR111 LED 12W 2700K BASE GU10 127/220V REFLETORA 8°',
  par20: 'PAR20 LED IP65 6W 2700K 127V/220VV',
  par30: 'PAR30 CDMR LED 20W 2700K 127/220V',
  vela: 'VELA LED E14+E27 6W 2700K 127/220V',
  balloon: 'BALLOON LED 14W 2700K 127V/220V',
};

describe('tipoDaLampada / ehLampadaAvulsa — identifica a LÂMPADA pelo prefixo do nome', () => {
  it('classifica as lâmpadas de spot do catálogo', () => {
    expect(tipoDaLampada(LAMPADAS.dicroica)).toBe('MR16');
    expect(tipoDaLampada(LAMPADAS.mr11)).toBe('MR11');
    expect(tipoDaLampada(LAMPADAS.ar70)).toBe('AR70');
    expect(tipoDaLampada(LAMPADAS.ar111)).toBe('AR111');
    expect(tipoDaLampada(LAMPADAS.par20)).toBe('PAR20');
    expect(tipoDaLampada(LAMPADAS.par30)).toBe('PAR30');
  });

  it('NÃO confunde o spot com a lâmpada (o spot cita o tipo no meio do nome)', () => {
    for (const d of Object.values(SPOTS)) expect(ehLampadaAvulsa(d)).toBe(false);
  });

  it('lâmpadas que não são de spot (vela, balloon) ficam de fora da oferta', () => {
    expect(tipoDaLampada(LAMPADAS.vela)).toBeNull();
    expect(tipoDaLampada(LAMPADAS.balloon)).toBeNull();
    expect(tipoDaLampada('')).toBeNull();
    expect(tipoDaLampada(null)).toBeNull();
  });
});

describe('tipoLampadaDoSpot — o que o spot pede (RULE-044)', () => {
  it('lê o tipo do nome, inclusive nos módulos do modular', () => {
    expect(tipoLampadaDoSpot(SPOTS.modularDicroica)).toBe('MR16');
    expect(tipoLampadaDoSpot(SPOTS.modularPar20)).toBe('PAR20');
    expect(tipoLampadaDoSpot(SPOTS.hubMr16)).toBe('MR16');
    expect(tipoLampadaDoSpot(SPOTS.hubPar30)).toBe('PAR30');
  });

  it('mini dicroica MR11 não vira dicroica comum', () => {
    expect(tipoLampadaDoSpot(SPOTS.connectMr11)).toBe('MR11');
  });

  it('não oferta para a própria lâmpada nem para luminária com LED integrado', () => {
    expect(tipoLampadaDoSpot(LAMPADAS.dicroica)).toBeNull();
    expect(tipoLampadaDoSpot('PLAFON REDONDO COM LED INTEGRADO 18W GU10')).toBeNull();
    expect(tipoLampadaDoSpot('PERFIL DE EMBUTIR 2M BRANCO')).toBeNull();
  });
});

describe('fachosDoSpot — multiplicador de lâmpadas (RULE-111)', () => {
  it('spot simples = 1', () => {
    expect(fachosDoSpot(SPOTS.hubMr16)).toBe(1);
    expect(fachosDoSpot('')).toBe(1);
  });

  it('duplo/triplo/quádruplo multiplicam', () => {
    expect(fachosDoSpot('SPOT DUPLO PARA DICROICA')).toBe(2);
    expect(fachosDoSpot('SPOT TRIPLO PARA DICROICA')).toBe(3);
    expect(fachosDoSpot('SPOT QUADRUPLO PARA DICROICA')).toBe(4);
    expect(fachosDoSpot('SPOT QUADUPLO PARA DICROICA')).toBe(4); // grafia do catálogo
  });

  it('"N FOCOS" também conta', () => {
    expect(fachosDoSpot('LUMINARIA 2 FOCOS PAR20')).toBe(2);
    expect(fachosDoSpot('LUMINARIA 3 FOCOS AR70')).toBe(3);
  });
});

describe('acessório de junção do SPOT CONNECT (RULE-112)', () => {
  it('LM2657 cobre MR11/MR16/AR70/PAR20; LM2658 cobre AR111/PAR30', () => {
    expect(skuJuncaoConnect('MR11')).toBe('LM2657');
    expect(skuJuncaoConnect('MR16')).toBe('LM2657');
    expect(skuJuncaoConnect('AR70')).toBe('LM2657');
    expect(skuJuncaoConnect('PAR20')).toBe('LM2657');
    expect(skuJuncaoConnect('AR111')).toBe('LM2658');
    expect(skuJuncaoConnect('PAR30')).toBe('LM2658');
    expect(skuJuncaoConnect(null)).toBeNull();
  });

  it('só a linha CONNECT NO FRAME tem junção por tipo', () => {
    expect(ehSpotConnectNoFrame(SPOTS.connectAr111)).toBe(true);
    expect(ehSpotConnectNoFrame(SPOTS.hubMr16)).toBe(false);
  });
});

describe('prefixosDeBuscaLampada — filtro enviado ao catálogo', () => {
  it('dicroica busca por DICROICA e MR16', () => {
    expect(prefixosDeBuscaLampada('MR16')).toEqual(['DICROICA%', 'MR16%', 'MR-16%']);
  });
  it('mini dicroica busca MR11 e "MINI DICROICA"', () => {
    expect(prefixosDeBuscaLampada('MR11')).toContain('MINI DICROICA%');
  });
});

describe('checklist de lâmpada (RULE-046)', () => {
  const item = (descricao: string, extra: Partial<ItemLuminaria> = {}): ItemLuminaria => ({
    id: descricao, codigo: 'X', descricao, quantidade: 1, precoUnitario: 10, precoMinimo: 8, ...extra,
  });

  it('a própria lâmpada não é acusada de "precisa de lâmpada"', () => {
    expect(luminariaPrecisaLampada(LAMPADAS.dicroica)).toBe(false);
    expect(luminariaPrecisaLampada(LAMPADAS.ar111)).toBe(false);
  });

  it('spot sem LED integrado continua sendo acusado', () => {
    expect(luminariaPrecisaLampada(SPOTS.hubMr16)).toBe(true);
  });

  it('ambiente com a dicroica cadastrada conta como "tem lâmpada"', () => {
    const amb: Ambiente = {
      id: 'a', nome: 'Sala',
      luminarias: [item(SPOTS.hubMr16), item(LAMPADAS.dicroica)],
      sistemas: [],
    };
    expect(ambienteTemLampada(amb)).toBe(true);
  });

  it('lâmpada dentro da composição de um modular também conta', () => {
    const amb: Ambiente = {
      id: 'a', nome: 'Sala',
      luminarias: [item(SPOTS.modularDicroica, {
        composicao: [{
          id: 'l', codigo: 'LM040', descricao: LAMPADAS.dicroica, quantidade: 1,
          precoUnitario: 10, precoMinimo: 8, papel: 'lampada', obrigatorio: false,
        }],
      })],
      sistemas: [],
    };
    expect(ambienteTemLampada(amb)).toBe(true);
  });

  it('ambiente só com o spot NÃO conta', () => {
    const amb: Ambiente = { id: 'a', nome: 'Sala', luminarias: [item(SPOTS.hubMr16)], sistemas: [] };
    expect(ambienteTemLampada(amb)).toBe(false);
  });
});
