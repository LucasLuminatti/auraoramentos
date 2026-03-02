import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Send, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { formatarMoeda } from "@/types/orcamento";

interface ExceptionChatProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exceptionId: string;
  produtoCodigo: string;
  produtoDescricao: string;
  precoSolicitado: number;
  precoMinimo: number;
  ambienteNome?: string;
  onStatusChange?: (status: string) => void;
}

interface Message {
  id: string;
  created_at: string;
  user_id: string;
  user_name: string;
  content: string;
}

const ExceptionChat = ({
  open,
  onOpenChange,
  exceptionId,
  produtoCodigo,
  produtoDescricao,
  precoSolicitado,
  precoMinimo,
  ambienteNome,
  onStatusChange,
}: ExceptionChatProps) => {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [status, setStatus] = useState("pendente");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !exceptionId) return;

    // Fetch status
    supabase
      .from("price_exceptions")
      .select("status")
      .eq("id", exceptionId)
      .single()
      .then(({ data }) => {
        if (data) setStatus(data.status);
      });

    // Fetch messages
    supabase
      .from("exception_messages")
      .select("*")
      .eq("exception_id", exceptionId)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        setMessages((data as Message[]) || []);
      });

    // Realtime messages
    const channel = supabase
      .channel(`exception-messages-${exceptionId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "exception_messages", filter: `exception_id=eq.${exceptionId}` },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "price_exceptions", filter: `id=eq.${exceptionId}` },
        (payload) => {
          const newStatus = (payload.new as any).status;
          setStatus(newStatus);
          onStatusChange?.(newStatus);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [open, exceptionId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !user) return;
    setSending(true);
    const userName =
      user.user_metadata?.nome || user.user_metadata?.name || user.email?.split("@")[0] || "Usuário";
    const { error } = await supabase.from("exception_messages").insert({
      exception_id: exceptionId,
      user_id: user.id,
      user_name: userName,
      content: newMessage.trim(),
    });
    if (error) {
      toast.error("Erro ao enviar mensagem");
    }
    setNewMessage("");
    setSending(false);
  };

  const handleAction = async (action: "aprovado" | "rejeitado") => {
    if (!user) return;
    const { error } = await supabase
      .from("price_exceptions")
      .update({ status: action, resolvido_por: user.id, resolvido_at: new Date().toISOString() })
      .eq("id", exceptionId);
    if (error) {
      toast.error("Erro ao atualizar status");
      return;
    }
    toast.success(action === "aprovado" ? "Exceção aprovada!" : "Exceção rejeitada!");
  };

  const statusBadge = () => {
    switch (status) {
      case "aprovado":
        return <Badge className="bg-green-100 text-green-800 border-green-300">Aprovado</Badge>;
      case "rejeitado":
        return <Badge variant="destructive">Rejeitado</Badge>;
      default:
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">Pendente</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Exceção de Preço {statusBadge()}
          </DialogTitle>
        </DialogHeader>

        {/* Context */}
        <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-1">
          {ambienteNome && (
            <div>
              <span className="text-muted-foreground">Ambiente:</span>{" "}
              <span className="font-medium">{ambienteNome}</span>
            </div>
          )}
          <div>
            <span className="text-muted-foreground">Produto:</span>{" "}
            <span className="font-mono">{produtoCodigo}</span> — {produtoDescricao}
          </div>
          <div className="flex gap-4">
            <div>
              <span className="text-muted-foreground">Preço solicitado:</span>{" "}
              <span className="font-semibold text-destructive">{formatarMoeda(precoSolicitado)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Preço mínimo:</span>{" "}
              <span className="font-semibold">{formatarMoeda(precoMinimo)}</span>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-[200px] max-h-[300px] space-y-2 p-2">
          {messages.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma mensagem ainda. Inicie a conversa.</p>
          )}
          {messages.map((msg) => {
            const isMe = msg.user_id === user?.id;
            return (
              <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${isMe ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                  <div className="text-xs font-medium opacity-70 mb-0.5">{msg.user_name}</div>
                  <div>{msg.content}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Admin actions */}
        {isAdmin && status === "pendente" && (
          <div className="flex gap-2 border-t pt-2">
            <Button size="sm" className="flex-1 gap-1 bg-green-600 hover:bg-green-700" onClick={() => handleAction("aprovado")}>
              <CheckCircle className="h-4 w-4" /> Aprovar
            </Button>
            <Button size="sm" variant="destructive" className="flex-1 gap-1" onClick={() => handleAction("rejeitado")}>
              <XCircle className="h-4 w-4" /> Rejeitar
            </Button>
          </div>
        )}

        {/* Message input */}
        <div className="flex gap-2 border-t pt-2">
          <Input
            placeholder="Digite sua mensagem..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
            disabled={sending}
          />
          <Button size="icon" onClick={sendMessage} disabled={sending || !newMessage.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ExceptionChat;
