import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface StatusBadgeSelectProps {
  orcamentoId: string;
  currentStatus: string;
  onStatusChange: (orcamentoId: string, novo: string) => Promise<void>;
}

/**
 * Dropdown de status do orçamento com confirmação one-way para "aprovado" (WIZ-04).
 * Usado tanto pelo Admin (tab Pedidos) quanto pela lista do colaborador (ClienteList).
 * A RLS já garante que só o colaborador dono (ou admin) consegue alterar, e bloqueia
 * mudanças após aprovado.
 */
const StatusBadgeSelect = ({ orcamentoId, currentStatus, onStatusChange }: StatusBadgeSelectProps) => {
  const [confirmAprovarOpen, setConfirmAprovarOpen] = useState(false);
  const [pendingValue, setPendingValue] = useState<string | null>(null);
  const isAprovado = currentStatus === "aprovado";

  const handleChange = (next: string) => {
    if (next === currentStatus) return;
    if (next === "aprovado") {
      setPendingValue(next);
      setConfirmAprovarOpen(true);
      return;
    }
    void onStatusChange(orcamentoId, next);
  };

  const handleConfirmAprovado = async () => {
    if (pendingValue) await onStatusChange(orcamentoId, pendingValue);
    setConfirmAprovarOpen(false);
    setPendingValue(null);
  };

  return (
    <>
      <Select value={currentStatus} onValueChange={handleChange} disabled={isAprovado}>
        <SelectTrigger className="w-[140px] h-8" onClick={(e) => e.stopPropagation()}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent onClick={(e) => e.stopPropagation()}>
          <SelectItem value="rascunho">Rascunho</SelectItem>
          <SelectItem value="pendente">Pendente</SelectItem>
          <SelectItem value="aprovado">Aprovado</SelectItem>
          <SelectItem value="perdido">Perdido</SelectItem>
        </SelectContent>
      </Select>

      <AlertDialog open={confirmAprovarOpen} onOpenChange={setConfirmAprovarOpen}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Marcar como aprovado?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é irreversível. Depois de aprovado, o orçamento não pode ser revertido para outro status. Tem certeza?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingValue(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmAprovado}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default StatusBadgeSelect;
