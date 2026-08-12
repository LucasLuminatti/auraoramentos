import { describe, it, expect } from 'vitest';
import {
  corDoProduto,
  normalizarCor,
  exigeDriverAlojado,
  classificarDriverSlim,
  ehDriverSlim,
  ehDriverDeTrilho,
  perfilSomenteFitaBaby,
  perfilRejeitaFitaIP,
  fitaEhIP,
  fitaEhBaby,
  LIMITE_W_DRIVER_ALOJADO,
} from '@/types/orcamento';

// WP-F — RULE-029/031/054/055/100/103/104/110

describe('corDoProduto (RULE-054/110)', () => {
  it('reconhece o sufixo PT do código como preto', () => {
    expect(corDoProduto('LM3168PT', '')).toBe('preto');
    expect(corDoProduto('TINIMAG-PT', null)).toBe('preto');
  });
  it('reconhece PT / PRETO na descrição', () => {
    expect(corDoProduto('LM2001', 'TRILHO TINY MAG 2M PT')).toBe('preto');
    expect(corDoProduto('LM2001', 'TRILHO TINY MAG PRETO')).toBe('preto');
    expect(corDoProduto('LM2001', 'MODULO SPOT PRETA')).toBe('preto');
  });
  it('reconhece BC / BR / BRANCO na descrição', () => {
    expect(corDoProduto('LM3169', 'CONECTOR TINY MAG BRANCO')).toBe('branco');
    expect(corDoProduto('LM3169', 'CONECTOR TINY MAG BC')).toBe('branco');
    expect(corDoProduto('LM3169', 'CONECTOR TINY MAG BR')).toBe('branco');
  });
  it('descrição tem precedência sobre o sufixo do código', () => {
    expect(corDoProduto('LM3169BC', 'TRILHO 2M BRANCO')).toBe('branco');
  });
  it('retorna null sem marcador de cor', () => {
    expect(corDoProduto('LM2338', 'CONECTOR DE ENERGIA DIRECIONAL')).toBeNull();
    expect(corDoProduto(undefined, undefined)).toBeNull();
    expect(corDoProduto('', '')).toBeNull();
  });
  it('retorna null quando os marcadores se contradizem (não inventa cor)', () => {
    expect(corDoProduto('LM1000', 'KIT PRETO E BRANCO')).toBeNull();
  });
  it('não confunde PT dentro de outra palavra', () => {
    expect(corDoProduto('LM1000', 'SUPORTE OPTIMA')).toBeNull();
  });
});

describe('normalizarCor', () => {
  it('normaliza o texto livre da coluna cor do catálogo', () => {
    expect(normalizarCor('Preto')).toBe('preto');
    expect(normalizarCor(' BRANCO ')).toBe('branco');
    expect(normalizarCor('Dourado')).toBe('dourado');
    expect(normalizarCor('PT')).toBe('preto');
  });
  it('retorna null para vazio ou desconhecido', () => {
    expect(normalizarCor(null)).toBeNull();
    expect(normalizarCor(undefined)).toBeNull();
    expect(normalizarCor('')).toBeNull();
    expect(normalizarCor('champanhe')).toBeNull();
  });
});

describe('exigeDriverAlojado (RULE-029/100)', () => {
  it('detecta pela família cadastrada', () => {
    expect(exigeDriverAlojado({ familiaPerfil: 'trik' })).toBe(true);
    expect(exigeDriverAlojado({ familiaPerfil: 'alojamento' })).toBe(true);
    expect(exigeDriverAlojado({ familiaPerfil: 'fk' })).toBe(true);
  });
  it('detecta pelo nome do perfil quando a família não está cadastrada', () => {
    expect(exigeDriverAlojado({ descricao: 'PERFIL TRICK 2M' })).toBe(true);
    expect(exigeDriverAlojado({ descricao: 'PERFIL DE ALOJAMENTO 3M' })).toBe(true);
  });
  it('detecta o modular de SOBREPOR (RULE-029)', () => {
    expect(exigeDriverAlojado({ descricao: 'PERFIL MODULAR DE SOBREPOR 2M', sistema: 's_mode' })).toBe(true);
    // modular de embutir não aloja o driver dentro do trilho
    expect(exigeDriverAlojado({ descricao: 'PERFIL MODULAR DE EMBUTIR 2M', sistema: 's_mode' })).toBe(false);
  });
  it('é falso sem dado nenhum (snapshot antigo não bloqueia)', () => {
    expect(exigeDriverAlojado({})).toBe(false);
    expect(exigeDriverAlojado({ descricao: 'PERFIL DE EMBUTIR 18MM', familiaPerfil: 'embutir_sobrepor_18' })).toBe(false);
  });
  it('o teto é 72 W', () => {
    expect(LIMITE_W_DRIVER_ALOJADO).toBe(72);
  });
});

describe('classificarDriverSlim (RULE-100)', () => {
  it("subtipo 'slim' → slim", () => {
    expect(classificarDriverSlim({ driverTipo: 'slim' })).toBe('slim');
    expect(ehDriverSlim({ driverTipo: 'slim' })).toBe(true);
  });
  it('nome com SLIM → slim mesmo sem subtipo', () => {
    expect(classificarDriverSlim({ descricao: 'DRIVER SLIM 60W 24V' })).toBe('slim');
  });
  it('subtipo diferente → nao_slim (bloqueia)', () => {
    expect(classificarDriverSlim({ driverTipo: 'convencional', descricao: 'DRIVER 100W' })).toBe('nao_slim');
    expect(ehDriverSlim({ driverTipo: 'pro' })).toBe(false);
  });
  it('sem subtipo e sem SLIM no nome → indeterminado (avisa, não bloqueia)', () => {
    expect(classificarDriverSlim({ descricao: 'DRIVER 60W 24V' })).toBe('indeterminado');
    expect(classificarDriverSlim({})).toBe('indeterminado');
  });
});

describe('ehDriverDeTrilho (RULE-031)', () => {
  it('usa o campo sistema do catálogo', () => {
    expect(ehDriverDeTrilho({ sistema: 'tiny_magneto' })).toBe(true);
    expect(ehDriverDeTrilho({ sistema: 'magneto_48v' })).toBe(true);
    expect(ehDriverDeTrilho({ sistema: 'trilha' })).toBe(true);
  });
  it("usa o subtipo 'magnetico'", () => {
    expect(ehDriverDeTrilho({ subtipo: 'magnetico' })).toBe(true);
  });
  it('cai no nome quando não há campo (padrão LM2343/LM2344)', () => {
    expect(ehDriverDeTrilho({ descricao: 'DRIVER 100W PARA TRILHO MAGNETICO' })).toBe(true);
  });
  it('driver de fita comum não é driver de trilho', () => {
    expect(ehDriverDeTrilho({ sistema: 'padrao', subtipo: 'slim', descricao: 'DRIVER SLIM 60W 24V' })).toBe(false);
    expect(ehDriverDeTrilho({})).toBe(false);
  });
});

describe('perfilSomenteFitaBaby (RULE-103)', () => {
  it('respeita a flag do catálogo', () => {
    expect(perfilSomenteFitaBaby({ somenteBaby: true })).toBe(true);
  });
  it('detecta Light Mini e Ripado por família e por nome', () => {
    expect(perfilSomenteFitaBaby({ familiaPerfil: 'light_mini' })).toBe(true);
    expect(perfilSomenteFitaBaby({ familiaPerfil: 'light_mini_sobrepor' })).toBe(true);
    expect(perfilSomenteFitaBaby({ familiaPerfil: 'ripado' })).toBe(true);
    expect(perfilSomenteFitaBaby({ descricao: 'PERFIL LIGHT MINI DE EMBUTIR 2M' })).toBe(true);
    expect(perfilSomenteFitaBaby({ descricao: 'PERFIL RIPADO 3M PT' })).toBe(true);
  });
  it('outros perfis não restringem', () => {
    expect(perfilSomenteFitaBaby({ familiaPerfil: 'sanca', descricao: 'PERFIL SANCA 2M' })).toBe(false);
    expect(perfilSomenteFitaBaby({})).toBe(false);
  });
});

describe('perfilRejeitaFitaIP (RULE-104)', () => {
  it('detecta Nano e Cantoneira por família e por nome', () => {
    expect(perfilRejeitaFitaIP({ familiaPerfil: 'light_nano_12' })).toBe(true);
    expect(perfilRejeitaFitaIP({ familiaPerfil: 'cantoneira' })).toBe(true);
    expect(perfilRejeitaFitaIP({ descricao: 'PERFIL NANO DE EMBUTIR 2M' })).toBe(true);
    expect(perfilRejeitaFitaIP({ descricao: 'PERFIL CANTONEIRA 1M BC' })).toBe(true);
  });
  it('outros perfis aceitam fita IP', () => {
    expect(perfilRejeitaFitaIP({ familiaPerfil: 'sanca', descricao: 'PERFIL SANCA 2M' })).toBe(false);
    expect(perfilRejeitaFitaIP({})).toBe(false);
  });
});

describe('fitaEhIP / fitaEhBaby (RULE-103/104)', () => {
  it('IP vem do nome da fita', () => {
    expect(fitaEhIP('FITA LED COB 10W/M IP65')).toBe(true);
    expect(fitaEhIP('FITA LED COB 10W/M IP 67')).toBe(true);
    expect(fitaEhIP('FITA LED COB 10W/M')).toBe(false);
    expect(fitaEhIP('FITA LED PRINCIPAL 10W/M')).toBe(false); // "IP" dentro de outra palavra
    expect(fitaEhIP(undefined)).toBe(false);
  });

  it('IP20 NÃO é fita vedada — é a fita sem capa, que cabe no perfil', () => {
    // 102 das 316 fitas do catálogo trazem "IP20" no nome; tratá-las como fita IP
    // bloquearia um terço do catálogo nos perfis Nano/Cantoneira (RULE-104).
    expect(fitaEhIP('FITA LED 25W 2700K 12V 5M - IP20')).toBe(false);
    expect(fitaEhIP('FITA LED 14,4W/M IP 20')).toBe(false);
    expect(fitaEhIP('FITA LED 10W/M IP44')).toBe(true); // a partir de IP44 há vedação
  });
  it('Baby vem da flag ou do nome', () => {
    expect(fitaEhBaby({ isBaby: true })).toBe(true);
    expect(fitaEhBaby({ descricao: 'FITA LED BABY 5W/M 24V' })).toBe(true);
    expect(fitaEhBaby({ descricao: 'FITA LED COB 10W/M', isBaby: false })).toBe(false);
    expect(fitaEhBaby({})).toBe(false);
  });
});
