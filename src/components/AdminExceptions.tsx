import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle, XCircle, MessageSquare, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAuth } from "@/hooks/useAuth";
import ExceptionChat from "./ExceptionChat";
import { formatarMoeda } from "@/types/orcamento";

interface PriceException {
  id: string;
  created_at: string;
  produto_codigo: string;
  produto_descricao: string;
  preco_solicitado: number;
  preco_minimo: number;
  status: string;
  solicitante_id: string;
}

const AdminExceptions = () => {
  const { user } = useAuth();
  const [exceptions, setExceptions] = useState<PriceException[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [chatOpen, setChatOpen] = useState(false);
  const [selectedEx, setSelectedEx] = useState<PriceException | null>(null);

  const fetchExceptions = async () => {
    setLoading(true);
    let query = supabase.from("price_exceptions").select("*").order("created_at", { ascending: false });
    if (filter !== "all") {
      query = query.eq("status", filter);
    }
    const { data } = await query;
    setExceptions((data as PriceException[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchExceptions();

    const channel = supabase
      .channel("admin-exceptions")
      .on("postgres_changes", { event: "*", schema: "public", table: "price_exceptions" }, () => {
        fetchExceptions();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [filter]);

  const handleAction = async (id: string, action: "aprovado" | "rejeitado") => {
    if (!user) return;
    const { error } = await supabase
      .from("price_exceptions")
      .update({ status: action, resolvido_por: user.id, resolvido_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      toast.error("Erro ao atualizar");
      return;
    }
    toast.success(action === "aprovado" ? "Aprovado!" : "Rejeitado!");
  };

  const openChat = (ex: PriceException) => {
    setSelectedEx(ex);
    setChatOpen(true);
  };

  const statusBadge = (s: string) => {
    switch (s) {
      case "aprovado":
        return <Badge className="bg-green-100 text-green-800 border-green-300">Aprovado</Badge>;
      case "rejeitado":
        return <Badge variant="destructive">Rejeitado</Badge>;
      default:
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">Pendente</Badge>;
    }
  };

  const pendingCount = exceptions.filter((e) => e.status === "pendente").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-foreground">Exceções de Preço</h3>
          {pendingCount > 0 && (
            <Badge className="bg-destructive text-destructive-foreground">{pendingCount} pendente{pendingCount > 1 ? "s" : ""}</Badge>
          )}
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pendente">Pendentes</SelectItem>
            <SelectItem value="aprovado">Aprovados</SelectItem>
            <SelectItem value="rejeitado">Rejeitados</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Produto</TableHead>
              <TableHead className="text-right">Preço Solicitado</TableHead>
              <TableHead className="text-right">Preço Mínimo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin inline-block mr-2" />Carregando...
                </TableCell>
              </TableRow>
            ) : exceptions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhuma exceção encontrada</TableCell>
              </TableRow>
            ) : (
              exceptions.map((ex) => (
                <TableRow key={ex.id}>
                  <TableCell className="text-sm">{format(new Date(ex.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}</TableCell>
                  <TableCell>
                    <span className="font-mono text-sm">{ex.produto_codigo}</span>
                    <br />
                    <span className="text-xs text-muted-foreground">{ex.produto_descricao}</span>
                  </TableCell>
                  <TableCell className="text-right font-medium text-destructive">{formatarMoeda(ex.preco_solicitado)}</TableCell>
                  <TableCell className="text-right">{formatarMoeda(ex.preco_minimo)}</TableCell>
                  <TableCell>{statusBadge(ex.status)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="Abrir Chat" onClick={() => openChat(ex)}>
                        <MessageSquare className="h-4 w-4" />
                      </Button>
                      {ex.status === "pendente" && (
                        <>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600 hover:text-green-700" title="Aprovar" onClick={() => handleAction(ex.id, "aprovado")}>
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" title="Rejeitar" onClick={() => handleAction(ex.id, "rejeitado")}>
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {selectedEx && (
        <ExceptionChat
          open={chatOpen}
          onOpenChange={setChatOpen}
          exceptionId={selectedEx.id}
          produtoCodigo={selectedEx.produto_codigo}
          produtoDescricao={selectedEx.produto_descricao}
          precoSolicitado={selectedEx.preco_solicitado}
          precoMinimo={selectedEx.preco_minimo}
        />
      )}
    </div>
  );
};

export default AdminExceptions;
