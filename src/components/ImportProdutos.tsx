import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import ImportMapper, { ImportField } from "./ImportMapper";

const fields: ImportField[] = [
  { name: "codigo", label: "Código", required: true },
  { name: "descricao", label: "Descrição", required: true },
];

const ImportProdutos = () => {
  const handleImport = async (rows: Record<string, any>[]) => {
    const produtos = rows.map((r) => ({
      codigo: String(r.codigo).trim(),
      descricao: String(r.descricao).trim(),
    }));

    const { data, error } = await supabase.functions.invoke("import-produtos", {
      body: { produtos },
    });

    if (error) {
      toast.error(error.message || "Erro na importação");
      return;
    }
    toast.success(`${data.inserted} produtos importados com sucesso!`);
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
