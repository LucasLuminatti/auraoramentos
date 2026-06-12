import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Produto } from "@/types/orcamento";

export type ProdutoFiltro = 'fita' | 'driver' | 'perfil' | 'luminaria' | 'todos';

export function useProdutoSearch(query: string, filtro: ProdutoFiltro = 'todos', filtroVoltagem?: number) {
  const [results, setResults] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(false);
  const [redirectTipo, setRedirectTipo] = useState<string | null>(null);

  useEffect(() => {
    setRedirectTipo(null);
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        let queryBuilder = supabase
          .from("produtos")
          .select(
            "id, codigo, descricao, preco_tabela, preco_minimo, imagem_url, " +
            "voltagem:tensao, wm:watts_por_metro, passadas:passadas_padrao, " +
            "familia_perfil, driver_tipo:subtipo, driver_potencia_w:potencia_watts, " +
            "driver_restr_tipo:driver_tipo_permitido, driver_restr_max_w:driver_max_watts, " +
            "sistema_magnetico:sistema, is_baby:somente_baby, somente_baby, " +
            "tipo_produto, subtipo"
          );

        if (filtro === 'fita' || filtro === 'driver' || filtro === 'perfil') {
          queryBuilder = queryBuilder.eq('tipo_produto', filtro);
        } else if (filtro === 'luminaria') {
          queryBuilder = queryBuilder.or('tipo_produto.is.null,tipo_produto.in.(spot,lampada,acessorio,conector,suporte)');
        }

        // Pré-filtro de voltagem do driver: 46/61 drivers têm tensao=null mas são compatíveis (D-01)
        if (filtro === 'driver' && filtroVoltagem !== undefined) {
          queryBuilder = queryBuilder.or(`tensao.eq.${filtroVoltagem},tensao.is.null`);
        }

        if (query.trim().length >= 2) {
          queryBuilder = queryBuilder.or(`codigo.ilike.%${query}%,descricao.ilike.%${query}%`);
        }

        const { data, error } = await queryBuilder.order("codigo").limit(50);

        if (error) throw error;
        setResults(data || []);

        // UX-01: fallback de detecção de tipo real quando luminária não acha nada
        let redirect: string | null = null;
        if (filtro === 'luminaria' && (data?.length ?? 0) === 0 && query.trim().length >= 2) {
          const { data: fb } = await supabase
            .from("produtos")
            .select("codigo, tipo_produto")
            .or(`codigo.ilike.%${query}%,descricao.ilike.%${query}%`)
            .in("tipo_produto", ["perfil", "fita", "driver"])
            .order("codigo")
            .limit(1);
          redirect = fb?.[0]?.tipo_produto ?? null;
        }
        setRedirectTipo(redirect);
      } catch {
        setResults([]);
        setRedirectTipo(null);
      } finally {
        setLoading(false);
      }
    }, query.trim().length < 2 ? 0 : 300);

    return () => clearTimeout(timer);
  }, [query, filtro, filtroVoltagem]);

  return { results, loading, redirectTipo };
}