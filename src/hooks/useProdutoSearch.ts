import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Produto } from "@/types/orcamento";

export function useProdutoSearch(query: string) {
  const [results, setResults] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
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
            "sistema_magnetico:sistema, is_baby:somente_baby, tipo_produto, subtipo"
          );

        if (query.trim().length >= 2) {
          queryBuilder = queryBuilder.or(`codigo.ilike.%${query}%,descricao.ilike.%${query}%`);
        }

        const { data, error } = await queryBuilder.order("codigo").limit(50);

        if (error) throw error;
        setResults(data || []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, query.trim().length < 2 ? 0 : 300);

    return () => clearTimeout(timer);
  }, [query]);

  return { results, loading };
}