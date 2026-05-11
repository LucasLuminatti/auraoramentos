import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";

export interface ArquitetoRow {
  id: string;
  nome: string;
  contato: string | null;
  data_nascimento: string | null;
  endereco: string | null;
  banco: string | null;
  agencia: string | null;
  conta: string | null;
  tipo_conta: string | null;
  pix: string | null;
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
  const [dataNascimento, setDataNascimento] = useState("");
  const [endereco, setEndereco] = useState("");
  const [banco, setBanco] = useState("");
  const [agencia, setAgencia] = useState("");
  const [conta, setConta] = useState("");
  const [tipoConta, setTipoConta] = useState("");
  const [pix, setPix] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      const a = mode === "edit" ? arquiteto : null;
      setNome(a?.nome ?? "");
      setContato(a?.contato ?? "");
      setDataNascimento(a?.data_nascimento ?? "");
      setEndereco(a?.endereco ?? "");
      setBanco(a?.banco ?? "");
      setAgencia(a?.agencia ?? "");
      setConta(a?.conta ?? "");
      setTipoConta(a?.tipo_conta ?? "");
      setPix(a?.pix ?? "");
    }
  }, [open, mode, arquiteto]);

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
      data_nascimento: dataNascimento || null,
      endereco: endereco.trim() || null,
      banco: banco.trim() || null,
      agencia: agencia.trim() || null,
      conta: conta.trim() || null,
      tipo_conta: tipoConta.trim() || null,
      pix: pix.trim() || null,
    };
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
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
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
            <Label htmlFor="arq-contato">Contato <span className="text-muted-foreground text-xs font-normal">(opcional)</span></Label>
            <Input
              id="arq-contato"
              placeholder="Ex: contato@studiomk27.com.br"
              value={contato}
              onChange={(e) => setContato(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="arq-data-nascimento">Data de Nascimento <span className="text-muted-foreground text-xs font-normal">(opcional)</span></Label>
            <Input
              id="arq-data-nascimento"
              type="date"
              value={dataNascimento}
              onChange={(e) => setDataNascimento(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="arq-endereco">Endereço <span className="text-muted-foreground text-xs font-normal">(opcional)</span></Label>
            <Textarea
              id="arq-endereco"
              placeholder="Rua, número, complemento, bairro, cidade — UF"
              rows={2}
              value={endereco}
              onChange={(e) => setEndereco(e.target.value)}
            />
          </div>

          <div className="pt-2 text-sm font-medium border-t mt-2">Dados Bancários <span className="text-muted-foreground text-xs font-normal">(opcional)</span></div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="arq-banco">Banco <span className="text-muted-foreground text-xs font-normal">(opcional)</span></Label>
              <Input
                id="arq-banco"
                placeholder="Ex: Bradesco"
                value={banco}
                onChange={(e) => setBanco(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="arq-agencia">Agência <span className="text-muted-foreground text-xs font-normal">(opcional)</span></Label>
              <Input
                id="arq-agencia"
                placeholder="Ex: 1234"
                value={agencia}
                onChange={(e) => setAgencia(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="arq-conta">Conta <span className="text-muted-foreground text-xs font-normal">(opcional)</span></Label>
              <Input
                id="arq-conta"
                placeholder="Ex: 567890-1"
                value={conta}
                onChange={(e) => setConta(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="arq-tipo-conta">Tipo de Conta <span className="text-muted-foreground text-xs font-normal">(opcional)</span></Label>
              <Input
                id="arq-tipo-conta"
                placeholder="Ex: corrente / poupança"
                value={tipoConta}
                onChange={(e) => setTipoConta(e.target.value)}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="arq-pix">Pix <span className="text-muted-foreground text-xs font-normal">(opcional)</span></Label>
              <Input
                id="arq-pix"
                placeholder="CPF / email / telefone / chave aleatória"
                value={pix}
                onChange={(e) => setPix(e.target.value)}
              />
            </div>
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
