import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { SistemaIluminacao } from '@/types/orcamento';

// O gate do passo 2 e do PDF confia no `status` deste hook: resultado de um estado anterior não
// pode bloquear nem liberar, e falha da edge não pode travar o vendedor para sempre.

const invoke = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { functions: { invoke: (...args: unknown[]) => invoke(...args) } },
}));

const { useValidarSistemas } = await import('@/hooks/useValidarSistemas');

const sistema = (id: string, codigoFita = 'LM2029'): SistemaIluminacao => ({
  id,
  perfil: null,
  fita: { id: `f${id}`, codigo: codigoFita, descricao: 'FITA', wm: 10, voltagem: 24, metragemRolo: 5, precoUnitario: 1, precoMinimo: 1 },
  driver: { id: `d${id}`, codigo: 'LM1', descricao: 'DRIVER', potencia: 100, voltagem: 24, precoUnitario: 1, precoMinimo: 1 },
  metragemManual: 5,
  passadasManual: 1,
  local: null,
});

const respostaOk = (n: number, erros: string[] = []) => ({
  data: { resultados: Array.from({ length: n }, (_, i) => ({ item_index: i, valido: !erros.length, erros, alertas: [], sugestoes: {} })) },
  error: null,
});

/** Avança os timers e deixa as promessas resolverem. */
const avancar = async (ms: number) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

describe('useValidarSistemas — status do resultado', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    invoke.mockReset();
  });
  afterEach(() => vi.useRealTimers());

  it('fica pendente durante o debounce e ok quando a resposta do estado atual chega', async () => {
    invoke.mockResolvedValue(respostaOk(1, ['Perfil ripado aceita SOMENTE fita Baby.']));
    const { result } = renderHook(({ s }) => useValidarSistemas(s), { initialProps: { s: [sistema('a')] } });
    expect(result.current.status).toBe('pendente');
    await avancar(800);
    expect(result.current.status).toBe('ok');
    expect(result.current.validacoes.a.erros).toHaveLength(1);
  });

  it('edição depois da validação volta a pendente (erro já corrigido não bloqueia)', async () => {
    invoke.mockResolvedValue(respostaOk(1, ['erro antigo']));
    const { result, rerender } = renderHook(({ s }) => useValidarSistemas(s), { initialProps: { s: [sistema('a')] } });
    await avancar(800);
    expect(result.current.status).toBe('ok');
    rerender({ s: [sistema('a', 'LM3827')] });
    expect(result.current.status).toBe('pendente');
  });

  it('sem nada a validar: ok, sem chamar a edge — mesmo depois de uma validação anterior', async () => {
    invoke.mockResolvedValue(respostaOk(1));
    const { result, rerender } = renderHook(({ s }) => useValidarSistemas(s), { initialProps: { s: [sistema('a')] } });
    await avancar(800);
    expect(invoke).toHaveBeenCalledTimes(1);
    rerender({ s: [] });
    await avancar(20_000);
    expect(invoke).toHaveBeenCalledTimes(1); // antes: 2ª chamada com itens [] → 400 → "falhou"
    expect(result.current.status).toBe('ok');
    expect(result.current.validacoes).toEqual({});
  });

  it('falha passageira: tenta de novo e fica ok', async () => {
    invoke.mockRejectedValueOnce(new Error('cold start')).mockResolvedValue(respostaOk(1));
    const { result } = renderHook(({ s }) => useValidarSistemas(s), { initialProps: { s: [sistema('a')] } });
    await avancar(800);
    expect(result.current.status).toBe('pendente');
    await avancar(2_000);
    expect(invoke).toHaveBeenCalledTimes(2);
    expect(result.current.status).toBe('ok');
  });

  it('edge fora do ar: depois das novas tentativas, falhou (o gate não trava)', async () => {
    invoke.mockRejectedValue(new Error('down'));
    const { result } = renderHook(({ s }) => useValidarSistemas(s), { initialProps: { s: [sistema('a')] } });
    await avancar(800 + 2_000 + 5_000);
    expect(invoke).toHaveBeenCalledTimes(3);
    expect(result.current.status).toBe('falhou');
  });

  it('resposta atrasada de um estado superado é descartada', async () => {
    let resolverAntiga: (v: unknown) => void = () => {};
    invoke
      .mockImplementationOnce(() => new Promise((r) => { resolverAntiga = r; }))
      .mockResolvedValueOnce(respostaOk(1, []));
    const { result, rerender } = renderHook(({ s }) => useValidarSistemas(s), { initialProps: { s: [sistema('a')] } });
    await avancar(800); // 1ª chamada em voo
    rerender({ s: [sistema('a', 'LM3827')] });
    await avancar(800); // 2ª chamada responde sem erro
    expect(result.current.status).toBe('ok');
    await act(async () => {
      resolverAntiga(respostaOk(1, ['erro do estado antigo']));
    });
    expect(result.current.validacoes.a.erros).toEqual([]);
    expect(result.current.status).toBe('ok');
  });
});
