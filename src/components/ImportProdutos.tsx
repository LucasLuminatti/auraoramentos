import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import ImportMapper, { ImportField, ImportResult } from "./ImportMapper";

const fields: ImportField[] = [
  { name: "codigo", label: "Código", required: true },
  { name: "descricao", label: "Descrição", required: true },
  { name: "grupo", label: "Grupo", required: false },
  { name: "categoria", label: "Categoria", required: false },
  { name: "preco_tabela", label: "Preço Tabela", required: false },
  { name: "preco_minimo", label: "Preço Mínimo", required: false },
  { name: "wm", label: "W/m", required: false },
  { name: "voltagem", label: "Voltagem", required: false },
  { name: "passadas", label: "Passadas", required: false },
  { name: "familia_perfil", label: "Família Perfil", required: false },
  { name: "fita_compativel", label: "Fita Compatível", required: false },
  { name: "driver_potencia_w", label: "Potência Driver (W)", required: false },
  { name: "driver_tipo", label: "Tipo Driver", required: false },
  { name: "driver_restr_tipo", label: "Restrição Tipo Driver", required: false },
  { name: "driver_restr_max_w", label: "Restrição Max W Driver", required: false },
  { name: "sistema_magnetico", label: "Sistema Magnético", required: false },
  { name: "is_baby", label: "Baby", required: false },
];

const BATCH_SIZE = 500;

const numericFields = new Set(["preco_tabela", "preco_minimo", "wm", "voltagem", "passadas", "driver_potencia_w", "driver_restr_max_w"]);
const booleanFields = new Set(["is_baby"]);

const ImportProdutos = () => {
  const handleImport = async (rows: Record<string, any>[], onProgress: (processed: number, total: number) => void): Promise<ImportResult> => {
    const produtos = rows.map((r) => {
      const item: Record<string, any> = {
        codigo: String(r.codigo).trim(),
        descricao: String(r.descricao).trim(),
      };

      for (const field of fields) {
        if (field.name === "codigo" || field.name === "descricao") continue;
        if (r[field.name] === undefined || r[field.name] === "" || r[field.name] === null) continue;

        const raw = r[field.name];
        if (numericFields.has(field.name)) {
          const parsed = typeof raw === "string" ? parseFloat(String(raw).replace(",", ".")) : Number(raw);
          if (!isNaN(parsed)) item[field.name] = parsed;
        } else if (booleanFields.has(field.name)) {
          const str = String(raw).toLowerCase().trim();
          item[field.name] = str === "true" || str === "sim" || str === "1" || str === "yes" || str === "s";
        } else {
          item[field.name] = String(raw).trim();
        }
      }

      return item;
    });

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
          Faça upload da planilha e mapeie as colunas aos campos do sistema. Apenas <strong>código</strong> e <strong>descrição</strong> são obrigatórios.
        </p>
      </div>
      <ImportMapper fields={fields} onImport={handleImport} importLabel="Importar" />
    </div>
  );
};

export default ImportProdutos;
