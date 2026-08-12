import { useState, useEffect, useRef } from "react";
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

// Converte um SistemaIluminacao para o formato esperado pela edge function
function sistemaParaPayload(sis: SistemaIluminacao) {
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

export function useValidarSistemas(sistemas: SistemaIluminacao[]) {
  const [validacoes, setValidacoes] = useState<ValidacaoState>({});
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Último payload validado com sucesso — edições que não afetam o payload
  // (ex.: qtdDriversManual, preços) não re-invocam a edge function à toa.
  const lastPayloadRef = useRef<string>("");

  useEffect(() => {
    // Só valida se tiver pelo menos fita ou driver selecionado
    const sistemasComDados = sistemas.filter(
      (s) => s.fita.codigo || s.driver.codigo
    );
    if (sistemasComDados.length === 0) {
      setValidacoes({});
      lastPayloadRef.current = ""; // estado limpo — payload igual no futuro precisa revalidar
      return;
    }

    // Debounce de 800ms para não chamar a edge function a cada keystroke
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const itens = sistemasComDados.map(sistemaParaPayload);
      // Inclui os ids na chave: payload igual mas sistemas diferentes (add/remove/reorder)
      // ainda precisa revalidar para remapear os resultados por id.
      const payloadKey = JSON.stringify({ ids: sistemasComDados.map((s) => s.id), itens });
      if (payloadKey === lastPayloadRef.current) return;
      setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke(
          "validar-sistema-orcamento",
          { body: { itens } }
        );

        if (error) throw error;

        const novasValidacoes: ValidacaoState = {};
        data.resultados.forEach(
          (r: { item_index: number } & ValidacaoResultado, idx: number) => {
            const sis = sistemasComDados[idx];
            novasValidacoes[sis.id] = {
              valido: r.valido,
              erros: r.erros,
              alertas: r.alertas,
              sugestoes: r.sugestoes,
            };
          }
        );
        setValidacoes(novasValidacoes);
        lastPayloadRef.current = payloadKey;
      } catch {
        // Silencia erros de rede — validação offline é feita no AmbienteCard
      } finally {
        setLoading(false);
      }
    }, 800);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [sistemas]);

  return { validacoes, loading };
}