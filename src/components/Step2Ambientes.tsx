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
      sistemas: [],
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

    // CALC-01 (D-01..D-05): bloquear sistemas com fita, sem perfil, metragem null/0
    const sistemasInvalidos: string[] = [];
    // D-06/D-07: detectar sistemas totalmente vazios para remover (não bloqueia)
    const ambientesLimpos = ambientes.map((amb) => {
      amb.sistemas.forEach((sis, idx) => {
        const totalmenteVazio = !sis.fita.codigo && !sis.driver.codigo && !sis.perfil;
        if (totalmenteVazio) return; // removido abaixo
        if (sis.fita.codigo && !sis.perfil) {
          const metragemInvalida = !sis.metragemManual || sis.metragemManual <= 0;
          if (metragemInvalida) {
            sistemasInvalidos.push(`${amb.nome} — Sistema ${idx + 1}`);
          }
        }
      });
      return {
        ...amb,
        sistemas: amb.sistemas.filter(
          (sis) => !(!sis.fita.codigo && !sis.driver.codigo && !sis.perfil)
        ),
      };
    });

    if (sistemasInvalidos.length > 0) {
      toast.error("Informe uma metragem válida para este sistema antes de continuar.", {
        description: sistemasInvalidos.join(" · "),
      });
      return; // BLOQUEIO (D-02)
    }

    const removidos =
      ambientes.reduce((acc, a) => acc + a.sistemas.length, 0) -
      ambientesLimpos.reduce((acc, a) => acc + a.sistemas.length, 0);

    if (removidos > 0) {
      onChange(ambientesLimpos); // remove vazios (D-06)
      toast.info(
        removidos === 1
          ? "1 sistema vazio foi removido do orçamento."
          : `${removidos} sistemas vazios foram removidos do orçamento.`
      );
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
