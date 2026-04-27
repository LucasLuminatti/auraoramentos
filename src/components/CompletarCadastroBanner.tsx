import { useColaborador } from "@/hooks/useColaborador";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

const CompletarCadastroBanner = () => {
  const { colaborador, loading } = useColaborador();
  const navigate = useNavigate();
  const location = useLocation();

  // Não mostrar enquanto carrega, na própria página de completar, ou se já completou.
  if (loading || !colaborador) return null;
  if (location.pathname === "/perfil/completar") return null;

  const incompleto = !colaborador.cpf || !colaborador.telefone || !colaborador.setor;
  if (!incompleto) return null;

  return (
    <div className="sticky top-0 z-40 w-full border-b border-amber-500/30 bg-amber-500/10 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5">
        <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="text-sm font-medium">
            Complete seu cadastro com CPF, telefone e setor.
          </span>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="border-amber-600 text-amber-700 hover:bg-amber-500/20 hover:text-amber-800"
          onClick={() => navigate("/perfil/completar")}
        >
          Completar agora
        </Button>
      </div>
    </div>
  );
};

export default CompletarCadastroBanner;
