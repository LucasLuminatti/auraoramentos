/**
 * BUG-22 — o wizard vivia só em memória: qualquer refresh (ou fechar a aba sem querer)
 * apagava o orçamento inteiro, incluindo ambientes já montados.
 *
 * Esta é a rede de segurança: um espelho do wizard em `localStorage`, gravado a cada
 * mudança e oferecido de volta na próxima abertura. NÃO grava no banco de propósito —
 * autosave em `orcamentos` criaria rascunhos fantasma em produção a cada tentativa
 * abandonada, e "Gerar PDF" já é o momento em que o orçamento vira registro.
 *
 * A restauração é sempre OFERECIDA, nunca automática: o colaborador pode ter voltado
 * para começar outra coisa, e trocar o conteúdo da tela sozinho seria pior que perder.
 */

import type { Ambiente, CategoriaFita, DadosOrcamento } from '@/types/orcamento';

const PREFIXO = 'aura:rascunho-wizard';
/** Rascunho velho não interessa a ninguém — e evita ressuscitar preço defasado. */
const VALIDADE_MS = 48 * 60 * 60 * 1000;
/** Acima disso o navegador tende a estourar a cota do localStorage; melhor não gravar. */
const TAMANHO_MAX_BYTES = 2 * 1024 * 1024;

export interface RascunhoWizard {
  salvoEm: number;
  step: number;
  dados: DadosOrcamento;
  ambientes: Ambiente[];
  categorias: CategoriaFita[];
  clienteId: string | null;
  clienteNome: string;
  projetoId: string | null;
  projetoNome: string;
  /** Id do orçamento sendo reaberto/editado (null = orçamento novo). */
  orcamentoId: string | null;
}

/** Chave por usuário: máquina compartilhada não pode oferecer o rascunho de outro. */
function chave(userId?: string | null): string {
  return `${PREFIXO}:${userId ?? 'anon'}`;
}

/** Há conteúdo de verdade para salvar? Wizard recém-aberto não vira rascunho. */
export function rascunhoTemConteudo(r: Pick<RascunhoWizard, 'ambientes' | 'categorias' | 'dados'>): boolean {
  if (r.ambientes.length > 0) return true;
  if (r.categorias.length > 0) return true;
  return false;
}

export function salvarRascunho(userId: string | null | undefined, rascunho: Omit<RascunhoWizard, 'salvoEm'>): void {
  try {
    if (!rascunhoTemConteudo(rascunho)) {
      limparRascunho(userId);
      return;
    }
    const payload = JSON.stringify({ ...rascunho, salvoEm: Date.now() } satisfies RascunhoWizard);
    if (payload.length > TAMANHO_MAX_BYTES) return;
    localStorage.setItem(chave(userId), payload);
  } catch {
    // localStorage cheio, desabilitado ou modo privativo: seguir sem rede de segurança
    // é melhor do que quebrar o wizard.
  }
}

export function lerRascunho(userId: string | null | undefined): RascunhoWizard | null {
  try {
    const bruto = localStorage.getItem(chave(userId));
    if (!bruto) return null;
    const r = JSON.parse(bruto) as RascunhoWizard;
    if (!r || typeof r.salvoEm !== 'number' || !Array.isArray(r.ambientes)) return null;
    if (Date.now() - r.salvoEm > VALIDADE_MS) {
      limparRascunho(userId);
      return null;
    }
    return r;
  } catch {
    return null;
  }
}

export function limparRascunho(userId: string | null | undefined): void {
  try {
    localStorage.removeItem(chave(userId));
  } catch {
    /* idem */
  }
}

/** Texto do banner de restauração: "há 5 minutos", "ontem"... */
export function descreverIdade(salvoEm: number, agora = Date.now()): string {
  const min = Math.floor((agora - salvoEm) / 60000);
  if (min < 1) return 'agora há pouco';
  if (min < 60) return `há ${min} minuto${min > 1 ? 's' : ''}`;
  const horas = Math.floor(min / 60);
  if (horas < 24) return `há ${horas} hora${horas > 1 ? 's' : ''}`;
  const dias = Math.floor(horas / 24);
  return `há ${dias} dia${dias > 1 ? 's' : ''}`;
}

/** Resumo curto do que será restaurado ("3 ambientes · 12 itens"). */
export function resumirRascunho(r: RascunhoWizard): string {
  const ambientes = r.ambientes.length;
  const itens = r.ambientes.reduce(
    (s, a) => s + a.luminarias.length + a.sistemas.length,
    0,
  );
  const partes = [`${ambientes} ambiente${ambientes === 1 ? '' : 's'}`];
  if (itens > 0) partes.push(`${itens} ite${itens === 1 ? 'm' : 'ns'}`);
  return partes.join(' · ');
}
