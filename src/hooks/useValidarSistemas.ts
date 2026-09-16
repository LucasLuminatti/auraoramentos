import { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { SistemaIluminacao } from "@/types/orcamento";

export interface ValidacaoResultado {
  valido: boolean;
  erros: string[];
  alertas: string[];
  sugestoes: Record<string, unknown>;
}

export interface ValidacaoState {
  [sistemaId: string]: ValidacaoResultado;
}

// Converte um SistemaIluminacao para o formato esperado pela edge function.
// Exportado para teste: o payload é o contrato com a edge, e campo que falta aqui
// desliga silenciosamente a validação lá (foi o que aconteceu com `codigo_fita`).
export function sistemaParaPayload(sis: SistemaIluminacao) {
  const comprimento_perfil_m = sis.perfil
    ? sis.perfil.comprimentoPeca
    : null;
  const quantidade_pecas = sis.perfil ? sis.perfil.quantidade : null;
  const passadas = sis.perfil
    ? sis.perfil.passadas
    : sis.passadasManual;

  // Detecta tipo de sistema pelo sistema_magnetico ou família do perfil
  const familia = sis.perfil?.familia_perfil ?? null;
  let tipo_sistema: "padrao" | "tiny_magneto" | "magneto_48v" | "s_mode" | "trilha" = "padrao";
  if (sis.fita.voltagem === 48 || sis.driver.voltagem === 48) {
    tipo_sistema = "magneto_48v";
  }

  return {
    tipo_sistema,
    familia_perfil: familia,
    comprimento_perfil_m: comprimento_perfil_m ?? (sis.metragemManual ?? null),
    quantidade_pecas: quantidade_pecas ?? 1,
    passadas,
    tensao_fita: sis.fita.voltagem ?? null,
    watts_por_metro: sis.fita.wm ?? null,
    // RULE-029/100/103/104: as restrições físicas identificam família de perfil, fita Baby/IP
    // e driver Slim pelo NOME do produto quando o catálogo não tem o campo cadastrado.
    // Sem estes três campos, as mesmas validações que já bloqueiam na UI ficariam inertes
    // no servidor (o payload é opcional na edge — snapshot antigo simplesmente não envia).
    descricao_perfil: sis.perfil?.descricao ?? null,
    descricao_fita: sis.fita.descricao ?? null,
    // `codigo_fita` é o campo que a edge usa para saber se JÁ EXISTE fita escolhida
    // (`temFita`). Sem ele, as checagens de Baby e de fita com IP do servidor nunca
    // disparavam — a regra existia lá e ficava inerte, valendo só no front.
    codigo_fita: sis.fita.codigo || null,
    descricao_driver: sis.driver.descricao ?? null,
    // RULE-013: largura da fita p/ validação dimensional perfil×fita (edge regra #6).
    // Snapshots antigos sem largura_mm enviam null → validação é pulada no server.
    largura_fita_mm: sis.fita.largura_mm ?? null,
    // RULE-005: tamanho do rolo p/ a sugestão de rolos da edge (5% de sobra por rolo).
    tamanho_rolo_m: sis.fita.metragemRolo ?? null,
    tensao_driver: sis.driver.voltagem ?? null,
    potencia_driver_w: sis.driver.potencia ?? null,
    subtipo_driver: sis.driver.driver_tipo ?? null,
    // Sem fita escolhida o campo vai null: "padrao" faria a edge concluir "não é Baby" e
    // acusar incompatibilidade num sistema que ainda nem tem fita (bloqueio por dado ausente).
    subtipo_fita: sis.fita.codigo ? (sis.fita.is_baby ? "baby" : "padrao") : null,
    driver_restr_tipo: sis.perfil?.driver_restr_tipo ?? null,
    driver_restr_max_w: sis.perfil?.driver_restr_max_w ?? null,
  };
}

/** Situação da validação do servidor em relação ao estado ATUAL dos sistemas:
 *  - `ok`: os resultados em `validacoes` são do payload atual;
 *  - `pendente`: houve edição depois da última validação (debounce ou chamada em voo) — os
 *    resultados na mão são de um estado anterior e não servem para bloquear nem liberar;
 *  - `falhou`: a chamada para o payload atual falhou (rede/edge fora) — o gate não trava por
 *    isso; as travas locais do passo 2 continuam valendo. */
export type StatusValidacao = "ok" | "pendente" | "falhou";

/** Erros do validador que BLOQUEIAM o avanço do passo 2 e o PDF.
 *  - "Tensão incompatível" (fita × driver) fica de fora: por decisão da equipe (D-05/D-10) é
 *    orientativa. O teste é pelo início da mensagem — `/tensão/` solto também casava "extensão".
 *  - Sistema ainda sem fita não tem incompatibilidade DE FITA real: a edge publicada acusa
 *    "aceita SOMENTE fita Baby" num Light Mini/Ripado que só tem driver, e isso travava o vendedor
 *    no meio da montagem. */
export function errosBloqueantes(sis: Pick<SistemaIluminacao, "fita">, erros: string[]): string[] {
  return erros.filter((e) => {
    if (/^\s*Tens[ãa]o incompat[íi]vel/i.test(e)) return false;
    if (!sis.fita.codigo && /\bfita\b/i.test(e)) return false;
    return true;
  });
}

const TIMEOUT_VALIDACAO_MS = 15_000;
/** Esperas antes da 2ª e da 3ª tentativa quando a edge falha. */
const ESPERAS_NOVA_TENTATIVA_MS = [2_000, 5_000];

export function useValidarSistemas(sistemas: SistemaIluminacao[]) {
  const [validacoes, setValidacoes] = useState<ValidacaoState>({});
  const [loading, setLoading] = useState(false);
  // Chave (ids + payload) dos resultados que estão em `validacoes`, e a última que falhou.
  const [chaveValidada, setChaveValidada] = useState("");
  const [chaveFalhou, setChaveFalhou] = useState<string | null>(null);
  const chaveValidadaRef = useRef("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Cada chamada leva um id: resposta de um estado já superado é descartada (antes, uma resposta
  // atrasada podia sobrescrever a mais nova).
  const reqIdRef = useRef(0);

  // Só valida sistema com fita ou driver. A chave inclui os ids: payload igual em sistemas
  // diferentes (add/remove/reorder) ainda precisa revalidar para remapear os resultados.
  // Edições que não mudam o payload (preço, qtdDriversManual) não re-invocam a edge.
  const { sistemasComDados, itens, chave } = useMemo(() => {
    const comDados = sistemas.filter((s) => s.fita.codigo || s.driver.codigo);
    const payload = comDados.map(sistemaParaPayload);
    return {
      sistemasComDados: comDados,
      itens: payload,
      chave: comDados.length ? JSON.stringify({ ids: comDados.map((s) => s.id), itens: payload }) : "",
    };
  }, [sistemas]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (chave === "") {
      // Nada a validar (só luminárias/compostos, ou sistemas vazios). Tratado ANTES da comparação:
      // com a chave antiga na ref, o caminho normal chamava a edge com `itens: []` → 400 → falhou.
      reqIdRef.current++;
      setLoading(false);
      setValidacoes({});
      chaveValidadaRef.current = "";
      setChaveValidada("");
      setChaveFalhou(null);
      return;
    }
    if (chave === chaveValidadaRef.current) {
      // voltou a um estado já validado: invalida chamada em voo
      reqIdRef.current++;
      setLoading(false);
      return;
    }
    const reqId = ++reqIdRef.current;

    const validar = async (tentativa: number) => {
      setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke("validar-sistema-orcamento", {
          body: { itens },
          timeout: TIMEOUT_VALIDACAO_MS,
        });
        if (error) throw error;
        if (reqId !== reqIdRef.current) return;

        const novasValidacoes: ValidacaoState = {};
        data.resultados.forEach((r: { item_index: number } & ValidacaoResultado, idx: number) => {
          const sis = sistemasComDados[idx];
          novasValidacoes[sis.id] = {
            valido: r.valido,
            erros: r.erros,
            alertas: r.alertas,
            sugestoes: r.sugestoes,
          };
        });
        setValidacoes(novasValidacoes);
        chaveValidadaRef.current = chave;
        setChaveValidada(chave);
        setChaveFalhou(null);
        setLoading(false);
      } catch {
        if (reqId !== reqIdRef.current) return;
        // Falha passageira (cold start da edge, rede) não pode desligar o bloqueio do servidor
        // até a próxima edição: tenta de novo com espera crescente antes de desistir.
        const espera = ESPERAS_NOVA_TENTATIVA_MS[tentativa];
        if (espera != null) {
          debounceRef.current = setTimeout(() => void validar(tentativa + 1), espera);
          return;
        }
        // Desistiu: a validação local do AmbienteCard continua; o gate não trava por isso.
        setChaveFalhou(chave);
        setLoading(false);
      }
    };

    // Debounce de 800ms para não chamar a edge function a cada keystroke
    debounceRef.current = setTimeout(() => void validar(0), 800);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // `itens`/`sistemasComDados` são derivados de `chave` no mesmo memo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);

  const status: StatusValidacao =
    chave === chaveValidada ? "ok" : chaveFalhou === chave ? "falhou" : "pendente";

  return { validacoes, loading, status };
}
