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

function appUrl(): string {
  return Deno.env.get("APP_URL") || "https://orcamentosaura.com.br";
}

function redirectToResult(status: string, params: Record<string, string> = {}): Response {
  const qs = new URLSearchParams({ status, ...params });
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
      return redirectToResult(
        request.status === "APPROVED" ? "already-approved" : "already-rejected"
      );
    }

    const adminEmail = Deno.env.get("ADMIN_EMAIL")!;
    const signupUrl = `${appUrl()}/auth?mode=signup`;
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
                      <h2 style="color:#1a1a2e;margin:0 0 12px;font-size:22px;">Acesso aprovado, ${request.name}!</h2>
                      <p style="color:#6b7280;margin:0 0 28px;font-size:15px;line-height:1.6;">Seu pedido de acesso ao sistema Aura foi aprovado. Agora você pode criar sua conta.</p>
                      <a href="${signupUrl}" style="display:inline-block;background:#1a1a2e;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:15px;font-weight:600;">Criar minha conta →</a>
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

      return redirectToResult("approved", { name: request.name, email: request.email });
    } else {
      // Reject
      await supabase
        .from("access_requests")
        .update({ status: "REJECTED", reviewed_at: new Date().toISOString(), reviewed_by: adminEmail })
        .eq("id", requestId);

      // Email to requester
      await resend.emails.send({
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

      return redirectToResult("rejected", { name: request.name, email: request.email });
    }
  } catch (err) {
    console.error("review-access error:", err);
    return redirectToResult("error");
  }
});
