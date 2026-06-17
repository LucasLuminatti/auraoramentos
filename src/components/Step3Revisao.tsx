import React, { useState, useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { ArrowLeft, FileDown, AlertTriangle, MessageSquare, ChevronDown, CheckCircle2 } from "lucide-react";
import type { Orcamento, Ambiente, SistemaIluminacao, GrupoFita, StatusOrcamento } from "@/types/orcamento";
import type { Json } from "@/integrations/supabase/types";
import { construirDescricaoRica } from "@/lib/produtoDescricao";
import {
  calcularDemandaFita, calcularConsumoW, calcularQtdDrivers,
  calcularSubtotalLuminaria, calcularSubtotalPerfilSistema, calcularSubtotalDriverSistema,
  calcularSubtotalSistemaSemFita, calcularTotalAmbienteSemFita, calcularRolosPorGrupo,
  calcularDriversPorProjeto, calcularTotalGeral, formatarMoeda,
  detectarChecklistIssues
} from "@/types/orcamento";
import type { ChecklistIssue } from "@/types/orcamento";
import { cn } from "@/lib/utils";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { gerarOrcamentoHtml } from "@/lib/gerarPdfHtml";
import { resolverTemplateVersion } from "@/lib/pdfTemplateVersion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useColaborador } from "@/hooks/useColaborador";
import ExceptionChat from "./ExceptionChat";

interface Step3Props {
  orcamento: Orcamento;
  onPrev: () => void;
  clienteId?: string;
  clienteNome: string;
  projetoNome: string;
  projetoId?: string;
  onUpdateAmbientes: (ambientes: Ambiente[]) => void;
  /** Phase 10 WIZ-03 (D-08): inicializa orcamentoId state quando o wizard é reaberto a partir de um rascunho — evita duplicate INSERT. */
  initialOrcamentoId?: string;
}

interface Violacao {
  ambienteId: string;
  ambienteNome: string;
  tipo: "luminaria" | "perfil" | "fita" | "driver";
  itemId: string;
  codigo: string;
  descricao: string;
  precoUnitario: number;
  precoMinimo: number;
}

// ─── Sub-componente local: input numérico inline com estado local + flush on-blur (D-34) ───
interface EditableNumericCellProps {
  value: number;
  onCommit: (next: number) => void;
  mode: "integer" | "decimal";
  min?: number;
  className?: string;
  ariaLabel?: string;
}

function EditableNumericCell({ value, onCommit, mode, min, className, ariaLabel }: EditableNumericCellProps) {
  const [local, setLocal] = useState<string>(String(value));

  // Sync external mutations (e.g. handleAjustarPreco) para o input
  useEffect(() => { setLocal(String(value)); }, [value]);

  const handleBlur = () => {
    const raw = mode === "integer" ? parseInt(local, 10) : parseFloat(local);
    const fallback = mode === "integer" ? (min ?? 1) : (min ?? 0);
    const clampMin = min ?? (mode === "integer" ? 1 : 0);
    const next = Number.isFinite(raw) ? Math.max(clampMin, raw) : fallback;
    if (next !== value) onCommit(next);
    setLocal(String(next));
  };

  return (
    <Input
      type="number"
      step={mode === "integer" ? "1" : "0.01"}
      min={min ?? (mode === "integer" ? 1 : 0)}
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
      onFocus={(e) => e.target.select()}
      className={className ?? "w-20 text-right ml-auto"}
      aria-label={ariaLabel}
    />
  );
}

// Helper local para converter asset Vite-imported (logo) — fetch de URL externa
// (thumbnails de produtos) usa src/lib/pdfImages.ts via inlineImagensSnapshot.
async function imageToBase64(src: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext("2d")!.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = src;
  });
}

const Step3Revisao = ({ orcamento, onPrev, clienteId, clienteNome, projetoNome, projetoId, onUpdateAmbientes, initialOrcamentoId }: Step3Props) => {
  const { dados, ambientes } = orcamento;
  const { user } = useAuth();
  const { colaborador } = useColaborador();
  const [approvedExceptions, setApprovedExceptions] = useState<Set<string>>(new Set());
  const [pendingExceptionIds, setPendingExceptionIds] = useState<Record<string, string>>({});
  const [chatOpen, setChatOpen] = useState(false);
  const [chatViolacao, setChatViolacao] = useState<Violacao | null>(null);
  const [chatExceptionId, setChatExceptionId] = useState("");
  const [orcamentoId, setOrcamentoId] = useState<string | null>(null);

  // WIZ-03 (D-08): inicializa orcamentoId com o id do rascunho reaberto para evitar duplicate INSERT
  useEffect(() => {
    if (initialOrcamentoId) setOrcamentoId(initialOrcamentoId);
    // Intencional: rodar apenas no mount. Mudança subsequente de initialOrcamentoId seria edge case
    // (parent reabriria outro rascunho sem desmontar — não acontece no fluxo atual).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [savingOrcamento, setSavingOrcamento] = useState(false);
  const pdfInFlightRef = useRef(false);

  const gruposFita = useMemo(() => calcularRolosPorGrupo(ambientes), [ambientes]);
  const resumoDrivers = useMemo(() => calcularDriversPorProjeto(ambientes), [ambientes]);
  const totalGeral = useMemo(() => calcularTotalGeral(ambientes), [ambientes]);

  // UX-05: checklist pré-PDF derivado dos ambientes
  const checklistIssues = useMemo(() => detectarChecklistIssues(ambientes), [ambientes]);
  const temErroBloqueante = checklistIssues.some((i) => i.level === 'error');

  // WIZ-05 (D-23): coleta de códigos distintos para batch lookup de atributos ricos
  const allCodigos = useMemo(() => {
    const set = new Set<string>();
    for (const amb of ambientes) {
      for (const l of amb.luminarias) if (l.codigo) set.add(l.codigo);
      for (const sis of amb.sistemas) {
        if (sis.fita?.codigo) set.add(sis.fita.codigo);
        if (sis.driver?.codigo) set.add(sis.driver.codigo);
        if (sis.perfil?.codigo) set.add(sis.perfil.codigo);
      }
    }
    return Array.from(set).sort(); // sort garante estabilidade do queryKey (Pitfall 3)
  }, [ambientes]);

  // WIZ-05 (D-22, D-23): re-resolução de atributos por código — 1 query batch, staleTime 5min
  type AtributosEntry = { atributos: Record<string, unknown> | null; potencia_watts: number | null };
  const { data: atributosMap = {} } = useQuery<Record<string, AtributosEntry>>({
    queryKey: ["produtoAtributos", allCodigos],
    queryFn: async () => {
      if (allCodigos.length === 0) return {};
      const { data, error } = await supabase
        .from("product_variants")
        .select("codigo, atributos, potencia_watts")
        .in("codigo", allCodigos);
      if (error || !data) return {};
      const map: Record<string, AtributosEntry> = {};
      for (const row of data) {
        if (row.codigo) {
          map[row.codigo] = {
            atributos: (row.atributos as Record<string, unknown> | null) ?? null,
            potencia_watts: row.potencia_watts ?? null,
          };
        }
      }
      return map;
    },
    staleTime: 5 * 60 * 1000,
    enabled: allCodigos.length > 0,
  });

  // Helper local: resolve descrição rica de qualquer item com codigo (D-22 fallback = nome cru)
  const descricaoRica = (codigo: string, descricaoSnapshot: string, potenciaSnapshot?: number | null): string => {
    const lookup = atributosMap[codigo];
    return construirDescricaoRica({
      nome: descricaoSnapshot || codigo || "—",
      atributos: lookup?.atributos ?? null,
      potenciaWatts: lookup?.potencia_watts ?? potenciaSnapshot ?? null,
    });
  };

  // Detect violations
  const violacoes = useMemo(() => {
    const v: Violacao[] = [];
    ambientes.forEach((amb) => {
      amb.luminarias.forEach((item) => {
        if (item.precoMinimo > 0 && item.precoUnitario < item.precoMinimo) {
          v.push({ ambienteId: amb.id, ambienteNome: amb.nome, tipo: "luminaria", itemId: item.id, codigo: item.codigo, descricao: item.descricao, precoUnitario: item.precoUnitario, precoMinimo: item.precoMinimo });
        }
      });
      amb.sistemas.forEach((sis) => {
        if (sis.perfil && sis.perfil.precoMinimo > 0 && sis.perfil.precoUnitario < sis.perfil.precoMinimo) {
          v.push({ ambienteId: amb.id, ambienteNome: amb.nome, tipo: "perfil", itemId: sis.perfil.id, codigo: sis.perfil.codigo, descricao: sis.perfil.descricao, precoUnitario: sis.perfil.precoUnitario, precoMinimo: sis.perfil.precoMinimo });
        }
        if (sis.fita.precoMinimo > 0 && sis.fita.precoUnitario < sis.fita.precoMinimo) {
          v.push({ ambienteId: amb.id, ambienteNome: amb.nome, tipo: "fita", itemId: sis.fita.id, codigo: sis.fita.codigo, descricao: sis.fita.descricao, precoUnitario: sis.fita.precoUnitario, precoMinimo: sis.fita.precoMinimo });
        }
        if (sis.driver.precoMinimo > 0 && sis.driver.precoUnitario < sis.driver.precoMinimo) {
          v.push({ ambienteId: amb.id, ambienteNome: amb.nome, tipo: "driver", itemId: sis.driver.id, codigo: sis.driver.codigo, descricao: sis.driver.descricao, precoUnitario: sis.driver.precoUnitario, precoMinimo: sis.driver.precoMinimo });
        }
      });
    });
    return v;
  }, [ambientes]);

  const unresolvedViolacoes = violacoes.filter(
    (v) => !approvedExceptions.has(`${v.codigo}-${v.precoUnitario}`)
  );
  const hasUnresolved = unresolvedViolacoes.length > 0;

  useEffect(() => {
    if (!user) return;
    const fetchExceptions = async () => {
      const { data } = await supabase
        .from("price_exceptions")
        .select("id, produto_codigo, preco_solicitado, status")
        .eq("solicitante_id", user.id);
      if (!data) return;
      const approved = new Set<string>();
      const pending: Record<string, string> = {};
      data.forEach((ex: any) => {
        const key = `${ex.produto_codigo}-${ex.preco_solicitado}`;
        if (ex.status === "aprovado") approved.add(key);
        if (ex.status === "pendente") pending[key] = ex.id;
      });
      setApprovedExceptions(approved);
      setPendingExceptionIds(pending);
    };
    fetchExceptions();

    const channel = supabase
      .channel("step3-exceptions")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "price_exceptions" }, (payload) => {
        const ex = payload.new as any;
        const key = `${ex.produto_codigo}-${ex.preco_solicitado}`;
        if (ex.status === "aprovado") {
          setApprovedExceptions((prev) => new Set(prev).add(key));
          toast.success(`Exceção aprovada para ${ex.produto_codigo}!`);
        } else if (ex.status === "rejeitado") {
          setPendingExceptionIds((prev) => { const n = { ...prev }; delete n[key]; return n; });
          toast.info(`Exceção rejeitada para ${ex.produto_codigo}. Ajuste o preço.`);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const isViolacao = (codigo: string, precoUnitario: number, precoMinimo: number) =>
    precoMinimo > 0 && precoUnitario < precoMinimo && !approvedExceptions.has(`${codigo}-${precoUnitario}`);

  const handleAjustarPreco = (v: Violacao) => {
    const updated = ambientes.map((amb) => {
      if (amb.id !== v.ambienteId) return amb;
      if (v.tipo === "luminaria") {
        return { ...amb, luminarias: amb.luminarias.map((l) => l.id === v.itemId ? { ...l, precoUnitario: l.precoMinimo } : l) };
      }
      return {
        ...amb,
        sistemas: amb.sistemas.map((sis) => {
          if (v.tipo === "perfil" && sis.perfil?.id === v.itemId) return { ...sis, perfil: { ...sis.perfil, precoUnitario: sis.perfil.precoMinimo } };
          if (v.tipo === "fita" && sis.fita.id === v.itemId) return { ...sis, fita: { ...sis.fita, precoUnitario: sis.fita.precoMinimo } };
          if (v.tipo === "driver" && sis.driver.id === v.itemId) return { ...sis, driver: { ...sis.driver, precoUnitario: sis.driver.precoMinimo } };
          return sis;
        }),
      };
    });
    onUpdateAmbientes(updated);
    toast.success(`Preço ajustado para ${formatarMoeda(v.precoMinimo)}`);
  };

  // WIZ-02 — Edita quantidade de uma luminária
  const handleEditQuantidade = (ambienteId: string, itemId: string, nova: number) => {
    const updated = ambientes.map((amb) => {
      if (amb.id !== ambienteId) return amb;
      return {
        ...amb,
        luminarias: amb.luminarias.map((l) =>
          l.id === itemId ? { ...l, quantidade: Math.max(1, Math.floor(nova)) } : l
        ),
      };
    });
    onUpdateAmbientes(updated);
  };

  // WIZ-01 — Edita preço unitário de uma luminária
  const handleEditPrecoLuminaria = (ambienteId: string, itemId: string, novo: number) => {
    const updated = ambientes.map((amb) => {
      if (amb.id !== ambienteId) return amb;
      return {
        ...amb,
        luminarias: amb.luminarias.map((l) =>
          l.id === itemId ? { ...l, precoUnitario: Math.max(0, novo) } : l
        ),
      };
    });
    onUpdateAmbientes(updated);
  };

  // WIZ-01 — Edita preço unitário da fita de um sistema
  const handleEditPrecoFita = (ambienteId: string, sistemaId: string, novo: number) => {
    const updated = ambientes.map((amb) => {
      if (amb.id !== ambienteId) return amb;
      return {
        ...amb,
        sistemas: amb.sistemas.map((sis) =>
          sis.id === sistemaId
            ? { ...sis, fita: { ...sis.fita, precoUnitario: Math.max(0, novo) } }
            : sis
        ),
      };
    });
    onUpdateAmbientes(updated);
  };

  // WIZ-01 — Edita preço unitário do perfil de um sistema
  const handleEditPrecoPerfil = (ambienteId: string, sistemaId: string, novo: number) => {
    const updated = ambientes.map((amb) => {
      if (amb.id !== ambienteId) return amb;
      return {
        ...amb,
        sistemas: amb.sistemas.map((sis) => {
          if (sis.id !== sistemaId || !sis.perfil) return sis;
          return { ...sis, perfil: { ...sis.perfil, precoUnitario: Math.max(0, novo) } };
        }),
      };
    });
    onUpdateAmbientes(updated);
  };

  // WIZ-01 — Edita preço unitário do driver de um sistema
  const handleEditPrecoDriver = (ambienteId: string, sistemaId: string, novo: number) => {
    const updated = ambientes.map((amb) => {
      if (amb.id !== ambienteId) return amb;
      return {
        ...amb,
        sistemas: amb.sistemas.map((sis) =>
          sis.id === sistemaId
            ? { ...sis, driver: { ...sis.driver, precoUnitario: Math.max(0, novo) } }
            : sis
        ),
      };
    });
    onUpdateAmbientes(updated);
  };

  const handleSolicitarExcecao = async (v: Violacao) => {
    const key = `${v.codigo}-${v.precoUnitario}`;
    if (pendingExceptionIds[key]) {
      setChatViolacao(v); setChatExceptionId(pendingExceptionIds[key]); setChatOpen(true);
      return;
    }
    if (!user) return;
    const userName = user.user_metadata?.nome || user.user_metadata?.name || user.email?.split("@")[0] || "Vendedor";
    const { data, error } = await supabase.from("price_exceptions").insert({
      projeto_id: projetoId || null, solicitante_id: user.id, produto_codigo: v.codigo,
      produto_descricao: v.descricao, preco_solicitado: v.precoUnitario, preco_minimo: v.precoMinimo,
    }).select("id").single();
    if (error) { toast.error("Erro ao criar solicitação"); return; }
    await supabase.from("exception_messages").insert({
      exception_id: data.id, user_id: user.id, user_name: userName,
      content: `Solicito exceção de preço para ${v.codigo} (${v.descricao}). Preço solicitado: ${formatarMoeda(v.precoUnitario)}, preço mínimo: ${formatarMoeda(v.precoMinimo)}.`,
    });
    setPendingExceptionIds((prev) => ({ ...prev, [key]: data.id }));
    setChatViolacao(v); setChatExceptionId(data.id); setChatOpen(true);
    toast.success("Solicitação enviada!");
  };

  const persistirOrcamento = async (): Promise<string | null> => {
    if (!clienteId) {
      toast.warning("Orçamento não salvo: cliente não identificado.");
      return null;
    }
    if (!colaborador?.id) {
      toast.warning("Orçamento não salvo: seu usuário não está vinculado a um colaborador. Peça a um admin para criar seu registro em Colaboradores.");
      return null;
    }
    setSavingOrcamento(true);
    // Supabase column is jsonb; Ambiente[] is JSON-serializable so this cast is safe.
    const ambientesJson = ambientes as unknown as Json;
    // Phase 22: resolver versão do template uma vez para consistência writer↔persist.
    const templateVersion = resolverTemplateVersion(ambientes);
    try {
      if (orcamentoId) {
        const { error } = await supabase
          .from("orcamentos")
          .update({
            tipo: dados.tipo || null,
            ambientes: ambientesJson,
            valor: totalGeral,
            pdf_template_version: templateVersion,
          })
          .eq("id", orcamentoId);
        if (error) throw error;
        return orcamentoId;
      }
      const { data, error } = await supabase
        .from("orcamentos")
        .insert({
          cliente_id: clienteId,
          colaborador_id: colaborador.id,
          projeto_id: projetoId || null,
          tipo: dados.tipo || null,
          ambientes: ambientesJson,
          valor: totalGeral,
          status: "rascunho" satisfies StatusOrcamento,
          pdf_template_version: templateVersion,
        })
        .select("id")
        .single();
      if (error) throw error;
      setOrcamentoId(data.id);
      return data.id;
    } catch (err) {
      console.error("Erro ao salvar orçamento:", err);
      toast.error("Não foi possível salvar o orçamento no histórico. O PDF será gerado mesmo assim.");
      return null;
    } finally {
      setSavingOrcamento(false);
    }
  };

  const carregarLogoBase64 = async (): Promise<string | undefined> => {
    try {
      const logoModule = await import("@/assets/logo.png");
      return await imageToBase64(logoModule.default);
    } catch {
      return undefined;
    }
  };

  const sanitizarNomeArquivo = (s: string) =>
    s.replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, "_").slice(0, 60) || "Orcamento";

  const handlePDF = async () => {
    // Guarda sincrona contra double-click: setSavingOrcamento é assincrono e
    // nao bloqueia um segundo clique disparado na mesma render.
    if (pdfInFlightRef.current) return;
    pdfInFlightRef.current = true;
    try {
      // Phase 5: pre-resolver fontes + imagens antes de rasterizar (Pitfalls 1 e 2 do RESEARCH).
      const { ensureFontsReady } = await import("@/lib/pdfFonts");
      const { inlineImagensSnapshot } = await import("@/lib/pdfImages");
      const [, logoBase64, ambientesInline] = await Promise.all([
        persistirOrcamento(),
        carregarLogoBase64(),
        inlineImagensSnapshot(ambientes),
      ]);
      await ensureFontsReady();

      const html = await gerarOrcamentoHtml({
        clienteNome,
        projetoNome,
        colaborador: dados.colaborador,
        tipo: dados.tipo,
        ambientes: ambientesInline,
        logoBase64,
        templateVersion: resolverTemplateVersion(ambientesInline),
      });

      // Renderiza o HTML num container oculto e converte para PDF download via html2pdf.
      const container = document.createElement("div");
      container.style.position = "fixed";
      container.style.left = "-10000px";
      container.style.top = "0";
      container.innerHTML = html;
      document.body.appendChild(container);

      // Aguarda todas as <img> carregarem antes de rasterizar (fix: timing issue onde
      // html2canvas captura antes do browser decodificar as data: URLs).
      // img.decode() resolve quando a imagem está pronta para exibição; fallback para
      // onload/onerror quando decode() não está disponível (Safari < 14).
      await Promise.all(
        Array.from(container.querySelectorAll("img")).map((img) =>
          img.complete
            ? Promise.resolve()
            : img.decode
              ? img.decode().catch(() => {})
              : new Promise<void>((res) => {
                  img.onload = () => res();
                  img.onerror = () => res();
                })
        )
      );

      const filename = `Proposta_${sanitizarNomeArquivo(clienteNome)}_${sanitizarNomeArquivo(projetoNome)}.pdf`;
      const html2pdf = (await import("html2pdf.js")).default;

      try {
        await html2pdf()
          .from(container.querySelector(".page") || container)
          .set({
            filename,
            margin: 0,
            // q92: ~⅓ menos peso que 0.98 com diferença visual imperceptível (scale 2 mantém a nitidez).
            image: { type: "jpeg", quality: 0.92 },
            html2canvas: { scale: 2, useCORS: true, logging: false },
            jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
            pagebreak: { mode: ["css", "legacy"] },
          })
          .save();
        toast.success("PDF baixado!");
      } finally {
        document.body.removeChild(container);
      }
    } catch (err) {
      console.error("Erro ao gerar PDF:", err);
      toast.error("Não foi possível gerar o PDF. Tente novamente.");
    } finally {
      pdfInFlightRef.current = false;
    }
  };

  const violacaoIndicator = (codigo: string, precoUnitario: number, precoMinimo: number) =>
    isViolacao(codigo, precoUnitario, precoMinimo) ? <AlertTriangle className="h-3.5 w-3.5 text-destructive inline ml-1" /> : null;

  return (
    <div className="space-y-6">
      {/* UX-05: Painel "Verificação pré-PDF" — sempre visível, primeiro elemento */}
      <Card className="border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            {checklistIssues.length === 0 ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            ) : (
              <AlertTriangle className={cn("h-4 w-4", temErroBloqueante ? "text-destructive" : "text-yellow-600")} />
            )}
            Verificação pré-PDF
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-1">
          {checklistIssues.length === 0 ? (
            <p className="text-sm text-muted-foreground">Tudo certo! Nenhum item suspeito encontrado.</p>
          ) : (
            checklistIssues.map((issue) => (
              <div key={issue.id} className="flex items-center justify-between gap-3 py-1">
                <div className="flex items-center gap-2">
                  <span>{issue.level === 'error' ? '🔴' : '🟡'}</span>
                  <span className="text-sm text-foreground">{issue.mensagem}</span>
                </div>
                <Button variant="link" size="sm" className="h-auto p-0 text-xs text-primary" onClick={onPrev}>
                  corrigir
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <div>
        <h2 className="text-2xl font-bold text-foreground">Revisão do Orçamento</h2>
        <p className="text-muted-foreground">Confira todos os dados antes de gerar o PDF.</p>
      </div>

      {/* Violation banner */}
      {hasUnresolved && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Atenção: {unresolvedViolacoes.length} item(ns) abaixo do preço mínimo</AlertTitle>
          <AlertDescription>
            <p className="mb-2">Ajuste os preços ou solicite exceção antes de gerar o PDF.</p>
            <div className="space-y-1">
              {unresolvedViolacoes.map((v) => {
                const key = `${v.codigo}-${v.precoUnitario}`;
                const hasPending = !!pendingExceptionIds[key];
                return (
                  <div key={`${v.ambienteId}-${v.itemId}`} className="flex items-center gap-2 flex-wrap text-sm">
                    <span className="font-mono">{v.codigo}</span>
                    <span className="text-muted-foreground">—</span>
                    <span>{v.ambienteNome}</span>
                    <span className="text-muted-foreground">|</span>
                    <span className="font-medium text-destructive">{formatarMoeda(v.precoUnitario)}</span>
                    <span className="text-muted-foreground">(mín: {formatarMoeda(v.precoMinimo)})</span>
                    <Button size="sm" variant="outline" className="h-6 text-xs" onClick={() => handleAjustarPreco(v)}>Ajustar Preço</Button>
                    <Button size="sm" variant="outline" className="h-6 text-xs gap-1" onClick={() => handleSolicitarExcecao(v)}>
                      <MessageSquare className="h-3 w-3" />{hasPending ? "Ver Chat" : "Solicitar Exceção"}
                    </Button>
                    {hasPending && <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300 text-xs">Pendente</Badge>}
                  </div>
                );
              })}
            </div>
          </AlertDescription>
        </Alert>
      )}

      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <h3 className="mb-3 text-lg font-semibold">Dados Gerais</h3>
        <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
          <div><span className="text-muted-foreground">Tipo:</span> <span className="font-medium">{dados.tipo}</span></div>
        </div>
      </div>

      {/* ─── Ambientes ─── */}
      {ambientes.map((amb) => (
        <div key={amb.id} className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <div className="bg-primary/5 px-5 py-3 border-b flex items-center justify-between">
            <h3 className="text-lg font-semibold text-foreground">{amb.nome}</h3>
            <span className="text-sm font-semibold text-primary">{formatarMoeda(calcularTotalAmbienteSemFita(amb))}</span>
          </div>
          <div className="p-5 space-y-5">
            {/* Luminárias */}
            {amb.luminarias.length > 0 && (
              <div>
                <h4 className="mb-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">Luminárias</h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="text-right">Qtd</TableHead>
                      <TableHead className="text-right">Preço Un.</TableHead>
                      <TableHead className="text-right">Subtotal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {amb.luminarias.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono">{item.codigo}</TableCell>
                        <TableCell>{descricaoRica(item.codigo, item.descricao, (item as any).potencia_watts)}</TableCell>
                        <TableCell className="text-right">
                          <EditableNumericCell
                            value={item.quantidade}
                            onCommit={(v) => handleEditQuantidade(amb.id, item.id, v)}
                            mode="integer"
                            ariaLabel={`Quantidade ${item.codigo}`}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <EditableNumericCell
                              value={item.precoUnitario}
                              onCommit={(v) => handleEditPrecoLuminaria(amb.id, item.id, v)}
                              mode="decimal"
                              ariaLabel={`Preço unitário ${item.codigo}`}
                            />
                            {violacaoIndicator(item.codigo, item.precoUnitario, item.precoMinimo)}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-semibold">{formatarMoeda(calcularSubtotalLuminaria(item))}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Sistemas */}
            {amb.sistemas.length > 0 && (
              <div>
                <h4 className="mb-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">Sistemas de Iluminação</h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Componente</TableHead>
                      <TableHead>Código</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="text-right">Detalhe</TableHead>
                      <TableHead className="text-right">Preço Un.</TableHead>
                      <TableHead className="text-right">Subtotal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {amb.sistemas.map((sis, si) => {
                      const demanda = calcularDemandaFita(sis);
                      const consumo = calcularConsumoW(sis);
                      const qtdDrv = calcularQtdDrivers(sis);
                      return (
                        <React.Fragment key={sis.id}>
                          {si > 0 && <TableRow><TableCell colSpan={6} className="py-1 bg-muted/30" /></TableRow>}
                          {/* Fita */}
                          <TableRow>
                            <TableCell><Badge variant="outline" className="text-xs bg-yellow-50">Fita</Badge></TableCell>
                            <TableCell className="font-mono">{sis.fita.codigo}</TableCell>
                            <TableCell>{descricaoRica(sis.fita.codigo, sis.fita.descricao)}</TableCell>
                            <TableCell className="text-right text-xs text-muted-foreground">{demanda}m | {sis.fita.wm}W/m | {consumo.toFixed(1)}W</TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <EditableNumericCell
                                  value={sis.fita.precoUnitario}
                                  onCommit={(v) => handleEditPrecoFita(amb.id, sis.id, v)}
                                  mode="decimal"
                                  ariaLabel={`Preço unitário fita ${sis.fita.codigo}`}
                                />
                                {violacaoIndicator(sis.fita.codigo, sis.fita.precoUnitario, sis.fita.precoMinimo)}
                              </div>
                            </TableCell>
                            <TableCell className="text-right text-xs text-muted-foreground italic">incluída no Resumo de Fitas</TableCell>
                          </TableRow>
                          {/* Perfil (se existir) */}
                          {sis.perfil && (
                            <TableRow>
                              <TableCell><Badge variant="outline" className="text-xs">Perfil</Badge></TableCell>
                              <TableCell className="font-mono">{sis.perfil.codigo}</TableCell>
                              <TableCell>{descricaoRica(sis.perfil.codigo, sis.perfil.descricao)}</TableCell>
                              <TableCell className="text-right text-xs text-muted-foreground">{sis.perfil.comprimentoPeca}m × {sis.perfil.quantidade} = {sis.perfil.comprimentoPeca * sis.perfil.quantidade}m | {sis.perfil.passadas} passada(s)</TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <EditableNumericCell
                                    value={sis.perfil.precoUnitario}
                                    onCommit={(v) => handleEditPrecoPerfil(amb.id, sis.id, v)}
                                    mode="decimal"
                                    ariaLabel={`Preço unitário perfil ${sis.perfil.codigo}`}
                                  />
                                  {violacaoIndicator(sis.perfil.codigo, sis.perfil.precoUnitario, sis.perfil.precoMinimo)}
                                </div>
                              </TableCell>
                              <TableCell className="text-right font-semibold">{formatarMoeda(calcularSubtotalPerfilSistema(sis))}</TableCell>
                            </TableRow>
                          )}
                          {/* Driver */}
                          <TableRow>
                            <TableCell><Badge variant="outline" className="text-xs">Driver</Badge></TableCell>
                            <TableCell className="font-mono">{sis.driver.codigo}</TableCell>
                            <TableCell>{descricaoRica(sis.driver.codigo, sis.driver.descricao)}</TableCell>
                            <TableCell className="text-right text-xs text-muted-foreground">{sis.driver.potencia}W | {sis.driver.voltagem}V | ×{qtdDrv}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <EditableNumericCell
                                  value={sis.driver.precoUnitario}
                                  onCommit={(v) => handleEditPrecoDriver(amb.id, sis.id, v)}
                                  mode="decimal"
                                  ariaLabel={`Preço unitário driver ${sis.driver.codigo}`}
                                />
                                {violacaoIndicator(sis.driver.codigo, sis.driver.precoUnitario, sis.driver.precoMinimo)}
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-semibold">{formatarMoeda(calcularSubtotalDriverSistema(sis))}</TableCell>
                          </TableRow>
                        </React.Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}

            {amb.luminarias.length === 0 && amb.sistemas.length === 0 && (
              <p className="text-sm text-muted-foreground italic">Nenhum item neste ambiente.</p>
            )}
          </div>
        </div>
      ))}

      {/* ─── Resumo Global de Fitas ─── */}
      {gruposFita.length > 0 && (
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <div className="bg-accent/30 px-5 py-3 border-b">
            <h3 className="text-lg font-semibold text-foreground">Resumo Global de Fitas LED</h3>
            <p className="text-xs text-muted-foreground">Cálculo otimizado de rolos para todo o projeto</p>
          </div>
          <div className="p-5">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Demanda (m)</TableHead>
                  <TableHead className="text-right">Rolos Sugeridos</TableHead>
                  <TableHead className="text-right">Preço Un.</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {gruposFita.map((g) => (
                  <TableRow key={g.codigo}>
                    <TableCell className="font-mono">{g.codigo}</TableCell>
                    <TableCell>
                      <div>{g.descricao}</div>
                      {g.localBreakdown && g.localBreakdown.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {g.localBreakdown.map((lb, i) => (
                            <Badge key={i} variant="outline" className="text-[10px] font-normal text-muted-foreground">
                              {lb.label} · {lb.demanda}m
                            </Badge>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">{g.demandaTotal}m</TableCell>
                    <TableCell className="text-right">
                      {g.rolos.map((r, i) => (
                        <span key={i} className="inline-block mr-1">
                          <Badge variant="secondary" className="text-xs">{r.quantidade}×{r.tamanho}m</Badge>
                        </span>
                      ))}
                      <span className="text-xs text-muted-foreground ml-1">({g.qtdRolosTotal} rolos)</span>
                    </TableCell>
                    <TableCell className="text-right">{formatarMoeda(g.precoUnitario)}</TableCell>
                    <TableCell className="text-right font-semibold">{formatarMoeda(g.subtotal)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* ─── Análise de Otimização de Drivers (Regra 26) — interno ─── */}
      {resumoDrivers.length > 0 && (
        <Collapsible defaultOpen={false}>
          <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
            <CollapsibleTrigger className="w-full text-left">
              <div className="bg-muted/50 px-5 py-3 border-b flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                    Análise de Otimização de Drivers
                    <Badge variant="outline" className="text-xs">interno</Badge>
                  </h3>
                  <p className="text-xs text-muted-foreground">Ferramenta de análise — não aparece no PDF do cliente</p>
                </div>
                <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="p-5">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Driver</TableHead>
                      <TableHead className="text-right">Consumo Total</TableHead>
                      <TableHead className="text-right">Extensão Total</TableHead>
                      <TableHead className="text-right">Qtd Global</TableHead>
                      <TableHead className="text-right">Soma p/ Ambiente</TableHead>
                      <TableHead className="text-right">Economia Potencial</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {resumoDrivers.map((d) => (
                      <TableRow key={`${d.driverCodigo}-${d.voltagem}`}>
                        <TableCell>
                          <div className="font-mono text-xs">{d.driverCodigo} · {d.voltagem}V</div>
                          <div className="text-xs text-muted-foreground">{d.driverDescricao} ({d.potenciaDriverW}W)</div>
                        </TableCell>
                        <TableCell className="text-right">{d.totalConsumoW.toFixed(1)}W</TableCell>
                        <TableCell className="text-right">{d.totalDemandaM}m{d.limiteExtensaoM ? ` / ${d.limiteExtensaoM}m por driver` : ''}</TableCell>
                        <TableCell className="text-right font-semibold">{d.qtdGlobal}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{d.qtdSomaIndividual}</TableCell>
                        <TableCell className="text-right">
                          {d.economiaDrivers > 0 ? (
                            <Badge variant="secondary" className="text-xs">−{d.economiaDrivers} driver{d.economiaDrivers > 1 ? 's' : ''}</Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <p className="text-xs text-muted-foreground mt-3">
                  ⚡ <strong>Qtd Global</strong>: dimensionamento agregado considerando todos os ambientes como um único circuito.
                  Compare com a soma por ambiente para identificar onde dá pra economizar drivers compartilhando entre ambientes adjacentes.
                </p>
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>
      )}

      {/* Total Geral */}
      <div className="rounded-xl border bg-card p-5 shadow-sm flex items-center justify-between">
        <h3 className="text-xl font-bold text-foreground">Total Geral</h3>
        <span className="text-2xl font-bold text-primary">{formatarMoeda(totalGeral)}</span>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
        <Button variant="outline" onClick={onPrev} className="gap-2 print:hidden">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Button>
        <Button onClick={handlePDF} className="gap-2 print:hidden"
          disabled={hasUnresolved || savingOrcamento || temErroBloqueante}
          title={temErroBloqueante ? "Corrija a fita sem metragem (0m) antes de gerar o PDF" : (hasUnresolved ? "Resolva as violações de preço antes de gerar o PDF" : "")}>
          <FileDown className="h-4 w-4" /> {savingOrcamento ? "Salvando..." : "Gerar PDF"}
        </Button>
      </div>

      {chatViolacao && (
        <ExceptionChat
          open={chatOpen} onOpenChange={setChatOpen} exceptionId={chatExceptionId}
          produtoCodigo={chatViolacao.codigo} produtoDescricao={chatViolacao.descricao}
          precoSolicitado={chatViolacao.precoUnitario} precoMinimo={chatViolacao.precoMinimo}
          ambienteNome={chatViolacao.ambienteNome}
          onStatusChange={(status) => {
            if (status === "aprovado") setApprovedExceptions((prev) => new Set(prev).add(`${chatViolacao.codigo}-${chatViolacao.precoUnitario}`));
          }}
        />
      )}
    </div>
  );
};

export default Step3Revisao;
