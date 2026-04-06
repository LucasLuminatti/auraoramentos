import { AlertTriangle, XCircle, Lightbulb } from "lucide-react";
import type { ValidacaoResultado } from "@/hooks/useValidarSistemas";

interface ValidacaoPanelProps {
  validacao: ValidacaoResultado | undefined;
}

const ValidacaoPanel = ({ validacao }: ValidacaoPanelProps) => {
  if (!validacao) return null;
  const { erros, alertas, sugestoes } = validacao;
  if (erros.length === 0 && alertas.length === 0) return null;

  // Sugestões de drivers
  const sugestaoDrivers = sugestoes.drivers as
    | { metragem_fita_m: number; potencia_total_w: number; qtd_drivers_sugerida: number }
    | undefined;

  return (
    <div className="space-y-2 mt-2">
      {/* ERROS — bloqueantes */}
      {erros.map((erro, i) => (
        <div
          key={i}
          className="flex items-start gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-800"
        >
          <XCircle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-red-500" />
          <span>{erro}</span>
        </div>
      ))}

      {/* ALERTAS — avisos */}
      {alertas.map((alerta, i) => (
        <div
          key={i}
          className="flex items-start gap-2 rounded-md bg-yellow-50 border border-yellow-200 px-3 py-2 text-xs text-yellow-800"
        >
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-yellow-500" />
          <span>{alerta}</span>
        </div>
      ))}

      {/* SUGESTÃO DE DRIVERS */}
      {sugestaoDrivers && (
        <div className="flex items-start gap-2 rounded-md bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-blue-800">
          <Lightbulb className="h-3.5 w-3.5 mt-0.5 shrink-0 text-blue-500" />
          <span>
            {sugestaoDrivers.metragem_fita_m}m de fita × {(sugestaoDrivers.potencia_total_w / sugestaoDrivers.metragem_fita_m).toFixed(1)}W/m
            = {sugestaoDrivers.potencia_total_w.toFixed(0)}W →{" "}
            <strong>{sugestaoDrivers.qtd_drivers_sugerida} driver(s) necessário(s)</strong>
          </span>
        </div>
      )}
    </div>
  );
};

export default ValidacaoPanel;
