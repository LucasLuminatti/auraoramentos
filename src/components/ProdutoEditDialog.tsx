import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import ArquitetoAutocomplete from "@/components/ArquitetoAutocomplete";

export interface ProdutoEditRow {
  id: string;
  codigo: string;
  descricao: string;
  preco_tabela: number | null;
  preco_minimo: number | null;
  arquiteto_id: string | null;
}

interface ProdutoEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  produto: ProdutoEditRow | null;
  onSuccess: () => void;
}

const ProdutoEditDialog = ({ open, onOpenChange, produto, onSuccess }: ProdutoEditDialogProps) => {
  const [descricao, setDescricao] = useState("");
  const [precoTabela, setPrecoTabela] = useState("");
  const [precoMinimo, setPrecoMinimo] = useState("");
  const [arquitetoId, setArquitetoId] = useState<string | null>(null);
  const [arquitetoNome, setArquitetoNome] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !produto) return;
    setDescricao(produto.descricao || "");
    setPrecoTabela(produto.preco_tabela != null ? String(produto.preco_tabela) : "");
    setPrecoMinimo(produto.preco_minimo != null ? String(produto.preco_minimo) : "");
    setArquitetoId(produto.arquiteto_id);
    if (produto.arquiteto_id) {
      supabase
        .from("arquitetos")
        .select("nome")
        .eq("id", produto.arquiteto_id)
        .maybeSingle()
        .then(({ data }) => {
          setArquitetoNome(data?.nome || "");
        });
    } else {
      setArquitetoNome("");
    }
  }, [open, produto]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!produto) return;
    if (!descricao.trim()) {
      toast.error("Descrição é obrigatória");
      return;
    }
    const ptNum = precoTabela.trim() ? Number(precoTabela.replace(",", ".")) : null;
    const pmNum = precoMinimo.trim() ? Number(precoMinimo.replace(",", ".")) : null;
    if (ptNum !== null && Number.isNaN(ptNum)) {
      toast.error("Preço tabela inválido");
      return;
    }
    if (pmNum !== null && Number.isNaN(pmNum)) {
      toast.error("Preço mínimo inválido");
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from("produtos")
      .update({
        descricao: descricao.trim(),
        preco_tabela: ptNum,
        preco_minimo: pmNum,
        arquiteto_id: arquitetoId,
      })
      .eq("id", produto.id);
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar: " + error.message);
      return;
    }
    toast.success("Produto atualizado!");
    onOpenChange(false);
    onSuccess();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Produto</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Código</Label>
            <Input value={produto?.codigo || ""} disabled className="font-mono" />
            <p className="text-xs text-muted-foreground">Código é fixo (chave de correlação com importação CSV).</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="prod-desc">Descrição *</Label>
            <Input
              id="prod-desc"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="prod-pt">Preço Tabela</Label>
              <Input
                id="prod-pt"
                inputMode="decimal"
                placeholder="0.00"
                value={precoTabela}
                onChange={(e) => setPrecoTabela(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="prod-pm">Preço Mínimo</Label>
              <Input
                id="prod-pm"
                inputMode="decimal"
                placeholder="0.00"
                value={precoMinimo}
                onChange={(e) => setPrecoMinimo(e.target.value)}
              />
            </div>
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
            <Button type="submit" disabled={saving || !descricao.trim()}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ProdutoEditDialog;
