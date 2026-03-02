import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeft, Upload, Loader2, CheckCircle, AlertCircle, Trash2, Search, ImageIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import logo from "@/assets/logo.png";
import AdminDashboard from "@/components/AdminDashboard";
import AdminExceptions from "@/components/AdminExceptions";

interface ProdutoRow {
  codigo: string;
  descricao: string;
  preco_tabela?: number;
  preco_minimo?: number;
}

const Admin = () => {
  const navigate = useNavigate();
  const { signOut } = useAuth();

  // Produtos tab
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<{ success: boolean; message: string } | null>(null);
  const [importProgress, setImportProgress] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [produtos, setProdutos] = useState<any[]>([]);
  const [produtoSearch, setProdutoSearch] = useState("");
  const [loadingProdutos, setLoadingProdutos] = useState(false);
  const [totalProdutos, setTotalProdutos] = useState(0);

  // Colaboradores tab
  const [colaboradores, setColaboradores] = useState<any[]>([]);

  // Orcamentos tab
  const [orcamentos, setOrcamentos] = useState<any[]>([]);

  // Clientes tab
  const [clientes, setClientes] = useState<any[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; nome: string } | null>(null);

  useEffect(() => {
    fetchProdutos("");
    fetchColaboradores();
    fetchOrcamentos();
    fetchClientes();
  }, []);

  // Debounced search for produtos
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchProdutos(produtoSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [produtoSearch]);

  const fetchProdutos = async (search: string) => {
    setLoadingProdutos(true);
    let query = supabase.from("produtos").select("*", { count: "exact" });
    if (search.trim().length >= 2) {
      query = query.or(`codigo.ilike.%${search}%,descricao.ilike.%${search}%`);
    }
    const { data, count } = await query.order("codigo").limit(100);
    setProdutos(data || []);
    setTotalProdutos(count || 0);
    setLoadingProdutos(false);
  };

  const fetchColaboradores = async () => {
    const { data } = await supabase.from("colaboradores").select("*").order("nome");
    setColaboradores(data || []);
  };

  const fetchOrcamentos = async () => {
    const { data } = await supabase
      .from("orcamentos")
      .select("*, clientes(nome), colaboradores(nome), projetos(nome)")
      .order("created_at", { ascending: false });
    setOrcamentos(data || []);
  };

  const fetchClientes = async () => {
    const { data } = await supabase.from("clientes").select("*").order("nome");
    setClientes(data || []);
  };

  // Import produtos logic
  const parsePrecoMinimo = (val: any): number => {
    if (typeof val === "number") return val;
    if (!val) return 0;
    const str = String(val).replace("R$", "").replace(/\s/g, "").replace(",", ".").replace("-", "0");
    return parseFloat(str) || 0;
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportLoading(true);
    setImportResult(null);
    setImportProgress("Lendo arquivo...");
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet);
      const produtosImport: ProdutoRow[] = rows
        .map((row) => {
          const codigo = (row["Nº do item"] || row["N do item"] || row["codigo"] || "").toString().trim();
          const descricao = (row["Descrição do item"] || row["Desc"] || row["descricao"] || row["Descrição"] || "").toString().trim();
          const preco_tabela = parseFloat(row["PRECO TABELA V2"]) || 0;
          const preco_minimo = parsePrecoMinimo(row["PRECO MINIMO V2"]);
          return { codigo, descricao, preco_tabela, preco_minimo };
        })
        .filter((p) => p.codigo && p.descricao);
      if (produtosImport.length === 0) {
        setImportResult({ success: false, message: "Nenhum produto válido encontrado na planilha." });
        setImportLoading(false);
        return;
      }
      setImportProgress(`Importando ${produtosImport.length} produtos...`);
      const { data: resData, error } = await supabase.functions.invoke("import-produtos", { body: { produtos: produtosImport } });
      if (error) throw error;
      setImportResult({ success: true, message: `${resData.inserted} produtos importados com sucesso!` });
      fetchProdutos(produtoSearch);
    } catch (err: any) {
      setImportResult({ success: false, message: err.message || "Erro na importação" });
    } finally {
      setImportLoading(false);
      setImportProgress("");
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleDeleteCliente = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from("clientes").delete().eq("id", deleteTarget.id);
    if (error) {
      toast.error("Erro ao excluir cliente. Verifique se não há projetos vinculados.");
      return;
    }
    toast.success("Cliente excluído!");
    setDeleteDialogOpen(false);
    setDeleteTarget(null);
    fetchClientes();
  };

  const handleDeleteColaborador = async (id: string) => {
    const { error } = await supabase.from("colaboradores").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao remover colaborador");
      return;
    }
    toast.success("Colaborador removido!");
    fetchColaboradores();
  };

  const displayProdutos = produtos;

  const statusLabel = (s: string) => {
    switch (s) {
      case "rascunho": return "Rascunho";
      case "enviado": return "Enviado";
      case "aprovado": return "Aprovado";
      case "fechado": return "Fechado";
      default: return s;
    }
  };

  const statusClass = (s: string) => {
    switch (s) {
      case "enviado": return "bg-yellow-100 text-yellow-800";
      case "aprovado": return "bg-blue-100 text-blue-800";
      case "fechado": return "bg-green-100 text-green-800";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const handleFecharOrcamento = async (id: string) => {
    const { error } = await supabase
      .from("orcamentos")
      .update({ status: "fechado" })
      .eq("id", id);
    if (error) {
      toast.error("Erro ao fechar orçamento");
      return;
    }
    toast.success("Orçamento marcado como fechado!");
    fetchOrcamentos();
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Logo" className="h-12 w-auto" />
            <span className="text-lg font-semibold text-foreground">Painel Admin</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate("/")}>
              <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
            </Button>
            <Button variant="ghost" size="sm" onClick={signOut} className="text-muted-foreground">
              Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <Tabs defaultValue="dashboard">
          <TabsList className="mb-6">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="excecoes">Exceções de Preço</TabsTrigger>
            <TabsTrigger value="produtos">Produtos</TabsTrigger>
            <TabsTrigger value="colaboradores">Colaboradores</TabsTrigger>
            <TabsTrigger value="orcamentos">Orçamentos</TabsTrigger>
            <TabsTrigger value="clientes">Clientes</TabsTrigger>
          </TabsList>

          {/* DASHBOARD */}
          <TabsContent value="dashboard">
            <AdminDashboard orcamentos={orcamentos} />
          </TabsContent>

          {/* EXCEÇÕES DE PREÇO */}
          <TabsContent value="excecoes">
            <AdminExceptions />
          </TabsContent>

          {/* PRODUTOS */}
          <TabsContent value="produtos" className="space-y-6">
            <div className="flex gap-4 flex-wrap">
              <div className="flex-1 min-w-[280px] rounded-xl border bg-card p-6 space-y-4">
                <h3 className="font-semibold text-foreground">Importar Produtos</h3>
              <p className="text-sm text-muted-foreground">Selecione a planilha Excel com as colunas "Nº do item", "Descrição do item", "PRECO TABELA V2" e "PRECO MINIMO V2"</p>
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="hidden" />
              <Button className="gap-2" disabled={importLoading} onClick={() => fileRef.current?.click()}>
                {importLoading ? <><Loader2 className="h-4 w-4 animate-spin" />{importProgress}</> : <><Upload className="h-4 w-4" />Selecionar Arquivo</>}
              </Button>
              {importResult && (
                <div className={`flex items-start gap-3 rounded-lg border p-4 ${importResult.success ? "border-green-500/30 bg-green-500/10 text-green-700" : "border-destructive/30 bg-destructive/10 text-destructive"}`}>
                  {importResult.success ? <CheckCircle className="h-5 w-5 shrink-0" /> : <AlertCircle className="h-5 w-5 shrink-0" />}
                  <p className="text-sm">{importResult.message}</p>
                </div>
              )}
              </div>
              <div className="flex-shrink-0 w-[220px] rounded-xl border bg-card p-6 flex flex-col items-center justify-center gap-3 text-center">
                <ImageIcon className="h-8 w-8 text-primary" />
                <h3 className="font-semibold text-foreground text-sm">Upload de Imagens</h3>
                <p className="text-xs text-muted-foreground">Envie fotos dos produtos em lote</p>
                <Button size="sm" className="gap-2" onClick={() => navigate("/admin/upload-imagens")}>
                  <Upload className="h-4 w-4" /> Upload
                </Button>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar produto por código ou descrição..." value={produtoSearch} onChange={(e) => setProdutoSearch(e.target.value)} className="max-w-sm" />
              </div>
              <div className="rounded-xl border overflow-hidden">
                <Table>
                  <TableHeader>
                     <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="text-right">Preço Tabela</TableHead>
                      <TableHead className="text-right">Preço Mínimo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                     {loadingProdutos ? (
                      <TableRow><TableCell colSpan={4} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin inline-block mr-2" />Buscando...</TableCell></TableRow>
                    ) : displayProdutos.length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Nenhum produto encontrado</TableCell></TableRow>
                    ) : (
                      displayProdutos.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="font-mono text-sm">{p.codigo}</TableCell>
                          <TableCell>{p.descricao}</TableCell>
                          <TableCell className="text-right">{p.preco_tabela ? `R$ ${Number(p.preco_tabela).toFixed(2)}` : "—"}</TableCell>
                          <TableCell className="text-right">{p.preco_minimo ? `R$ ${Number(p.preco_minimo).toFixed(2)}` : "—"}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
                <p className="text-xs text-muted-foreground text-center py-2">
                  Mostrando {displayProdutos.length} de {totalProdutos} produtos
                </p>
              </div>
            </div>
          </TabsContent>

          {/* COLABORADORES */}
          <TabsContent value="colaboradores">
            <div className="rounded-xl border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Cargo</TableHead>
                    <TableHead>Departamento</TableHead>
                    <TableHead className="w-20"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {colaboradores.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.nome}</TableCell>
                      <TableCell>{c.cargo || "—"}</TableCell>
                      <TableCell>{c.departamento || "—"}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleDeleteColaborador(c.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {colaboradores.length === 0 && (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Nenhum colaborador</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* ORCAMENTOS */}
          <TabsContent value="orcamentos">
            <div className="rounded-xl border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Projeto</TableHead>
                    <TableHead>Colaborador</TableHead>
                     <TableHead>Valor</TableHead>
                     <TableHead>Status</TableHead>
                     <TableHead className="w-20">Ações</TableHead>
                   </TableRow>
                </TableHeader>
                <TableBody>
                  {orcamentos.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell>{format(new Date(o.data), "dd/MM/yyyy", { locale: ptBR })}</TableCell>
                      <TableCell>{(o as any).clientes?.nome || "—"}</TableCell>
                      <TableCell>{(o as any).projetos?.nome || "—"}</TableCell>
                      <TableCell>{(o as any).colaboradores?.nome || "—"}</TableCell>
                      <TableCell className="font-medium">R$ {Number(o.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell>
                        <span className={`rounded px-2 py-0.5 text-xs font-medium ${statusClass(o.status)}`}>{statusLabel(o.status)}</span>
                      </TableCell>
                      <TableCell>
                        {o.status === "aprovado" && (
                          <button
                            className="p-1 rounded hover:bg-green-100 transition-colors"
                            title="Marcar como Fechado"
                            onClick={() => handleFecharOrcamento(o.id)}
                          >
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          </button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {orcamentos.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhum orçamento</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* CLIENTES */}
          <TabsContent value="clientes">
            <div className="rounded-xl border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead className="w-20"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clientes.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.nome}</TableCell>
                      <TableCell>{c.email || "—"}</TableCell>
                      <TableCell>{c.telefone || "—"}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => { setDeleteTarget({ id: c.id, nome: c.nome }); setDeleteDialogOpen(true); }}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {clientes.length === 0 && (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Nenhum cliente</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </main>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Excluir Cliente</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Tem certeza que deseja excluir o cliente <strong>{deleteTarget?.nome}</strong>? Esta ação não pode ser desfeita.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDeleteCliente}>Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Admin;
