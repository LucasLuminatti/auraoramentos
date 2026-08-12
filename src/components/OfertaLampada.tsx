import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  formatarMoeda,
  prefixosDeBuscaLampada,
  type TipoLampada,
} from "@/types/orcamento";

/** Lâmpada oferecida — subconjunto de `produtos` suficiente para virar item do orçamento. */
export interface LampadaOfertada {
  codigo: string;
  descricao: string;
  preco_tabela: number;
  preco_minimo: number;
  imagem_url: string | null;
  potencia_watts: number | null;
}

interface OfertaLampadaProps {
  /** Tipo lido do nome do spot (RULE-044) — define quais lâmpadas aparecem. */
  tipo: TipoLampada;
  /** Descrição do spot, só para o texto do painel. */
  descricaoSpot: string;
  /** Quantidade sugerida = qtd do spot × fachos (RULE-111). */
  quantidadeSugerida: number;
  onAdicionar: (lampada: LampadaOfertada, quantidade: number) => void;
  onDispensar: () => void;
}

/**
 * RULE-044/045/046 — oferta de lâmpada no momento em que o spot entra no orçamento.
 *
 * A compatibilidade sai do NOME (R6 final RF6.16): spot "PARA LAMPADA DICROICA MR16"
 * só lista dicroicas. O filtro é por PREFIXO da descrição porque `tipo_produto` não
 * serve — no catálogo real as 115 lâmpadas de spot estão espalhadas entre 'spot',
 * 'lampada' e NULL (conferido em 2026-08-12).
 *
 * A oferta é opcional (RULE-002): "Não, obrigado" fecha. A quantidade é livre
 * (RULE-045) e vem pré-preenchida com a do spot × fachos.
 */
const OfertaLampada = ({
  tipo,
  descricaoSpot,
  quantidadeSugerida,
  onAdicionar,
  onDispensar,
}: OfertaLampadaProps) => {
  const [lampadas, setLampadas] = useState<LampadaOfertada[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [escolhida, setEscolhida] = useState<string>("");
  const [qtd, setQtd] = useState(String(Math.max(1, quantidadeSugerida)));

  // Mudar a quantidade do spot enquanto a oferta está aberta reflete na sugestão:
  // 4 spots pedem 4 lâmpadas. O campo continua editável (RULE-045: quantidade livre).
  useEffect(() => {
    setQtd(String(Math.max(1, quantidadeSugerida)));
  }, [quantidadeSugerida]);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      setCarregando(true);
      const filtros = prefixosDeBuscaLampada(tipo)
        .map((p) => `descricao.ilike.${p}`)
        .join(",");
      const { data } = await supabase
        .from("produtos")
        .select("codigo, descricao, preco_tabela, preco_minimo, imagem_url, potencia_watts")
        // RULE-003: nunca oferecer item fora do catálogo atual.
        .not("descricao", "ilike", "%DESCONTINUAR%")
        .or(filtros)
        .order("codigo")
        .limit(60);
      if (cancelado) return;
      setLampadas((data ?? []) as LampadaOfertada[]);
      setCarregando(false);
    })();
    return () => {
      cancelado = true;
    };
  }, [tipo]);

  const adicionar = () => {
    const lamp = lampadas.find((l) => l.codigo === escolhida);
    if (!lamp) return;
    onAdicionar(lamp, Math.max(1, parseInt(qtd, 10) || 1));
  };

  return (
    <div className="rounded-md border border-amber-300/60 bg-amber-50/60 px-3 py-2 space-y-2">
      <p className="text-xs font-semibold text-amber-900">
        💡 Este spot usa lâmpada {tipo} — incluir no orçamento?
        <span className="font-normal text-amber-800"> ({descricaoSpot.slice(0, 60)})</span>
      </p>

      {carregando ? (
        <p className="text-xs text-amber-800">Buscando lâmpadas {tipo}...</p>
      ) : lampadas.length === 0 ? (
        <p className="text-xs text-amber-800">
          Nenhuma lâmpada {tipo} cadastrada no catálogo — inclua manualmente pela busca do ambiente.
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={escolhida}
            onChange={(e) => setEscolhida(e.target.value)}
            className="h-8 max-w-[26rem] flex-1 rounded-md border border-input bg-background px-2 text-xs"
          >
            <option value="">Escolha a lâmpada ({lampadas.length} opções)</option>
            {lampadas.map((l) => (
              <option key={l.codigo} value={l.codigo}>
                {l.codigo} — {l.descricao} ({formatarMoeda(l.preco_tabela || 0)})
              </option>
            ))}
          </select>
          <div className="flex items-center gap-1">
            <span className="text-xs text-amber-900">Qtd:</span>
            <Input
              type="number"
              min={1}
              value={qtd}
              onChange={(e) => setQtd(e.target.value)}
              className="h-8 w-20"
            />
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1 text-xs"
            disabled={!escolhida}
            onClick={adicionar}
          >
            <Plus className="h-3 w-3" />
            Adicionar lâmpada
          </Button>
        </div>
      )}

      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onDispensar}>
        Não, obrigado
      </Button>
    </div>
  );
};

export default OfertaLampada;
