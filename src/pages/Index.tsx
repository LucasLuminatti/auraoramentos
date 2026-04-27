import { useState } from "react";
import logo from "@/assets/logo.png";
import StepIndicator from "@/components/StepIndicator";
import Step1DadosOrcamento from "@/components/Step1DadosOrcamento";
import Step2Ambientes from "@/components/Step2Ambientes";
import Step3Revisao from "@/components/Step3Revisao";
import ClienteList from "@/components/ClienteList";
import type { DadosOrcamento, Ambiente, Orcamento } from "@/types/orcamento";
import { useAuth } from "@/hooks/useAuth";
import { useColaborador } from "@/hooks/useColaborador";
import { useUserRole } from "@/hooks/useUserRole";
import { getSaudacao } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LogOut, Plus, User, FolderOpen, ChevronRight, Shield, HardDrive } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import CompletarCadastroBanner from "@/components/CompletarCadastroBanner";

const STEPS = ["Dados", "Ambientes", "Revisão"];

const Index = () => {
  const { signOut } = useAuth();
  const { colaborador } = useColaborador();
  const { isAdmin } = useUserRole();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"list" | "create">("list");
  const [step, setStep] = useState(1);
  const [dados, setDados] = useState<DadosOrcamento>({ colaborador: "", tipo: "" });
  const [ambientes, setAmbientes] = useState<Ambiente[]>([]);
  const [clienteDialogOpen, setClienteDialogOpen] = useState(false);
  const [novoClienteNome, setNovoClienteNome] = useState("");
  const [listKey, setListKey] = useState(0);
  const [currentProjetoId, setCurrentProjetoId] = useState<string | null>(null);
  const [currentClienteId, setCurrentClienteId] = useState<string | null>(null);
  const [currentClienteNome, setCurrentClienteNome] = useState("");
  const [currentProjetoNome, setCurrentProjetoNome] = useState("");
  const [confirmVoltarOpen, setConfirmVoltarOpen] = useState(false);

  const orcamento: Orcamento = { dados, ambientes };

  const handleNovoOrcamento = (clienteId: string, projetoId: string, projetoNome: string, clienteNome: string) => {
    setDados({ colaborador: colaborador?.nome || "", tipo: "" });
    setAmbientes([]);
    setCurrentProjetoId(projetoId);
    setCurrentClienteId(clienteId);
    setCurrentClienteNome(clienteNome);
    setCurrentProjetoNome(projetoNome);
    setStep(1);
    setMode("create");
  };

  const handleCriarCliente = async () => {
    if (!novoClienteNome.trim()) return;
    const { error } = await supabase.from("clientes").insert({ nome: novoClienteNome.trim() });
    if (error) {
      toast.error("Erro ao criar cliente");
      return;
    }
    toast.success("Cliente adicionado!");
    setClienteDialogOpen(false);
    setNovoClienteNome("");
    setListKey((k) => k + 1);
  };

  const handleLogoClick = () => {
    if (mode === "create") setConfirmVoltarOpen(true);
  };

  const handleConfirmarVoltar = () => {
    setMode("list");
    setStep(1);
    setDados({ colaborador: colaborador?.nome || "", tipo: "" });
    setAmbientes([]);
    setCurrentProjetoId(null);
    setCurrentClienteId(null);
    setCurrentClienteNome("");
    setCurrentProjetoNome("");
    setConfirmVoltarOpen(false);
  };

  const saudacao = getSaudacao();
  const nomeColaborador = colaborador?.nome?.split(" ")[0] || "";

  return (
    <div className="min-h-screen bg-background">
      <CompletarCadastroBanner />
      {/* Header */}
      <header className="border-b bg-card shadow-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Aura Projetos de Iluminação" className={`h-12 w-auto ${mode === "create" ? "cursor-pointer" : ""}`} onClick={handleLogoClick} />
            {nomeColaborador ? (
              <span className="text-lg font-semibold text-foreground">
                {saudacao}, <span className="text-primary">{nomeColaborador}</span>!
              </span>
            ) : (
              <span className="text-lg font-semibold text-primary">Criador de Orçamentos</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {mode === "list" && (
              <Button onClick={() => { setNovoClienteNome(""); setClienteDialogOpen(true); }} className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
                <Plus className="h-4 w-4" /> Novo Cliente
              </Button>
            )}
            {mode === "create" && (
              <Button variant="outline" size="sm" onClick={() => setMode("list")}>
                Voltar à lista
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => navigate("/drive")} className="gap-1.5">
              <HardDrive className="h-4 w-4" /> Drive
            </Button>
            {isAdmin && (
              <Button variant="outline" size="sm" onClick={() => navigate("/admin")} className="gap-1.5">
                <Shield className="h-4 w-4" /> Admin
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={signOut} className="text-muted-foreground">
              <LogOut className="mr-1 h-4 w-4" /> Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        {mode === "list" && <ClienteList key={listKey} onNovoOrcamento={handleNovoOrcamento} />}

        {mode === "create" && (
          <>
            <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-4 py-2.5 text-sm mb-4">
              <User className="h-4 w-4 text-primary" />
              <span className="font-medium text-foreground">{currentClienteNome}</span>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              <FolderOpen className="h-4 w-4 text-primary/70" />
              <span className="font-medium text-foreground">{currentProjetoNome}</span>
            </div>
            <StepIndicator currentStep={step} steps={STEPS} />
            <div className="mt-6">
              {step === 1 && (
                <Step1DadosOrcamento dados={dados} onChange={setDados} onNext={() => setStep(2)} />
              )}
              {step === 2 && (
                <Step2Ambientes ambientes={ambientes} onChange={setAmbientes} onNext={() => setStep(3)} onPrev={() => setStep(1)} />
              )}
              {step === 3 && (
                <Step3Revisao orcamento={orcamento} onPrev={() => setStep(2)} clienteId={currentClienteId || undefined} clienteNome={currentClienteNome} projetoNome={currentProjetoNome} projetoId={currentProjetoId || undefined} onUpdateAmbientes={setAmbientes} />
              )}
            </div>
          </>
        )}
      </main>

      <Dialog open={clienteDialogOpen} onOpenChange={setClienteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Cliente</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Input
              placeholder="Nome do cliente"
              value={novoClienteNome}
              onChange={(e) => setNovoClienteNome(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCriarCliente()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClienteDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleCriarCliente} disabled={!novoClienteNome.trim()}>Criar Cliente</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmVoltarOpen} onOpenChange={setConfirmVoltarOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Sair do orçamento?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Você perderá o orçamento em andamento. Deseja voltar à lista de clientes?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmVoltarOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleConfirmarVoltar}>Voltar à lista</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Index;
