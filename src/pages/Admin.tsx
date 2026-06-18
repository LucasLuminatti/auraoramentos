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
import { ArrowLeft, Loader2, Trash2, Search, FileSpreadsheet, DollarSign, ImageIcon, Plus, Pencil, Filter } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import logo from "@/assets/logo.png";
import AdminDashboard from "@/components/AdminDashboard";
import AdminExceptions from "@/components/AdminExceptions";
import ImportMaster from "@/components/ImportMaster";
import ImportProdutos from "@/components/ImportProdutos";
import ImportImagens from "@/components/ImportImagens";
import ImportPrecos from "@/components/ImportPrecos";
import PrecosBatch from "@/components/PrecosBatch";
import CompletarCadastroBanner from "@/components/CompletarCadastroBanner";
import ArquitetoDialog, { type ArquitetoRow } from "@/components/ArquitetoDialog";
import ClienteDialog, { type ClienteRow } from "@/components/ClienteDialog";
import StatusBadgeSelect from "@/components/StatusBadgeSelect";
import ProdutoEditDialog, { type ProdutoEditRow } from "@/components/ProdutoEditDialog";
import ArquitetoAutocomplete from "@/components/ArquitetoAutocomplete";
import ClienteFilterAutocomplete from "@/components/ClienteFilterAutocomplete";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";

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

// Status options para o filtro Pedidos — alinhado com CHECK constraint Phase 7 (D-33)
const STATUS_OPTIONS = [
  { value: "all", label: "Todos" },
  { value: "rascunho", label: "Rascunho" },
  { value: "pendente", label: "Pendente" },
  { value: "aprovado", label: "Aprovado" },
  { value: "perdido", label: "Perdido" },
] as const;

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

  // Filtro arquiteto — Cadastros > Clientes (Phase 6 Plan 02, D-03/D-04)
  // URL: ?arq_clientes=<uuid>  → filtra clientes.arquiteto_id = <uuid>
  //      ?arq_clientes=none    → filtra clientes.arquiteto_id IS NULL
  //      (ausente)             → sem filtro (Todos)
  const arqClientesParam = searchParams.get("arq_clientes"); // null | "none" | "<uuid>"

  const setArqClientesParam = (next: string | null) => {
    const params = new URLSearchParams(searchParams);
    if (next === null) params.delete("arq_clientes");
    else params.set("arq_clientes", next);
    setSearchParams(params, { replace: true });
  };

  // Filtro arquiteto — Cadastros > Produtos (Phase 6 Plan 03, D-04)
  // URL: ?arq_produtos=<uuid> → filtra product_variants.arquiteto_id = <uuid>
  //      ?arq_produtos=none   → filtra product_variants.arquiteto_id IS NULL
  //      (ausente)            → sem filtro (Todos)
  // Combina com produtoSearch (search por código/descrição) via AND-chain na query.
  const arqProdutosParam = searchParams.get("arq_produtos"); // null | "none" | "<uuid>"

  const setArqProdutosParam = (next: string | null) => {
    const params = new URLSearchParams(searchParams);
    if (next === null) params.delete("arq_produtos");
    else params.set("arq_produtos", next);
    setSearchParams(params, { replace: true });
  };

  // Filtros Pedidos — Phase 6 Plan 04 (D-04, D-05, D-06, D-07, D-11)
  // URL params: arq_pedidos, cli_pedidos, data_de, data_ate, status_pedidos
  // Combinados via AND na query Supabase. Arquiteto via JOIN clientes!inner (sem migration nova).
  const arqPedidosParam = searchParams.get("arq_pedidos");        // null | "none" | "<uuid>"
  const cliPedidosParam = searchParams.get("cli_pedidos");        // null | "<uuid>"
  const dataDeParam = searchParams.get("data_de");                // null | "YYYY-MM-DD"
  const dataAteParam = searchParams.get("data_ate");              // null | "YYYY-MM-DD"
  const statusPedidosParam = searchParams.get("status_pedidos");  // null | enum
  const colabPedidosParam = searchParams.get("colab_pedidos");    // null | "<uuid>" (colaborador responsável)
  const qPedidosParam = searchParams.get("q_pedidos");            // null | texto livre (busca client-side)

  // Helper genérico — substitui setArqClientesParam/setArqProdutosParam quando útil; mantidos pra retro-compat com Plans 02/03
  const setUrlParam = (key: string, next: string | null) => {
    const params = new URLSearchParams(searchParams);
    if (next === null || next === "") params.delete(key);
    else params.set(key, next);
    setSearchParams(params, { replace: true });
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
  const [arqProdutosNome, setArqProdutosNome] = useState("");

  // Colaboradores tab
  const [colaboradores, setColaboradores] = useState<any[]>([]);

  // Orcamentos tab
  const [orcamentos, setOrcamentos] = useState<any[]>([]);
  const [arqPedidosNome, setArqPedidosNome] = useState("");
  const [cliPedidosNome, setCliPedidosNome] = useState("");

  // Clientes tab
  const [clientes, setClientes] = useState<any[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; nome: string } | null>(null);
  const [clienteCreateOpen, setClienteCreateOpen] = useState(false);
  const [clienteEditOpen, setClienteEditOpen] = useState(false);
  const [clienteEditTarget, setClienteEditTarget] = useState<ClienteRow | null>(null);
  const [arqClientesNome, setArqClientesNome] = useState("");

  // Arquitetos tab
  const [arquitetos, setArquitetos] = useState<ArquitetoRow[]>([]);
  const [arquitetosMap, setArquitetosMap] = useState<Record<string, string>>({});
  const [arquitetoDialogOpen, setArquitetoDialogOpen] = useState(false);
  const [arquitetoDialogMode, setArquitetoDialogMode] = useState<"create" | "edit">("create");
  const [arquitetoEditTarget, setArquitetoEditTarget] = useState<ArquitetoRow | null>(null);
  const [arquitetoDeleteTarget, setArquitetoDeleteTarget] = useState<ArquitetoRow | null>(null);
  const [arquitetoDeleteOpen, setArquitetoDeleteOpen] = useState(false);


  useEffect(() => {
    fetchColaboradores();
    fetchArquitetos();
    // fetchClientes é disparado por effect dedicado abaixo (reage a arq_clientes da URL)
    // fetchProdutos é disparado pelo effect de debounce (reage a produtoSearch + arq_produtos)
    // fetchOrcamentos é disparado por effect dedicado abaixo (reage aos 5 params Pedidos)
  }, []);

  // Refetch clientes quando o filtro arquiteto muda (ou no mount inicial, com param vazio)
  useEffect(() => {
    fetchClientes(arqClientesParam);
  }, [arqClientesParam]);

  // Sincroniza o nome exibido no input do autocomplete com o param da URL
  useEffect(() => {
    if (!arqClientesParam) {
      setArqClientesNome("");
      return;
    }
    if (arqClientesParam === "none") {
      setArqClientesNome("Nenhum arquiteto");
      return;
    }
    // arqClientesParam é UUID — buscar nome no arquitetosMap (carregado por fetchArquitetos)
    setArqClientesNome(arquitetosMap[arqClientesParam] || "");
  }, [arqClientesParam, arquitetosMap]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchProdutos(produtoSearch, arqProdutosParam);
    }, 300);
    return () => clearTimeout(timer);
  }, [produtoSearch, arqProdutosParam]);

  // Sincroniza o nome exibido no input do autocomplete (Produtos) com o param da URL
  useEffect(() => {
    if (!arqProdutosParam) {
      setArqProdutosNome("");
      return;
    }
    if (arqProdutosParam === "none") {
      setArqProdutosNome("Nenhum arquiteto");
      return;
    }
    setArqProdutosNome(arquitetosMap[arqProdutosParam] || "");
  }, [arqProdutosParam, arquitetosMap]);

  // Refetch Pedidos quando QUALQUER filtro Pedidos muda (e no mount inicial, com params vazios)
  useEffect(() => {
    fetchOrcamentos({
      arq: arqPedidosParam,
      cli: cliPedidosParam,
      dataDe: dataDeParam,
      dataAte: dataAteParam,
      status: statusPedidosParam,
      colab: colabPedidosParam,
    });
  }, [arqPedidosParam, cliPedidosParam, dataDeParam, dataAteParam, statusPedidosParam, colabPedidosParam]);

  // Sync nome do arquiteto no input do filtro Pedidos
  useEffect(() => {
    if (!arqPedidosParam) {
      setArqPedidosNome("");
      return;
    }
    if (arqPedidosParam === "none") {
      setArqPedidosNome("Nenhum arquiteto");
      return;
    }
    setArqPedidosNome(arquitetosMap[arqPedidosParam] || "");
  }, [arqPedidosParam, arquitetosMap]);

  // Sync nome do cliente no input do filtro Pedidos — não temos um clientesMap global,
  // então buscamos pontualmente quando o param vem da URL (paste/bookmark).
  useEffect(() => {
    if (!cliPedidosParam) {
      setCliPedidosNome("");
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("clientes")
        .select("nome")
        .eq("id", cliPedidosParam)
        .maybeSingle();
      if (!cancelled) setCliPedidosNome(data?.nome ?? "");
    })();
    return () => { cancelled = true; };
  }, [cliPedidosParam]);

  const fetchProdutos = async (search: string, arqFilter?: string | null) => {
    setLoadingProdutos(true);
    let query = supabase.from("product_variants").select("id, codigo, descricao, nome, preco_tabela, preco_minimo, arquiteto_id, imagem_url, created_at", { count: "exact" });
    if (search.trim().length >= 2) {
      query = query.or(`codigo.ilike.%${search}%,descricao.ilike.%${search}%`);
    }
    if (arqFilter === "none") {
      query = query.is("arquiteto_id", null);
    } else if (arqFilter && arqFilter !== "none") {
      query = query.eq("arquiteto_id", arqFilter);
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

  // Pedidos — fetch parametrizado (Phase 6 Plan 04, D-11)
  // Arquiteto via JOIN clientes!inner(arquiteto_id) — sem migration nova; cliente_id é NOT NULL
  // em orcamentos, então INNER JOIN não muda o resultset em produção.
  const fetchOrcamentos = async (filters?: {
    arq?: string | null;
    cli?: string | null;
    dataDe?: string | null;
    dataAte?: string | null;
    status?: string | null;
    colab?: string | null;
  }) => {
    const f = filters ?? {};
    let q = supabase
      .from("orcamentos")
      .select("*, clientes!inner(nome, arquiteto_id), colaboradores(nome), projetos(nome)");
    if (f.arq === "none") q = q.is("clientes.arquiteto_id", null);
    else if (f.arq && f.arq !== "none") q = q.eq("clientes.arquiteto_id", f.arq);
    if (f.cli) q = q.eq("cliente_id", f.cli);
    if (f.colab) q = q.eq("colaborador_id", f.colab);
    if (f.dataDe) q = q.gte("data", f.dataDe);
    if (f.dataAte) q = q.lte("data", f.dataAte);
    if (f.status && f.status !== "all") q = q.eq("status", f.status);
    const { data, error } = await q.order("created_at", { ascending: false });
    if (error) {
      toast.error("Erro ao carregar pedidos");
      return;
    }
    setOrcamentos(data || []);
  };

  const fetchClientes = async (arqFilter?: string | null) => {
    let q = supabase
      .from("clientes")
      .select("id, nome, email, telefone, contato, cpf_cnpj, arquiteto_id, data_nascimento");
    if (arqFilter === "none") {
      q = q.is("arquiteto_id", null);
    } else if (arqFilter && arqFilter !== "none") {
      q = q.eq("arquiteto_id", arqFilter);
    }
    const { data, error } = await q.order("nome");
    if (error) {
      toast.error("Erro ao carregar clientes");
      return;
    }
    setClientes(data || []);
  };

  const fetchArquitetos = async () => {
    const { data, error } = await supabase
      .from("arquitetos")
      .select("id, nome, contato, data_nascimento, endereco, banco, agencia, conta, tipo_conta, pix")
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
    // Guard: não cascatear exclusão de venda fechada (registro de venda concretizada).
    // A FK orcamentos.cliente_id é ON DELETE CASCADE, então sem esse bloqueio um
    // orçamento "fechado" seria apagado silenciosamente junto com o cliente.
    const { count: fechados, error: countError } = await supabase
      .from("orcamentos")
      .select("id", { count: "exact", head: true })
      .eq("cliente_id", deleteTarget.id)
      .eq("status", "fechado");
    if (countError) {
      toast.error("Erro ao verificar orçamentos do cliente: " + countError.message);
      return;
    }
    if (fechados && fechados > 0) {
      toast.error(`Cliente possui ${fechados} orçamento(s) fechado(s) — não é possível excluir. Arquive ou remova esses orçamentos primeiro.`);
      return;
    }
    const { error } = await supabase.from("clientes").delete().eq("id", deleteTarget.id);
    if (error) {
      toast.error("Erro ao excluir cliente: " + error.message);
      return;
    }
    toast.success("Cliente excluído!");
    setDeleteDialogOpen(false);
    setDeleteTarget(null);
    fetchClientes(arqClientesParam);
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

  // WIZ-04: atualiza status de um orçamento via Supabase UPDATE com otimistic state update
  const handleStatusChange = async (id: string, novo: string) => {
    const { error } = await supabase
      .from("orcamentos")
      .update({ status: novo })
      .eq("id", id);

    if (error) {
      // RLS bloqueio (ex: tentar reverter aprovado ou alterar orçamento de outro colab)
      toast.error(
        error.message?.includes("policy")
          ? "Você não tem permissão para alterar este orçamento (ou ele já está aprovado)."
          : `Erro ao atualizar status: ${error.message}`
      );
      return;
    }

    // Otimistic update do state local — evita refetch completo
    setOrcamentos((prev) => prev.map((o) => (o.id === id ? { ...o, status: novo } : o)));
    toast.success(`Status atualizado para ${novo}`);
  };

  const statusLabel = (s: string) => {
    switch (s) {
      case "rascunho": return "Rascunho";
      case "pendente": return "Pendente";
      case "aprovado": return "Aprovado";
      case "perdido": return "Perdido";
      default: return s;
    }
  };

  const statusClass = (s: string) => {
    switch (s) {
      case "rascunho": return "bg-muted text-muted-foreground";
      case "pendente": return "bg-yellow-100 text-yellow-800";
      case "aprovado": return "bg-emerald-100 text-emerald-800";
      case "perdido": return "bg-red-100 text-red-800";
      default: return "bg-muted text-muted-foreground";
    }
  };

  // Contador de filtros ativos em Pedidos (para badge mobile e botão "Limpar filtros")
  const pedidosFilterCount = [
    arqPedidosParam,
    cliPedidosParam,
    dataDeParam,
    dataAteParam,
    statusPedidosParam && statusPedidosParam !== "all" ? statusPedidosParam : null,
    colabPedidosParam,
    qPedidosParam && qPedidosParam.trim() ? qPedidosParam : null,
  ].filter(Boolean).length;

  // Busca textual (client-side) sobre a lista já carregada — combina com os filtros server-side.
  const orcamentosFiltrados = (() => {
    const term = (qPedidosParam ?? "").trim().toLowerCase();
    if (!term) return orcamentos;
    return orcamentos.filter((o: any) =>
      (o.clientes?.nome ?? "").toLowerCase().includes(term) ||
      (o.projetos?.nome ?? "").toLowerCase().includes(term) ||
      (o.colaboradores?.nome ?? "").toLowerCase().includes(term)
    );
  })();

  const importSubTabs = [
    { key: "master" as const, label: "Master (one-shot)", description: "Sobe planilha master 2026", icon: FileSpreadsheet },
    { key: "produtos" as const, label: "Produtos (CSV)", description: "Cria/atualiza por SKU", icon: FileSpreadsheet },
    { key: "imagens" as const, label: "Imagens", description: "Fotos dos produtos", icon: ImageIcon },
    { key: "precos" as const, label: "Preços", description: "Atualiza preços por SKU", icon: DollarSign },
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
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <Search className="h-4 w-4 text-muted-foreground" />
                      <Input placeholder="Buscar produto por código ou descrição..." value={produtoSearch} onChange={(e) => setProdutoSearch(e.target.value)} className="max-w-sm" />
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-full sm:w-64">
                        <ArquitetoAutocomplete
                          mode="filter"
                          value={arqProdutosNome}
                          onSelect={(arq, kind) => {
                            if (kind === 'all') {
                              setArqProdutosParam(null);
                              setArqProdutosNome("");
                            } else if (kind === 'none') {
                              setArqProdutosParam("none");
                              setArqProdutosNome("Nenhum arquiteto");
                            } else if (arq) {
                              setArqProdutosParam(arq.id);
                              setArqProdutosNome(arq.nome);
                            }
                          }}
                          placeholder="Filtrar por arquiteto..."
                        />
                      </div>
                      <Button onClick={() => setProdutoCreateOpen(true)} className="gap-2 whitespace-nowrap">
                        <Plus className="h-4 w-4" /> Novo Produto
                      </Button>
                    </div>
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
                          <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                            {arqProdutosParam
                              ? (arqProdutosParam === "none"
                                  ? (produtoSearch ? "Nenhum produto sem arquiteto bate com a busca" : "Nenhum produto sem arquiteto")
                                  : (produtoSearch ? "Nenhum produto deste arquiteto bate com a busca" : "Nenhum produto vinculado a este arquiteto"))
                              : "Nenhum produto encontrado"}
                          </TableCell></TableRow>
                        ) : (
                          produtos.map((p) => (
                            <TableRow key={p.id}>
                              <TableCell className="font-mono text-sm">{p.codigo}</TableCell>
                              <TableCell>{p.descricao}</TableCell>
                              <TableCell>{p.arquiteto_id ? (arquitetosMap[p.arquiteto_id] || "—") : "—"}</TableCell>
                              <TableCell className="text-right">{p.preco_tabela ? `R$ ${Number(p.preco_tabela).toFixed(2)}` : "—"}</TableCell>
                              <TableCell className="text-right">{p.preco_minimo ? `R$ ${Number(p.preco_minimo).toFixed(2)}` : "—"}</TableCell>
                              <TableCell className="text-right">
                                <div className="inline-flex gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    title="Anexar/trocar imagem"
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
                                    <ImageIcon className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    title="Editar produto"
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
                                </div>
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
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="w-full sm:max-w-xs">
                      <ArquitetoAutocomplete
                        mode="filter"
                        value={arqClientesNome}
                        onSelect={(arq, kind) => {
                          if (kind === 'all') {
                            setArqClientesParam(null);
                            setArqClientesNome("");
                          } else if (kind === 'none') {
                            setArqClientesParam("none");
                            setArqClientesNome("Nenhum arquiteto");
                          } else if (arq) {
                            setArqClientesParam(arq.id);
                            setArqClientesNome(arq.nome);
                          }
                        }}
                        placeholder="Filtrar por arquiteto..."
                      />
                    </div>
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
                          <TableRow>
                            <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                              {arqClientesParam
                                ? (arqClientesParam === "none"
                                    ? "Nenhum cliente sem arquiteto"
                                    : "Nenhum cliente vinculado a este arquiteto")
                                : "Nenhum cliente cadastrado"}
                            </TableCell>
                          </TableRow>
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

          {/* PEDIDOS — Phase 6 Plan 04: filtros [Arquiteto + Cliente + Período + Status] AND-chained */}
          <TabsContent value="pedidos">
            {/* Bloco de filtros */}
            <div className="mb-4 space-y-3">
              {/* Desktop: 1 linha com todos os filtros */}
              <div className="hidden sm:flex sm:items-end sm:gap-3 sm:flex-wrap">
                <div className="w-64">
                  <Label className="text-xs text-muted-foreground">Buscar</Label>
                  <Input
                    placeholder="Cliente, projeto ou colaborador..."
                    value={qPedidosParam ?? ""}
                    onChange={(e) => setUrlParam("q_pedidos", e.target.value || null)}
                  />
                </div>
                <div className="w-48">
                  <Label className="text-xs text-muted-foreground">Colaborador</Label>
                  <Select
                    value={colabPedidosParam ?? "all"}
                    onValueChange={(v) => setUrlParam("colab_pedidos", v === "all" ? null : v)}
                  >
                    <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {colaboradores.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-56">
                  <Label className="text-xs text-muted-foreground">Arquiteto</Label>
                  <ArquitetoAutocomplete
                    mode="filter"
                    value={arqPedidosNome}
                    onSelect={(arq, kind) => {
                      if (kind === 'all') {
                        setUrlParam("arq_pedidos", null);
                        setArqPedidosNome("");
                      } else if (kind === 'none') {
                        setUrlParam("arq_pedidos", "none");
                        setArqPedidosNome("Nenhum arquiteto");
                      } else if (arq) {
                        setUrlParam("arq_pedidos", arq.id);
                        setArqPedidosNome(arq.nome);
                      }
                    }}
                    placeholder="Filtrar por arquiteto..."
                  />
                </div>
                <div className="w-56">
                  <Label className="text-xs text-muted-foreground">Cliente</Label>
                  <ClienteFilterAutocomplete
                    value={cliPedidosNome}
                    onSelect={(cli, kind) => {
                      if (kind === 'all') {
                        setUrlParam("cli_pedidos", null);
                        setCliPedidosNome("");
                      } else if (cli) {
                        setUrlParam("cli_pedidos", cli.id);
                        setCliPedidosNome(cli.nome);
                      }
                    }}
                    placeholder="Filtrar por cliente..."
                  />
                </div>
                <div className="w-36">
                  <Label className="text-xs text-muted-foreground">De</Label>
                  <Input
                    type="date"
                    value={dataDeParam ?? ""}
                    onChange={(e) => setUrlParam("data_de", e.target.value || null)}
                  />
                </div>
                <div className="w-36">
                  <Label className="text-xs text-muted-foreground">Até</Label>
                  <Input
                    type="date"
                    value={dataAteParam ?? ""}
                    onChange={(e) => setUrlParam("data_ate", e.target.value || null)}
                  />
                </div>
                <div className="w-40">
                  <Label className="text-xs text-muted-foreground">Status</Label>
                  <Select
                    value={statusPedidosParam ?? "all"}
                    onValueChange={(v) => setUrlParam("status_pedidos", v === "all" ? null : v)}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((s) => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {pedidosFilterCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const p = new URLSearchParams(searchParams);
                      ["arq_pedidos", "cli_pedidos", "data_de", "data_ate", "status_pedidos", "colab_pedidos", "q_pedidos"].forEach((k) => p.delete(k));
                      setSearchParams(p, { replace: true });
                      setArqPedidosNome("");
                      setCliPedidosNome("");
                    }}
                  >
                    Limpar filtros
                  </Button>
                )}
              </div>

              {/* Mobile: Arquiteto sempre visível + popover com os outros filtros */}
              <div className="flex sm:hidden items-center gap-2">
                <div className="flex-1">
                  <ArquitetoAutocomplete
                    mode="filter"
                    value={arqPedidosNome}
                    onSelect={(arq, kind) => {
                      if (kind === 'all') {
                        setUrlParam("arq_pedidos", null);
                        setArqPedidosNome("");
                      } else if (kind === 'none') {
                        setUrlParam("arq_pedidos", "none");
                        setArqPedidosNome("Nenhum arquiteto");
                      } else if (arq) {
                        setUrlParam("arq_pedidos", arq.id);
                        setArqPedidosNome(arq.nome);
                      }
                    }}
                    placeholder="Arquiteto..."
                  />
                </div>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="icon" className="relative">
                      <Filter className="h-4 w-4" />
                      {pedidosFilterCount > 0 && (
                        <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                          {pedidosFilterCount}
                        </span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 space-y-3" align="end">
                    <div>
                      <Label className="text-xs text-muted-foreground">Buscar</Label>
                      <Input
                        placeholder="Cliente, projeto ou colaborador..."
                        value={qPedidosParam ?? ""}
                        onChange={(e) => setUrlParam("q_pedidos", e.target.value || null)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Colaborador</Label>
                      <Select
                        value={colabPedidosParam ?? "all"}
                        onValueChange={(v) => setUrlParam("colab_pedidos", v === "all" ? null : v)}
                      >
                        <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos</SelectItem>
                          {colaboradores.map((c) => (
                            <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Cliente</Label>
                      <ClienteFilterAutocomplete
                        value={cliPedidosNome}
                        onSelect={(cli, kind) => {
                          if (kind === 'all') {
                            setUrlParam("cli_pedidos", null);
                            setCliPedidosNome("");
                          } else if (cli) {
                            setUrlParam("cli_pedidos", cli.id);
                            setCliPedidosNome(cli.nome);
                          }
                        }}
                        placeholder="Filtrar por cliente..."
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs text-muted-foreground">De</Label>
                        <Input
                          type="date"
                          value={dataDeParam ?? ""}
                          onChange={(e) => setUrlParam("data_de", e.target.value || null)}
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Até</Label>
                        <Input
                          type="date"
                          value={dataAteParam ?? ""}
                          onChange={(e) => setUrlParam("data_ate", e.target.value || null)}
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Status</Label>
                      <Select
                        value={statusPedidosParam ?? "all"}
                        onValueChange={(v) => setUrlParam("status_pedidos", v === "all" ? null : v)}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map((s) => (
                            <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {pedidosFilterCount > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full"
                        onClick={() => {
                          const p = new URLSearchParams(searchParams);
                          ["arq_pedidos", "cli_pedidos", "data_de", "data_ate", "status_pedidos", "colab_pedidos", "q_pedidos"].forEach((k) => p.delete(k));
                          setSearchParams(p, { replace: true });
                          setArqPedidosNome("");
                          setCliPedidosNome("");
                        }}
                      >
                        Limpar filtros
                      </Button>
                    )}
                  </PopoverContent>
                </Popover>
              </div>
            </div>

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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orcamentosFiltrados.map((o) => (
                    <TableRow
                      key={o.id}
                      role="button"
                      className="cursor-pointer hover:bg-muted/50"
                      title={o.status === "rascunho" ? "Continuar este rascunho" : undefined}
                      onClick={() => {
                        if (o.status === "rascunho") {
                          navigate("/", { state: { orcamentoId: o.id } });
                        } else {
                          navigate(`/admin/orcamento/${o.id}`);
                        }
                      }}
                    >
                      <TableCell>{format(new Date(o.data), "dd/MM/yyyy", { locale: ptBR })}</TableCell>
                      <TableCell>{(o as any).clientes?.nome || "—"}</TableCell>
                      <TableCell>{(o as any).projetos?.nome || "—"}</TableCell>
                      <TableCell>{(o as any).colaboradores?.nome || "—"}</TableCell>
                      <TableCell className="font-medium">R$ {Number(o.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <span className={`rounded px-2 py-0.5 text-xs font-medium ${statusClass(o.status)}`}>{statusLabel(o.status)}</span>
                          <StatusBadgeSelect
                            orcamentoId={o.id}
                            currentStatus={o.status}
                            onStatusChange={handleStatusChange}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {orcamentosFiltrados.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        {pedidosFilterCount > 0
                          ? "Nenhum pedido bate com os filtros aplicados"
                          : "Nenhum orçamento"}
                      </TableCell>
                    </TableRow>
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
                {importSubTab === "precos" && <ImportPrecos />}
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
            Tem certeza que deseja excluir o cliente <strong>{deleteTarget?.nome}</strong>? Isso também remove os projetos, orçamentos e arquivos vinculados. Esta ação não pode ser desfeita.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDeleteCliente}>Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
        onSuccess={() => fetchClientes(arqClientesParam)}
      />

      <ClienteDialog
        open={clienteEditOpen}
        onOpenChange={setClienteEditOpen}
        mode="edit"
        cliente={clienteEditTarget}
        onSuccess={() => fetchClientes(arqClientesParam)}
      />

      <ProdutoEditDialog
        open={produtoCreateOpen}
        onOpenChange={setProdutoCreateOpen}
        mode="create"
        produto={null}
        onSuccess={() => fetchProdutos(produtoSearch, arqProdutosParam)}
      />
      <ProdutoEditDialog
        open={produtoEditOpen}
        onOpenChange={setProdutoEditOpen}
        mode="edit"
        produto={produtoEditTarget}
        onSuccess={() => fetchProdutos(produtoSearch, arqProdutosParam)}
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
