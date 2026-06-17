import { toast } from "sonner";
import { Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { downloadPrecosTemplate } from "@/lib/downloadPrecosTemplate";
import ImportMapper, { ImportField, ImportResult } from "./ImportMapper";

const fields: ImportField[] = [
  { name: "codigo", label: "Código", required: true },
  { name: "preco_tabela", label: "Preço Tabela", required: false },
  { name: "preco_minimo", label: "Preço Mínimo", required: false },
];

const parsePreco = (val: any): number | undefined => {
  if (typeof val === "number" && val > 0) return val;
  if (!val) return undefined;
  let str = String(val).replace("R$", "").replace(/\s/g, "");
  if (str === "-" || str === "" || str === "0") return undefined;
  // Formato BR "1.234,56": ponto é separador de milhar, vírgula é decimal → remove pontos, vírgula vira ponto.
  // Só vírgula "1234,56": vírgula é decimal. Só ponto "1234.56": já é decimal (deixa parseFloat resolver).
  if (str.includes(",") && str.includes(".")) {
    str = str.replace(/\./g, "").replace(",", ".");
  } else if (str.includes(",")) {
    str = str.replace(",", ".");
  }
  const num = parseFloat(str);
  return Number.isFinite(num) && num > 0 ? num : undefined;
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
    let totalPreservados = 0;
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
      } else if (!data) {
        for (const item of batch) {
          allFailed.push({ ...item, _erro: "Resposta vazia do servidor" });
        }
      } else {
        totalUpdated += data.updated ?? 0;
        totalPreservados += data.preservados?.length ?? 0;
        if (data.failed?.length) {
          for (const f of data.failed) {
            allFailed.push({ codigo: f.codigo, preco_tabela: f.preco_tabela, preco_minimo: f.preco_minimo, _erro: f.erro });
          }
        }
      }
      onProgress(Math.min(i + BATCH_SIZE, precos.length), precos.length);
    }

    const preservadosMsg = totalPreservados > 0 ? ` ${totalPreservados} preço(s) editado(s) manualmente foram preservados.` : "";

    if (allFailed.length === 0) {
      toast.success(`${totalUpdated} preços atualizados com sucesso!${preservadosMsg}`);
    } else {
      toast.warning(`${totalUpdated} atualizados, ${allFailed.length} com erro.${preservadosMsg}`);
    }

    return { totalProcessed: precos.length, totalSuccess: totalUpdated, failed: allFailed };
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Importar Preços</h2>
          <p className="text-sm text-muted-foreground">
            Faça upload da planilha e mapeie as colunas de <strong>código</strong>, <strong>preço tabela</strong> e <strong>preço mínimo</strong>. Os preços serão atualizados para produtos já cadastrados. Preços ajustados manualmente são <strong>preservados</strong> (não sobrescritos).
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-2 shrink-0" onClick={downloadPrecosTemplate}>
          <Download className="h-4 w-4" /> Baixar modelo
        </Button>
      </div>
      <ImportMapper fields={fields} onImport={handleImport} importLabel="Atualizar preços de" />
    </div>
  );
};

export default ImportPrecos;
