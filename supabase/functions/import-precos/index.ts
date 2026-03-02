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

    const batchSize = 500;
    let updated = 0;

    for (let i = 0; i < precos.length; i += batchSize) {
      const batch = precos.slice(i, i + batchSize);

      // Update each product's prices by codigo
      for (const item of batch) {
        const updateData: Record<string, any> = {};
        if (item.preco_tabela !== undefined) updateData.preco_tabela = item.preco_tabela;
        if (item.preco_minimo !== undefined) updateData.preco_minimo = item.preco_minimo;

        const { error } = await supabase
          .from('produtos')
          .update(updateData)
          .eq('codigo', item.codigo);

        if (!error) updated++;
      }
    }

    return new Response(JSON.stringify({ success: true, updated }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
