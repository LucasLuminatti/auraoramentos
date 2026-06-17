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
    const { data: existingRows, error: existingError } = await supabase
      .from('produtos')
      .select('codigo')
      .in('codigo', allCodigos);

    if (existingError) {
      return new Response(JSON.stringify({ error: 'Falha ao consultar produtos existentes: ' + existingError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const existingCodigos = new Set((existingRows ?? []).map((r: any) => r.codigo));

    // Preços ajustados manualmente (editado_manualmente=true) NÃO são sobrescritos por
    // import em massa (decisão Lenny 2026-06-17). A flag só existe em product_variants —
    // a view `produtos` não a expõe — então lemos a tabela canônica.
    // CRÍTICO: se esta query falhar, ABORTAR — nunca sobrescrever sem confirmar os locks,
    // senão um erro transitório apagaria preços editados na mão (code review WR-01).
    const { data: lockRows, error: lockError } = await supabase
      .from('product_variants')
      .select('codigo')
      .in('codigo', allCodigos)
      .eq('editado_manualmente', true);

    if (lockError) {
      return new Response(JSON.stringify({ error: 'Falha ao verificar preços editados manualmente — import abortado para não sobrescrevê-los: ' + lockError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const lockedCodigos = new Set((lockRows ?? []).map((r: any) => r.codigo));

    let updated = 0;
    const preservados: Array<Record<string, any>> = [];
    const failed: Array<Record<string, any>> = [];

    // Process all items in parallel
    const results = await Promise.all(
      precos.map(async (item) => {
        const codigo = String(item.codigo).trim();

        if (!existingCodigos.has(codigo)) {
          failed.push({ ...item, erro: 'Código não cadastrado na base - importe o produto primeiro na aba "Produtos"' });
          return;
        }

        if (lockedCodigos.has(codigo)) {
          preservados.push({ ...item, motivo: 'Preço editado manualmente — preservado (não sobrescrito)' });
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

    return new Response(JSON.stringify({ success: true, updated, preservados, failed }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
