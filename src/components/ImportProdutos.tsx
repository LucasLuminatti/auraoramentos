import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import ImportMapper, { ImportField, ImportResult } from "./ImportMapper";

const fields: ImportField[] = [
  { name: "codigo", label: "Código", required: true },
  { name: "descricao", label: "Descrição", required: true },
];

const BATCH_SIZE = 500;

const ImportProdutos = () => {
  const handleImport = async (rows: Record<string, any>[], onProgress: (processed: number, total: number) => void): Promise<ImportResult> => {
    const produtos = rows.map((r) => ({
      codigo: String(r.codigo).trim(),
      descricao: String(r.descricao).trim(),
    }));

    let totalInserted = 0;
    const allFailed: ImportResult["failed"] = [];

    for (let i = 0; i < produtos.length; i += BATCH_SIZE) {
      const batch = produtos.slice(i, i + BATCH_SIZE);
      const { data, error } = await supabase.functions.invoke("import-produtos", {
        body: { produtos: batch },
      });

      if (error) {
        for (const item of batch) {
          allFailed.push({ ...item, _erro: error.message || "Erro desconhecido no servidor" });
        }
      } else if (!data) {
        for (const item of batch) {
          allFailed.push({ ...item, _erro: "Resposta vazia do servidor" });
        }
      } else {
        totalInserted += data.inserted ?? 0;
        if (data.failed?.length) {
          for (const f of data.failed) {
            allFailed.push({ codigo: f.codigo, descricao: f.descricao, _erro: f.erro });
          }
        }
      }
      onProgress(Math.min(i + BATCH_SIZE, produtos.length), produtos.length);
    }

    if (allFailed.length === 0) {
      toast.success(`${totalInserted} produtos importados com sucesso!`);
    } else {
      toast.warning(`${totalInserted} importados, ${allFailed.length} com erro.`);
    }

    return { totalProcessed: produtos.length, totalSuccess: totalInserted, failed: allFailed };
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Importar Produtos</h2>
        <p className="text-sm text-muted-foreground">
          Faça upload da planilha e mapeie as colunas de <strong>código</strong> e <strong>descrição</strong>.
        </p>
      </div>
      <ImportMapper fields={fields} onImport={handleImport} importLabel="Importar" />
    </div>
  );
};

export default ImportProdutos;
