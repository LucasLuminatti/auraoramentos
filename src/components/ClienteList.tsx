import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ChevronDown, ChevronRight, FileText, Users, FolderOpen, Plus, Pencil, Flag } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import ClienteArquivos from "@/components/ClienteArquivos";
import EncerrarNegociacaoModal from "@/components/EncerrarNegociacaoModal";

interface OrcamentoRow {
  id: string;
  data: string;
  valor: number;
  status: string;
}

interface ProjetoWithOrcamentos {
  id: string;
  nome: string;
  orcamentos: OrcamentoRow[];
}

interface ClienteWithProjetos {
  id: string;
  nome: string;
  projetos: ProjetoWithOrcamentos[];
}

interface ClienteListProps {
  onNovoOrcamento?: (clienteId: string, projetoId: string, projetoNome: string, clienteNome: string) => void;
}

const ClienteList = ({ onNovoOrcamento }: ClienteListProps) => {
  const [clientes, setClientes] = useState<ClienteWithProjetos[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCliente, setExpandedCliente] = useState<string | null>(null);
  const [expandedProjeto, setExpandedProjeto] = useState<string | null>(null);

  // Novo projeto dialog
  const [projetoDialogOpen, setProjetoDialogOpen] = useState(false);
  const [projetoClienteId, setProjetoClienteId] = useState<string | null>(null);
  const [novoProjNome, setNovoProjNome] = useState("");

  // Renomear projeto dialog
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameProjetoId, setRenameProjetoId] = useState<string | null>(null);
  const [renameNome, setRenameNome] = useState("");

  // Encerrar negociação modal
  const [encerrarOpen, setEncerrarOpen] = useState(false);
  const [encerrarOrcId, setEncerrarOrcId] = useState("");

  const fetchData = async () => {
    const { data: clientesData } = await supabase
      .from("clientes")
      .select("id, nome")
      .order("nome");

    const { data: projetosData } = await supabase
      .from("projetos")
      .select("id, nome, cliente_id")
      .order("nome");

    const { data: orcamentosData } = await supabase
      .from("orcamentos")
      .select("id, data, valor, status, projeto_id")
      .order("data", { ascending: false });

    if (clientesData) {
      const mapped: ClienteWithProjetos[] = clientesData.map((c) => ({
        ...c,
        projetos: (projetosData || [])
          .filter((p) => p.cliente_id === c.id)
          .map((p) => ({
            ...p,
            orcamentos: (orcamentosData || []).filter((o) => o.projeto_id === p.id),
          })),
      }));
      setClientes(mapped);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCriarProjeto = async () => {
    if (!novoProjNome.trim() || !projetoClienteId) return;
    const nome = novoProjNome.trim();

    const { error } = await supabase
      .from("projetos")
      .insert({ nome, cliente_id: projetoClienteId });

    if (error) {
      toast.error("Erro ao criar projeto");
      return;
    }
    toast.success("Projeto criado!");
    setProjetoDialogOpen(false);
    setNovoProjNome("");
    fetchData();
  };

  const handleRenomearProjeto = async () => {
    if (!renameNome.trim() || !renameProjetoId) return;
    const { error } = await supabase
      .from("projetos")
      .update({ nome: renameNome.trim() })
      .eq("id", renameProjetoId);
    if (error) {
      toast.error("Erro ao renomear projeto");
      return;
    }
    toast.success("Projeto renomeado!");
    setRenameDialogOpen(false);
    setRenameNome("");
    setRenameProjetoId(null);
    fetchData();
  };

  if (loading) {
    return <p className="text-center text-muted-foreground py-12">Carregando...</p>;
  }

  if (clientes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <h3 className="text-lg font-semibold text-foreground">Nenhum cliente cadastrado</h3>
        <p className="text-muted-foreground mt-1">Adicione seu primeiro cliente clicando no botão acima.</p>
      </div>
    );
  }

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

  return (
    <>
      <div className="space-y-3">
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          Clientes
        </h2>
        <div className="space-y-2">
          {clientes.map((cliente) => {
            const isExpanded = expandedCliente === cliente.id;
            const totalOrcamentos = cliente.projetos.reduce((sum, p) => sum + p.orcamentos.length, 0);
            return (
              <div key={cliente.id} className="rounded-xl border bg-card shadow-sm overflow-hidden">
                <button
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/50 transition-colors"
                  onClick={() => setExpandedCliente(isExpanded ? null : cliente.id)}
                >
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-foreground">{cliente.nome}</span>
                    <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                      {cliente.projetos.length} projeto{cliente.projetos.length !== 1 ? "s" : ""}
                    </span>
                    {totalOrcamentos > 0 && (
                      <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
                        {totalOrcamentos} orçamento{totalOrcamentos !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
                {isExpanded && (
                  <div className="border-t px-5 py-3 space-y-2">
                    {cliente.projetos.length === 0 && (
                      <p className="text-sm text-muted-foreground py-2">Nenhum projeto ainda.</p>
                    )}
                    {cliente.projetos.map((projeto) => {
                      const isProjExpanded = expandedProjeto === projeto.id;
                      return (
                        <div key={projeto.id} className="rounded-lg border bg-background overflow-hidden">
                          <button
                            className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
                            onClick={() => setExpandedProjeto(isProjExpanded ? null : projeto.id)}
                          >
                            <div className="flex items-center gap-2">
                              <FolderOpen className="h-4 w-4 text-primary/70" />
                              <span className="font-medium text-sm text-foreground">{projeto.nome}</span>
                              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                                {projeto.orcamentos.length} orçamento{projeto.orcamentos.length !== 1 ? "s" : ""}
                              </span>
                              <button
                                className="ml-1 p-1 rounded hover:bg-muted transition-colors"
                                title="Renomear projeto"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setRenameProjetoId(projeto.id);
                                  setRenameNome(projeto.nome);
                                  setRenameDialogOpen(true);
                                }}
                              >
                                <Pencil className="h-3 w-3 text-muted-foreground" />
                              </button>
                            </div>
                            {isProjExpanded ? (
                              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                            )}
                          </button>
                          {isProjExpanded && (
                            <div className="border-t px-4 py-2 space-y-1.5">
                              {projeto.orcamentos.map((orc) => (
                                <div key={orc.id} className="flex items-center justify-between text-sm py-1.5">
                                  <div className="flex items-center gap-3">
                                    <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                                    <span className="text-muted-foreground">
                                      {format(new Date(orc.data), "dd/MM/yyyy", { locale: ptBR })}
                                    </span>
                                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${statusClass(orc.status)}`}>
                                      {statusLabel(orc.status)}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-foreground">
                                      R$ {Number(orc.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                    </span>
                                    {canEncerrar(orc.status) && (
                                      <button
                                        className="p-1 rounded hover:bg-muted transition-colors"
                                        title="Encerrar negociação"
                                        onClick={() => {
                                          setEncerrarOrcId(orc.id);
                                          setEncerrarOpen(true);
                                        }}
                                      >
                                        <Flag className="h-4 w-4 text-muted-foreground" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ))}
                              {projeto.orcamentos.length === 0 && (
                                <p className="text-xs text-muted-foreground py-1">Nenhum orçamento neste projeto.</p>
                              )}
                              {onNovoOrcamento && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="mt-1 gap-1.5 text-xs"
                                  onClick={() => onNovoOrcamento(cliente.id, projeto.id, projeto.nome, cliente.nome)}
                                >
                                  <Plus className="h-3.5 w-3.5" /> Novo Orçamento
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-1.5 text-xs text-primary"
                      onClick={() => {
                        setProjetoClienteId(cliente.id);
                        setNovoProjNome("");
                        setProjetoDialogOpen(true);
                      }}
                    >
                      <Plus className="h-3.5 w-3.5" /> Novo Projeto
                    </Button>

                    <div className="border-t pt-3 mt-2">
                      <ClienteArquivos clienteId={cliente.id} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <Dialog open={projetoDialogOpen} onOpenChange={setProjetoDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Projeto</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Input
              placeholder="Nome do projeto (ex: Casa do João)"
              value={novoProjNome}
              onChange={(e) => setNovoProjNome(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCriarProjeto()}
            />
            <p className="text-xs text-muted-foreground">
              Digite o nome do projeto.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProjetoDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleCriarProjeto} disabled={!novoProjNome.trim()}>Criar Projeto</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Renomear Projeto</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Input
              placeholder="Novo nome do projeto"
              value={renameNome}
              onChange={(e) => setRenameNome(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleRenomearProjeto()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleRenomearProjeto} disabled={!renameNome.trim()}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <EncerrarNegociacaoModal
        open={encerrarOpen}
        onOpenChange={setEncerrarOpen}
        orcamentoId={encerrarOrcId}
        onSuccess={fetchData}
      />
    </>
  );
};

export default ClienteList;
