import { useState, useEffect, useRef } from "react";
import logo from "@/assets/logo.png";
import StepIndicator from "@/components/StepIndicator";
import Step1DadosOrcamento from "@/components/Step1DadosOrcamento";
import Step2Categorias from "@/components/Step2Categorias";
import Step2Ambientes from "@/components/Step2Ambientes";
import Step3Revisao from "@/components/Step3Revisao";
import ClienteList from "@/components/ClienteList";
import { salvarRascunho, lerRascunho, limparRascunho, rascunhoTemConteudo, resumirRascunho, descreverIdade, type RascunhoWizard } from "@/lib/rascunhoLocal";
import type { DadosOrcamento, Ambiente, Orcamento, CategoriaFita } from "@/types/orcamento";
import { LIMITE_ORCAMENTOS_POR_PROJETO, rotuloUltimaRevisao } from "@/types/orcamento";
import { useAuth } from "@/hooks/useAuth";
import { useColaborador } from "@/hooks/useColaborador";
import { useUserRole } from "@/hooks/useUserRole";
import { getSaudacao } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LogOut, Plus, User, FolderOpen, ChevronRight, Shield, HardDrive } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import CompletarCadastroBanner from "@/components/CompletarCadastroBanner";
import ClienteDialog from "@/components/ClienteDialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// RULE-014: "Categorias" fica ANTES de "Ambientes" — as categorias de fita são criadas no
// começo do projeto e depois vinculadas aos perfis de cada ambiente.
const STEPS = ["Dados", "Categorias", "Ambientes", "Revisão"];

const COLUNAS_ORCAMENTO =
  "id, cliente_id, colaborador_id, projeto_id, tipo, ambientes, status, clientes:cliente_id(id, nome), projetos:projeto_id(id, nome)";

/** Carrega um orçamento para reabrir/duplicar tolerando a ausência da coluna `categorias`
 *  (migration 20260812000004). O front sobe no push e a migration é aplicada à mão: sem esse
 *  fallback, a janela entre os dois deixaria o colaborador sem conseguir abrir orçamento
 *  nenhum. Quando a coluna não existe, o orçamento carrega sem categorias — que é exatamente
 *  o que ele tem. */
async function carregarOrcamento(id: string, motivo: "reabrir" | "duplicar") {
  const comCategorias = await supabase
    .from("orcamentos")
    .select(`${COLUNAS_ORCAMENTO}, categorias`)
    .eq("id", id)
    .maybeSingle();
  if (!comCategorias.error) return comCategorias;

  const semCategorias = await supabase
    .from("orcamentos")
    .select(COLUNAS_ORCAMENTO)
    .eq("id", id)
    .maybeSingle();
  if (!semCategorias.error && semCategorias.data) {
    console.warn(`[${motivo}] coluna 'categorias' ausente — migration 20260812000004 pendente.`);
    return { ...semCategorias, data: { ...semCategorias.data, categorias: [] } };
  }
  return semCategorias.error ? semCategorias : comCategorias;
}

const Index = () => {
  const { signOut } = useAuth();
  const { colaborador } = useColaborador();
  const { isAdmin } = useUserRole();
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState<"list" | "create">("list");
  const [step, setStep] = useState(1);
  const [dados, setDados] = useState<DadosOrcamento>({ colaborador: "", tipo: "" });
  const [ambientes, setAmbientes] = useState<Ambiente[]>([]);
  const [categorias, setCategorias] = useState<CategoriaFita[]>([]);
  const [clienteDialogOpen, setClienteDialogOpen] = useState(false);
  const [listKey, setListKey] = useState(0);
  const [currentProjetoId, setCurrentProjetoId] = useState<string | null>(null);
  const [currentClienteId, setCurrentClienteId] = useState<string | null>(null);
  const [currentClienteNome, setCurrentClienteNome] = useState("");
  const [currentProjetoNome, setCurrentProjetoNome] = useState("");
  const [confirmVoltarOpen, setConfirmVoltarOpen] = useState(false);
  const [reopenedOrcamentoId, setReopenedOrcamentoId] = useState<string | null>(null);
  // BUG-22: rascunho local encontrado ao abrir a página (oferta de restauração).
  const [rascunhoOferecido, setRascunhoOferecido] = useState<RascunhoWizard | null>(null);

  // ─── BUG-22: espelho local do wizard ───
  // Grava a cada mudança enquanto o wizard está aberto; some quando o orçamento é salvo
  // ou descartado. Não toca no banco (autosave em `orcamentos` criaria rascunho fantasma
  // a cada tentativa abandonada).
  const userId = colaborador?.user_id ?? colaborador?.id ?? null;

  useEffect(() => {
    if (mode !== "create") return;
    salvarRascunho(userId, {
      step,
      dados,
      ambientes,
      categorias,
      clienteId: currentClienteId,
      clienteNome: currentClienteNome,
      projetoId: currentProjetoId,
      projetoNome: currentProjetoNome,
      orcamentoId: reopenedOrcamentoId,
    });
  }, [mode, step, dados, ambientes, categorias, currentClienteId, currentClienteNome, currentProjetoId, currentProjetoNome, reopenedOrcamentoId, userId]);

  // Oferta de restauração: só na lista, só uma vez, e nunca quando já se está
  // reabrindo/duplicando um orçamento por link (o state da navegação manda).
  useEffect(() => {
    if (mode !== "list" || rascunhoOferecido) return;
    if ((location.state as { orcamentoId?: string; duplicarDe?: string } | null)?.orcamentoId) return;
    if ((location.state as { duplicarDe?: string } | null)?.duplicarDe) return;
    const r = lerRascunho(userId);
    if (r && rascunhoTemConteudo(r)) setRascunhoOferecido(r);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, userId]);

  const restaurarRascunho = () => {
    const r = rascunhoOferecido;
    if (!r) return;
    setDados(r.dados);
    setAmbientes(r.ambientes);
    setCategorias(r.categorias);
    setCurrentClienteId(r.clienteId);
    setCurrentClienteNome(r.clienteNome);
    setCurrentProjetoId(r.projetoId);
    setCurrentProjetoNome(r.projetoNome);
    setReopenedOrcamentoId(r.orcamentoId);
    setStep(r.step || 1);
    setMode("create");
    setRascunhoOferecido(null);
    toast.success("Orçamento em andamento restaurado.");
  };

  const descartarRascunho = () => {
    limparRascunho(userId);
    setRascunhoOferecido(null);
  };

  // WIZ-03 (D-09): detecta location.state.orcamentoId para reabrir rascunho
  const orcamentoParaReabrir = (location.state as { orcamentoId?: string } | null)?.orcamentoId ?? null;
  // Feature 6: location.state.duplicarDe para criar um NOVO orçamento a partir de um existente
  const orcamentoParaDuplicar = (location.state as { duplicarDe?: string } | null)?.duplicarDe ?? null;

  useEffect(() => {
    if (!orcamentoParaReabrir) return;
    let cancelled = false;

    async function reabrir() {
      try {
        const { data, error } = await carregarOrcamento(orcamentoParaReabrir!, "reabrir");

        if (cancelled) return;
        if (error || !data) {
          toast.error("Orçamento não encontrado ou inacessível.");
          navigate("/admin?tab=pedidos", { replace: true });
          return;
        }

        // D-10: cliente removido (defesa em camadas — FK RESTRICT em prod mas tratamos mesmo assim)
        if (!data.clientes) {
          toast.error("Este orçamento referencia um cliente removido — não é possível continuar.");
          navigate("/admin?tab=pedidos", { replace: true });
          return;
        }

        // Popula state do wizard
        setDados({ colaborador: colaborador?.nome ?? "", tipo: (data.tipo as DadosOrcamento["tipo"]) ?? "" });
        setAmbientes((data.ambientes as unknown as Ambiente[]) ?? []);
        // Orçamentos anteriores ao modelo de categorias têm a coluna nula (RULE-014)
        setCategorias((data.categorias as unknown as CategoriaFita[]) ?? []);
        setCurrentClienteId(data.cliente_id);
        setCurrentClienteNome((data.clientes as any).nome ?? "");
        setCurrentProjetoId(data.projeto_id);
        setCurrentProjetoNome((data.projetos as any)?.nome ?? "");
        setReopenedOrcamentoId(data.id);
        setStep(1); // D-08: sempre reabre no Step 1
        setMode("create");

        // Limpa location.state para evitar re-fetch em refresh
        navigate("/", { replace: true, state: null });
      } catch {
        if (!cancelled) {
          toast.error("Erro ao carregar orçamento.");
          navigate("/admin?tab=pedidos", { replace: true });
        }
      }
    }

    void reabrir();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orcamentoParaReabrir]);

  // Feature 6: duplica um orçamento existente como NOVO (reopenedOrcamentoId = null → salva nova linha)
  useEffect(() => {
    if (!orcamentoParaDuplicar) return;
    let cancelled = false;

    async function duplicar() {
      try {
        const { data, error } = await carregarOrcamento(orcamentoParaDuplicar!, "duplicar");

        if (cancelled) return;
        if (error || !data || !data.clientes) {
          toast.error("Não foi possível duplicar este orçamento.");
          navigate("/", { replace: true, state: null });
          return;
        }

        setDados({ colaborador: colaborador?.nome ?? "", tipo: (data.tipo as DadosOrcamento["tipo"]) ?? "" });
        setAmbientes((data.ambientes as unknown as Ambiente[]) ?? []);
        setCategorias((data.categorias as unknown as CategoriaFita[]) ?? []);
        setCurrentClienteId(data.cliente_id);
        setCurrentClienteNome((data.clientes as any).nome ?? "");
        setCurrentProjetoId(data.projeto_id);
        setCurrentProjetoNome((data.projetos as any)?.nome ?? "");
        setReopenedOrcamentoId(null); // NOVO orçamento — não sobrescreve o original
        setStep(1);
        setMode("create");
        toast.success("Orçamento duplicado — ajuste o tipo/itens e salve como nova revisão.");

        navigate("/", { replace: true, state: null });
      } catch {
        if (!cancelled) {
          toast.error("Erro ao duplicar orçamento.");
          navigate("/", { replace: true, state: null });
        }
      }
    }

    void duplicar();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orcamentoParaDuplicar]);

  // Mantém o step atual acessível dentro do listener de popstate sem recriar o efeito a cada passo.
  const stepRef = useRef(step);
  useEffect(() => { stepRef.current = step; }, [step]);
  // Sentinela armada = a entrada que empilhamos ainda está no topo do histórico (não consumida por um popstate).
  const sentinelaArmadaRef = useRef(false);
  // Sinaliza que o popstate em curso veio de uma saída in-app (botão/logo), não do Voltar do navegador.
  const saindoRef = useRef(false);

  // Integra os passos do wizard ao botão "Voltar" do navegador: ao entrar no modo criação
  // empilhamos uma entrada-sentinela no histórico e, a cada "Voltar", recuamos um passo
  // (3→2→1→lista) em vez de sair do site. Re-arma a sentinela a cada pop.
  useEffect(() => {
    if (mode !== "create") return;
    window.history.pushState({ wizardStep: stepRef.current }, "");
    sentinelaArmadaRef.current = true;
    const onPop = () => {
      // O navegador já removeu a entrada do topo (nossa sentinela).
      sentinelaArmadaRef.current = false;
      // Saída in-app (botão "Voltar à lista" / logo): só consome a sentinela e vai pra lista.
      if (saindoRef.current) { saindoRef.current = false; setMode("list"); return; }
      const atual = stepRef.current;
      if (atual > 1) {
        stepRef.current = atual - 1; // sincroniza já — evita dessincronia em Backs rápidos
        window.history.pushState({ wizardStep: atual - 1 }, "");
        sentinelaArmadaRef.current = true;
        setStep(atual - 1);
      } else {
        setMode("list");
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [mode]);

  // Saída in-app para a lista: consome a sentinela do histórico (se ainda no topo) para não
  // deixar entrada órfã que viraria um "Voltar morto" depois. Caso contrário, sai direto.
  const sairParaLista = () => {
    if (sentinelaArmadaRef.current) { saindoRef.current = true; window.history.back(); }
    else { setMode("list"); }
  };

  const orcamento: Orcamento = { dados, ambientes, categorias };

  /** Remover uma categoria precisa desvincular os sistemas que apontavam para ela — senão o
   *  `categoriaId` órfão continua agrupando a fita num grupo separado (RULE-017), e o
   *  colaborador acaba comprando dois rolos da mesma fita sem entender por quê. */
  const atualizarCategorias = (novas: CategoriaFita[]) => {
    setCategorias(novas);
    const idsVivos = new Set(novas.map((c) => c.id));
    setAmbientes((prev) => {
      let mudou = false;
      const arr = prev.map((amb) => ({
        ...amb,
        sistemas: amb.sistemas.map((sis) => {
          if (!sis.categoriaId || idsVivos.has(sis.categoriaId)) return sis;
          mudou = true;
          return { ...sis, categoriaId: null };
        }),
      }));
      return mudou ? arr : prev;
    });
  };

  const handleNovoOrcamento = async (clienteId: string, projetoId: string, projetoNome: string, clienteNome: string) => {
    // RULE-072: teto de revisões por projeto (a equipe fixou 15 — R00…R14).
    const { count, error } = await supabase
      .from("orcamentos")
      .select("id", { count: "exact", head: true })
      .eq("projeto_id", projetoId);
    if (!error && (count ?? 0) >= LIMITE_ORCAMENTOS_POR_PROJETO) {
      toast.error(
        `Este projeto já tem ${LIMITE_ORCAMENTOS_POR_PROJETO} revisões (R00 a ${rotuloUltimaRevisao()}).`,
        { description: "Crie um novo projeto para continuar orçando." },
      );
      return;
    }
    setDados({ colaborador: colaborador?.nome || "", tipo: "" });
    setAmbientes([]);
    setCategorias([]);
    setCurrentProjetoId(projetoId);
    setCurrentClienteId(clienteId);
    setCurrentClienteNome(clienteNome);
    setCurrentProjetoNome(projetoNome);
    setReopenedOrcamentoId(null);
    setStep(1);
    setMode("create");
  };

  const handleLogoClick = () => {
    if (mode === "create") setConfirmVoltarOpen(true);
  };

  const handleConfirmarVoltar = () => {
    setStep(1);
    setDados({ colaborador: colaborador?.nome || "", tipo: "" });
    setAmbientes([]);
    setCategorias([]);
    setCurrentProjetoId(null);
    setCurrentClienteId(null);
    setCurrentClienteNome("");
    setCurrentProjetoNome("");
    setReopenedOrcamentoId(null);
    setConfirmVoltarOpen(false);
    // BUG-22: sair pelo logo é abandono explícito — o rascunho local vai junto,
    // senão a próxima visita ofereceria de volta o que a pessoa acabou de descartar.
    limparRascunho(userId);
    setRascunhoOferecido(null);
    sairParaLista();
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
              <Button onClick={() => setClienteDialogOpen(true)} className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
                <Plus className="h-4 w-4" /> Novo Cliente
              </Button>
            )}
            {mode === "create" && (
              <Button variant="outline" size="sm" onClick={sairParaLista}>
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
        {/* BUG-22: rascunho local encontrado — restauração é OFERECIDA, nunca automática. */}
        {mode === "list" && rascunhoOferecido && (
          <div className="mb-4 rounded-lg border border-amber-400/50 bg-amber-50 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-amber-900">
              <strong>Você tinha um orçamento em andamento</strong>
              {rascunhoOferecido.clienteNome ? ` — ${rascunhoOferecido.clienteNome}` : ""}
              {rascunhoOferecido.projetoNome ? ` / ${rascunhoOferecido.projetoNome}` : ""}.
              <span className="text-amber-800">
                {" "}({resumirRascunho(rascunhoOferecido)}, salvo {descreverIdade(rascunhoOferecido.salvoEm)})
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={restaurarRascunho}>Retomar</Button>
              <Button size="sm" variant="ghost" onClick={descartarRascunho}>Descartar</Button>
            </div>
          </div>
        )}
        {mode === "list" && <ClienteList key={listKey} onNovoOrcamento={handleNovoOrcamento} />}

        {mode === "create" && (
          <>
            {/* RULE-091: o cliente no breadcrumb é clicável e volta para a pasta dele
                (mesma confirmação do logo — sair do wizard descarta o que não foi salvo). */}
            <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-4 py-2.5 text-sm mb-4">
              <User className="h-4 w-4 text-primary" />
              <button
                type="button"
                onClick={() => setConfirmVoltarOpen(true)}
                className="font-medium text-foreground hover:text-primary hover:underline transition-colors"
                title="Voltar para a lista de clientes"
              >
                {currentClienteNome}
              </button>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              <FolderOpen className="h-4 w-4 text-primary/70" />
              <span className="font-medium text-foreground">{currentProjetoNome}</span>
            </div>
            <StepIndicator currentStep={step} steps={STEPS} onStepClick={(s) => setStep(s)} />
            <div className="mt-6">
              {step === 1 && (
                <Step1DadosOrcamento dados={dados} onChange={setDados} onNext={() => setStep(2)} />
              )}
              {step === 2 && (
                <Step2Categorias categorias={categorias} onChange={atualizarCategorias} onNext={() => setStep(3)} onPrev={() => setStep(1)} />
              )}
              {step === 3 && (
                <Step2Ambientes ambientes={ambientes} categorias={categorias} onChange={setAmbientes} onNext={() => setStep(4)} onPrev={() => setStep(2)} />
              )}
              {step === 4 && (
                <Step3Revisao orcamento={orcamento} onPrev={() => setStep(3)} clienteId={currentClienteId || undefined} clienteNome={currentClienteNome} projetoNome={currentProjetoNome} projetoId={currentProjetoId || undefined} onUpdateAmbientes={setAmbientes} initialOrcamentoId={reopenedOrcamentoId ?? undefined} onOrcamentoSalvo={() => limparRascunho(userId)} />
              )}
            </div>
          </>
        )}
      </main>

      <ClienteDialog
        open={clienteDialogOpen}
        onOpenChange={setClienteDialogOpen}
        mode="create"
        onSuccess={() => setListKey((k) => k + 1)}
      />

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
