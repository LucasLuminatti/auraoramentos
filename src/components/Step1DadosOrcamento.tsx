import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DadosOrcamento,
  opcoesRevisao,
  rotuloUltimaRevisao,
  LIMITE_ORCAMENTOS_POR_PROJETO,
} from "@/types/orcamento";
import { ArrowRight } from "lucide-react";
import { toast } from "sonner";

interface Step1Props {
  dados: DadosOrcamento;
  onChange: (dados: DadosOrcamento) => void;
  onNext: () => void;
}

/** Rótulos de revisão (RULE-069/072) — derivados de `LIMITE_ORCAMENTOS_POR_PROJETO` para
 *  que a lista nunca fique menor que o teto do guard. O `valor` é o que vai para o banco:
 *  "Primeiro Orçamento" é histórico e não pode mudar sem migrar os orçamentos existentes;
 *  o rótulo é o que a equipe usa no dia a dia (R00 é a revisão inicial). */
const TIPOS_ORCAMENTO = opcoesRevisao();

const Step1DadosOrcamento = ({ dados, onChange, onNext }: Step1Props) => {
  const handleNext = () => {
    if (!dados.tipo) {
      toast.error("Selecione o tipo de orçamento");
      return;
    }
    onNext();
  };

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-foreground">Dados do Orçamento</h2>
        <p className="text-muted-foreground">Preencha as informações iniciais do pedido.</p>
      </div>

      <div className="space-y-4 rounded-xl border bg-card p-6 shadow-sm">
        <div className="space-y-2">
          <Label>Tipo de Orçamento *</Label>
          <Select
            value={dados.tipo}
            onValueChange={(value) => onChange({ ...dados, tipo: value as DadosOrcamento['tipo'] })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione o tipo" />
            </SelectTrigger>
            <SelectContent>
              {/* RULE-069: a revisão inicial é a R00 — o rótulo mudou, mas o valor gravado
                  continua "Primeiro Orçamento" para não invalidar os orçamentos já salvos.
                  RULE-072: o teto de revisões por projeto vem de LIMITE_ORCAMENTOS_POR_PROJETO. */}
              {TIPOS_ORCAMENTO.map(({ valor, rotulo }) => (
                <SelectItem key={valor} value={valor}>{rotulo}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Até {LIMITE_ORCAMENTOS_POR_PROJETO} revisões por projeto (R00 a {rotuloUltimaRevisao()}).
          </p>
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleNext} className="gap-2">
          Próximo <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default Step1DadosOrcamento;
