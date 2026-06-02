/**
 * Helper de limpeza pros testes E2E: usa a service role pra apagar APENAS o
 * orçamento que o teste criou em produção. NUNCA importado pelo app.
 *
 * Estratégia segura (não apaga dado real, mesmo com usuário real criando junto):
 *   1. snapshot dos ids existentes ANTES do teste criar nada;
 *   2. depois, apaga só ids NOVOS (não estavam no snapshot) que batem a
 *      impressão digital do teste (status + tipo + valor). Deleção é sempre por id.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

let _client: SupabaseClient | null = null;
export function admin(): SupabaseClient {
  if (!URL || !SERVICE_KEY) {
    throw new Error("Faltam VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no .env.local");
  }
  if (!_client) {
    _client = createClient(URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return _client;
}

/** Conjunto de todos os ids de orçamento existentes agora (paginado). */
export async function snapshotOrcamentoIds(): Promise<Set<string>> {
  const ids = new Set<string>();
  let from = 0;
  const page = 1000;
  for (;;) {
    const { data, error } = await admin().from("orcamentos").select("id").range(from, from + page - 1);
    if (error) throw new Error(`snapshot falhou: ${error.message}`);
    if (!data?.length) break;
    for (const r of data) ids.add(r.id);
    if (data.length < page) break;
    from += page;
  }
  return ids;
}

export interface FingerprintOrcamento {
  tipo: string;
  valor: number;
  status?: string;
}

/**
 * Apaga (por id) os orçamentos NOVOS criados após `isoUtc` que não existiam no
 * `idsAntes` e batem a impressão digital. Retorna quantos apagou. Nunca apaga
 * linha pré-existente nem de fingerprint diferente.
 */
export async function deleteOrcamentoDeTeste(
  idsAntes: Set<string>,
  isoUtc: string,
  fp: FingerprintOrcamento,
): Promise<number> {
  const { data, error } = await admin()
    .from("orcamentos")
    .select("id,valor,status,tipo")
    .gte("created_at", isoUtc);
  if (error) throw new Error(`busca de cleanup falhou: ${error.message}`);

  const alvos = (data ?? []).filter(
    (r) =>
      !idsAntes.has(r.id) &&
      r.tipo === fp.tipo &&
      (fp.status === undefined || r.status === fp.status) &&
      Math.abs(Number(r.valor) - fp.valor) < 0.01,
  );
  if (!alvos.length) return 0;

  const { data: del, error: delErr } = await admin()
    .from("orcamentos")
    .delete()
    .in("id", alvos.map((a) => a.id))
    .select("id");
  if (delErr) throw new Error(`cleanup falhou: ${delErr.message}`);
  return del?.length ?? 0;
}
