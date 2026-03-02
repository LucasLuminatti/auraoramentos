import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";

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

function htmlPage(title: string, emoji: string, heading: string, body: string, color: string): Response {
  return new Response(
    `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f4f4f5; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
    .card { background: #fff; border-radius: 16px; box-shadow: 0 4px 24px rgba(0,0,0,0.10); padding: 48px 40px; max-width: 480px; width: 100%; text-align: center; }
    .emoji { font-size: 56px; margin-bottom: 20px; }
    h1 { font-size: 24px; font-weight: 700; color: #111827; margin-bottom: 12px; }
    p { font-size: 15px; color: #6b7280; line-height: 1.6; }
    .badge { display: inline-block; margin-top: 20px; padding: 6px 16px; border-radius: 20px; font-size: 13px; font-weight: 600; background: ${color}20; color: ${color}; }
  </style>
</head>
<body>
  <div class="card">
    <div class="emoji">${emoji}</div>
    <h1>${heading}</h1>
    <p>${body}</p>
    <span class="badge">Aura · Criador de Orçamentos</span>
  </div>
</body>
</html>`,
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const action = url.searchParams.get("action");
  const requestId = url.searchParams.get("requestId");
  const token = url.searchParams.get("token");

  if (!action || !requestId || !token) {
    return htmlPage("Erro", "⚠️", "Link inválido", "Os parâmetros necessários estão ausentes. Verifique o link e tente novamente.", "#f59e0b");
  }

  if (action !== "approve" && action !== "reject") {
    return htmlPage("Erro", "⚠️", "Ação inválida", "A ação especificada não é reconhecida.", "#f59e0b");
  }

  try {
    const secret = Deno.env.get("APPROVAL_TOKEN_SECRET")!;

    // Decode and verify token
    const [encodedPayload, signature] = token.split(".");
    if (!encodedPayload || !signature) {
      return htmlPage("Link inválido", "🔒", "Link inválido ou corrompido", "O link de aprovação está inválido. Peça ao solicitante para fazer um novo pedido.", "#dc2626");
    }

    const payload = atob(encodedPayload.replace(/-/g, "+").replace(/_/g, "/"));
    const expectedSig = await hmacSign(secret, payload);

    if (expectedSig !== signature) {
      return htmlPage("Link inválido", "🔒", "Assinatura inválida", "O link de aprovação não é autêntico ou foi modificado.", "#dc2626");
    }

    const [tokenRequestId, expStr] = payload.split(":");
    const exp = parseInt(expStr, 10);

    if (tokenRequestId !== requestId) {
      return htmlPage("Link inválido", "🔒", "Link inválido", "O identificador do pedido não corresponde ao token.", "#dc2626");
    }

    if (Date.now() > exp) {
      return htmlPage("Link expirado", "⏰", "Este link expirou", "O link de aprovação é válido por 24 horas. Peça ao solicitante para fazer um novo pedido de acesso.", "#f59e0b");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch the request
    const { data: request, error: fetchError } = await supabase
      .from("access_requests")
      .select("*")
      .eq("id", requestId)
      .maybeSingle();

    if (fetchError || !request) {
      return htmlPage("Não encontrado", "🔍", "Pedido não encontrado", "O pedido de acesso não foi encontrado no sistema.", "#f59e0b");
    }

    if (request.status !== "PENDING") {
      const alreadyMsg = request.status === "APPROVED"
        ? "Este pedido já foi <strong>aprovado</strong> anteriormente."
        : "Este pedido já foi <strong>recusado</strong> anteriormente.";
      return htmlPage("Já processado", "✅", "Pedido já revisado", alreadyMsg, "#6b7280");
    }

    const adminEmail = Deno.env.get("ADMIN_EMAIL")!;
    const appUrl = Deno.env.get("APP_URL") || "https://id-preview--4b83f535-5981-45a3-8f30-77b74fb023aa.lovable.app";
    const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

    if (action === "approve") {
      // Update status
      await supabase
        .from("access_requests")
        .update({ status: "APPROVED", reviewed_at: new Date().toISOString(), reviewed_by: adminEmail })
        .eq("id", requestId);

      // Add to allowed_users
      await supabase
        .from("allowed_users")
        .upsert({ email: request.email, role: "user" }, { onConflict: "email", ignoreDuplicates: true });

      // Email to requester
      await resend.emails.send({
        from: "Aura Orçamentos <onboarding@resend.dev>",
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
                      <h2 style="color:#1a1a2e;margin:0 0 12px;font-size:22px;">Acesso aprovado, ${request.name}!</h2>
                      <p style="color:#6b7280;margin:0 0 28px;font-size:15px;line-height:1.6;">Seu pedido de acesso ao sistema Aura foi aprovado. Agora você pode criar sua conta.</p>
                      <a href="${appUrl}/auth" style="display:inline-block;background:#1a1a2e;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:15px;font-weight:600;">Criar minha conta →</a>
                      <p style="color:#9ca3af;font-size:12px;margin:24px 0 0;">Acesse com o e-mail: <strong>${request.email}</strong></p>
                    </td>
                  </tr>
                </table>
              </td></tr>
            </table>
          </body>
          </html>
        `,
      });

      return htmlPage(
        "Acesso aprovado",
        "✅",
        `Acesso aprovado para ${request.name}`,
        `Um e-mail foi enviado para <strong>${request.email}</strong> com o link para criar a conta.`,
        "#16a34a"
      );
    } else {
      // Reject
      await supabase
        .from("access_requests")
        .update({ status: "REJECTED", reviewed_at: new Date().toISOString(), reviewed_by: adminEmail })
        .eq("id", requestId);

      // Email to requester
      await resend.emails.send({
        from: "Aura Orçamentos <onboarding@resend.dev>",
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
                      <h2 style="color:#1a1a2e;margin:0 0 12px;font-size:20px;">Olá, ${request.name}</h2>
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

      return htmlPage(
        "Acesso recusado",
        "❌",
        `Pedido de ${request.name} recusado`,
        `Um e-mail foi enviado para <strong>${request.email}</strong> informando sobre a recusa.`,
        "#dc2626"
      );
    }
  } catch (err) {
    console.error("review-access error:", err);
    return htmlPage("Erro", "⚠️", "Erro interno", "Ocorreu um erro inesperado. Tente novamente.", "#dc2626");
  }
});
