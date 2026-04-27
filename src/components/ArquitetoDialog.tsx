import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";

export interface ArquitetoRow {
  id: string;
  nome: string;
  contato: string | null;
}

interface ArquitetoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  arquiteto?: ArquitetoRow | null;
  onSuccess: () => void;
}

const ArquitetoDialog = ({ open, onOpenChange, mode, arquiteto, onSuccess }: ArquitetoDialogProps) => {
  const [nome, setNome] = useState("");
  const [contato, setContato] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setNome(mode === "edit" && arquiteto ? arquiteto.nome : "");
      setContato(mode === "edit" && arquiteto?.contato ? arquiteto.contato : "");
    }
  }, [open, mode, arquiteto]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    setSaving(true);
    const payload = { nome: nome.trim(), contato: contato.trim() || null };
    let error;
    if (mode === "create") {
      const res = await supabase.from("arquitetos").insert(payload);
      error = res.error;
    } else if (mode === "edit" && arquiteto) {
      const res = await supabase.from("arquitetos").update(payload).eq("id", arquiteto.id);
      error = res.error;
    }
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar arquiteto: " + error.message);
      return;
    }
    toast.success(mode === "create" ? "Arquiteto criado!" : "Arquiteto atualizado!");
    onOpenChange(false);
    onSuccess();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Novo Arquiteto" : "Editar Arquiteto"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="arq-nome">Nome *</Label>
            <Input
              id="arq-nome"
              placeholder="Ex: Studio MK27"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="arq-contato">Contato</Label>
            <Input
              id="arq-contato"
              placeholder="Ex: contato@studiomk27.com.br"
              value={contato}
              onChange={(e) => setContato(e.target.value)}
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

export default ArquitetoDialog;
