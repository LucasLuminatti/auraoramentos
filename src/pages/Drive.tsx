import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import logo from "@/assets/logo.png";
import DriveSidebar from "@/components/DriveSidebar";
import DriveExplorer from "@/components/DriveExplorer";

const Drive = () => {
  const navigate = useNavigate();
  const [explorerKey, setExplorerKey] = useState(0);
  const [navState, setNavState] = useState<{
    clienteId: string | null;
    clienteNome: string;
    projetoId: string | null;
    projetoNome: string;
  }>({ clienteId: null, clienteNome: "", projetoId: null, projetoNome: "" });

  // We pass callbacks to sidebar that update the explorer via key remount
  // DriveExplorer manages its own internal navigation state
  // For sidebar integration, we'll use a ref-based approach

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b bg-card shadow-sm shrink-0">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Aura" className="h-10 w-auto" />
            <span className="text-lg font-semibold text-foreground">Drive</span>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Button>
        </div>
      </header>

      {/* Content */}
      <div className="flex flex-1 overflow-hidden">
        <DriveExplorer />
      </div>
    </div>
  );
};

export default Drive;
