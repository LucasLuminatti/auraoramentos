import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface Colaborador {
  id: string;
  nome: string;
  cargo: string | null;
  departamento: string | null;
  user_id: string | null;
}

export function useColaborador() {
  const { user } = useAuth();
  const [colaborador, setColaborador] = useState<Colaborador | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setColaborador(null);
      setLoading(false);
      return;
    }

    const fetch = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("colaboradores")
        .select("id, nome, cargo, departamento, user_id")
        .eq("user_id", user.id)
        .maybeSingle();

      setColaborador(data);
      setLoading(false);
    };

    fetch();
  }, [user]);

  return { colaborador, loading };
}
