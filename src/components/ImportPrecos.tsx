import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import ImportMapper, { ImportField, ImportResult } from "./ImportMapper";

const fields: ImportField[] = [
  { name: "codigo", label: "Código", required: true },
  { name: "preco_tabela", label: "Preço Tabela", required: false },
  { name: "preco_minimo", label: "Preço Mínimo", required: false },
];

const parsePreco = (val: any): number | undefined => {
  if (typeof val === "number" && val > 0) return val;
  if (!val) return undefined;
  const str = String(val).replace("R$", "").replace(/\s/g, "").replace(",", ".");
  if (str === "-" || str === "" || str === "0") return undefined;
  const num = parseFloat(str);
  return num > 0 ? num : undefined;
};

const BATCH_SIZE = 500;

const ImportPrecos = () => {
  const handleImport = async (rows: Record<string, any>[], onProgress: (processed: number, total: number) => void): Promise<ImportResult> => {
    const precos = rows
      .map((r) => {
        const preco_tabela = parsePreco(r.preco_tabela);
        const preco_minimo = parsePreco(r.preco_minimo);
        if (preco_tabela === undefined && preco_minimo === undefined) return null;
        return {
          codigo: String(r.codigo).trim(),
          ...(preco_tabela !== undefined && { preco_tabela }),
          ...(preco_minimo !== undefined && { preco_minimo }),
        };
      })
      .filter(Boolean) as { codigo: string; preco_tabela?: number; preco_minimo?: number }[];

    if (precos.length === 0) {
      toast.error("Nenhum registro com preços válidos encontrado.");
      return { totalProcessed: 0, totalSuccess: 0, failed: [] };
    }

    let totalUpdated = 0;
    const allFailed: ImportResult["failed"] = [];

    for (let i = 0; i < precos.length; i += BATCH_SIZE) {
      const batch = precos.slice(i, i + BATCH_SIZE);
      const { data, error } = await supabase.functions.invoke("import-precos", {
        body: { precos: batch },
      });

      if (error) {
        for (const item of batch) {
          allFailed.push({ ...item, _erro: error.message || "Erro desconhecido no servidor" });
        }
      } else {
        totalUpdated += data.updated ?? 0;
        if (data.failed?.length) {
          for (const f of data.failed) {
            allFailed.push({ codigo: f.codigo, preco_tabela: f.preco_tabela, preco_minimo: f.preco_minimo, _erro: f.erro });
          }
        }
      }
      onProgress(Math.min(i + BATCH_SIZE, precos.length), precos.length);
    }

    if (allFailed.length === 0) {
      toast.success(`${totalUpdated} preços atualizados com sucesso!`);
    } else {
      toast.warning(`${totalUpdated} atualizados, ${allFailed.length} com erro.`);
    }

    return { totalProcessed: precos.length, totalSuccess: totalUpdated, failed: allFailed };
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Importar Preços</h2>
        <p className="text-sm text-muted-foreground">
          Faça upload da planilha e mapeie as colunas de <strong>código</strong>, <strong>preço tabela</strong> e <strong>preço mínimo</strong>. Os preços serão atualizados para produtos já cadastrados.
        </p>
      </div>
      <ImportMapper fields={fields} onImport={handleImport} importLabel="Atualizar preços de" />
    </div>
  );
};

export default ImportPrecos;
