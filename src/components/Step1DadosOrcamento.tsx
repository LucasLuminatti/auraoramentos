import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DadosOrcamento } from "@/types/orcamento";
import { ArrowRight } from "lucide-react";
import { toast } from "sonner";

interface Step1Props {
  dados: DadosOrcamento;
  onChange: (dados: DadosOrcamento) => void;
  onNext: () => void;
}

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
              <SelectItem value="Primeiro Orçamento">Primeiro Orçamento</SelectItem>
              <SelectItem value="Revisão 01">Revisão 01</SelectItem>
              <SelectItem value="Revisão 02">Revisão 02</SelectItem>
              <SelectItem value="Revisão 03">Revisão 03</SelectItem>
              <SelectItem value="Revisão 04">Revisão 04</SelectItem>
              <SelectItem value="Revisão 05">Revisão 05</SelectItem>
            </SelectContent>
          </Select>
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
