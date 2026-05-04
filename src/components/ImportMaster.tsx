import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Upload, Loader2, AlertCircle, CheckCircle2, XCircle, ChevronDown, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { parseMasterXlsx, ParseMasterError, type ParsedMaster } from "@/lib/parseMasterXlsx";
import { reconcile, type DbVariantRow, type ReconcileReport } from "@/lib/reconcileProducts";

type Phase = "idle" | "parsing" | "preview" | "applying" | "done";

const BATCH_SIZE = 500;

const ImportMaster = () => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState<ParsedMaster | null>(null);
  const [report, setReport] = useState<ReconcileReport | null>(null);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [errorsApplying, setErrorsApplying] = useState<Array<{ sku: string; reason: string }>>([]);
  const [showSkipped, setShowSkipped] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  const reset = () => {
    setPhase("idle");
    setFileName("");
    setParsed(null);
    setReport(null);
    setProgress(0);
    setProgressLabel("");
    setErrorsApplying([]);
  };

  const fetchAllDbVariants = async (): Promise<DbVariantRow[]> => {
    const all: DbVariantRow[] = [];
    let from = 0;
    const pageSize = 1000;
    let hasMore = true;
    while (hasMore) {
      const { data, error } = await supabase
        .from("product_variants")
        .select("id, codigo, product_id, origem, editado_manualmente, arquiteto_id, preco_tabela, preco_minimo")
        .range(from, from + pageSize - 1);
      if (error) throw new Error("Erro carregando variants do DB: " + error.message);
      if (!data || data.length === 0) {
        hasMore = false;
        break;
      }
      for (const r of data) {
        all.push({
          id: r.id,
          codigo: r.codigo,
          product_id: r.product_id,
          origem: r.origem as DbVariantRow["origem"],
          editado_manualmente: r.editado_manualmente,
          arquiteto_id: r.arquiteto_id,
          preco_tabela: r.preco_tabela ?? null,
          preco_minimo: r.preco_minimo ?? null,
        });
      }
      from += pageSize;
      if (data.length < pageSize) hasMore = false;
    }
    return all;
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setPhase("parsing");
    try {
      const buffer = await file.arrayBuffer();
      const parsedData = parseMasterXlsx(buffer);
      setParsed(parsedData);
      // Roda reconcile contra DB
      const dbRows = await fetchAllDbVariants();
      const reportData = reconcile(parsedData.variants, dbRows);
      setReport(reportData);
      setPhase("preview");
    } catch (err) {
      if (err instanceof ParseMasterError) {
        toast.error(err.message);
      } else {
        toast.error("Erro ao processar arquivo: " + (err as Error).message);
      }
      setPhase("idle");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const ensureProducts = async (): Promise<Map<string, string>> => {
    if (!parsed) return new Map();
    setProgressLabel("Sincronizando produto-pais...");
    // Upsert products (codigo_pai unique). Retorna mapa codigo_pai → id (UUID)
    const productsToUpsert = parsed.products.map((p) => ({
      codigo_pai: p.codigo_pai,
      nome: p.nome,
      categoria: p.categoria,
      tipologia: p.tipologia,
    }));

    if (productsToUpsert.length > 0) {
      const { error } = await supabase
        .from("products")
        .upsert(productsToUpsert, { onConflict: "codigo_pai" });
      if (error) throw new Error("Erro upserting products: " + error.message);
    }

    const { data, error } = await supabase
      .from("products")
      .select("id, codigo_pai");
    if (error) throw new Error("Erro fetching products map: " + error.message);

    const map = new Map<string, string>();
    for (const p of data || []) map.set(p.codigo_pai, p.id);
    return map;
  };

  const apply = async () => {
    if (!parsed || !report) return;
    setPhase("applying");
    setProgress(0);
    setProgressLabel("Iniciando...");
    setErrorsApplying([]);
    const errs: Array<{ sku: string; reason: string }> = [];

    try {
      const productMap = await ensureProducts();

      const total = report.creates.length + report.updates.length;
      let done = 0;

      // 1. CREATES — insert batches em product_variants
      for (let i = 0; i < report.creates.length; i += BATCH_SIZE) {
        const batch = report.creates.slice(i, i + BATCH_SIZE);
        const rows = batch.map((m) => {
          const productId = productMap.get(m.produto_id) ?? productMap.get("P-LEGADO");
          return {
            codigo: m.sku,
            descricao: m.variante_nome,
            nome: m.variante_nome,
            product_id: productId,
            origem: "master",
            editado_manualmente: false,
            atributos: m.atributos,
            tensao: m.tensao,
            watts_por_metro: m.watts_por_metro,
            potencia_watts: m.potencia_watts,
            largura_mm: m.largura_mm,
            cor: m.cor,
          };
        });
        const { error } = await supabase.from("product_variants").insert(rows);
        if (error) {
          // Falha em batch — tenta item-a-item para isolar erros (IMP-06)
          for (const row of rows) {
            const { error: itemErr } = await supabase.from("product_variants").insert(row);
            if (itemErr) {
              errs.push({ sku: row.codigo, reason: itemErr.message });
            }
          }
        }
        done += batch.length;
        setProgress(Math.round((done / total) * 100));
        setProgressLabel(`Criando produtos: ${done}/${total}`);
      }

      // 2. UPDATES — um por um (patches diferentes por SKU; D-05 invariante já aplicado em reconcile)
      for (let i = 0; i < report.updates.length; i++) {
        const upd = report.updates[i];
        const { error } = await supabase
          .from("product_variants")
          .update(upd.patch)
          .eq("id", upd.id);
        if (error) {
          errs.push({ sku: upd.sku, reason: error.message });
        }
        done++;
        if (i % 50 === 0 || i === report.updates.length - 1) {
          setProgress(Math.round((done / total) * 100));
          setProgressLabel(`Atualizando produtos: ${done}/${total}`);
        }
      }

      setErrorsApplying(errs);
      setPhase("done");

      if (errs.length === 0) {
        toast.success(`Master importada: ${report.creates.length} criados, ${report.updates.length} atualizados, ${report.skipped.length} preservados`);
      } else {
        toast.warning(`Master importada com ${errs.length} erros — verifique abaixo`);
      }
    } catch (err) {
      toast.error("Erro fatal: " + (err as Error).message);
      setPhase("preview");
    }
  };

  const downloadErrorsXlsx = () => {
    if (errorsApplying.length === 0) return;
    const ws = XLSX.utils.json_to_sheet(errorsApplying);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Erros");
    XLSX.writeFile(wb, `erros_master_${Date.now()}.xlsx`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Importar Master (one-shot)</h2>
        <p className="text-sm text-muted-foreground">
          Sobe a planilha <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">base_dados_site_2026.xlsx</code> com as 2.088 variantes oficiais.
          O sistema preserva edições manuais (admin), AU coringa, arquiteto e preço — só atualiza specs e nome.
        </p>
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
            <li>• <strong>Aba "Variantes"</strong> ou <strong>"Base Completa (flat)"</strong> é obrigatória (1 linha por SKU).</li>
            <li>• <strong>Aba "Produtos"</strong> (opcional) define os pais e enriquece nomes.</li>
            <li>• <strong>Editado manualmente</strong>: SKUs marcados pelo admin via UI NUNCA são sobrescritos.</li>
            <li>• <strong>AU coringa</strong> (AU001..AU016) NUNCA são sobrescritos pela master.</li>
            <li>• <strong>Preço e arquiteto</strong> NUNCA são alterados — só nome, descrição, specs e atributos.</li>
            <li>• <strong>Erros linha-a-linha</strong>: falha em 1 SKU não aborta o batch; relatório baixável ao final.</li>
          </ul>
        </CardContent>
      </Card>

      {phase === "idle" && (
        <div className="rounded-xl border bg-card p-6 space-y-4">
          <input ref={fileRef} type="file" accept=".xlsx" className="hidden" onChange={handleFile} />
          <Button className="gap-2" onClick={() => fileRef.current?.click()}>
            <Upload className="h-4 w-4" /> Selecionar arquivo XLSX
          </Button>
          <p className="text-xs text-muted-foreground">Apenas .xlsx é aceito (CSV não tem múltiplas abas).</p>
        </div>
      )}

      {phase === "parsing" && (
        <Card>
          <CardContent className="py-8 flex items-center justify-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Processando {fileName}...</span>
          </CardContent>
        </Card>
      )}

      {phase === "preview" && parsed && report && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Preview da Importação</CardTitle>
            <CardDescription>{fileName} — {parsed.variants.length} variantes na master</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-3">
                <div className="text-xs text-green-700">Criar</div>
                <div className="text-2xl font-bold text-green-700">{report.creates.length}</div>
              </div>
              <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-3">
                <div className="text-xs text-blue-700">Atualizar</div>
                <div className="text-2xl font-bold text-blue-700">{report.updates.length}</div>
              </div>
              <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3">
                <div className="text-xs text-yellow-700">Preservados (skipped)</div>
                <div className="text-2xl font-bold text-yellow-700">{report.skipped.length}</div>
              </div>
            </div>

            <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
              <strong className="text-foreground">{report.legados_preserved.length}</strong> SKUs do DB sem match na master (mantidos como legado).
            </div>

            {report.skipped.length > 0 && (
              <Collapsible open={showSkipped} onOpenChange={setShowSkipped}>
                <CollapsibleTrigger asChild>
                  <button className="flex w-full items-center gap-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 hover:bg-yellow-500/15 transition-colors">
                    <AlertCircle className="h-5 w-5 text-yellow-700 shrink-0" />
                    <span className="text-sm font-medium text-yellow-700 flex-1 text-left">{report.skipped.length} SKUs preservados (não sobrescritos)</span>
                    <ChevronDown className={`h-4 w-4 text-yellow-700 transition-transform ${showSkipped ? "rotate-180" : ""}`} />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-2 max-h-48 overflow-auto rounded-lg border bg-muted/30 p-3 space-y-1">
                    {report.skipped.slice(0, 100).map((s, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <span className="font-mono text-xs">{s.sku}</span>
                        <span className="text-muted-foreground">— {s.reason === "editado_manualmente" ? "editado pelo admin (D-08)" : "AU coringa (D-10)"}</span>
                      </div>
                    ))}
                    {report.skipped.length > 100 && <p className="text-xs text-muted-foreground pt-1">...e mais {report.skipped.length - 100}</p>}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            <div className="flex gap-3 pt-2">
              <Button onClick={apply} className="gap-2">
                <CheckCircle2 className="h-4 w-4" /> Aplicar importação
              </Button>
              <Button variant="outline" onClick={reset}>Cancelar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {(phase === "applying" || phase === "done") && report && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{phase === "applying" ? "Aplicando..." : "Concluído"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Progress value={progress} className="h-3" />
            <p className="text-sm text-muted-foreground">{progressLabel}</p>
            {phase === "done" && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span>{report.creates.length} criados, {report.updates.length} atualizados, {report.skipped.length} preservados</span>
                </div>
                {errorsApplying.length > 0 && (
                  <Collapsible open={showErrors} onOpenChange={setShowErrors}>
                    <CollapsibleTrigger asChild>
                      <button className="flex w-full items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3 hover:bg-destructive/15 transition-colors">
                        <XCircle className="h-5 w-5 text-destructive shrink-0" />
                        <span className="text-sm font-medium text-destructive flex-1 text-left">{errorsApplying.length} erros (linha-a-linha)</span>
                        <ChevronDown className={`h-4 w-4 text-destructive transition-transform ${showErrors ? "rotate-180" : ""}`} />
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="mt-2 max-h-48 overflow-auto rounded-lg border bg-muted/30 p-3 space-y-1">
                        {errorsApplying.slice(0, 100).map((e, i) => (
                          <div key={i} className="flex items-center gap-2 text-sm">
                            <span className="font-mono text-xs">{e.sku}</span>
                            <span className="text-muted-foreground">— {e.reason}</span>
                          </div>
                        ))}
                      </div>
                      <Button variant="outline" size="sm" className="mt-2" onClick={downloadErrorsXlsx}>
                        Baixar XLSX de erros
                      </Button>
                    </CollapsibleContent>
                  </Collapsible>
                )}
                <Button variant="outline" onClick={reset} className="mt-2">Nova importação</Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ImportMaster;
