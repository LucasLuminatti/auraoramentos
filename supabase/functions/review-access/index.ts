import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";

// Segurança (auditoria 2026-09-15):
// - nome e e-mail do solicitante iam crus no HTML dos e-mails (phishing para um endereço que o
//   próprio solicitante escolhe);
// - aprovar e recusar em paralelo passavam ambos pela checagem de PENDING (a atualização agora
//   é condicional e só um vence);
// - nome e e-mail iam na query string do redirect (histórico do navegador, logs).
// Pendente: confirmação em dois passos, para scanner de links do e-mail não aprovar sozinho.

function escapeHtml(s: string): string {
  return String(s ?? "")
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

function appUrl(): string {
  return Deno.env.get("APP_URL") || "https://orcamentosaura.com.br";
}

function redirectToResult(status: string): Response {
  const qs = new URLSearchParams({ status });
  const url = `${appUrl()}/access-result?${qs.toString()}`;
  return Response.redirect(url, 302);
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const action = url.searchParams.get("action");
  const requestId = url.searchParams.get("requestId");
  const token = url.searchParams.get("token");

  if (!action || !requestId || !token) {
    return redirectToResult("invalid");
  }

  if (action !== "approve" && action !== "reject") {
    return redirectToResult("invalid");
  }

  try {
    const secret = Deno.env.get("APPROVAL_TOKEN_SECRET")!;

    // Decode and verify token
    const [encodedPayload, signature] = token.split(".");
    if (!encodedPayload || !signature) {
      return redirectToResult("invalid");
    }

    const payload = atob(encodedPayload.replace(/-/g, "+").replace(/_/g, "/"));
    const expectedSig = await hmacSign(secret, payload);

    if (expectedSig !== signature) {
      return redirectToResult("invalid");
    }

    const [tokenRequestId, expStr] = payload.split(":");
    const exp = parseInt(expStr, 10);

    if (tokenRequestId !== requestId) {
      return redirectToResult("invalid");
    }

    if (Date.now() > exp) {
      return redirectToResult("expired");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      (Deno.env.get("SB_SECRET_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"))!
    );

    const statusAtual = async (): Promise<Response> => {
      const { data } = await supabase
        .from("access_requests")
        .select("status, email")
        .eq("id", requestId)
        .maybeSingle();
      if (!data) return redirectToResult("not-found");
      if (data.status === "APPROVED") {
        // idempotente: se a aprovação anterior caiu antes de liberar o e-mail, libera agora
        const { error } = await supabase
          .from("allowed_users")
          .upsert({ email: data.email, role: "user" }, { onConflict: "email", ignoreDuplicates: true });
        if (error) console.error("review-access allowed_users (reprocesso) error:", error);
      }
      return redirectToResult(data.status === "APPROVED" ? "already-approved" : "already-rejected");
    };

    // Fetch the request
    const { data: request, error: fetchError } = await supabase
      .from("access_requests")
      .select("*")
      .eq("id", requestId)
      .maybeSingle();

    if (fetchError || !request) {
      return redirectToResult("not-found");
    }

    if (request.status !== "PENDING") {
      return statusAtual();
    }

    const adminEmail = Deno.env.get("ADMIN_EMAIL")!;
    const signupUrl = `${appUrl()}/auth?mode=signup`;
    const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
    const nameHtml = escapeHtml(request.name);
    const emailHtml = escapeHtml(request.email);
    const novoStatus = action === "approve" ? "APPROVED" : "REJECTED";

    // Atualização condicional: só muda se ainda estiver PENDING. Se outra chamada decidiu antes,
    // nada é alterado e o resultado reflete a decisão que venceu.
    const { data: atualizados, error: updateError } = await supabase
      .from("access_requests")
      .update({ status: novoStatus, reviewed_at: new Date().toISOString(), reviewed_by: adminEmail })
      .eq("id", requestId)
      .eq("status", "PENDING")
      .select("id");

    if (updateError) {
      console.error("review-access update error:", updateError);
      return redirectToResult("error");
    }
    if (!atualizados || atualizados.length === 0) {
      return statusAtual();
    }

    if (action === "approve") {
      // Add to allowed_users
      const { error: allowError } = await supabase
        .from("allowed_users")
        .upsert({ email: request.email, role: "user" }, { onConflict: "email", ignoreDuplicates: true });
      if (allowError) {
        console.error("review-access allowed_users error:", allowError);
        return redirectToResult("error");
      }

      // Email to requester
      const { error: sendError } = await resend.emails.send({
        from: "Aura Orçamentos <noreply@orcamentosaura.com.br>",
        to: [request.email],
        subject: "Seu acesso foi aprovado! ✓",
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
                    <td style="padding:40px 32px;text-align:center;">
                      <div style="font-size:48px;margin-bottom:20px;">🎉</div>
                      <h2 style="color:#1a1a2e;margin:0 0 12px;font-size:22px;">Acesso aprovado, ${nameHtml}!</h2>
                      <p style="color:#6b7280;margin:0 0 28px;font-size:15px;line-height:1.6;">Seu pedido de acesso ao sistema Aura foi aprovado. Agora você pode criar sua conta.</p>
                      <a href="${signupUrl}" style="display:inline-block;background:#1a1a2e;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:15px;font-weight:600;">Criar minha conta →</a>
                      <p style="color:#9ca3af;font-size:12px;margin:24px 0 0;">Acesse com o e-mail: <strong>${emailHtml}</strong></p>
                    </td>
                  </tr>
                </table>
              </td></tr>
            </table>
          </body>
          </html>
        `,
      });
      if (sendError) console.error("review-access resend error:", sendError);

      return redirectToResult("approved");
    }

    // Email to requester (reject)
    const { error: sendError } = await resend.emails.send({
      from: "Aura Orçamentos <noreply@orcamentosaura.com.br>",
      to: [request.email],
      subject: "Atualização sobre seu pedido de acesso",
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
                  <td style="padding:40px 32px;text-align:center;">
                    <h2 style="color:#1a1a2e;margin:0 0 12px;font-size:20px;">Olá, ${nameHtml}</h2>
                    <p style="color:#6b7280;margin:0;font-size:15px;line-height:1.6;">Infelizmente seu pedido de acesso ao sistema Aura não foi aprovado desta vez. Se acredita que houve um engano, entre em contato diretamente com a equipe.</p>
                  </td>
                </tr>
              </table>
            </td></tr>
          </table>
        </body>
        </html>
      `,
    });
    if (sendError) console.error("review-access resend error:", sendError);

    return redirectToResult("rejected");
  } catch (err) {
    console.error("review-access error:", err);
    return redirectToResult("error");
  }
});
