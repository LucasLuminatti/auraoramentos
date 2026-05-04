// Phase 3 / Plan 04: refator de alvo produtos → product_variants
// - Cria pais ad-hoc se necessário (mas default é P-LEGADO)
// - Retorna { inserted, updated, failed[] } para UI mostrar contadores reais
//
// D-05 INVARIANTE (propagado para CSV diário também):
// UPDATE patch NÃO inclui preco_tabela, preco_minimo, arquiteto_id nem editado_manualmente.
// Apenas master via reconcile() é legítima pra sobrescrever specs.
// CSV diário só toca: descricao, nome, tensao, watts_por_metro, potencia_watts, cor, imagem_url.

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ProdutoCsvRow {
  codigo: string;
  descricao: string;
  nome?: string;
  categoria?: string;
  tipologia?: string;
  tensao?: number;
  watts_por_metro?: number;
  potencia_watts?: number;
  cor?: string;
  imagem_url?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) {
      return new Response(JSON.stringify({ error: "Missing Supabase env" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const supabase = createClient(supabaseUrl, serviceKey);

    const { produtos } = (await req.json()) as { produtos: ProdutoCsvRow[] };
    if (!Array.isArray(produtos)) {
      return new Response(JSON.stringify({ error: "produtos must be array" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 1. Resolve P-LEGADO uma vez
    const { data: legado, error: legadoErr } = await supabase
      .from("products")
      .select("id")
      .eq("codigo_pai", "P-LEGADO")
      .maybeSingle();
    if (legadoErr || !legado) {
      return new Response(JSON.stringify({ error: "P-LEGADO not found — run migrations" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const legadoId = legado.id;

    // 2. Pega quem já existe
    const codigos = produtos.map((p) => p.codigo).filter(Boolean);
    const existing = new Set<string>();
    if (codigos.length > 0) {
      const { data: ex } = await supabase
        .from("product_variants")
        .select("codigo")
        .in("codigo", codigos);
      for (const r of ex || []) existing.add(r.codigo);
    }

    // 3. Separa creates vs updates
    const creates: any[] = [];
    const updates: Array<{ codigo: string; patch: any }> = [];
    for (const p of produtos) {
      if (!p.codigo || !p.descricao) continue;
      if (existing.has(p.codigo)) {
        // update — NÃO toca preço/arquiteto/editado_manualmente (D-05 invariante para CSV diário também)
        const patch: any = {
          descricao: p.descricao,
        };
        if (p.nome) patch.nome = p.nome;
        if (p.tensao != null) patch.tensao = p.tensao;
        if (p.watts_por_metro != null) patch.watts_por_metro = p.watts_por_metro;
        if (p.potencia_watts != null) patch.potencia_watts = p.potencia_watts;
        if (p.cor) patch.cor = p.cor;
        if (p.imagem_url) patch.imagem_url = p.imagem_url;
        updates.push({ codigo: p.codigo, patch });
      } else {
        creates.push({
          codigo: p.codigo,
          descricao: p.descricao,
          nome: p.nome || p.descricao,
          product_id: legadoId,
          origem: "manual",
          editado_manualmente: false,
          atributos: {},
          tensao: p.tensao ?? null,
          watts_por_metro: p.watts_por_metro ?? null,
          potencia_watts: p.potencia_watts ?? null,
          cor: p.cor ?? null,
          imagem_url: p.imagem_url ?? null,
        });
      }
    }

    let inserted = 0;
    let updated = 0;
    const failed: Array<{ codigo: string; descricao: string; erro: string }> = [];

    // 4. INSERT batch (com fallback per-item se falhar — IMP-06)
    if (creates.length > 0) {
      const { error: insertErr, data: insData } = await supabase
        .from("product_variants")
        .insert(creates)
        .select("codigo");
      if (insertErr) {
        // Fallback per-item
        for (const row of creates) {
          const { error: itemErr } = await supabase.from("product_variants").insert(row);
          if (itemErr) {
            failed.push({ codigo: row.codigo, descricao: row.descricao, erro: itemErr.message });
          } else {
            inserted++;
          }
        }
      } else {
        inserted = insData?.length ?? creates.length;
      }
    }

    // 5. UPDATE per-item (patches diferentes)
    for (const u of updates) {
      const { error: updErr } = await supabase
        .from("product_variants")
        .update(u.patch)
        .eq("codigo", u.codigo);
      if (updErr) {
        failed.push({ codigo: u.codigo, descricao: u.patch.descricao || "", erro: updErr.message });
      } else {
        updated++;
      }
    }

    return new Response(
      JSON.stringify({ inserted, updated, failed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
