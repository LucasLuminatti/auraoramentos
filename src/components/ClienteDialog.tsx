import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { formatCpfCnpj, unmask } from "@/lib/masks";
import ArquitetoAutocomplete from "@/components/ArquitetoAutocomplete";

export interface ClienteRow {
  id: string;
  nome: string;
  contato: string | null;
  cpf_cnpj: string | null;
  arquiteto_id: string | null;
}

interface ClienteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  cliente?: ClienteRow | null;
  onSuccess: () => void;
}

const ClienteDialog = ({ open, onOpenChange, mode, cliente, onSuccess }: ClienteDialogProps) => {
  const [nome, setNome] = useState("");
  const [contato, setContato] = useState("");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [arquitetoId, setArquitetoId] = useState<string | null>(null);
  const [arquitetoNome, setArquitetoNome] = useState("");
  const [saving, setSaving] = useState(false);

  // Carrega dados quando abre em modo edit; reseta em create
  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && cliente) {
      setNome(cliente.nome);
      setContato(cliente.contato || "");
      setCpfCnpj(cliente.cpf_cnpj ? formatCpfCnpj(cliente.cpf_cnpj) : "");
      setArquitetoId(cliente.arquiteto_id);
      if (cliente.arquiteto_id) {
        supabase
          .from("arquitetos")
          .select("nome")
          .eq("id", cliente.arquiteto_id)
          .maybeSingle()
          .then(({ data }) => {
            setArquitetoNome(data?.nome || "");
          });
      } else {
        setArquitetoNome("");
      }
    } else {
      setNome("");
      setContato("");
      setCpfCnpj("");
      setArquitetoId(null);
      setArquitetoNome("");
    }
  }, [open, mode, cliente]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    setSaving(true);
    const payload = {
      nome: nome.trim(),
      contato: contato.trim() || null,
      cpf_cnpj: cpfCnpj.trim() ? unmask(cpfCnpj) : null,
      arquiteto_id: arquitetoId,
    };
    let error;
    if (mode === "create") {
      const res = await supabase.from("clientes").insert(payload);
      error = res.error;
    } else if (mode === "edit" && cliente) {
      const res = await supabase.from("clientes").update(payload).eq("id", cliente.id);
      error = res.error;
    }
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar cliente: " + error.message);
      return;
    }
    toast.success(mode === "create" ? "Cliente criado!" : "Cliente atualizado!");
    onOpenChange(false);
    onSuccess();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Novo Cliente" : "Editar Cliente"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="cli-nome">Nome *</Label>
            <Input
              id="cli-nome"
              placeholder="Ex: Casa João Silva"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cli-contato">Contato</Label>
            <Input
              id="cli-contato"
              placeholder="Ex: João Silva, joao@email.com"
              value={contato}
              onChange={(e) => setContato(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cli-cpf">CPF/CNPJ</Label>
            <Input
              id="cli-cpf"
              placeholder="000.000.000-00 ou 00.000.000/0000-00"
              value={cpfCnpj}
              onChange={(e) => setCpfCnpj(formatCpfCnpj(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label>Arquiteto</Label>
            <ArquitetoAutocomplete
              value={arquitetoNome}
              onSelect={(arq) => {
                if (arq === null) {
                  setArquitetoId(null);
                  setArquitetoNome("");
                } else {
                  setArquitetoId(arq.id);
                  setArquitetoNome(arq.nome);
                }
              }}
              placeholder="Buscar arquiteto..."
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving || !nome.trim()}>
              {saving ? "Salvando..." : mode === "create" ? "Criar" : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ClienteDialog;
