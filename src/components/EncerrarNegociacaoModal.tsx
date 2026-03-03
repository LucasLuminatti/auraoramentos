import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Trophy, XCircle } from "lucide-react";

const MOTIVOS_PERDA = [
  { value: "preco", label: "Preço" },
  { value: "concorrencia", label: "Concorrência" },
  { value: "prazo", label: "Prazo" },
  { value: "sem_retorno", label: "Sem retorno do cliente" },
  { value: "outro", label: "Outro" },
];

interface EncerrarNegociacaoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orcamentoId: string;
  onSuccess: () => void;
}

const EncerrarNegociacaoModal = ({ open, onOpenChange, orcamentoId, onSuccess }: EncerrarNegociacaoModalProps) => {
  const [resultado, setResultado] = useState<"ganho" | "perdido" | null>(null);
  const [motivoPerda, setMotivoPerda] = useState("");
  const [motivoPerdaDetalhe, setMotivoPerdaDetalhe] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setResultado(null);
    setMotivoPerda("");
    setMotivoPerdaDetalhe("");
  };

  const handleConfirm = async () => {
    if (!resultado) return;
    if (resultado === "perdido" && !motivoPerda) {
      toast.error("Selecione o motivo da perda");
      return;
    }

    setSaving(true);
    const updateData: Record<string, unknown> = {
      status: resultado === "ganho" ? "fechado" : "perdido",
      fechado_at: new Date().toISOString(),
    };
    if (resultado === "perdido") {
      updateData.motivo_perda = motivoPerda;
      updateData.motivo_perda_detalhe = motivoPerdaDetalhe || null;
    }

    const { error } = await supabase
      .from("orcamentos")
      .update(updateData)
      .eq("id", orcamentoId);

    setSaving(false);

    if (error) {
      toast.error("Erro ao encerrar negociação");
      return;
    }

    toast.success(
      resultado === "ganho" ? "Negociação encerrada como Ganha! 🎉" : "Negociação registrada como Perdida.",
    );
    reset();
    onOpenChange(false);
    onSuccess();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Encerrar Negociação</DialogTitle>
          <DialogDescription>Selecione o resultado desta negociação.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Resultado buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setResultado("ganho")}
              className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-colors ${
                resultado === "ganho"
                  ? "border-green-500 bg-green-50 text-green-700"
                  : "border-border hover:border-green-300 hover:bg-green-50/50"
              }`}
            >
              <Trophy className="h-6 w-6" />
              <span className="font-semibold text-sm">Ganho</span>
            </button>
            <button
              type="button"
              onClick={() => setResultado("perdido")}
              className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-colors ${
                resultado === "perdido"
                  ? "border-red-500 bg-red-50 text-red-700"
                  : "border-border hover:border-red-300 hover:bg-red-50/50"
              }`}
            >
              <XCircle className="h-6 w-6" />
              <span className="font-semibold text-sm">Perdido</span>
            </button>
          </div>

          {/* Motivo de perda */}
          {resultado === "perdido" && (
            <div className="space-y-3 animate-in fade-in-0 slide-in-from-top-2 duration-200">
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">
                  Motivo da perda <span className="text-destructive">*</span>
                </label>
                <Select value={motivoPerda} onValueChange={setMotivoPerda}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o motivo" />
                  </SelectTrigger>
                  <SelectContent>
                    {MOTIVOS_PERDA.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">
                  Observação <span className="text-muted-foreground font-normal">(opcional)</span>
                </label>
                <Textarea
                  placeholder="Detalhes adicionais..."
                  value={motivoPerdaDetalhe}
                  onChange={(e) => setMotivoPerdaDetalhe(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!resultado || saving}>
            {saving ? "Salvando..." : "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EncerrarNegociacaoModal;
