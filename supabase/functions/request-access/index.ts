import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Endpoint público (verify_jwt=false). Segurança (auditoria 2026-09-15):
// - nome e e-mail entravam crus no HTML do e-mail ao admin (phishing pelo domínio da Luminatti);
// - sem limite, qualquer um disparava e-mails ilimitados e esgotava a cota do Resend.
const NOME_MAX = 100;
const EMAIL_MAX = 254;
const PEDIDOS_NOVOS_POR_HORA = 20;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function hmacSign(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const body = await req.json().catch(() => null);
    // espaços internos colapsados e sem caracteres de controle (o nome vai no assunto do e-mail)
    const name = typeof body?.name === "string"
      ? [...body.name].map((ch: string) => (ch.charCodeAt(0) < 32 || ch.charCodeAt(0) === 127 ? " " : ch)).join("").replace(/\s+/g, " ").trim()
      : "";
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

    if (name.length < 2 || name.length > NOME_MAX) {
      return json({ error: "Nome inválido" }, 400);
    }

    const emailRegex = /^[^\s@<>"]+@[^\s@<>"']+\.[^\s@<>"']+$/;
    if (!email || email.length > EMAIL_MAX || !emailRegex.test(email)) {
      return json({ error: "E-mail inválido" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      (Deno.env.get("SB_SECRET_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"))!
    );

    // Check existing requests
    const { data: existing } = await supabase
      .from("access_requests")
      .select("status")
      .eq("email", email)
      .maybeSingle();

    if (existing) {
      if (existing.status === "PENDING") {
        return json({
          error: "pending",
          message: "Seu pedido já está aguardando aprovação. Verifique seu e-mail.",
        });
      }
      if (existing.status === "APPROVED") {
        return json({
          error: "approved",
          message: "Seu acesso já foi aprovado! Acesse a página de login para criar sua conta.",
        });
      }
    }

    // Limite global de pedidos novos: cada pedido dispara um e-mail ao admin. Acima do limite o
    // pedido é registrado normalmente, mas sem e-mail — um robô não esgota a cota do Resend e
    // também não consegue travar o pedido de quem é legítimo (recusar com 429 permitia isso).
    const umaHoraAtras = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: pedidosRecentes, error: countError } = await supabase
      .from("access_requests")
      .select("id", { count: "exact", head: true })
      .gte("created_at", umaHoraAtras);
    if (countError) {
      console.error("request-access count error:", countError);
      return json({ error: "Erro interno do servidor" }, 500);
    }
    const acimaDoLimite = (pedidosRecentes ?? 0) >= PEDIDOS_NOVOS_POR_HORA;

    if (existing) {
      // REJECTED — delete old entry and allow re-request
      await supabase.from("access_requests").delete().eq("email", email);
    }

    // Insert new request
    const { data: inserted, error: insertError } = await supabase
      .from("access_requests")
      .insert({ name, email })
      .select("id")
      .single();

    if (insertError || !inserted) {
      console.error("Insert error:", insertError);
      return json({ error: "Erro ao registrar pedido" }, 500);
    }

    const requestId = inserted.id;
    const secret = Deno.env.get("APPROVAL_TOKEN_SECRET")!;
    const adminEmail = Deno.env.get("ADMIN_EMAIL")!;

    // Generate HMAC token (24h expiry)
    const exp = Date.now() + 24 * 60 * 60 * 1000;
    const payload = `${requestId}:${exp}`;
    const signature = await hmacSign(secret, payload);
    const token = `${btoa(payload).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}.${signature}`;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const projectId = supabaseUrl.split("//")[1].split(".")[0];
    const funcBaseUrl = `https://${projectId}.supabase.co/functions/v1`;

    const approveUrl = `${funcBaseUrl}/review-access?action=approve&requestId=${requestId}&token=${encodeURIComponent(token)}`;
    const rejectUrl = `${funcBaseUrl}/review-access?action=reject&requestId=${requestId}&token=${encodeURIComponent(token)}`;

    const requestedAt = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
    const nameHtml = escapeHtml(name);
    const emailHtml = escapeHtml(email);

    if (acimaDoLimite) {
      console.warn(`request-access: limite de ${PEDIDOS_NOVOS_POR_HORA} pedidos/h atingido — pedido ${requestId} registrado sem e-mail ao admin`);
      return json({ success: true });
    }

    // Send email to admin
    const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
    const { error: sendError } = await resend.emails.send({
      from: "Aura Orçamentos <noreply@orcamentosaura.com.br>",
      to: [adminEmail],
      subject: `Novo pedido de acesso: ${name}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
        <body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
            <tr><td align="center">
              <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
                <tr>
                  <td style="background:#1a1a2e;padding:32px;text-align:center;">
                    <h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:600;">Aura · Criador de Orçamentos</h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding:32px;">
                    <h2 style="color:#1a1a2e;margin:0 0 16px;font-size:18px;">Novo pedido de acesso</h2>
                    <p style="color:#6b7280;margin:0 0 24px;font-size:14px;">Um novo usuário solicitou acesso ao sistema. Revise os dados abaixo e aprove ou recuse.</p>
                    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:8px;padding:20px;margin-bottom:28px;">
                      <tr>
                        <td style="padding:6px 0;">
                          <span style="color:#6b7280;font-size:13px;font-weight:500;">Nome</span><br>
                          <span style="color:#111827;font-size:15px;font-weight:600;">${nameHtml}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;">
                          <span style="color:#6b7280;font-size:13px;font-weight:500;">E-mail</span><br>
                          <span style="color:#111827;font-size:15px;">${emailHtml}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;">
                          <span style="color:#6b7280;font-size:13px;font-weight:500;">Solicitado em</span><br>
                          <span style="color:#111827;font-size:15px;">${requestedAt}</span>
                        </td>
                      </tr>
                    </table>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding-right:8px;" width="50%">
                          <a href="${approveUrl}" style="display:block;text-align:center;background:#16a34a;color:#ffffff;text-decoration:none;padding:14px 20px;border-radius:8px;font-size:15px;font-weight:600;">✓ Aprovar Acesso</a>
                        </td>
                        <td style="padding-left:8px;" width="50%">
                          <a href="${rejectUrl}" style="display:block;text-align:center;background:#dc2626;color:#ffffff;text-decoration:none;padding:14px 20px;border-radius:8px;font-size:15px;font-weight:600;">✗ Recusar Acesso</a>
                        </td>
                      </tr>
                    </table>
                    <p style="color:#9ca3af;font-size:12px;margin:24px 0 0;text-align:center;">Este link expira em 24 horas.</p>
                  </td>
                </tr>
              </table>
            </td></tr>
          </table>
        </body>
        </html>
      `,
    });
    if (sendError) {
      // o pedido já está gravado; o admin ainda o vê no painel
      console.error("request-access resend error:", sendError);
    }

    return json({ success: true });
  } catch (err) {
    console.error("request-access error:", err);
    return json({ error: "Erro interno do servidor" }, 500);
  }
});
