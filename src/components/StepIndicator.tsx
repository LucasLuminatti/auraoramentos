import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface StepIndicatorProps {
  currentStep: number;
  steps: string[];
  /** Permite voltar a uma etapa já concluída clicando nela (sem perda de dados). */
  onStepClick?: (step: number) => void;
}

const StepIndicator = ({ currentStep, steps, onStepClick }: StepIndicatorProps) => {
  return (
    <div className="flex items-center justify-center gap-2 py-6">
      {steps.map((label, index) => {
        const stepNum = index + 1;
        const isActive = stepNum === currentStep;
        const isCompleted = stepNum < currentStep;
        // Só etapas concluídas (anteriores à atual) são clicáveis — volta sem perder dados.
        const isClickable = isCompleted && !!onStepClick;

        return (
          <div key={index} className="flex items-center gap-2">
            {index > 0 && (
              <div
                className={cn(
                  "h-0.5 w-8 md:w-16 transition-colors",
                  isCompleted ? "bg-primary" : "bg-border"
                )}
              />
            )}
            <button
              type="button"
              disabled={!isClickable}
              onClick={isClickable ? () => onStepClick!(stepNum) : undefined}
              title={isClickable ? `Voltar para ${label}` : undefined}
              className={cn(
                "flex items-center gap-2 rounded-full",
                isClickable && "cursor-pointer hover:opacity-80 transition-opacity",
                !isClickable && "cursor-default"
              )}
            >
              <div
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold transition-all",
                  isActive && "bg-primary text-primary-foreground shadow-md",
                  isCompleted && "bg-primary text-primary-foreground",
                  !isActive && !isCompleted && "bg-muted text-muted-foreground"
                )}
              >
                {isCompleted ? <Check className="h-4 w-4" /> : stepNum}
              </div>
              <span
                className={cn(
                  "hidden text-sm font-medium md:block",
                  isActive && "text-foreground",
                  !isActive && "text-muted-foreground"
                )}
              >
                {label}
              </span>
            </button>
          </div>
        );
      })}
    </div>
  );
};

export default StepIndicator;
