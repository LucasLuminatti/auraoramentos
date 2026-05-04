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
import { ArrowLeft, Loader2, Trash2, Search, FileSpreadsheet, DollarSign, ImageIcon, Flag, Plus, Pencil } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import logo from "@/assets/logo.png";
import AdminDashboard from "@/components/AdminDashboard";
import AdminExceptions from "@/components/AdminExceptions";
import ImportMaster from "@/components/ImportMaster";
import ImportProdutos from "@/components/ImportProdutos";
import ImportImagens from "@/components/ImportImagens";
import PrecosBatch from "@/components/PrecosBatch";
import EncerrarNegociacaoModal from "@/components/EncerrarNegociacaoModal";
import CompletarCadastroBanner from "@/components/CompletarCadastroBanner";
import ArquitetoDialog, { type ArquitetoRow } from "@/components/ArquitetoDialog";
import ClienteDialog, { type ClienteRow } from "@/components/ClienteDialog";
import ProdutoEditDialog, { type ProdutoEditRow } from "@/components/ProdutoEditDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const TOP_TABS = ["inicio", "cadastros", "pedidos", "precos", "excecoes"] as const;
type TopTab = (typeof TOP_TABS)[number];

const SUB_TABS_BY_TAB: Record<TopTab, readonly string[]> = {
  inicio: [],
  cadastros: ["produtos", "arquitetos", "clientes", "colaboradores"],
  pedidos: [],
  precos: ["atualizacao", "importacao"],
  excecoes: [],
};

const DEFAULT_SUB_BY_TAB: Partial<Record<TopTab, string>> = {
  cadastros: "produtos",
  precos: "atualizacao",
};

// Backward-compat: tabs antigas → novo (?tab=X&sub=Y)
const LEGACY_TAB_MAP: Record<string, { tab: TopTab; sub?: string }> = {
  dashboard: { tab: "inicio" },
  produtos: { tab: "cadastros", sub: "produtos" },
  clientes: { tab: "cadastros", sub: "clientes" },
  arquitetos: { tab: "cadastros", sub: "arquitetos" },
  colaboradores: { tab: "cadastros", sub: "colaboradores" },
  orcamentos: { tab: "pedidos" },
  importacao: { tab: "precos", sub: "importacao" },
  excecoes: { tab: "excecoes" },
};

const Admin = () => {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const rawTab = searchParams.get("tab");
  const rawSub = searchParams.get("sub");

  // Normalize legacy tabs
  const legacy = rawTab ? LEGACY_TAB_MAP[rawTab] : undefined;
  const activeTab: TopTab = legacy
    ? legacy.tab
    : rawTab && (TOP_TABS as readonly string[]).includes(rawTab)
      ? (rawTab as TopTab)
      : "inicio";

  const validSubs = SUB_TABS_BY_TAB[activeTab];
  const candidateSub = legacy?.sub ?? rawSub ?? DEFAULT_SUB_BY_TAB[activeTab] ?? "";
  const activeSub = validSubs.includes(candidateSub) ? candidateSub : (DEFAULT_SUB_BY_TAB[activeTab] ?? "");

  // Effect: se URL veio com legacy ou inválido, normaliza (replace)
  useEffect(() => {
    const isLegacy = !!(rawTab && LEGACY_TAB_MAP[rawTab]);
    const isInvalidTab = !!(rawTab && !(TOP_TABS as readonly string[]).includes(rawTab) && !LEGACY_TAB_MAP[rawTab]);
    const subMismatch =
      (validSubs.length > 0 && rawSub !== activeSub) ||
      (validSubs.length === 0 && !!rawSub);
    if (isLegacy || isInvalidTab || subMismatch) {
      const next: Record<string, string> = { tab: activeTab };
      if (validSubs.length > 0) next.sub = activeSub;
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawTab, rawSub]);

  const handleTabChange = (value: string) => {
    const t = value as TopTab;
    const next: Record<string, string> = { tab: t };
    const defSub = DEFAULT_SUB_BY_TAB[t];
    if (defSub) next.sub = defSub;
    setSearchParams(next, { replace: true });
  };

  const handleSubChange = (sub: string) => {
    setSearchParams({ tab: activeTab, sub }, { replace: true });
  };

  const [importSubTab, setImportSubTab] = useState<"master" | "produtos" | "imagens" | "precos">("master");

  // Produtos tab
  const [produtos, setProdutos] = useState<any[]>([]);
  const [produtoSearch, setProdutoSearch] = useState("");
  const [loadingProdutos, setLoadingProdutos] = useState(false);
  const [totalProdutos, setTotalProdutos] = useState(0);
  const [produtoEditOpen, setProdutoEditOpen] = useState(false);
  const [produtoEditTarget, setProdutoEditTarget] = useState<ProdutoEditRow | null>(null);
  const [produtoCreateOpen, setProdutoCreateOpen] = useState(false);

  // Colaboradores tab
  const [colaboradores, setColaboradores] = useState<any[]>([]);

  // Orcamentos tab
  const [orcamentos, setOrcamentos] = useState<any[]>([]);

  // Clientes tab
  const [clientes, setClientes] = useState<any[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; nome: string } | null>(null);
  const [clienteCreateOpen, setClienteCreateOpen] = useState(false);
  const [clienteEditOpen, setClienteEditOpen] = useState(false);
  const [clienteEditTarget, setClienteEditTarget] = useState<ClienteRow | null>(null);

  // Arquitetos tab
  const [arquitetos, setArquitetos] = useState<ArquitetoRow[]>([]);
  const [arquitetosMap, setArquitetosMap] = useState<Record<string, string>>({});
  const [arquitetoDialogOpen, setArquitetoDialogOpen] = useState(false);
  const [arquitetoDialogMode, setArquitetoDialogMode] = useState<"create" | "edit">("create");
  const [arquitetoEditTarget, setArquitetoEditTarget] = useState<ArquitetoRow | null>(null);
  const [arquitetoDeleteTarget, setArquitetoDeleteTarget] = useState<ArquitetoRow | null>(null);
  const [arquitetoDeleteOpen, setArquitetoDeleteOpen] = useState(false);

  // Encerrar negociação
  const [encerrarOpen, setEncerrarOpen] = useState(false);
  const [encerrarOrcId, setEncerrarOrcId] = useState("");

  useEffect(() => {
    fetchProdutos("");
    fetchColaboradores();
    fetchOrcamentos();
    fetchClientes();
    fetchArquitetos();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchProdutos(produtoSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [produtoSearch]);

  const fetchProdutos = async (search: string) => {
    setLoadingProdutos(true);
    let query = supabase.from("product_variants").select("id, codigo, descricao, nome, preco_tabela, preco_minimo, arquiteto_id, imagem_url, created_at", { count: "exact" });
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
    const { data } = await supabase
      .from("clientes")
      .select("id, nome, email, telefone, contato, cpf_cnpj, arquiteto_id")
      .order("nome");
    setClientes(data || []);
  };

  const fetchArquitetos = async () => {
    const { data, error } = await supabase
      .from("arquitetos")
      .select("id, nome, contato")
      .order("nome", { ascending: true });
    if (error) {
      toast.error("Erro ao carregar arquitetos");
      return;
    }
    setArquitetos((data || []) as ArquitetoRow[]);
    const map: Record<string, string> = {};
    for (const a of data || []) map[a.id] = a.nome;
    setArquitetosMap(map);
  };

  const handleDeleteArquiteto = async () => {
    if (!arquitetoDeleteTarget) return;
    const { error } = await supabase.from("arquitetos").delete().eq("id", arquitetoDeleteTarget.id);
    if (error) {
      toast.error("Erro ao excluir arquiteto: " + error.message);
      return;
    }
    toast.success("Arquiteto excluído!");
    setArquitetoDeleteOpen(false);
    setArquitetoDeleteTarget(null);
    fetchArquitetos();
  };

  const openCreateArquiteto = () => {
    setArquitetoDialogMode("create");
    setArquitetoEditTarget(null);
    setArquitetoDialogOpen(true);
  };

  const openEditArquiteto = (arq: ArquitetoRow) => {
    setArquitetoDialogMode("edit");
    setArquitetoEditTarget(arq);
    setArquitetoDialogOpen(true);
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
    { key: "master" as const, label: "Master (one-shot)", description: "Sobe planilha master 2026", icon: FileSpreadsheet },
    { key: "produtos" as const, label: "Produtos (CSV)", description: "Cria/atualiza por SKU", icon: FileSpreadsheet },
    { key: "imagens" as const, label: "Imagens", description: "Fotos dos produtos", icon: ImageIcon },
    { key: "precos" as const, label: "Preços", description: "Indisponível neste marco", icon: DollarSign },
  ];

  return (
    <div className="min-h-screen bg-background">
      <CompletarCadastroBanner />
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
            <TabsTrigger value="inicio">Início</TabsTrigger>
            <TabsTrigger value="cadastros">Cadastros</TabsTrigger>
            <TabsTrigger value="pedidos">Pedidos</TabsTrigger>
            <TabsTrigger value="precos">Preços</TabsTrigger>
            <TabsTrigger value="excecoes">Exceções</TabsTrigger>
          </TabsList>

          {/* INÍCIO — D-26 (dashboard como sub-tab) */}
          <TabsContent value="inicio">
            <AdminDashboard orcamentos={orcamentos} />
          </TabsContent>

          {/* CADASTROS — sub-tabs Produtos / Arquitetos / Clientes / Colaboradores */}
          <TabsContent value="cadastros">
            <Tabs value={activeSub} onValueChange={handleSubChange}>
              <TabsList className="mb-4">
                <TabsTrigger value="produtos">Produtos</TabsTrigger>
                <TabsTrigger value="arquitetos">Arquitetos</TabsTrigger>
                <TabsTrigger value="clientes">Clientes</TabsTrigger>
                <TabsTrigger value="colaboradores">Colaboradores</TabsTrigger>
              </TabsList>

              {/* CADASTROS > PRODUTOS */}
              <TabsContent value="produtos" className="space-y-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1">
                      <Search className="h-4 w-4 text-muted-foreground" />
                      <Input placeholder="Buscar produto por código ou descrição..." value={produtoSearch} onChange={(e) => setProdutoSearch(e.target.value)} className="max-w-sm" />
                    </div>
                    <Button onClick={() => setProdutoCreateOpen(true)} className="gap-2">
                      <Plus className="h-4 w-4" /> Novo Produto
                    </Button>
                  </div>
                  <div className="rounded-xl border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Código</TableHead>
                          <TableHead>Descrição</TableHead>
                          <TableHead>Arquiteto</TableHead>
                          <TableHead className="text-right">Preço Tabela</TableHead>
                          <TableHead className="text-right">Preço Mínimo</TableHead>
                          <TableHead className="w-20 text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {loadingProdutos ? (
                          <TableRow><TableCell colSpan={6} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin inline-block mr-2" />Buscando...</TableCell></TableRow>
                        ) : produtos.length === 0 ? (
                          <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum produto encontrado</TableCell></TableRow>
                        ) : (
                          produtos.map((p) => (
                            <TableRow key={p.id}>
                              <TableCell className="font-mono text-sm">{p.codigo}</TableCell>
                              <TableCell>{p.descricao}</TableCell>
                              <TableCell>{p.arquiteto_id ? (arquitetosMap[p.arquiteto_id] || "—") : "—"}</TableCell>
                              <TableCell className="text-right">{p.preco_tabela ? `R$ ${Number(p.preco_tabela).toFixed(2)}` : "—"}</TableCell>
                              <TableCell className="text-right">{p.preco_minimo ? `R$ ${Number(p.preco_minimo).toFixed(2)}` : "—"}</TableCell>
                              <TableCell className="text-right">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setProdutoEditTarget({
                                      id: p.id,
                                      codigo: p.codigo,
                                      descricao: p.descricao,
                                      nome: p.nome ?? null,
                                      preco_tabela: p.preco_tabela,
                                      preco_minimo: p.preco_minimo,
                                      arquiteto_id: p.arquiteto_id ?? null,
                                      imagem_url: p.imagem_url ?? null,
                                    });
                                    setProdutoEditOpen(true);
                                  }}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              </TableCell>
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

              {/* CADASTROS > ARQUITETOS */}
              <TabsContent value="arquitetos">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Arquitetos</h3>
                    <Button size="sm" onClick={openCreateArquiteto} className="gap-1.5">
                      <Plus className="h-4 w-4" /> Novo Arquiteto
                    </Button>
                  </div>
                  <div className="rounded-xl border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome</TableHead>
                          <TableHead>Contato</TableHead>
                          <TableHead className="w-28 text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {arquitetos.map((a) => (
                          <TableRow key={a.id}>
                            <TableCell className="font-medium">{a.nome}</TableCell>
                            <TableCell>{a.contato || "—"}</TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="sm" onClick={() => openEditArquiteto(a)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                onClick={() => { setArquitetoDeleteTarget(a); setArquitetoDeleteOpen(true); }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                        {arquitetos.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                              Nenhum arquiteto cadastrado
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </TabsContent>

              {/* CADASTROS > CLIENTES */}
              <TabsContent value="clientes">
                <div className="space-y-3">
                  <div className="flex justify-end">
                    <Button size="sm" onClick={() => setClienteCreateOpen(true)} className="gap-1.5">
                      <Plus className="h-4 w-4" /> Novo Cliente
                    </Button>
                  </div>
                  <div className="rounded-xl border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Telefone</TableHead>
                          <TableHead>Arquiteto</TableHead>
                          <TableHead className="w-28 text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {clientes.map((c) => (
                          <TableRow key={c.id}>
                            <TableCell className="font-medium">{c.nome}</TableCell>
                            <TableCell>{c.email || "—"}</TableCell>
                            <TableCell>{c.telefone || "—"}</TableCell>
                            <TableCell>{c.arquiteto_id ? (arquitetosMap[c.arquiteto_id] || "—") : "—"}</TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setClienteEditTarget(c as ClienteRow);
                                  setClienteEditOpen(true);
                                }}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => { setDeleteTarget({ id: c.id, nome: c.nome }); setDeleteDialogOpen(true); }}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                        {clientes.length === 0 && (
                          <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhum cliente</TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </TabsContent>

              {/* CADASTROS > COLABORADORES */}
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
            </Tabs>
          </TabsContent>

          {/* PEDIDOS — lista de orçamentos (Plan 05 vai adicionar link para /admin/orcamento/:id) */}
          <TabsContent value="pedidos">
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
                    <TableRow
                      key={o.id}
                      role="button"
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/admin/orcamento/${o.id}`)}
                    >
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
                            onClick={(e) => {
                              e.stopPropagation();
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

          {/* PREÇOS — sub-tabs Atualização (placeholder Plan 04) / Importação */}
          <TabsContent value="precos">
            <Tabs value={activeSub} onValueChange={handleSubChange}>
              <TabsList className="mb-4">
                <TabsTrigger value="atualizacao">Atualização</TabsTrigger>
                <TabsTrigger value="importacao">Importação</TabsTrigger>
              </TabsList>

              {/* PREÇOS > ATUALIZAÇÃO — ADM-02 (D-12..D-17) */}
              <TabsContent value="atualizacao">
                <PrecosBatch />
              </TabsContent>

              {/* PREÇOS > IMPORTAÇÃO (mantém comportamento existente — sub-sub-tab interno via importSubTab) */}
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

                {importSubTab === "master" && <ImportMaster />}
                {importSubTab === "produtos" && <ImportProdutos />}
                {importSubTab === "imagens" && <ImportImagens />}
                {importSubTab === "precos" && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Importação de Preços</CardTitle>
                      <CardDescription>Indisponível neste marco</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        A importação de preços (preco_tabela / preco_minimo via CSV) está deferida para uma phase futura.
                        Em produção real, preço é atualizado ~1x por mês — fluxo periódico, não dia-a-dia (decisão D-18 do CONTEXT da Phase 3 / IMP-02 deferido).
                      </p>
                      <p className="text-sm text-muted-foreground mt-2">
                        Por enquanto, edite preços individualmente via aba <strong>Cadastros &gt; Produtos</strong> → Pencil → "Editar Produto".
                      </p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          </TabsContent>

          {/* EXCEÇÕES */}
          <TabsContent value="excecoes">
            <AdminExceptions />
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

      <ArquitetoDialog
        open={arquitetoDialogOpen}
        onOpenChange={setArquitetoDialogOpen}
        mode={arquitetoDialogMode}
        arquiteto={arquitetoEditTarget}
        onSuccess={fetchArquitetos}
      />

      <ClienteDialog
        open={clienteCreateOpen}
        onOpenChange={setClienteCreateOpen}
        mode="create"
        onSuccess={fetchClientes}
      />

      <ClienteDialog
        open={clienteEditOpen}
        onOpenChange={setClienteEditOpen}
        mode="edit"
        cliente={clienteEditTarget}
        onSuccess={fetchClientes}
      />

      <ProdutoEditDialog
        open={produtoCreateOpen}
        onOpenChange={setProdutoCreateOpen}
        mode="create"
        produto={null}
        onSuccess={() => fetchProdutos(produtoSearch)}
      />
      <ProdutoEditDialog
        open={produtoEditOpen}
        onOpenChange={setProdutoEditOpen}
        mode="edit"
        produto={produtoEditTarget}
        onSuccess={() => fetchProdutos(produtoSearch)}
      />

      <AlertDialog open={arquitetoDeleteOpen} onOpenChange={setArquitetoDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Arquiteto</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{arquitetoDeleteTarget?.nome}</strong>?
              Clientes e produtos vinculados ficarão sem arquiteto (não serão deletados).
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteArquiteto}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Admin;
