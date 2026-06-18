import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Paperclip, Download, Trash2, FileText, Image, File, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Arquivo {
  id: string;
  nome: string;
  arquivo_path: string;
  tamanho: number;
  created_at: string;
}

interface OrcamentoArquivosProps {
  /** Cliente dono — usado para o path no storage e o cliente_id obrigatório. */
  clienteId: string;
  /** Revisão (orçamento) à qual os anexos pertencem. */
  orcamentoId: string;
}

const ACCEPT = ".pdf,.dwg,.skp,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx";

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileIcon(nome: string) {
  const ext = nome.split(".").pop()?.toLowerCase();
  if (["jpg", "jpeg", "png", "webp"].includes(ext || "")) return <Image className="h-4 w-4 text-primary/70" />;
  if (["pdf"].includes(ext || "")) return <FileText className="h-4 w-4 text-destructive/70" />;
  return <File className="h-4 w-4 text-muted-foreground" />;
}

const OrcamentoArquivos = ({ clienteId, orcamentoId }: OrcamentoArquivosProps) => {
  const [arquivos, setArquivos] = useState<Arquivo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Arquivo | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchArquivos = async () => {
    const { data } = await supabase
      .from("cliente_arquivos")
      .select("id, nome, arquivo_path, tamanho, created_at")
      .eq("orcamento_id", orcamentoId)
      .order("created_at", { ascending: false });
    setArquivos((data as Arquivo[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchArquivos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orcamentoId]);

  const handleFileSelected = async (file: globalThis.File | null) => {
    if (!file) return;
    setUploading(true);

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      toast.error("Sessão expirada, faça login novamente");
      setUploading(false);
      return;
    }

    const timestamp = Date.now();
    const path = `${clienteId}/${timestamp}_${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from("cliente-arquivos")
      .upload(path, file);

    if (uploadError) {
      toast.error("Erro ao enviar arquivo");
      setUploading(false);
      return;
    }

    const { error: insertError } = await supabase.from("cliente_arquivos").insert({
      cliente_id: clienteId,
      orcamento_id: orcamentoId,
      nome: file.name,
      categoria: "Geral",
      arquivo_path: path,
      tamanho: file.size,
      user_id: userData.user.id,
    });

    if (insertError) {
      // Reverte o blob já enviado para não deixar arquivo órfão no storage.
      await supabase.storage.from("cliente-arquivos").remove([path]);
      toast.error("Erro ao salvar registro do arquivo");
      setUploading(false);
      return;
    }

    toast.success("Arquivo anexado!");
    if (fileInputRef.current) fileInputRef.current.value = "";
    setUploading(false);
    fetchArquivos();
  };

  // Bucket cliente-arquivos é privado — gera signed URL sob demanda (mesmo padrão do DriveExplorer).
  const handleDownload = async (arquivo: Arquivo) => {
    const { data, error } = await supabase.storage
      .from("cliente-arquivos")
      .createSignedUrl(arquivo.arquivo_path, 3600);
    if (error || !data?.signedUrl) {
      toast.error("Erro ao abrir arquivo");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const handleDelete = async (arquivo: Arquivo) => {
    await supabase.storage.from("cliente-arquivos").remove([arquivo.arquivo_path]);
    const { error } = await supabase.from("cliente_arquivos").delete().eq("id", arquivo.id);
    if (error) {
      toast.error("Erro ao excluir arquivo");
      return;
    }
    toast.success("Arquivo excluído!");
    setDeleteTarget(null);
    fetchArquivos();
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
          <Paperclip className="h-3.5 w-3.5" />
          Anexos desta revisão
        </h4>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 text-xs"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="h-3.5 w-3.5" /> {uploading ? "Enviando..." : "Anexar Arquivo"}
        </Button>
        <Input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => handleFileSelected(e.target.files?.[0] || null)}
        />
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground">Carregando...</p>
      ) : arquivos.length === 0 ? (
        <p className="text-xs text-muted-foreground py-1">Nenhum anexo nesta revisão.</p>
      ) : (
        <div className="space-y-1">
          {arquivos.map((arq) => (
            <div key={arq.id} className="flex items-center justify-between text-sm py-1.5 px-2 rounded-md hover:bg-muted/30">
              <div className="flex items-center gap-2 min-w-0">
                {fileIcon(arq.nome)}
                <button
                  type="button"
                  onClick={() => handleDownload(arq)}
                  className="truncate text-left text-foreground hover:underline"
                  title={arq.nome}
                >
                  {arq.nome}
                </button>
                <span className="text-xs text-muted-foreground shrink-0">{formatSize(arq.tamanho)}</span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {format(new Date(arq.created_at), "dd/MM/yy", { locale: ptBR })}
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0 ml-2">
                <button
                  type="button"
                  onClick={() => handleDownload(arq)}
                  className="p-1 rounded hover:bg-muted transition-colors"
                  title="Baixar"
                >
                  <Download className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
                <button
                  className="p-1 rounded hover:bg-destructive/10 transition-colors"
                  title="Excluir"
                  onClick={() => setDeleteTarget(arq)}
                >
                  <Trash2 className="h-3.5 w-3.5 text-destructive/70" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir anexo?</AlertDialogTitle>
            <AlertDialogDescription>
              O arquivo "{deleteTarget?.nome}" será excluído permanentemente. Esta ação não poderá ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteTarget && handleDelete(deleteTarget)}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default OrcamentoArquivos;
