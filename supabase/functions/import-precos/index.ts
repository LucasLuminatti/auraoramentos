import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { precos } = await req.json();

    if (!Array.isArray(precos) || precos.length === 0) {
      return new Response(JSON.stringify({ error: 'No precos provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch existing codes to identify missing ones
    const allCodigos = precos.map((p) => String(p.codigo).trim());
    const { data: existingRows } = await supabase
      .from('produtos')
      .select('codigo')
      .in('codigo', allCodigos);

    const existingCodigos = new Set((existingRows ?? []).map((r: any) => r.codigo));

    let updated = 0;
    const failed: Array<Record<string, any>> = [];

    // Process all items in parallel
    const results = await Promise.all(
      precos.map(async (item) => {
        const codigo = String(item.codigo).trim();

        if (!existingCodigos.has(codigo)) {
          failed.push({ ...item, erro: 'Código não cadastrado na base - importe o produto primeiro na aba "Produtos"' });
          return;
        }

        const updateData: Record<string, any> = {};
        if (item.preco_tabela !== undefined && item.preco_tabela !== null) updateData.preco_tabela = item.preco_tabela;
        if (item.preco_minimo !== undefined && item.preco_minimo !== null) updateData.preco_minimo = item.preco_minimo;

        if (Object.keys(updateData).length === 0) {
          failed.push({ ...item, erro: 'Nenhum preço válido informado (tabela ou mínimo)' });
          return;
        }

        const { error } = await supabase
          .from('produtos')
          .update(updateData)
          .eq('codigo', codigo);

        if (error) {
          failed.push({ ...item, erro: error.message });
        } else {
          updated++;
        }
      })
    );

    return new Response(JSON.stringify({ success: true, updated, failed }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
