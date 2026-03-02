import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface StepIndicatorProps {
  currentStep: number;
  steps: string[];
}

const StepIndicator = ({ currentStep, steps }: StepIndicatorProps) => {
  return (
    <div className="flex items-center justify-center gap-2 py-6">
      {steps.map((label, index) => {
        const stepNum = index + 1;
        const isActive = stepNum === currentStep;
        const isCompleted = stepNum < currentStep;

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
            <div className="flex items-center gap-2">
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
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default StepIndicator;
