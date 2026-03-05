import React, { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, FileDown, AlertTriangle, MessageSquare } from "lucide-react";
import type { Orcamento, Ambiente, SistemaIluminacao, GrupoFita } from "@/types/orcamento";
import {
  calcularDemandaFita, calcularConsumoW, calcularQtdDrivers,
  calcularSubtotalLuminaria, calcularSubtotalPerfilSistema, calcularSubtotalDriverSistema,
  calcularSubtotalSistemaSemFita, calcularTotalAmbienteSemFita, calcularRolosPorGrupo,
  calcularTotalGeral, formatarMoeda
} from "@/types/orcamento";
import { toast } from "sonner";
import { gerarOrcamentoHtml } from "@/lib/gerarPdfHtml";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import ExceptionChat from "./ExceptionChat";

interface Step3Props {
  orcamento: Orcamento;
  onPrev: () => void;
  clienteNome: string;
  projetoNome: string;
  projetoId?: string;
  onUpdateAmbientes: (ambientes: Ambiente[]) => void;
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

const Step3Revisao = ({ orcamento, onPrev, clienteNome, projetoNome, projetoId, onUpdateAmbientes }: Step3Props) => {
  const { dados, ambientes } = orcamento;
  const { user } = useAuth();
  const [approvedExceptions, setApprovedExceptions] = useState<Set<string>>(new Set());
  const [pendingExceptionIds, setPendingExceptionIds] = useState<Record<string, string>>({});
  const [chatOpen, setChatOpen] = useState(false);
  const [chatViolacao, setChatViolacao] = useState<Violacao | null>(null);
  const [chatExceptionId, setChatExceptionId] = useState("");

  const gruposFita = useMemo(() => calcularRolosPorGrupo(ambientes), [ambientes]);
  const totalGeral = calcularTotalGeral(ambientes);

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

  const handlePDF = async () => {
    let logoBase64: string | undefined;
    try {
      const logoModule = await import("@/assets/logo.png");
      logoBase64 = await imageToBase64(logoModule.default);
    } catch { /* logo won't appear */ }
    const html = gerarOrcamentoHtml({ clienteNome, projetoNome, colaborador: dados.colaborador, tipo: dados.tipo, ambientes, logoBase64 });
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); } else { toast.error("Pop-up bloqueado. Permita pop-ups e tente novamente."); }
  };

  const violacaoIndicator = (codigo: string, precoUnitario: number, precoMinimo: number) =>
    isViolacao(codigo, precoUnitario, precoMinimo) ? <AlertTriangle className="h-3.5 w-3.5 text-destructive inline ml-1" /> : null;

  return (
    <div className="space-y-6">
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
                        <TableCell>{item.descricao}</TableCell>
                        <TableCell className="text-right">{item.quantidade}</TableCell>
                        <TableCell className="text-right">{formatarMoeda(item.precoUnitario)}{violacaoIndicator(item.codigo, item.precoUnitario, item.precoMinimo)}</TableCell>
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
                            <TableCell>{sis.fita.descricao}</TableCell>
                            <TableCell className="text-right text-xs text-muted-foreground">{demanda}m | {sis.fita.wm}W/m | {consumo.toFixed(1)}W</TableCell>
                            <TableCell className="text-right">{formatarMoeda(sis.fita.precoUnitario)}{violacaoIndicator(sis.fita.codigo, sis.fita.precoUnitario, sis.fita.precoMinimo)}</TableCell>
                            <TableCell className="text-right text-xs text-muted-foreground italic">Global →</TableCell>
                          </TableRow>
                          {/* Perfil (se existir) */}
                          {sis.perfil && (
                            <TableRow>
                              <TableCell><Badge variant="outline" className="text-xs">Perfil</Badge></TableCell>
                              <TableCell className="font-mono">{sis.perfil.codigo}</TableCell>
                              <TableCell>{sis.perfil.descricao}</TableCell>
                              <TableCell className="text-right text-xs text-muted-foreground">{sis.perfil.comprimentoPeca}m × {sis.perfil.quantidade} = {sis.perfil.comprimentoPeca * sis.perfil.quantidade}m | {sis.perfil.passadas} passada(s)</TableCell>
                              <TableCell className="text-right">{formatarMoeda(sis.perfil.precoUnitario)}{violacaoIndicator(sis.perfil.codigo, sis.perfil.precoUnitario, sis.perfil.precoMinimo)}</TableCell>
                              <TableCell className="text-right font-semibold">{formatarMoeda(calcularSubtotalPerfilSistema(sis))}</TableCell>
                            </TableRow>
                          )}
                          {/* Driver */}
                          <TableRow>
                            <TableCell><Badge variant="outline" className="text-xs">Driver</Badge></TableCell>
                            <TableCell className="font-mono">{sis.driver.codigo}</TableCell>
                            <TableCell>{sis.driver.descricao}</TableCell>
                            <TableCell className="text-right text-xs text-muted-foreground">{sis.driver.potencia}W | {sis.driver.voltagem}V | ×{qtdDrv}</TableCell>
                            <TableCell className="text-right">{formatarMoeda(sis.driver.precoUnitario)}{violacaoIndicator(sis.driver.codigo, sis.driver.precoUnitario, sis.driver.precoMinimo)}</TableCell>
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
                    <TableCell>{g.descricao}</TableCell>
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

      {/* Total Geral */}
      <div className="rounded-xl border bg-card p-5 shadow-sm flex items-center justify-between">
        <h3 className="text-xl font-bold text-foreground">Total Geral</h3>
        <span className="text-2xl font-bold text-primary">{formatarMoeda(totalGeral)}</span>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
        <Button variant="outline" onClick={onPrev} className="gap-2 print:hidden">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Button>
        <Button onClick={handlePDF} className="gap-2 print:hidden" disabled={hasUnresolved} title={hasUnresolved ? "Resolva as violações de preço antes de gerar o PDF" : ""}>
          <FileDown className="h-4 w-4" /> Gerar PDF
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
