import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Paperclip, Download, Trash2, FileText, Image, File, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Arquivo {
  id: string;
  nome: string;
  descricao: string | null;
  categoria: string;
  arquivo_url: string;
  arquivo_path: string;
  tamanho: number;
  created_at: string;
}

interface ClienteArquivosProps {
  clienteId: string;
}

const CATEGORIAS = ["Planta", "Reunião", "Geral"];
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

const ClienteArquivos = ({ clienteId }: ClienteArquivosProps) => {
  const [arquivos, setArquivos] = useState<Arquivo[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [categoria, setCategoria] = useState("Geral");
  const [descricao, setDescricao] = useState("");
  const [selectedFile, setSelectedFile] = useState<globalThis.File | null>(null);
  const [projetos, setProjetos] = useState<{ id: string; nome: string }[]>([]);
  const [projetoId, setProjetoId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchArquivos = async () => {
    const { data } = await supabase
      .from("cliente_arquivos")
      .select("*")
      .eq("cliente_id", clienteId)
      .order("created_at", { ascending: false });
    setArquivos((data as Arquivo[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchArquivos();
    supabase.from("projetos").select("id, nome").eq("cliente_id", clienteId).then(({ data }) => {
      setProjetos(data || []);
    });
  }, [clienteId]);

  const handleUpload = async () => {
    if (!selectedFile) return;
    setUploading(true);

    const timestamp = Date.now();
    const path = `${clienteId}/${timestamp}_${selectedFile.name}`;

    const { error: uploadError } = await supabase.storage
      .from("cliente-arquivos")
      .upload(path, selectedFile);

    if (uploadError) {
      toast.error("Erro ao enviar arquivo");
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage
      .from("cliente-arquivos")
      .getPublicUrl(path);

    const { error: insertError } = await supabase.from("cliente_arquivos").insert({
      cliente_id: clienteId,
      nome: selectedFile.name,
      descricao: descricao.trim() || null,
      categoria,
      arquivo_path: path,
      arquivo_url: urlData.publicUrl,
      tamanho: selectedFile.size,
      projeto_id: projetoId,
    });

    if (insertError) {
      toast.error("Erro ao salvar registro do arquivo");
      setUploading(false);
      return;
    }

    toast.success("Arquivo anexado!");
    setDialogOpen(false);
    setSelectedFile(null);
    setDescricao("");
    setCategoria("Geral");
    setProjetoId(null);
    setUploading(false);
    fetchArquivos();
  };

  const handleDelete = async (arquivo: Arquivo) => {
    const { error: storageError } = await supabase.storage
      .from("cliente-arquivos")
      .remove([arquivo.arquivo_path]);

    if (storageError) {
      toast.error("Erro ao excluir arquivo do storage");
      return;
    }

    const { error } = await supabase
      .from("cliente_arquivos")
      .delete()
      .eq("id", arquivo.id);

    if (error) {
      toast.error("Erro ao excluir registro");
      return;
    }

    toast.success("Arquivo excluído!");
    fetchArquivos();
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
          <Paperclip className="h-3.5 w-3.5" />
          Arquivos
        </h4>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 text-xs"
          onClick={() => setDialogOpen(true)}
        >
          <Upload className="h-3.5 w-3.5" /> Anexar Arquivo
        </Button>
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground">Carregando...</p>
      ) : arquivos.length === 0 ? (
        <p className="text-xs text-muted-foreground py-1">Nenhum arquivo anexado.</p>
      ) : (
        <div className="space-y-1">
          {arquivos.map((arq) => (
            <div key={arq.id} className="flex items-center justify-between text-sm py-1.5 px-2 rounded-md hover:bg-muted/30">
              <div className="flex items-center gap-2 min-w-0">
                {fileIcon(arq.nome)}
                <a
                  href={arq.arquivo_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="truncate text-foreground hover:underline"
                  title={arq.nome}
                >
                  {arq.nome}
                </a>
                <span className="rounded px-1.5 py-0.5 text-xs bg-muted text-muted-foreground shrink-0">
                  {arq.categoria}
                </span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {formatSize(arq.tamanho)}
                </span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {format(new Date(arq.created_at), "dd/MM/yy", { locale: ptBR })}
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0 ml-2">
                <a
                  href={arq.arquivo_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1 rounded hover:bg-muted transition-colors"
                  title="Baixar"
                >
                  <Download className="h-3.5 w-3.5 text-muted-foreground" />
                </a>
                <button
                  className="p-1 rounded hover:bg-destructive/10 transition-colors"
                  title="Excluir"
                  onClick={() => handleDelete(arq)}
                >
                  <Trash2 className="h-3.5 w-3.5 text-destructive/70" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Anexar Arquivo</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Input
                ref={fileInputRef}
                type="file"
                accept={ACCEPT}
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                PDF, DWG, SketchUp, imagens, Word, Excel
              </p>
            </div>
            <Select value={projetoId || "none"} onValueChange={(v) => setProjetoId(v === "none" ? null : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Projeto (opcional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum projeto (geral)</SelectItem>
                {projetos.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={categoria} onValueChange={setCategoria}>
              <SelectTrigger>
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIAS.map((cat) => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Textarea
              placeholder="Descrição / notas (opcional)"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={2}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleUpload} disabled={!selectedFile || uploading}>
              {uploading ? "Enviando..." : "Anexar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ClienteArquivos;
