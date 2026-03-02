import { useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Upload, ImageIcon, CheckCircle, AlertTriangle, XCircle, ChevronDown, Download, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const ACCEPTED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];
const MAX_SIZE = 2 * 1024 * 1024;
const BATCH_SIZE = 20;

interface ClassifiedFile {
  file: File;
  codigo: string;
  ext: string;
}

interface UploadError {
  filename: string;
  codigo: string;
  reason: string;
}

type Phase = "idle" | "analyzing" | "ready" | "uploading" | "done";

const ImportImagens = () => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [dragOver, setDragOver] = useState(false);
  const [validFiles, setValidFiles] = useState<ClassifiedFile[]>([]);
  const [noMatchFiles, setNoMatchFiles] = useState<{ filename: string; codigo: string }[]>([]);
  const [invalidFiles, setInvalidFiles] = useState<{ filename: string; reason: string }[]>([]);
  const [uploaded, setUploaded] = useState(0);
  const [totalToUpload, setTotalToUpload] = useState(0);
  const [uploadErrors, setUploadErrors] = useState<UploadError[]>([]);
  const [successList, setSuccessList] = useState<string[]>([]);
  const [showNoMatch, setShowNoMatch] = useState(false);
  const [showInvalid, setShowInvalid] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  const reset = () => {
    setPhase("idle");
    setValidFiles([]);
    setNoMatchFiles([]);
    setInvalidFiles([]);
    setUploaded(0);
    setTotalToUpload(0);
    setUploadErrors([]);
    setSuccessList([]);
  };

  const fetchAllCodigos = async (): Promise<Set<string>> => {
    const codes = new Set<string>();
    let from = 0;
    const pageSize = 1000;
    let hasMore = true;
    while (hasMore) {
      const { data } = await supabase.from("produtos").select("codigo").range(from, from + pageSize - 1);
      if (data && data.length > 0) {
        data.forEach((r) => codes.add(r.codigo));
        from += pageSize;
        if (data.length < pageSize) hasMore = false;
      } else {
        hasMore = false;
      }
    }
    return codes;
  };

  const analyzeFiles = useCallback(async (files: FileList | File[]) => {
    setPhase("analyzing");
    const fileArray = Array.from(files);
    const valid: ClassifiedFile[] = [];
    const noMatch: { filename: string; codigo: string }[] = [];
    const invalid: { filename: string; reason: string }[] = [];

    const formatValid: { file: File; codigo: string; ext: string }[] = [];
    for (const file of fileArray) {
      const name = file.name;
      const extMatch = name.match(/\.(\w+)$/);
      const ext = extMatch ? `.${extMatch[1].toLowerCase()}` : "";
      if (!ACCEPTED_EXTENSIONS.includes(ext) && !ACCEPTED_TYPES.includes(file.type)) {
        invalid.push({ filename: name, reason: `Formato não aceito (${ext || file.type})` });
        continue;
      }
      if (file.size > MAX_SIZE) {
        invalid.push({ filename: name, reason: `Excede 2MB (${(file.size / 1024 / 1024).toFixed(1)}MB)` });
        continue;
      }
      const codigo = name.replace(/\.\w+$/, "").trim();
      if (!codigo) {
        invalid.push({ filename: name, reason: "Nome de arquivo vazio" });
        continue;
      }
      formatValid.push({ file, codigo, ext: ext.replace(".", "") });
    }

    const codigosDb = await fetchAllCodigos();
    for (const item of formatValid) {
      if (codigosDb.has(item.codigo)) {
        valid.push(item);
      } else {
        noMatch.push({ filename: item.file.name, codigo: item.codigo });
      }
    }

    setValidFiles(valid);
    setNoMatchFiles(noMatch);
    setInvalidFiles(invalid);
    setPhase("ready");
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) analyzeFiles(e.target.files);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) analyzeFiles(e.dataTransfer.files);
  };

  const startUpload = async () => {
    setPhase("uploading");
    setTotalToUpload(validFiles.length);
    setUploaded(0);
    setUploadErrors([]);
    setSuccessList([]);
    const errors: UploadError[] = [];
    const success: string[] = [];

    for (let i = 0; i < validFiles.length; i += BATCH_SIZE) {
      const batch = validFiles.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map(async ({ file, codigo, ext }) => {
          const path = `${codigo}.${ext}`;
          const { error: uploadError } = await supabase.storage.from("produto-imagens").upload(path, file, { upsert: true });
          if (uploadError) throw new Error(uploadError.message);
          const { data: urlData } = supabase.storage.from("produto-imagens").getPublicUrl(path);
          await supabase.from("produtos").update({ imagem_url: urlData.publicUrl } as any).eq("codigo", codigo);
          return codigo;
        })
      );
      for (let j = 0; j < results.length; j++) {
        const result = results[j];
        if (result.status === "fulfilled") {
          success.push(result.value);
        } else {
          errors.push({ filename: batch[j].file.name, codigo: batch[j].codigo, reason: result.reason?.message || "Erro desconhecido" });
        }
      }
      setUploaded(Math.min(i + BATCH_SIZE, validFiles.length));
      setUploadErrors([...errors]);
      setSuccessList([...success]);
    }
    setPhase("done");
  };

  const exportCsv = (items: { filename: string; codigo: string }[], filename: string) => {
    const csv = "Arquivo,Código\n" + items.map((i) => `${i.filename},${i.codigo}`).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const progress = totalToUpload > 0 ? (uploaded / totalToUpload) * 100 : 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Importar Imagens</h2>
        <p className="text-sm text-muted-foreground">
          O nome de cada arquivo deve ser o <strong>código do produto</strong> (ex: <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">LM2439.jpg</code>). O sistema valida os códigos antes do upload.
        </p>
      </div>

      {/* Guidelines */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Orientações
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            <li>• <strong>Formatos:</strong> JPG, PNG, WEBP</li>
            <li>• <strong>Tamanho máximo:</strong> 2MB por arquivo</li>
            <li>• <strong>Nome do arquivo</strong> = código do produto</li>
            <li>• Arquivos sem correspondência serão listados para revisão</li>
          </ul>
        </CardContent>
      </Card>

      {/* Drop Zone */}
      {(phase === "idle" || phase === "ready") && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed p-12 transition-colors",
            dragOver ? "border-primary bg-primary/10" : "border-border hover:border-primary/50 hover:bg-muted/50"
          )}
        >
          <ImageIcon className="h-12 w-12 text-muted-foreground" />
          <div className="text-center">
            <p className="font-medium text-foreground">Arraste as imagens aqui ou clique para selecionar</p>
            <p className="text-sm text-muted-foreground mt-1">JPG, PNG, WEBP • Máx. 2MB cada</p>
          </div>
          <input ref={inputRef} type="file" accept=".jpg,.jpeg,.png,.webp" multiple className="hidden" onChange={handleFileSelect} />
        </div>
      )}

      {/* Analysis Results */}
      {(phase === "ready" || phase === "uploading" || phase === "done") && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Análise</CardTitle>
            <CardDescription>{validFiles.length + noMatchFiles.length + invalidFiles.length} arquivos analisados</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3 rounded-lg border border-green-500/30 bg-green-500/10 p-3">
              <CheckCircle className="h-5 w-5 text-green-600 shrink-0" />
              <span className="text-sm font-medium text-green-700">{validFiles.length} prontos para envio</span>
            </div>

            {noMatchFiles.length > 0 && (
              <Collapsible open={showNoMatch} onOpenChange={setShowNoMatch}>
                <CollapsibleTrigger asChild>
                  <button className="flex w-full items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3 hover:bg-destructive/15 transition-colors">
                    <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
                    <span className="text-sm font-medium text-destructive flex-1 text-left">{noMatchFiles.length} sem correspondência na base</span>
                    <ChevronDown className={cn("h-4 w-4 text-destructive transition-transform", showNoMatch && "rotate-180")} />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-2 max-h-48 overflow-auto rounded-lg border bg-muted/30 p-3 space-y-1">
                    {noMatchFiles.map((f, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                        <span className="font-mono text-xs">{f.codigo}</span>
                        <span className="text-muted-foreground">— {f.filename}</span>
                      </div>
                    ))}
                  </div>
                  <Button variant="outline" size="sm" className="mt-2 gap-2" onClick={() => exportCsv(noMatchFiles, "sem-correspondencia.csv")}>
                    <Download className="h-4 w-4" /> Exportar CSV
                  </Button>
                </CollapsibleContent>
              </Collapsible>
            )}

            {invalidFiles.length > 0 && (
              <Collapsible open={showInvalid} onOpenChange={setShowInvalid}>
                <CollapsibleTrigger asChild>
                  <button className="flex w-full items-center gap-3 rounded-lg border border-border bg-muted/50 p-3 hover:bg-muted transition-colors">
                    <XCircle className="h-5 w-5 text-muted-foreground shrink-0" />
                    <span className="text-sm font-medium text-muted-foreground flex-1 text-left">{invalidFiles.length} inválidos</span>
                    <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", showInvalid && "rotate-180")} />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-2 max-h-48 overflow-auto rounded-lg border bg-muted/30 p-3 space-y-1">
                    {invalidFiles.map((f, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <XCircle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="font-mono text-xs">{f.filename}</span>
                        <span className="text-muted-foreground">— {f.reason}</span>
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            {phase === "ready" && validFiles.length > 0 && (
              <div className="flex gap-3 pt-2">
                <Button onClick={startUpload} className="gap-2">
                  <Upload className="h-4 w-4" /> Iniciar Upload ({validFiles.length} arquivos)
                </Button>
                <Button variant="outline" onClick={reset}>Cancelar</Button>
              </div>
            )}
            {phase === "ready" && validFiles.length === 0 && (
              <Button variant="outline" onClick={reset}>Selecionar outros arquivos</Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Upload Progress */}
      {(phase === "uploading" || phase === "done") && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{phase === "uploading" ? "Enviando..." : "Upload Concluído"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Progresso</span>
                <span className="font-medium">{uploaded} de {totalToUpload}</span>
              </div>
              <Progress value={progress} />
            </div>

            {successList.length > 0 && (
              <Collapsible open={showSuccess} onOpenChange={setShowSuccess}>
                <CollapsibleTrigger asChild>
                  <button className="flex w-full items-center gap-3 rounded-lg border border-green-500/30 bg-green-500/10 p-3 hover:bg-green-500/15 transition-colors">
                    <CheckCircle className="h-5 w-5 text-green-600 shrink-0" />
                    <span className="text-sm font-medium text-green-700 flex-1 text-left">{successList.length} enviados com sucesso</span>
                    <ChevronDown className={cn("h-4 w-4 text-green-600 transition-transform", showSuccess && "rotate-180")} />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-2 max-h-48 overflow-auto rounded-lg border bg-muted/30 p-3">
                    <div className="flex flex-wrap gap-1.5">
                      {successList.map((c, i) => (
                        <span key={i} className="rounded bg-green-100 px-2 py-0.5 font-mono text-xs text-green-800">{c}</span>
                      ))}
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            {uploadErrors.length > 0 && (
              <Collapsible open={showErrors} onOpenChange={setShowErrors}>
                <CollapsibleTrigger asChild>
                  <button className="flex w-full items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3 hover:bg-destructive/15 transition-colors">
                    <XCircle className="h-5 w-5 text-destructive shrink-0" />
                    <span className="text-sm font-medium text-destructive flex-1 text-left">{uploadErrors.length} erros de upload</span>
                    <ChevronDown className={cn("h-4 w-4 text-destructive transition-transform", showErrors && "rotate-180")} />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-2 max-h-48 overflow-auto rounded-lg border bg-muted/30 p-3 space-y-1">
                    {uploadErrors.map((e, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                        <span className="font-mono text-xs">{e.codigo}</span>
                        <span className="text-muted-foreground">— {e.reason}</span>
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            {phase === "done" && (
              <Button variant="outline" onClick={reset} className="mt-2">Novo Upload</Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ImportImagens;
