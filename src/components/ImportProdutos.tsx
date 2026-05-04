import { useState, useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, FileSpreadsheet } from "lucide-react";
import ImportMapper, { ImportField, ImportResult } from "./ImportMapper";
import { downloadProdutosTemplate } from "@/lib/downloadProdutosTemplate";

const fields: ImportField[] = [
  { name: "codigo", label: "Código", required: true },
  { name: "descricao", label: "Descrição", required: true },
  { name: "nome", label: "Nome", required: false },
  { name: "categoria", label: "Categoria", required: false },
  { name: "tipologia", label: "Tipologia", required: false },
  { name: "tensao", label: "Tensão (12/24/48)", required: false },
  { name: "watts_por_metro", label: "W/m (fitas)", required: false },
  { name: "potencia_watts", label: "Potência (W)", required: false },
  { name: "cor", label: "Cor", required: false },
  { name: "imagem_url", label: "Imagem (URL ou nome arquivo)", required: false },
];

const BATCH_SIZE = 500;

const numericFields = new Set(["tensao", "watts_por_metro", "potencia_watts"]);

const ImportProdutos = () => {
  const handleImport = async (
    rows: Record<string, any>[],
    onProgress: (processed: number, total: number) => void,
  ): Promise<ImportResult> => {
    // Normalize rows
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
        } else {
          item[field.name] = String(raw).trim();
        }
      }
      return item;
    });

    let totalInserted = 0;
    let totalUpdated = 0;
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
        totalUpdated += data.updated ?? 0;
        if (data.failed?.length) {
          for (const f of data.failed) {
            allFailed.push({ codigo: f.codigo, descricao: f.descricao, _erro: f.erro });
          }
        }
      }
      onProgress(Math.min(i + BATCH_SIZE, produtos.length), produtos.length);
    }

    if (allFailed.length === 0) {
      toast.success(`${totalInserted} criados, ${totalUpdated} atualizados`);
    } else {
      toast.warning(`${totalInserted} criados, ${totalUpdated} atualizados, ${allFailed.length} com erro`);
    }

    return {
      totalProcessed: produtos.length,
      totalSuccess: totalInserted + totalUpdated,
      failed: allFailed,
    };
  };

  // Classifier: dado um array de codigos, retorna Map<codigo, 'create' | 'update'>
  const classifyRows = async (codigos: string[]): Promise<Map<string, "create" | "update">> => {
    const result = new Map<string, "create" | "update">();
    if (codigos.length === 0) return result;
    // Page-by-page IN query para evitar URL longa
    const PAGE = 100;
    const existing = new Set<string>();
    for (let i = 0; i < codigos.length; i += PAGE) {
      const slice = codigos.slice(i, i + PAGE);
      const { data } = await supabase.from("product_variants").select("codigo").in("codigo", slice);
      for (const r of data || []) existing.add(r.codigo);
    }
    for (const c of codigos) result.set(c, existing.has(c) ? "update" : "create");
    return result;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Importar Produtos (CSV diário)</h2>
          <p className="text-sm text-muted-foreground">
            CSV ou XLSX. Cria produtos novos ou atualiza existentes via SKU. Preço (preco_tabela / preco_minimo) NÃO importado nesta versão (deferido — D-18).
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={downloadProdutosTemplate} className="gap-2 shrink-0">
          <Download className="h-4 w-4" /> Baixar template
        </Button>
      </div>

      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Como funciona
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            <li>• <strong>codigo</strong> e <strong>descricao</strong> são obrigatórios.</li>
            <li>• Cada linha cria produto novo (se SKU não existe) ou atualiza existente.</li>
            <li>• <strong>imagem_url</strong>: aceita URL pública (https://...) OU nome de arquivo (ex: LM2847.jpg). Para upload do arquivo, use depois a aba "Imagens".</li>
            <li>• Preview mostra quantos serão criados vs atualizados ANTES de confirmar.</li>
            <li>• Erros em 1 linha não param o batch — relatório baixável ao final.</li>
            <li>• <strong>Preços</strong>: não importados aqui (deferido para phase de preços — D-18).</li>
          </ul>
        </CardContent>
      </Card>

      <ImportMapper fields={fields} onImport={handleImport} importLabel="Importar" classifyRows={classifyRows} />
    </div>
  );
};

export default ImportProdutos;
