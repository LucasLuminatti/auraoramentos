import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { User } from "@supabase/supabase-js";

export interface Colaborador {
  id: string;
  nome: string;
  cargo: string | null;
  departamento: string | null;
  user_id: string | null;
  cpf: string | null;
  telefone: string | null;
  setor: string | null;
}

/** Mesma lista do CHECK de `colaboradores.setor` e da edge `create-colaborador`. */
const SETORES_VALIDOS = ["comercial", "projetos", "logistica", "financeiro"];

function derivarNomeInicial(user: User): string {
  const meta = user.user_metadata ?? {};
  const candidatos = [meta.nome, meta.name, meta.full_name];
  for (const c of candidatos) {
    if (typeof c === "string" && c.trim()) return c.trim();
  }
  return user.email?.split("@")[0] ?? "Colaborador";
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

      const { data: existing } = await supabase
        .from("colaboradores")
        .select("id, nome, cargo, departamento, user_id, cpf, telefone, setor")
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing) {
        setColaborador(existing);
        setLoading(false);
        return;
      }

      // Nenhum colaborador vinculado — cria automaticamente via edge function
      // (usa service_role para contornar RLS da tabela colaboradores).
      try {
        const nome = derivarNomeInicial(user);
        // Dados que o próprio usuário digitou no cadastro (Auth.tsx guarda em user_metadata
        // quando a confirmação de e-mail adia a criação do perfil). Só preenchem o perfil
        // dele — nada disso é usado para autorizar.
        const meta = user.user_metadata ?? {};
        const texto = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
        // setor fora da lista faria a edge recusar a criação inteira (400) — melhor sem setor,
        // que o banner de "Complete seu cadastro" pede depois
        const setor = texto(meta.setor);
        await supabase.functions.invoke("create-colaborador", {
          body: {
            nome,
            user_id: user.id,
            cargo: texto(meta.cargo),
            departamento: texto(meta.departamento),
            setor: setor && SETORES_VALIDOS.includes(setor) ? setor : undefined,
          },
        });
        const { data: created } = await supabase
          .from("colaboradores")
          .select("id, nome, cargo, departamento, user_id, cpf, telefone, setor")
          .eq("user_id", user.id)
          .maybeSingle();
        setColaborador(created);
      } catch (err) {
        console.error("Falha ao auto-criar colaborador:", err);
        setColaborador(null);
      } finally {
        setLoading(false);
      }
    };

    fetch();
  }, [user]);

  return { colaborador, loading };
}
