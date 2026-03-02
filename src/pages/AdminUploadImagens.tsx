import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import logo from "@/assets/logo.png";
import ImportImagens from "@/components/ImportImagens";

const AdminUploadImagens = () => {
  const navigate = useNavigate();
  const { signOut } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card shadow-sm">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Logo" className="h-12 w-auto cursor-pointer" onClick={() => navigate("/")} />
            <span className="text-lg font-semibold text-foreground">Upload de Imagens</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate("/admin")}>
              <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
            </Button>
            <Button variant="ghost" size="sm" onClick={signOut} className="text-muted-foreground">
              Sair
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-6">
        <ImportImagens />
      </main>
    </div>
  );
};

export default AdminUploadImagens;
