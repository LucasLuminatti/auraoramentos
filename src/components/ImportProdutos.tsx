import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import ImportMapper, { ImportField } from "./ImportMapper";

const fields: ImportField[] = [
  { name: "codigo", label: "Código", required: true },
  { name: "descricao", label: "Descrição", required: true },
];

const BATCH_SIZE = 500;

const ImportProdutos = () => {
  const handleImport = async (rows: Record<string, any>[], onProgress: (processed: number, total: number) => void) => {
    const produtos = rows.map((r) => ({
      codigo: String(r.codigo).trim(),
      descricao: String(r.descricao).trim(),
    }));

    let totalInserted = 0;
    for (let i = 0; i < produtos.length; i += BATCH_SIZE) {
      const batch = produtos.slice(i, i + BATCH_SIZE);
      const { data, error } = await supabase.functions.invoke("import-produtos", {
        body: { produtos: batch },
      });

      if (error) {
        toast.error(error.message || "Erro na importação");
        return;
      }
      totalInserted += data.inserted;
      onProgress(Math.min(i + BATCH_SIZE, produtos.length), produtos.length);
    }
    toast.success(`${totalInserted} produtos importados com sucesso!`);
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
