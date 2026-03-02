import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Plus } from "lucide-react";
import AmbienteCard from "./AmbienteCard";
import type { Ambiente } from "@/types/orcamento";
import { toast } from "sonner";

interface Step2Props {
  ambientes: Ambiente[];
  onChange: (ambientes: Ambiente[]) => void;
  onNext: () => void;
  onPrev: () => void;
}

const Step2Ambientes = ({ ambientes, onChange, onNext, onPrev }: Step2Props) => {
  const addAmbiente = () => {
    const novo: Ambiente = {
      id: crypto.randomUUID(),
      nome: `Ambiente ${ambientes.length + 1}`,
      luminarias: [],
      perfis: [],
      fitasLed: [],
    };
    onChange([...ambientes, novo]);
  };

  const updateAmbiente = (index: number, amb: Ambiente) => {
    const arr = [...ambientes]; arr[index] = amb;
    onChange(arr);
  };

  const removeAmbiente = (index: number) => {
    onChange(ambientes.filter((_, i) => i !== index));
  };

  const handleNext = () => {
    if (ambientes.length === 0) {
      toast.error("Adicione pelo menos um ambiente");
      return;
    }
    onNext();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Ambientes e Itens</h2>
          <p className="text-muted-foreground">Adicione os ambientes e seus respectivos itens.</p>
        </div>
        <Button onClick={addAmbiente} className="gap-2">
          <Plus className="h-4 w-4" /> Novo Ambiente
        </Button>
      </div>

      <div className="space-y-4">
        {ambientes.map((amb, i) => (
          <AmbienteCard
            key={amb.id}
            ambiente={amb}
            onChange={(a) => updateAmbiente(i, a)}
            onRemove={() => removeAmbiente(i)}
          />
        ))}
      </div>

      {ambientes.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-16 text-center">
          <p className="text-lg text-muted-foreground">Nenhum ambiente adicionado</p>
          <Button variant="outline" className="mt-4 gap-2" onClick={addAmbiente}>
            <Plus className="h-4 w-4" /> Adicionar Ambiente
          </Button>
        </div>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={onPrev} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Button>
        <Button onClick={handleNext} className="gap-2">
          Próximo <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default Step2Ambientes;
