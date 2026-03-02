import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, Loader2, AlertCircle, CheckCircle2, XCircle, Download, ChevronDown } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

export interface ImportField {
  name: string;
  label: string;
  required: boolean;
}

export interface ImportResult {
  totalProcessed: number;
  totalSuccess: number;
  failed: Array<Record<string, any> & { _erro: string }>;
}

interface ImportMapperProps {
  fields: ImportField[];
  onImport: (mappedRows: Record<string, any>[], onProgress: (processed: number, total: number) => void) => Promise<ImportResult>;
  importLabel?: string;
}

const ImportMapper = ({ fields, onImport, importLabel = "Importar" }: ImportMapperProps) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [previewRows, setPreviewRows] = useState<any[][]>([]);
  const [rawRows, setRawRows] = useState<any[][]>([]);
  const [importing, setImporting] = useState(false);
  const [fileName, setFileName] = useState("");
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [showInvalidRows, setShowInvalidRows] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setImportResult(null);

    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const allRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    if (allRows.length < 2) {
      setHeaders([]);
      setRawRows([]);
      setPreviewRows([]);
      return;
    }

    const detectedHeaders = (allRows[0] as any[]).map((h) => String(h ?? "").trim()).filter(Boolean);
    setHeaders(detectedHeaders);
    setRawRows(allRows.slice(1));
    setPreviewRows(allRows.slice(1, 6));

    const autoMapping: Record<string, string> = {};
    for (const field of fields) {
      const match = detectedHeaders.find(
        (h) => h.toLowerCase().includes(field.name.toLowerCase()) || h.toLowerCase().includes(field.label.toLowerCase())
      );
      if (match) autoMapping[field.name] = match;
    }
    setMapping(autoMapping);

    if (fileRef.current) fileRef.current.value = "";
  };

  const allRequiredMapped = fields.every((f) => !f.required || mapping[f.name]);

  const getMappedPreview = () => {
    if (!allRequiredMapped) return [];
    const headerIndexMap: Record<string, number> = {};
    headers.forEach((h, i) => (headerIndexMap[h] = i));

    return previewRows.map((row) => {
      const mapped: Record<string, any> = {};
      for (const field of fields) {
        const col = mapping[field.name];
        if (col) {
          mapped[field.name] = row[headerIndexMap[col]] ?? "";
        }
      }
      return mapped;
    });
  };

  const handleImport = async () => {
    setImporting(true);
    setProgress(0);
    setProgressLabel("");
    setImportResult(null);
    try {
      const headerIndexMap: Record<string, number> = {};
      headers.forEach((h, i) => (headerIndexMap[h] = i));

      const mappedData = rawRows
        .map((row) => {
          const mapped: Record<string, any> = {};
          for (const field of fields) {
            const col = mapping[field.name];
            if (col) {
              mapped[field.name] = row[headerIndexMap[col]] ?? "";
            }
          }
          return mapped;
        })
        .filter((row) => fields.every((f) => !f.required || row[f.name]));

      const onProgress = (processed: number, total: number) => {
        setProgress(Math.round((processed / total) * 100));
        setProgressLabel(`${processed} de ${total} registros processados`);
      };

      const result = await onImport(mappedData, onProgress);
      setImportResult(result);
    } catch (err: any) {
      setImportResult({
        totalProcessed: 0,
        totalSuccess: 0,
        failed: [{ _erro: err?.message || "Erro desconhecido durante a importação" }],
      });
    } finally {
      setImporting(false);
    }
  };

  const downloadFailedExcel = () => {
    if (!importResult || importResult.failed.length === 0) return;

    const rows = importResult.failed.map(({ _erro, ...rest }) => ({
      ...rest,
      "Motivo do Erro": _erro,
      "Sugestão": getSuggestion(_erro),
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Erros");
    XLSX.writeFile(wb, `erros_importacao_${Date.now()}.xlsx`);
  };

  const getSuggestion = (erro: string): string => {
    if (erro.includes("não cadastrado")) return "Importe o produto primeiro na aba 'Produtos'";
    if (erro.includes("código") && erro.includes("vazio")) return "Preencha o campo código na planilha";
    if (erro.includes("descrição") && erro.includes("vazio")) return "Preencha o campo descrição na planilha";
    if (erro.includes("preço")) return "Verifique se os valores de preço estão corretos";
    return "Verifique os dados na planilha e tente novamente";
  };

  const getGroupedErrors = () => {
    if (!importResult) return [];
    const groups: Record<string, number> = {};
    for (const item of importResult.failed) {
      groups[item._erro] = (groups[item._erro] || 0) + 1;
    }
    return Object.entries(groups).map(([erro, count]) => ({ erro, count }));
  };

  const mappedPreview = getMappedPreview();
  const headerIndexMap: Record<string, number> = {};
  headers.forEach((h, i) => (headerIndexMap[h] = i));

  const totalValid = rawRows.filter((row) => {
    return fields.every((f) => {
      if (!f.required) return true;
      const col = mapping[f.name];
      return col && row[headerIndexMap[col]];
    });
  }).length;

  const totalInvalid = rawRows.length - totalValid;

  const invalidRows = rawRows
    .map((row, idx) => {
      const missingFields = fields
        .filter((f) => {
          if (!f.required) return true;
          const col = mapping[f.name];
          return !(col && row[headerIndexMap[col]]);
        })
        .filter((f) => f.required)
        .map((f) => f.label);
      if (missingFields.length === 0) return null;
      return { linha: idx + 2, campos: missingFields };
    })
    .filter(Boolean) as { linha: number; campos: string[] }[];


  return (
    <div className="space-y-6">
      {/* Upload */}
      <div className="rounded-xl border bg-card p-6 space-y-4">
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="hidden" />
        <Button className="gap-2" onClick={() => fileRef.current?.click()}>
          <Upload className="h-4 w-4" /> Selecionar Arquivo
        </Button>
        {fileName && <p className="text-sm text-muted-foreground">Arquivo: {fileName}</p>}
      </div>

      {/* Mapping */}
      {headers.length > 0 && (
        <div className="rounded-xl border bg-card p-6 space-y-4">
          <h3 className="font-semibold text-foreground">Mapeamento de Colunas</h3>
          <p className="text-sm text-muted-foreground">Para cada campo, selecione a coluna correspondente da sua planilha.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {fields.map((field) => (
              <div key={field.name} className="space-y-1">
                <label className="text-sm font-medium text-foreground">
                  {field.label} {field.required && <span className="text-destructive">*</span>}
                </label>
                <Select value={mapping[field.name] || ""} onValueChange={(val) => setMapping((prev) => ({ ...prev, [field.name]: val }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a coluna..." />
                  </SelectTrigger>
                  <SelectContent>
                    {headers.map((h) => (
                      <SelectItem key={h} value={h}>{h}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>

          {!allRequiredMapped && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              Mapeie todos os campos obrigatórios para continuar.
            </div>
          )}
        </div>
      )}

      {/* Análise */}
      {allRequiredMapped && rawRows.length > 0 && !importResult && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Análise</CardTitle>
            <CardDescription>{rawRows.length} linhas analisadas</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3 rounded-lg border border-green-500/30 bg-green-500/10 p-3">
              <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
              <span className="text-sm font-medium text-green-700">{totalValid} prontos para importação</span>
            </div>

            {totalInvalid > 0 && (
              <Collapsible open={showInvalidRows} onOpenChange={setShowInvalidRows}>
                <CollapsibleTrigger asChild>
                  <button className="flex w-full items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3 hover:bg-destructive/15 transition-colors">
                    <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
                    <span className="text-sm font-medium text-destructive flex-1 text-left">{totalInvalid} linhas com campos obrigatórios vazios</span>
                    <ChevronDown className={cn("h-4 w-4 text-destructive transition-transform", showInvalidRows && "rotate-180")} />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-2 max-h-48 overflow-auto rounded-lg border bg-muted/30 p-3 space-y-1">
                    {invalidRows.slice(0, 50).map((r, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                        <span className="font-mono text-xs">Linha {r.linha}</span>
                        <span className="text-muted-foreground">— faltando: {r.campos.join(", ")}</span>
                      </div>
                    ))}
                    {invalidRows.length > 50 && (
                      <p className="text-xs text-muted-foreground pt-1">...e mais {invalidRows.length - 50} linhas</p>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Amostra */}
            {mappedPreview.length > 0 && (
              <div className="rounded-lg border overflow-hidden">
                <div className="bg-muted/50 px-4 py-2 border-b">
                  <p className="text-xs font-medium text-muted-foreground">Amostra das primeiras {mappedPreview.length} linhas</p>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      {fields.filter((f) => mapping[f.name]).map((f) => (
                        <TableHead key={f.name}>{f.label}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mappedPreview.map((row, i) => (
                      <TableRow key={i}>
                        {fields.filter((f) => mapping[f.name]).map((f) => (
                          <TableCell key={f.name} className="text-sm">{String(row[f.name] ?? "")}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Import button / progress */}
            {importing ? (
              <div className="space-y-2">
                <Progress value={progress} className="h-3" />
                <p className="text-sm text-muted-foreground">{progressLabel || "Iniciando..."}</p>
              </div>
            ) : (
              <Button className="gap-2 w-full" disabled={totalValid === 0} onClick={handleImport}>
                {`${importLabel} ${totalValid} registros`}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Import Result */}
      {importResult && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Resultado da Importação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <span className="text-foreground font-medium">{importResult.totalSuccess} registros importados com sucesso</span>
              </div>
              {importResult.failed.length > 0 && (
                <div className="flex items-center gap-2 text-sm">
                  <XCircle className="h-4 w-4 text-destructive" />
                  <span className="text-foreground font-medium">{importResult.failed.length} registros com erro</span>
                </div>
              )}
            </div>

            {importResult.failed.length > 0 && (
              <>
                <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
                  <p className="text-sm font-semibold text-foreground">Motivos dos erros:</p>
                  <ul className="space-y-1">
                    {getGroupedErrors().map(({ erro, count }) => (
                      <li key={erro} className="text-sm text-muted-foreground">
                        • {count}x "{erro}"
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
                  <p className="text-sm font-semibold text-foreground">O que fazer:</p>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    {getGroupedErrors().map(({ erro }) => (
                      <li key={erro}>• {getSuggestion(erro)}</li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-destructive">
                    <AlertCircle className="h-4 w-4" />
                    Alguns registros não foram importados
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Baixe a planilha abaixo para ver quais linhas falharam e o motivo de cada erro. Corrija os dados na planilha e importe novamente.
                  </p>
                  <Button variant="outline" className="gap-2" onClick={downloadFailedExcel}>
                    <Download className="h-5 w-5" />
                    Baixar planilha com erros ({importResult.failed.length} linhas)
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Contém as linhas que não foram importadas para a base de dados, com o motivo do erro e sugestão de correção para cada registro.
                  </p>
                </div>
              </>
            )}

            <Button variant="ghost" size="sm" onClick={() => { setImportResult(null); setHeaders([]); setRawRows([]); setPreviewRows([]); setFileName(""); }}>
              Nova importação
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ImportMapper;
