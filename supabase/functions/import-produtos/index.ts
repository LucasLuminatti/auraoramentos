import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ALLOWED_FIELDS = new Set([
  "codigo", "descricao", "grupo", "categoria",
  "preco_tabela", "preco_minimo", "wm", "voltagem", "passadas",
  "familia_perfil", "fita_compativel",
  "driver_potencia_w", "driver_tipo", "driver_restr_tipo", "driver_restr_max_w",
  "sistema_magnetico", "is_baby",
]);

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

    let inserted = 0;
    const failed: Array<Record<string, any>> = [];

    const validItems: Array<Record<string, any>> = [];
    for (const item of produtos) {
      const codigo = String(item.codigo ?? '').trim();
      const descricao = String(item.descricao ?? '').trim();

      if (!codigo) {
        failed.push({ ...item, erro: 'Campo "código" está vazio ou ausente' });
        continue;
      }
      if (!descricao) {
        failed.push({ ...item, erro: 'Campo "descrição" está vazio ou ausente' });
        continue;
      }

      const clean: Record<string, any> = { codigo, descricao };
      for (const [key, value] of Object.entries(item)) {
        if (key === 'codigo' || key === 'descricao') continue;
        if (!ALLOWED_FIELDS.has(key)) continue;
        if (value === null || value === undefined || value === '') continue;
        clean[key] = value;
      }

      validItems.push(clean);
    }

    const batchSize = 500;
    for (let i = 0; i < validItems.length; i += batchSize) {
      const batch = validItems.slice(i, i + batchSize);
      const { error } = await supabase
        .from('produtos')
        .upsert(batch, { onConflict: 'codigo' });

      if (error) {
        for (const item of batch) {
          const { error: itemError } = await supabase
            .from('produtos')
            .upsert(item, { onConflict: 'codigo' });

          if (itemError) {
            failed.push({ ...item, erro: itemError.message });
          } else {
            inserted++;
          }
        }
      } else {
        inserted += batch.length;
      }
    }

    return new Response(JSON.stringify({ success: true, inserted, failed }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
