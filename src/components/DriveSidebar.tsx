import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ChevronDown, ChevronRight, Users, FolderOpen, FileBox } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Cliente {
  id: string;
  nome: string;
}

interface Projeto {
  id: string;
  nome: string;
  cliente_id: string;
}

interface DriveSidebarProps {
  selectedClienteId: string | null;
  selectedProjetoId: string | null;
  onSelectCliente: (id: string, nome: string) => void;
  onSelectProjeto: (clienteId: string, clienteNome: string, projetoId: string, projetoNome: string) => void;
  onSelectRoot: () => void;
}

const DriveSidebar = ({
  selectedClienteId,
  selectedProjetoId,
  onSelectCliente,
  onSelectProjeto,
  onSelectRoot,
}: DriveSidebarProps) => {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [expandedClientes, setExpandedClientes] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetch = async () => {
      const [{ data: c }, { data: p }] = await Promise.all([
        supabase.from("clientes").select("id, nome").order("nome"),
        supabase.from("projetos").select("id, nome, cliente_id").order("nome"),
      ]);
      setClientes(c || []);
      setProjetos(p || []);
    };
    fetch();
  }, []);

  // Auto-expand selected cliente
  useEffect(() => {
    if (selectedClienteId) {
      setExpandedClientes((prev) => new Set(prev).add(selectedClienteId));
    }
  }, [selectedClienteId]);

  const toggleCliente = (id: string) => {
    setExpandedClientes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="w-60 border-r bg-card flex flex-col h-full">
      <div className="p-3 border-b">
        <button
          onClick={onSelectRoot}
          className={`flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-sm font-medium transition-colors ${
            !selectedClienteId ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"
          }`}
        >
          <Users className="h-4 w-4" />
          Todos os Clientes
        </button>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-0.5">
          {clientes.map((cliente) => {
            const isExpanded = expandedClientes.has(cliente.id);
            const clienteProjetos = projetos.filter((p) => p.cliente_id === cliente.id);
            const isSelected = selectedClienteId === cliente.id && !selectedProjetoId;

            return (
              <div key={cliente.id}>
                <div className="flex items-center">
                  <button
                    onClick={() => toggleCliente(cliente.id)}
                    className="p-1 rounded hover:bg-muted transition-colors"
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </button>
                  <button
                    onClick={() => onSelectCliente(cliente.id, cliente.nome)}
                    className={`flex-1 text-left px-2 py-1.5 rounded-md text-sm truncate transition-colors ${
                      isSelected ? "bg-primary/10 text-primary font-medium" : "text-foreground hover:bg-muted"
                    }`}
                  >
                    {cliente.nome}
                  </button>
                </div>
                {isExpanded && (
                  <div className="ml-5 space-y-0.5 mt-0.5">
                    <button
                      onClick={() => onSelectCliente(cliente.id, cliente.nome)}
                      className={`flex items-center gap-1.5 w-full px-2 py-1 rounded-md text-xs transition-colors ${
                        isSelected ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      <FileBox className="h-3.5 w-3.5" />
                      Arquivos Gerais
                    </button>
                    {clienteProjetos.map((proj) => {
                      const isProjSelected = selectedProjetoId === proj.id;
                      return (
                        <button
                          key={proj.id}
                          onClick={() => onSelectProjeto(cliente.id, cliente.nome, proj.id, proj.nome)}
                          className={`flex items-center gap-1.5 w-full px-2 py-1 rounded-md text-xs truncate transition-colors ${
                            isProjSelected ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                          }`}
                        >
                          <FolderOpen className="h-3.5 w-3.5" />
                          {proj.nome}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
};

export default DriveSidebar;
