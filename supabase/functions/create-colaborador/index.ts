import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const textoOpcional = (v: unknown, max: number): string | null => {
  if (v == null || v === "") return null;
  return String(v).trim().slice(0, max) || null;
};

// Cria o cadastro de colaborador do PRÓPRIO usuário autenticado.
// Segurança (auditoria 2026-09-15): o user_id vinha do corpo da requisição e era gravado com a
// service role sem conferir o JWT — qualquer usuário logado criava um perfil preso ao user_id de
// outra pessoa. Agora o user_id sai do token; se o corpo trouxer outro, a chamada é recusada.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      (Deno.env.get("SB_SECRET_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"))!
    );

    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    const uid = userData?.user?.id;
    if (userErr || !uid) {
      return json({ error: "Não autenticado" }, 401);
    }

    const { nome, cargo, departamento, user_id, cpf, telefone, setor } = await req.json();

    if (user_id && user_id !== uid) {
      return json({ error: "Operação não permitida" }, 403);
    }

    const nomeLimpo = typeof nome === "string" ? nome.trim().slice(0, 120) : "";
    if (nomeLimpo.length < 1) {
      return json({ error: "nome é obrigatório" }, 400);
    }

    // Validate setor if provided (matches DB CHECK constraint).
    const validSetores = ["comercial", "projetos", "logistica", "financeiro"];
    if (setor && !validSetores.includes(setor)) {
      return json({ error: `setor must be one of: ${validSetores.join(", ")}` }, 400);
    }

    const { data, error } = await supabaseAdmin
      .from("colaboradores")
      .insert({
        nome: nomeLimpo,
        cargo: textoOpcional(cargo, 120),
        departamento: textoOpcional(departamento, 120),
        user_id: uid,
        cpf: textoOpcional(cpf, 14),
        telefone: textoOpcional(telefone, 20),
        setor: setor || null,
      })
      .select()
      .single();

    if (error) {
      console.error("create-colaborador insert:", error);
      // 23505 = já existe cadastro para este usuário (índice único em colaboradores.user_id)
      return error.code === "23505"
        ? json({ error: "Cadastro já existe" }, 409)
        : json({ error: "Não foi possível criar o cadastro" }, 400);
    }

    return json(data);
  } catch (e) {
    console.error("create-colaborador error:", e);
    return json({ error: "Erro interno do servidor" }, 500);
  }
});
