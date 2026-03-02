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

    const { produtos } = await req.json();

    if (!Array.isArray(produtos) || produtos.length === 0) {
      return new Response(JSON.stringify({ error: 'No produtos provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Insert in batches of 500
    const batchSize = 500;
    let inserted = 0;

    for (let i = 0; i < produtos.length; i += batchSize) {
      const batch = produtos.slice(i, i + batchSize);
      const { error } = await supabase
        .from('produtos')
        .upsert(batch, { onConflict: 'codigo' });

      if (error) {
        console.error('Batch error:', error);
        return new Response(JSON.stringify({ error: error.message, inserted }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      inserted += batch.length;
    }

    return new Response(JSON.stringify({ success: true, inserted }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
