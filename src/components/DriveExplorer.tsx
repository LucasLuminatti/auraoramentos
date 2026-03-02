import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Folder,
  FileText,
  Image,
  File,
  Upload,
  FolderPlus,
  Download,
  Trash2,
  LayoutGrid,
  List,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import DriveBreadcrumb, { type BreadcrumbItem } from "./DriveBreadcrumb";

interface Pasta {
  id: string;
  nome: string;
  created_at: string;
}

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

const CATEGORIAS = ["Planta", "Reunião", "Documento", "Geral"];
const ACCEPT = ".pdf,.dwg,.skp,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx";

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileIcon(nome: string) {
  const ext = nome.split(".").pop()?.toLowerCase();
  if (["jpg", "jpeg", "png", "webp"].includes(ext || ""))
    return <Image className="h-5 w-5 text-primary/70" />;
  if (["pdf"].includes(ext || ""))
    return <FileText className="h-5 w-5 text-destructive/70" />;
  return <File className="h-5 w-5 text-muted-foreground" />;
}

const DriveExplorer = () => {
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [projetoId, setProjetoId] = useState<string | null>(null);
  const [pastaId, setPastaId] = useState<string | null>(null);
  const [breadcrumb, setBreadcrumb] = useState<BreadcrumbItem[]>([]);

  const [pastas, setPastas] = useState<Pasta[]>([]);
  const [arquivos, setArquivos] = useState<Arquivo[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");

  // Clientes list for root view
  const [clientes, setClientes] = useState<{ id: string; nome: string }[]>([]);
  const [projetos, setProjetos] = useState<{ id: string; nome: string; cliente_id: string }[]>([]);

  // New folder dialog
  const [novaPastaOpen, setNovaPastaOpen] = useState(false);
  const [novaPastaNome, setNovaPastaNome] = useState("");

  // Upload dialog
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadCategoria, setUploadCategoria] = useState("Geral");
  const [uploadDescricao, setUploadDescricao] = useState("");
  const [selectedFile, setSelectedFile] = useState<globalThis.File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<{ type: "pasta" | "arquivo"; id: string; nome: string } | null>(null);

  // Fetch root data
  useEffect(() => {
    const fetchRoot = async () => {
      const [{ data: c }, { data: p }] = await Promise.all([
        supabase.from("clientes").select("id, nome").order("nome"),
        supabase.from("projetos").select("id, nome, cliente_id").order("nome"),
      ]);
      setClientes(c || []);
      setProjetos(p || []);
    };
    fetchRoot();
  }, []);

  // Fetch current level data
  useEffect(() => {
    if (!clienteId) return;
    fetchCurrentLevel();
  }, [clienteId, projetoId, pastaId]);

  const fetchCurrentLevel = async () => {
    setLoading(true);

    // Fetch folders
    let folderQuery = supabase
      .from("arquivo_pastas")
      .select("id, nome, created_at")
      .eq("cliente_id", clienteId!)
      .order("nome");

    if (projetoId) folderQuery = folderQuery.eq("projeto_id", projetoId);
    else folderQuery = folderQuery.is("projeto_id", null);

    if (pastaId) folderQuery = folderQuery.eq("pasta_pai_id", pastaId);
    else folderQuery = folderQuery.is("pasta_pai_id", null);

    // Fetch files
    let fileQuery = supabase
      .from("cliente_arquivos")
      .select("id, nome, descricao, categoria, arquivo_url, arquivo_path, tamanho, created_at")
      .eq("cliente_id", clienteId!)
      .order("created_at", { ascending: false });

    if (projetoId) fileQuery = fileQuery.eq("projeto_id", projetoId);
    else fileQuery = fileQuery.is("projeto_id", null);

    if (pastaId) fileQuery = fileQuery.eq("pasta_id", pastaId);
    else fileQuery = fileQuery.is("pasta_id", null);

    const [{ data: foldersData }, { data: filesData }] = await Promise.all([
      folderQuery,
      fileQuery,
    ]);

    setPastas((foldersData as Pasta[]) || []);
    setArquivos((filesData as Arquivo[]) || []);
    setLoading(false);
  };

  // Navigation
  const navigateToCliente = (id: string, nome: string) => {
    setClienteId(id);
    setProjetoId(null);
    setPastaId(null);
    setBreadcrumb([{ id, nome, tipo: "cliente" }]);
  };

  const navigateToProjeto = (cId: string, cNome: string, pId: string, pNome: string) => {
    setClienteId(cId);
    setProjetoId(pId);
    setPastaId(null);
    setBreadcrumb([
      { id: cId, nome: cNome, tipo: "cliente" },
      { id: pId, nome: pNome, tipo: "projeto" },
    ]);
  };

  const navigateToPasta = (pasta: Pasta) => {
    setPastaId(pasta.id);
    setBreadcrumb((prev) => [...prev, { id: pasta.id, nome: pasta.nome, tipo: "pasta" }]);
  };

  const navigateBreadcrumb = (index: number) => {
    if (index === -1) {
      // Root
      setClienteId(null);
      setProjetoId(null);
      setPastaId(null);
      setBreadcrumb([]);
      return;
    }

    const item = breadcrumb[index];
    const newBreadcrumb = breadcrumb.slice(0, index + 1);
    setBreadcrumb(newBreadcrumb);

    if (item.tipo === "cliente") {
      setClienteId(item.id);
      setProjetoId(null);
      setPastaId(null);
    } else if (item.tipo === "projeto") {
      setProjetoId(item.id);
      setPastaId(null);
    } else {
      setPastaId(item.id);
    }
  };

  // Create folder
  const handleCriarPasta = async () => {
    if (!novaPastaNome.trim() || !clienteId) return;
    const { error } = await supabase.from("arquivo_pastas").insert({
      nome: novaPastaNome.trim(),
      cliente_id: clienteId,
      projeto_id: projetoId || null,
      pasta_pai_id: pastaId || null,
    });
    if (error) {
      toast.error("Erro ao criar pasta");
      return;
    }
    toast.success("Pasta criada!");
    setNovaPastaOpen(false);
    setNovaPastaNome("");
    fetchCurrentLevel();
  };

  // Upload file
  const handleUpload = async () => {
    if (!selectedFile || !clienteId) return;
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
      projeto_id: projetoId || null,
      pasta_id: pastaId || null,
      nome: selectedFile.name,
      descricao: uploadDescricao.trim() || null,
      categoria: uploadCategoria,
      arquivo_path: path,
      arquivo_url: urlData.publicUrl,
      tamanho: selectedFile.size,
    });

    if (insertError) {
      toast.error("Erro ao salvar registro");
      setUploading(false);
      return;
    }

    toast.success("Arquivo enviado!");
    setUploadOpen(false);
    setSelectedFile(null);
    setUploadDescricao("");
    setUploadCategoria("Geral");
    setUploading(false);
    fetchCurrentLevel();
  };

  // Delete
  const handleDelete = async () => {
    if (!deleteTarget) return;

    if (deleteTarget.type === "pasta") {
      const { error } = await supabase.from("arquivo_pastas").delete().eq("id", deleteTarget.id);
      if (error) {
        toast.error("Erro ao excluir pasta");
      } else {
        toast.success("Pasta excluída!");
      }
    } else {
      const arquivo = arquivos.find((a) => a.id === deleteTarget.id);
      if (arquivo) {
        await supabase.storage.from("cliente-arquivos").remove([arquivo.arquivo_path]);
      }
      const { error } = await supabase.from("cliente_arquivos").delete().eq("id", deleteTarget.id);
      if (error) {
        toast.error("Erro ao excluir arquivo");
      } else {
        toast.success("Arquivo excluído!");
      }
    }

    setDeleteTarget(null);
    fetchCurrentLevel();
  };

  // Root view: show clients
  if (!clienteId) {
    return (
      <div className="flex-1 p-6">
        <DriveBreadcrumb items={[]} onNavigate={navigateBreadcrumb} />
        <h2 className="text-lg font-semibold text-foreground mt-2 mb-4">Selecione um cliente</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {clientes.map((c) => {
            const clienteProjetos = projetos.filter((p) => p.cliente_id === c.id);
            return (
              <button
                key={c.id}
                onClick={() => navigateToCliente(c.id, c.nome)}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border bg-card hover:bg-muted/50 transition-colors"
              >
                <Folder className="h-10 w-10 text-primary" />
                <span className="text-sm font-medium text-foreground text-center truncate w-full">
                  {c.nome}
                </span>
                <span className="text-xs text-muted-foreground">
                  {clienteProjetos.length} projeto{clienteProjetos.length !== 1 ? "s" : ""}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // Client level: show projects + general files
  return (
    <div className="flex-1 p-6 overflow-auto">
      <DriveBreadcrumb items={breadcrumb} onNavigate={navigateBreadcrumb} />

      {/* Toolbar */}
      <div className="flex items-center justify-between mt-2 mb-4">
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => { setNovaPastaNome(""); setNovaPastaOpen(true); }}>
            <FolderPlus className="h-4 w-4" /> Nova Pasta
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => { setSelectedFile(null); setUploadDescricao(""); setUploadCategoria("Geral"); setUploadOpen(true); }}>
            <Upload className="h-4 w-4" /> Upload
          </Button>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant={viewMode === "list" ? "secondary" : "ghost"}
            className="h-8 w-8"
            onClick={() => setViewMode("list")}
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant={viewMode === "grid" ? "secondary" : "ghost"}
            className="h-8 w-8"
            onClick={() => setViewMode("grid")}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-muted-foreground text-sm py-8 text-center">Carregando...</p>
      ) : pastas.length === 0 && arquivos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Folder className="h-12 w-12 text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground text-sm">Esta pasta está vazia</p>
          <p className="text-muted-foreground/70 text-xs mt-1">Crie uma pasta ou faça upload de um arquivo</p>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {pastas.map((pasta) => (
            <button
              key={pasta.id}
              onDoubleClick={() => navigateToPasta(pasta)}
              onClick={() => navigateToPasta(pasta)}
              className="group flex flex-col items-center gap-2 p-4 rounded-xl border bg-card hover:bg-muted/50 transition-colors relative"
            >
              <button
                className="absolute top-2 right-2 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/10 transition-all"
                onClick={(e) => { e.stopPropagation(); setDeleteTarget({ type: "pasta", id: pasta.id, nome: pasta.nome }); }}
              >
                <Trash2 className="h-3.5 w-3.5 text-destructive/70" />
              </button>
              <Folder className="h-10 w-10 text-primary" />
              <span className="text-sm font-medium text-foreground text-center truncate w-full">{pasta.nome}</span>
            </button>
          ))}
          {arquivos.map((arq) => (
            <div
              key={arq.id}
              className="group flex flex-col items-center gap-2 p-4 rounded-xl border bg-card hover:bg-muted/50 transition-colors relative"
            >
              <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                <a href={arq.arquivo_url} target="_blank" rel="noopener noreferrer" className="p-1 rounded hover:bg-muted">
                  <Download className="h-3.5 w-3.5 text-muted-foreground" />
                </a>
                <button
                  className="p-1 rounded hover:bg-destructive/10"
                  onClick={() => setDeleteTarget({ type: "arquivo", id: arq.id, nome: arq.nome })}
                >
                  <Trash2 className="h-3.5 w-3.5 text-destructive/70" />
                </button>
              </div>
              {fileIcon(arq.nome)}
              <span className="text-xs font-medium text-foreground text-center truncate w-full">{arq.nome}</span>
              <span className="text-xs text-muted-foreground">{formatSize(arq.tamanho)}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-0.5">
          {pastas.map((pasta) => (
            <button
              key={pasta.id}
              onClick={() => navigateToPasta(pasta)}
              className="group w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Folder className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium text-foreground">{pasta.nome}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {format(new Date(pasta.created_at), "dd/MM/yy", { locale: ptBR })}
                </span>
                <button
                  className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/10 transition-all"
                  onClick={(e) => { e.stopPropagation(); setDeleteTarget({ type: "pasta", id: pasta.id, nome: pasta.nome }); }}
                >
                  <Trash2 className="h-3.5 w-3.5 text-destructive/70" />
                </button>
              </div>
            </button>
          ))}
          {arquivos.map((arq) => (
            <div
              key={arq.id}
              className="group flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                {fileIcon(arq.nome)}
                <a
                  href={arq.arquivo_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-foreground hover:underline truncate"
                >
                  {arq.nome}
                </a>
                <span className="rounded px-1.5 py-0.5 text-xs bg-muted text-muted-foreground shrink-0">
                  {arq.categoria}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-muted-foreground">{formatSize(arq.tamanho)}</span>
                <span className="text-xs text-muted-foreground">
                  {format(new Date(arq.created_at), "dd/MM/yy", { locale: ptBR })}
                </span>
                <a href={arq.arquivo_url} target="_blank" rel="noopener noreferrer" className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-muted transition-all">
                  <Download className="h-3.5 w-3.5 text-muted-foreground" />
                </a>
                <button
                  className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/10 transition-all"
                  onClick={() => setDeleteTarget({ type: "arquivo", id: arq.id, nome: arq.nome })}
                >
                  <Trash2 className="h-3.5 w-3.5 text-destructive/70" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New Folder Dialog */}
      <Dialog open={novaPastaOpen} onOpenChange={setNovaPastaOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Pasta</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Input
              placeholder="Nome da pasta"
              value={novaPastaNome}
              onChange={(e) => setNovaPastaNome(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCriarPasta()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNovaPastaOpen(false)}>Cancelar</Button>
            <Button onClick={handleCriarPasta} disabled={!novaPastaNome.trim()}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload Dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload de Arquivo</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Input ref={fileInputRef} type="file" accept={ACCEPT} onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} />
            <p className="text-xs text-muted-foreground">PDF, DWG, SketchUp, imagens, Word, Excel</p>
            <Select value={uploadCategoria} onValueChange={setUploadCategoria}>
              <SelectTrigger><SelectValue placeholder="Categoria" /></SelectTrigger>
              <SelectContent>
                {CATEGORIAS.map((cat) => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Textarea placeholder="Descrição (opcional)" value={uploadDescricao} onChange={(e) => setUploadDescricao(e.target.value)} rows={2} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadOpen(false)}>Cancelar</Button>
            <Button onClick={handleUpload} disabled={!selectedFile || uploading}>
              {uploading ? "Enviando..." : "Enviar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {deleteTarget?.type === "pasta" ? "pasta" : "arquivo"}?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.type === "pasta"
                ? `A pasta "${deleteTarget.nome}" e todo seu conteúdo serão excluídos permanentemente.`
                : `O arquivo "${deleteTarget?.nome}" será excluído permanentemente.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default DriveExplorer;
