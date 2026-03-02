import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, FileDown, Pencil, Check, X, AlertTriangle, MessageSquare } from "lucide-react";
import type { Orcamento, Ambiente, ItemLuminaria, ItemPerfil, ItemFitaLED } from "@/types/orcamento";
import { calcularMetragemTotal, calcularWTotal, calcularQtdRolos, calcularSubtotalLuminaria, calcularSubtotalPerfil, calcularSubtotalFita, calcularTotalAmbiente, calcularTotalGeral, formatarMoeda } from "@/types/orcamento";
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

type EditingKey = { ambienteId: string; tipo: "luminaria" | "perfil" | "fita"; itemId: string } | null;

interface Violacao {
  ambienteId: string;
  ambienteNome: string;
  tipo: "luminaria" | "perfil" | "fita";
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
  const [editing, setEditing] = useState<EditingKey>(null);
  const [editValues, setEditValues] = useState<Record<string, number>>({});
  const [approvedExceptions, setApprovedExceptions] = useState<Set<string>>(new Set());
  const [pendingExceptionIds, setPendingExceptionIds] = useState<Record<string, string>>({});
  const [chatOpen, setChatOpen] = useState(false);
  const [chatViolacao, setChatViolacao] = useState<Violacao | null>(null);
  const [chatExceptionId, setChatExceptionId] = useState("");

  // Detect violations
  const violacoes = useMemo(() => {
    const v: Violacao[] = [];
    ambientes.forEach((amb) => {
      amb.luminarias.forEach((item) => {
        if (item.precoMinimo > 0 && item.precoUnitario < item.precoMinimo) {
          v.push({ ambienteId: amb.id, ambienteNome: amb.nome, tipo: "luminaria", itemId: item.id, codigo: item.codigo, descricao: item.descricao, precoUnitario: item.precoUnitario, precoMinimo: item.precoMinimo });
        }
      });
      amb.perfis.forEach((item) => {
        if (item.precoMinimo > 0 && item.precoUnitario < item.precoMinimo) {
          v.push({ ambienteId: amb.id, ambienteNome: amb.nome, tipo: "perfil", itemId: item.id, codigo: item.codigo, descricao: item.descricao, precoUnitario: item.precoUnitario, precoMinimo: item.precoMinimo });
        }
      });
      amb.fitasLed.forEach((item) => {
        if (item.precoMinimo > 0 && item.precoUnitario < item.precoMinimo) {
          v.push({ ambienteId: amb.id, ambienteNome: amb.nome, tipo: "fita", itemId: item.id, codigo: item.codigo, descricao: item.descricao, precoUnitario: item.precoUnitario, precoMinimo: item.precoMinimo });
        }
      });
    });
    return v;
  }, [ambientes]);

  // Unresolved = violations without approved exception
  const unresolvedViolacoes = violacoes.filter(
    (v) => !approvedExceptions.has(`${v.codigo}-${v.precoUnitario}`)
  );

  const hasUnresolved = unresolvedViolacoes.length > 0;

  // Check existing exceptions on mount
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

    // Realtime for status changes
    const channel = supabase
      .channel("step3-exceptions")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "price_exceptions" }, (payload) => {
        const ex = payload.new as any;
        const key = `${ex.produto_codigo}-${ex.preco_solicitado}`;
        if (ex.status === "aprovado") {
          setApprovedExceptions((prev) => new Set(prev).add(key));
          toast.success(`Exceção aprovada para ${ex.produto_codigo}!`);
        } else if (ex.status === "rejeitado") {
          setPendingExceptionIds((prev) => {
            const n = { ...prev };
            delete n[key];
            return n;
          });
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
      } else if (v.tipo === "perfil") {
        return { ...amb, perfis: amb.perfis.map((p) => p.id === v.itemId ? { ...p, precoUnitario: p.precoMinimo } : p) };
      }
      return { ...amb, fitasLed: amb.fitasLed.map((f) => f.id === v.itemId ? { ...f, precoUnitario: f.precoMinimo } : f) };
    });
    onUpdateAmbientes(updated);
    toast.success(`Preço ajustado para ${formatarMoeda(v.precoMinimo)}`);
  };

  const handleSolicitarExcecao = async (v: Violacao) => {
    const key = `${v.codigo}-${v.precoUnitario}`;
    // Already has pending exception?
    if (pendingExceptionIds[key]) {
      setChatViolacao(v);
      setChatExceptionId(pendingExceptionIds[key]);
      setChatOpen(true);
      return;
    }
    if (!user) return;
    const userName = user.user_metadata?.nome || user.user_metadata?.name || user.email?.split("@")[0] || "Vendedor";
    const { data, error } = await supabase.from("price_exceptions").insert({
      projeto_id: projetoId || null,
      solicitante_id: user.id,
      produto_codigo: v.codigo,
      produto_descricao: v.descricao,
      preco_solicitado: v.precoUnitario,
      preco_minimo: v.precoMinimo,
    }).select("id").single();
    if (error) {
      toast.error("Erro ao criar solicitação");
      return;
    }
    // Send initial message
    await supabase.from("exception_messages").insert({
      exception_id: data.id,
      user_id: user.id,
      user_name: userName,
      content: `Solicito exceção de preço para ${v.codigo} (${v.descricao}). Preço solicitado: ${formatarMoeda(v.precoUnitario)}, preço mínimo: ${formatarMoeda(v.precoMinimo)}.`,
    });
    setPendingExceptionIds((prev) => ({ ...prev, [key]: data.id }));
    setChatViolacao(v);
    setChatExceptionId(data.id);
    setChatOpen(true);
    toast.success("Solicitação enviada!");
  };

  const startEdit = (ambienteId: string, tipo: "luminaria" | "perfil" | "fita", item: ItemLuminaria | ItemPerfil | ItemFitaLED) => {
    setEditing({ ambienteId, tipo, itemId: item.id });
    if (tipo === "luminaria") {
      const i = item as ItemLuminaria;
      setEditValues({ quantidade: i.quantidade, precoUnitario: i.precoUnitario });
    } else if (tipo === "perfil") {
      const i = item as ItemPerfil;
      setEditValues({ metragem: i.metragem, quantidade: i.quantidade, precoUnitario: i.precoUnitario });
    } else {
      const i = item as ItemFitaLED;
      setEditValues({ passadas: i.passadas, wm: i.wm, metragemRolo: i.metragemRolo, precoUnitario: i.precoUnitario });
    }
  };

  const cancelEdit = () => { setEditing(null); setEditValues({}); };

  const confirmEdit = () => {
    if (!editing) return;
    const updated = ambientes.map((amb) => {
      if (amb.id !== editing.ambienteId) return amb;
      if (editing.tipo === "luminaria") {
        return { ...amb, luminarias: amb.luminarias.map((l) => l.id !== editing.itemId ? l : { ...l, quantidade: editValues.quantidade ?? l.quantidade, precoUnitario: editValues.precoUnitario ?? l.precoUnitario }) };
      } else if (editing.tipo === "perfil") {
        return { ...amb, perfis: amb.perfis.map((p) => p.id !== editing.itemId ? p : { ...p, metragem: editValues.metragem ?? p.metragem, quantidade: editValues.quantidade ?? p.quantidade, precoUnitario: editValues.precoUnitario ?? p.precoUnitario }) };
      }
      return { ...amb, fitasLed: amb.fitasLed.map((f) => f.id !== editing.itemId ? f : { ...f, passadas: editValues.passadas ?? f.passadas, wm: editValues.wm ?? f.wm, metragemRolo: editValues.metragemRolo ?? f.metragemRolo, precoUnitario: editValues.precoUnitario ?? f.precoUnitario }) };
    });
    onUpdateAmbientes(updated);
    setEditing(null);
    setEditValues({});
    toast.success("Item atualizado!");
  };

  const isEditing = (ambienteId: string, tipo: string, itemId: string) =>
    editing?.ambienteId === ambienteId && editing?.tipo === tipo && editing?.itemId === itemId;

  

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

  const editBtn = (ambienteId: string, tipo: "luminaria" | "perfil" | "fita", item: ItemLuminaria | ItemPerfil | ItemFitaLED) => (
    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(ambienteId, tipo, item)}>
      <Pencil className="h-3.5 w-3.5" />
    </Button>
  );

  const actionBtns = (
    <div className="flex gap-1">
      <Button variant="ghost" size="icon" className="h-7 w-7 text-green-600" onClick={confirmEdit}><Check className="h-4 w-4" /></Button>
      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={cancelEdit}><X className="h-4 w-4" /></Button>
    </div>
  );

  const numInput = (field: string, className?: string) => (
    <Input
      type="number"
      className={`h-7 w-20 text-right ${className ?? ""}`}
      value={editValues[field] ?? ""}
      onChange={(e) => {
        const raw = e.target.value;
        setEditValues((v) => ({ ...v, [field]: raw === "" ? 0 : (parseFloat(raw) || 0) }));
      }}
      onKeyDown={(e) => e.key === "Enter" && confirmEdit()}
    />
  );

  const violacaoRowClass = (codigo: string, precoUnitario: number, precoMinimo: number) =>
    isViolacao(codigo, precoUnitario, precoMinimo) ? "bg-destructive/5" : "";

  const violacaoIndicator = (codigo: string, precoUnitario: number, precoMinimo: number) =>
    isViolacao(codigo, precoUnitario, precoMinimo) ? <AlertTriangle className="h-3.5 w-3.5 text-destructive inline ml-1" /> : null;

  const totalGeral = calcularTotalGeral(ambientes);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Revisão do Orçamento</h2>
        <p className="text-muted-foreground">Confira todos os dados antes de enviar. Clique no <Pencil className="inline h-3.5 w-3.5" /> para editar valores.</p>
      </div>

      {/* Violation banner */}
      {hasUnresolved && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Atenção: {unresolvedViolacoes.length} item(ns) abaixo do preço mínimo</AlertTitle>
          <AlertDescription>
            <p className="mb-2">Ajuste os preços ou solicite exceção para cada item antes de gerar o PDF ou enviar por e-mail.</p>
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
                    <Button size="sm" variant="outline" className="h-6 text-xs" onClick={() => handleAjustarPreco(v)}>
                      Ajustar Preço
                    </Button>
                    <Button size="sm" variant="outline" className="h-6 text-xs gap-1" onClick={() => handleSolicitarExcecao(v)}>
                      <MessageSquare className="h-3 w-3" />
                      {hasPending ? "Ver Chat" : "Solicitar Exceção"}
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

      {ambientes.map((amb) => (
        <div key={amb.id} className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <div className="bg-primary/5 px-5 py-3 border-b flex items-center justify-between">
            <h3 className="text-lg font-semibold text-foreground">{amb.nome}</h3>
            <span className="text-sm font-semibold text-primary">{formatarMoeda(calcularTotalAmbiente(amb))}</span>
          </div>
          <div className="p-5 space-y-5">
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
                      <TableHead className="w-16" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {amb.luminarias.map((item) => {
                      const isEd = isEditing(amb.id, "luminaria", item.id);
                      const displayItem = isEd ? { ...item, quantidade: editValues.quantidade ?? item.quantidade, precoUnitario: editValues.precoUnitario ?? item.precoUnitario } : item;
                      return (
                        <TableRow key={item.id} className={violacaoRowClass(item.codigo, item.precoUnitario, item.precoMinimo)}>
                          <TableCell className="font-mono">{item.codigo}</TableCell>
                          <TableCell>{item.descricao}</TableCell>
                          <TableCell className="text-right">{isEd ? numInput("quantidade") : item.quantidade}</TableCell>
                          <TableCell className="text-right">
                            {isEd ? numInput("precoUnitario", "w-28") : <>{formatarMoeda(item.precoUnitario)}{violacaoIndicator(item.codigo, item.precoUnitario, item.precoMinimo)}</>}
                          </TableCell>
                          <TableCell className="text-right font-semibold">{formatarMoeda(calcularSubtotalLuminaria(displayItem))}</TableCell>
                          <TableCell className="text-right">{isEd ? actionBtns : editBtn(amb.id, "luminaria", item)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}

            {amb.perfis.length > 0 && (
              <div>
                <h4 className="mb-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">Perfil</h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="text-right">Metragem</TableHead>
                      <TableHead className="text-right">Qtd</TableHead>
                      <TableHead className="text-right">Total (m)</TableHead>
                      <TableHead className="text-right">Preço Un.</TableHead>
                      <TableHead className="text-right">Subtotal</TableHead>
                      <TableHead className="w-16" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {amb.perfis.map((item) => {
                      const isEd = isEditing(amb.id, "perfil", item.id);
                      const displayItem = isEd ? { ...item, metragem: editValues.metragem ?? item.metragem, quantidade: editValues.quantidade ?? item.quantidade, precoUnitario: editValues.precoUnitario ?? item.precoUnitario } : item;
                      return (
                        <TableRow key={item.id} className={violacaoRowClass(item.codigo, item.precoUnitario, item.precoMinimo)}>
                          <TableCell className="font-mono">{item.codigo}</TableCell>
                          <TableCell>{item.descricao}</TableCell>
                          <TableCell className="text-right">{isEd ? numInput("metragem") : item.metragem}</TableCell>
                          <TableCell className="text-right">{isEd ? numInput("quantidade") : item.quantidade}</TableCell>
                          <TableCell className="text-right font-semibold">{calcularMetragemTotal(displayItem).toFixed(2)}</TableCell>
                          <TableCell className="text-right">
                            {isEd ? numInput("precoUnitario", "w-28") : <>{formatarMoeda(item.precoUnitario)}{violacaoIndicator(item.codigo, item.precoUnitario, item.precoMinimo)}</>}
                          </TableCell>
                          <TableCell className="text-right font-semibold">{formatarMoeda(calcularSubtotalPerfil(displayItem))}</TableCell>
                          <TableCell className="text-right">{isEd ? actionBtns : editBtn(amb.id, "perfil", item)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}

            {amb.fitasLed.length > 0 && (
              <div>
                <h4 className="mb-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">Fita LED</h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="text-right">Passadas</TableHead>
                      <TableHead className="text-right">W/M</TableHead>
                      <TableHead className="text-right">W Total</TableHead>
                      <TableHead className="text-right">Rolo (m)</TableHead>
                      <TableHead className="text-right">Rolos</TableHead>
                      <TableHead className="text-right">Preço Un.</TableHead>
                      <TableHead className="text-right">Subtotal</TableHead>
                      <TableHead className="w-16" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {amb.fitasLed.map((item) => {
                      const isEd = isEditing(amb.id, "fita", item.id);
                      const displayItem = isEd ? { ...item, passadas: editValues.passadas ?? item.passadas, wm: editValues.wm ?? item.wm, metragemRolo: editValues.metragemRolo ?? item.metragemRolo, precoUnitario: editValues.precoUnitario ?? item.precoUnitario } : item;
                      return (
                        <TableRow key={item.id} className={violacaoRowClass(item.codigo, item.precoUnitario, item.precoMinimo)}>
                          <TableCell className="font-mono">{item.codigo}</TableCell>
                          <TableCell>{item.descricao}</TableCell>
                          <TableCell className="text-right">{isEd ? numInput("passadas") : item.passadas}</TableCell>
                          <TableCell className="text-right">{isEd ? numInput("wm") : item.wm}</TableCell>
                          <TableCell className="text-right">{calcularWTotal(displayItem).toFixed(1)}</TableCell>
                          <TableCell className="text-right">{isEd ? numInput("metragemRolo") : item.metragemRolo}</TableCell>
                          <TableCell className="text-right font-semibold">{calcularQtdRolos(displayItem)}</TableCell>
                          <TableCell className="text-right">
                            {isEd ? numInput("precoUnitario", "w-28") : <>{formatarMoeda(item.precoUnitario)}{violacaoIndicator(item.codigo, item.precoUnitario, item.precoMinimo)}</>}
                          </TableCell>
                          <TableCell className="text-right font-semibold">{formatarMoeda(calcularSubtotalFita(displayItem))}</TableCell>
                          <TableCell className="text-right">{isEd ? actionBtns : editBtn(amb.id, "fita", item)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}

            {amb.luminarias.length === 0 && amb.perfis.length === 0 && amb.fitasLed.length === 0 && (
              <p className="text-sm text-muted-foreground italic">Nenhum item neste ambiente.</p>
            )}
          </div>
        </div>
      ))}

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

      {/* Chat dialog */}
      {chatViolacao && (
        <ExceptionChat
          open={chatOpen}
          onOpenChange={setChatOpen}
          exceptionId={chatExceptionId}
          produtoCodigo={chatViolacao.codigo}
          produtoDescricao={chatViolacao.descricao}
          precoSolicitado={chatViolacao.precoUnitario}
          precoMinimo={chatViolacao.precoMinimo}
          ambienteNome={chatViolacao.ambienteNome}
          onStatusChange={(status) => {
            if (status === "aprovado") {
              setApprovedExceptions((prev) => new Set(prev).add(`${chatViolacao.codigo}-${chatViolacao.precoUnitario}`));
            }
          }}
        />
      )}
    </div>
  );
};

export default Step3Revisao;
