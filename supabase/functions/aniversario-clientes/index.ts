// Phase 12 / Plan 02 — Edge function batch de aniversário
// Refs: CONTEXT D-01..D-09; replica pattern de supabase/functions/request-access/index.ts
//
// POST /functions/v1/aniversario-clientes
// Sem body. Auth via Authorization Bearer SERVICE_ROLE (Supabase Functions default).
// Cron chama uma vez por dia (Wave 3 / Migration 20260515000002_aniversario_cron_schedule.sql).
// Lenny pode disparar manual via curl pra smoke (Phase 13).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ClienteAniversariante {
  id: string;
  nome: string;
  data_nascimento: string;
  contato: string | null;
  user_id: string;
  colab_email: string | null;
}

interface AdminEmailRow {
  email: string;
}

// WR-05: valida formato de email (não só trim) — evita marcar como `failed` o que deveria ser `skipped_no_owner`
const isValidEmail = (e: string | null | undefined): boolean =>
  !!e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

    // 1. Calcular ano_referencia a partir do target date (não today — evita bug de fim de ano, RESEARCH Pitfall 3)
    const target = new Date();
    target.setUTCDate(target.getUTCDate() + 5);
    const anoReferencia = target.getUTCFullYear();

    // 2. Buscar aniversariantes D-5 (stored fn cobre 29/02 + filtro de já notificados)
    const { data: aniversariantes, error: queryErr } = await supabase.rpc(
      "buscar_aniversariantes_d5"
    );

    if (queryErr) {
      console.error("buscar_aniversariantes_d5 failed:", queryErr);
      return new Response(
        JSON.stringify({ error: queryErr.message }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // 3. Buscar emails de admins UMA vez (stored fn, evita N+1)
    const { data: adminRows, error: adminErr } = await supabase.rpc(
      "buscar_admins_emails"
    );

    if (adminErr) {
      console.error("buscar_admins_emails failed:", adminErr);
      return new Response(
        JSON.stringify({ error: adminErr.message }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const adminEmails: string[] = ((adminRows ?? []) as AdminEmailRow[])
      .map((r) => r.email)
      .filter((e) => isValidEmail(e));

    let processed = 0;
    let sent = 0;
    let failed = 0;
    let skipped = 0;

    console.log(
      `[aniversario-clientes] ano_referencia=${anoReferencia} aniversariantes=${
        (aniversariantes ?? []).length
      } admins=${adminEmails.length}`
    );

    // 4. Loop por aniversariante
    for (const cliente of (aniversariantes ?? []) as ClienteAniversariante[]) {
      processed++;

      // 4a. Cliente órfão (colab dono sem email válido) — registra skipped sem enviar (D-06)
      // WR-05: validar formato de email (não só trim) — evita marcar como `failed` o que deveria ser `skipped_no_owner`
      if (!isValidEmail(cliente.colab_email)) {
        const { error: skipErr } = await supabase
          .from("aniversario_envios")
          .insert({
            cliente_id: cliente.id,
            ano_referencia: anoReferencia,
            destinatarios: { colab_email: null, admin_emails: adminEmails },
            status: "skipped_no_owner",
            error_msg: "colab dono sem email válido (auth.users.email nulo, vazio ou malformado)",
          });
        if (skipErr && skipErr.code !== "23505") {
          console.error(`[skip-insert ${cliente.id}] ${skipErr.message}`);
        }
        skipped++;
        continue;
      }

      // WR-01: deduplicar admin_emails em relação ao colab_email — quando colab é admin (ex: Lenny),
      // o email apareceria duas vezes no `to` do Resend. Mantém log fiel ao que foi enviado.
      const adminEmailsDedup = adminEmails.filter((e) => e !== cliente.colab_email);
      const destinatarios = {
        colab_email: cliente.colab_email,
        admin_emails: adminEmailsDedup,
      };

      // 4b. INSERT log com status optimistic 'sent' — UNIQUE constraint garante idempotência (D-02)
      const { data: inserted, error: insErr } = await supabase
        .from("aniversario_envios")
        .insert({
          cliente_id: cliente.id,
          ano_referencia: anoReferencia,
          destinatarios,
          status: "sent",
        })
        .select("id")
        .single();

      if (insErr) {
        // 23505 = unique_violation → já notificado este ano (idempotência)
        if (insErr.code === "23505") {
          skipped++;
          continue;
        }
        console.error(`[log-insert ${cliente.id}] ${insErr.message}`);
        failed++;
        continue;
      }

      const logId = inserted!.id;

      // 4c. Enviar email via Resend
      // WR-01: toList usa adminEmailsDedup para evitar duplicação quando colab é admin
      const toList = [cliente.colab_email, ...adminEmailsDedup];
      // WR-04: parse manual de data_nascimento (formato Postgres DATE 'YYYY-MM-DD') —
      // evita ambiguidade UTC de `new Date(string)` caso o driver mude o shape no futuro.
      const [yyyyStr, mmStr, ddStr] = cliente.data_nascimento.split("-");
      const yyyy = Number(yyyyStr);
      const mm = Number(mmStr);
      const dd = Number(ddStr);
      const dataFormatada = `${String(dd).padStart(2, "0")}/${String(mm).padStart(2, "0")}`;
      const idadeQueCompleta = anoReferencia - yyyy;

      try {
        const result = await resend.emails.send({
          from: "Aura Orçamentos <noreply@orcamentosaura.com.br>",
          to: toList,
          subject: `Aniversário em 5 dias: ${cliente.nome}`,
          html: buildHtml({
            nome: cliente.nome,
            dataFormatada,
            idade: idadeQueCompleta,
            contato: cliente.contato,
          }),
        });

        if (result.error) {
          throw new Error(result.error.message || JSON.stringify(result.error));
        }
        sent++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[resend ${cliente.id}] ${msg}`);
        // D-09: sem retry. UNIQUE constraint impede tentativa nova no mesmo ano.
        await supabase
          .from("aniversario_envios")
          .update({ status: "failed", error_msg: msg })
          .eq("id", logId);
        failed++;
      }
    }

    console.log(
      `[aniversario-clientes done] processed=${processed} sent=${sent} failed=${failed} skipped=${skipped}`
    );

    return new Response(
      JSON.stringify({ processed, sent, failed, skipped, ano_referencia: anoReferencia }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (err) {
    console.error("aniversario-clientes fatal:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "internal error" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});

function buildHtml(args: {
  nome: string;
  dataFormatada: string;
  idade: number;
  contato: string | null;
}): string {
  const { nome, dataFormatada, idade, contato } = args;
  const idadeLabel = idade > 0 ? ` (completa ${idade} anos)` : "";
  const contatoBlock = contato
    ? `
                      <tr>
                        <td style="padding:6px 0;">
                          <span style="color:#6b7280;font-size:13px;font-weight:500;">Contato</span><br>
                          <span style="color:#111827;font-size:15px;">${contato}</span>
                        </td>
                      </tr>`
    : "";

  return `
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
                <h2 style="color:#1a1a2e;margin:0 0 16px;font-size:18px;">Aniversário próximo — 5 dias</h2>
                <p style="color:#6b7280;margin:0 0 24px;font-size:14px;">
                  <strong>${nome}</strong> faz aniversário em <strong>${dataFormatada}</strong>${idadeLabel}.
                  É uma boa hora pra mandar uma mensagem.
                </p>
                <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:8px;padding:20px;margin-bottom:28px;">
                  <tr>
                    <td style="padding:6px 0;">
                      <span style="color:#6b7280;font-size:13px;font-weight:500;">Cliente</span><br>
                      <span style="color:#111827;font-size:15px;font-weight:600;">${nome}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:6px 0;">
                      <span style="color:#6b7280;font-size:13px;font-weight:500;">Data</span><br>
                      <span style="color:#111827;font-size:15px;">${dataFormatada}</span>
                    </td>
                  </tr>${contatoBlock}
                </table>
                <a href="https://orcamentosaura.com.br/admin?tab=clientes" style="display:block;text-align:center;background:#16a34a;color:#ffffff;text-decoration:none;padding:14px 20px;border-radius:8px;font-size:15px;font-weight:600;">
                  Abrir clientes no Aura
                </a>
                <p style="color:#9ca3af;font-size:12px;margin:24px 0 0;text-align:center;">Enviado automaticamente pelo Aura — 5 dias antes do aniversário do cliente.</p>
              </td>
            </tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>
  `;
}
