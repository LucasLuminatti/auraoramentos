import { useState, useEffect } from "react";
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
import { ArrowLeft, Loader2, Trash2, Search, FileSpreadsheet, DollarSign, ImageIcon, Flag } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import logo from "@/assets/logo.png";
import AdminDashboard from "@/components/AdminDashboard";
import AdminExceptions from "@/components/AdminExceptions";
import ImportProdutos from "@/components/ImportProdutos";
import ImportPrecos from "@/components/ImportPrecos";
import ImportImagens from "@/components/ImportImagens";
import EncerrarNegociacaoModal from "@/components/EncerrarNegociacaoModal";

const VALID_TABS = ["dashboard", "excecoes", "importacao", "produtos", "colaboradores", "orcamentos", "clientes"] as const;
type AdminTab = (typeof VALID_TABS)[number];

const Admin = () => {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const tabParam = searchParams.get("tab") as AdminTab | null;
  const activeTab: AdminTab = tabParam && VALID_TABS.includes(tabParam) ? tabParam : "dashboard";

  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value }, { replace: true });
  };

  const [importSubTab, setImportSubTab] = useState<"produtos" | "precos" | "imagens">("produtos");

  // Produtos tab
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

  // Encerrar negociação
  const [encerrarOpen, setEncerrarOpen] = useState(false);
  const [encerrarOrcId, setEncerrarOrcId] = useState("");

  useEffect(() => {
    fetchProdutos("");
    fetchColaboradores();
    fetchOrcamentos();
    fetchClientes();
  }, []);

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

  const statusLabel = (s: string) => {
    switch (s) {
      case "rascunho": return "Rascunho";
      case "enviado": return "Enviado";
      case "aprovado": return "Aprovado";
      case "fechado": return "Fechado";
      case "perdido": return "Perdido";
      default: return s;
    }
  };

  const statusClass = (s: string) => {
    switch (s) {
      case "enviado": return "bg-yellow-100 text-yellow-800";
      case "aprovado": return "bg-blue-100 text-blue-800";
      case "fechado": return "bg-green-100 text-green-800";
      case "perdido": return "bg-red-100 text-red-800";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const canEncerrar = (status: string) => status === "enviado" || status === "aprovado";

  const importSubTabs = [
    { key: "produtos" as const, label: "Produtos", description: "Código + descrição", icon: FileSpreadsheet },
    { key: "precos" as const, label: "Preços", description: "Atualizar preços", icon: DollarSign },
    { key: "imagens" as const, label: "Imagens", description: "Fotos dos produtos", icon: ImageIcon },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Logo" className="h-12 w-auto cursor-pointer" onClick={() => navigate("/")} />
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
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="mb-6">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="excecoes">Exceções de Preço</TabsTrigger>
            <TabsTrigger value="importacao">Importação</TabsTrigger>
            <TabsTrigger value="produtos">Produtos</TabsTrigger>
            <TabsTrigger value="colaboradores">Colaboradores</TabsTrigger>
            <TabsTrigger value="orcamentos">Orçamentos</TabsTrigger>
            <TabsTrigger value="clientes">Clientes</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard">
            <AdminDashboard orcamentos={orcamentos} />
          </TabsContent>

          <TabsContent value="excecoes">
            <AdminExceptions />
          </TabsContent>

          {/* IMPORTAÇÃO */}
          <TabsContent value="importacao" className="space-y-6">
            <div className="flex justify-center gap-4">
              {importSubTabs.map(({ key, label, description, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setImportSubTab(key)}
                  className={`flex w-[180px] flex-col items-center gap-2 rounded-xl border p-5 transition-colors ${
                    importSubTab === key
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-card hover:border-primary/50 hover:bg-muted/50 text-foreground"
                  }`}
                >
                  <Icon className="h-7 w-7" />
                  <span className="font-semibold text-sm">{label}</span>
                  <span className="text-xs text-muted-foreground">{description}</span>
                </button>
              ))}
            </div>

            {importSubTab === "produtos" && <ImportProdutos />}
            {importSubTab === "precos" && <ImportPrecos />}
            {importSubTab === "imagens" && <ImportImagens />}
          </TabsContent>

          {/* PRODUTOS */}
          <TabsContent value="produtos" className="space-y-6">
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
                    ) : produtos.length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Nenhum produto encontrado</TableCell></TableRow>
                    ) : (
                      produtos.map((p) => (
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
                  Mostrando {produtos.length} de {totalProdutos} produtos
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
                        {canEncerrar(o.status) && (
                          <button
                            className="p-1 rounded hover:bg-muted transition-colors"
                            title="Encerrar negociação"
                            onClick={() => {
                              setEncerrarOrcId(o.id);
                              setEncerrarOpen(true);
                            }}
                          >
                            <Flag className="h-4 w-4 text-muted-foreground" />
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

      <EncerrarNegociacaoModal
        open={encerrarOpen}
        onOpenChange={setEncerrarOpen}
        orcamentoId={encerrarOrcId}
        onSuccess={fetchOrcamentos}
      />
    </div>
  );
};

export default Admin;
