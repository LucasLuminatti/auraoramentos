import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, FileDown, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { gerarOrcamentoHtml, type PdfParams } from "@/lib/gerarPdfHtml";
import logo from "@/assets/logo.png";
import type { Ambiente } from "@/types/orcamento";
import {
  calcularTotalGeral,
  calcularTotalAmbienteSemFita,
  calcularSubtotalLuminaria,
  formatarMoeda,
} from "@/types/orcamento";

interface OrcamentoFull {
  id: string;
  data: string;
  valor: number;
  status: string;
  tipo: string;
  ambientes: Ambiente[];
  motivo_perda: string | null;
  fechado_at: string | null;
  created_at: string;
  pdf_template_version: number | null;
  clientes: {
    nome: string;
    email: string | null;
    telefone: string | null;
    contato: string | null;
    cpf_cnpj: string | null;
    arquitetos: { nome: string; contato: string | null } | null;
  } | null;
  colaboradores: { nome: string } | null;
  projetos: { nome: string } | null;
}

interface ExceptionRow {
  id: string;
  produto_codigo: string;
  produto_descricao: string;
  preco_solicitado: number;
  preco_minimo: number;
  status: string;
  created_at: string;
}

const statusLabel = (s: string) => {
  switch (s) {
    case "rascunho": return "Rascunho";
    case "pendente": return "Pendente";
    case "aprovado": return "Aprovado";
    case "perdido": return "Perdido";
    default: return s;
  }
};

const statusClass = (s: string) => {
  switch (s) {
    case "rascunho": return "bg-muted text-muted-foreground";
    case "pendente": return "bg-yellow-100 text-yellow-800";
    case "aprovado": return "bg-emerald-100 text-emerald-800";
    case "perdido": return "bg-red-100 text-red-800";
    default: return "bg-muted text-muted-foreground";
  }
};

const exceptionStatusClass = (s: string) => {
  switch (s) {
    case "aprovado": return "bg-green-100 text-green-800";
    case "rejeitado": return "bg-red-100 text-red-800";
    case "pendente": return "bg-yellow-100 text-yellow-800";
    default: return "bg-muted text-muted-foreground";
  }
};

const OrcamentoDetalhe = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [orc, setOrc] = useState<OrcamentoFull | null>(null);
  const [exceptions, setExceptions] = useState<ExceptionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [logoBase64, setLogoBase64] = useState<string>("");
  const [gerando, setGerando] = useState(false);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("orcamentos")
        .select(`
          id, data, valor, status, tipo, ambientes, motivo_perda, fechado_at, created_at, pdf_template_version,
          clientes ( nome, email, telefone, contato, cpf_cnpj,
            arquitetos ( nome, contato )
          ),
          colaboradores ( nome ),
          projetos ( nome )
        `)
        .eq("id", id)
        .single();

      if (error || !data) {
        toast.error("Erro ao carregar orçamento");
        setLoading(false);
        return;
      }

      // Pitfall 8: ambientes pode ter campos faltando em snapshots antigos.
      const ambientesParsed = Array.isArray(data.ambientes)
        ? (data.ambientes as unknown as Ambiente[])
        : [];

      setOrc({ ...(data as unknown as OrcamentoFull), ambientes: ambientesParsed });

      const { data: exData } = await supabase
        .from("price_exceptions")
        .select("id, produto_codigo, produto_descricao, preco_solicitado, preco_minimo, status, created_at")
        .eq("orcamento_id", id)
        .order("created_at", { ascending: true });

      setExceptions((exData ?? []) as ExceptionRow[]);
      setLoading(false);
    };
    load();
  }, [id]);

  // Carrega logo em base64 para o PDF (mesmo padrão usado no Step3 / Index).
  useEffect(() => {
    fetch(logo)
      .then((r) => r.blob())
      .then((b) => {
        const reader = new FileReader();
        reader.onloadend = () => setLogoBase64(reader.result as string);
        reader.readAsDataURL(b);
      })
      .catch(() => {});
  }, []);

  const sanitizarNomeArquivo = (nome: string) =>
    (nome || "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9]/g, "_")
      .replace(/_+/g, "_");

  const handleReemitirPdf = async () => {
    if (!orc) return;
    setGerando(true);
    const container = document.createElement("div");
    let appended = false;
    try {
      // Phase 5: pre-resolver fontes + imagens antes de rasterizar (Pitfalls 1 e 2 do RESEARCH).
      const { ensureFontsReady } = await import("@/lib/pdfFonts");
      const { inlineImagensSnapshot } = await import("@/lib/pdfImages");
      const ambientesInline = await inlineImagensSnapshot(orc.ambientes ?? []);
      await ensureFontsReady();

      const params: PdfParams = {
        clienteNome: orc.clientes?.nome ?? "—",
        projetoNome: orc.projetos?.nome ?? "—",
        colaborador: orc.colaboradores?.nome ?? "—",
        tipo: orc.tipo,
        ambientes: ambientesInline,
        logoBase64: logoBase64 || undefined,
        // PDF-05: rows criadas antes da Phase 5 têm pdf_template_version NULL — coage para 1 (legacy).
        // Rows criadas pela Phase 5 em diante têm 2 explicitamente persistido em Step3Revisao.
        templateVersion: orc.pdf_template_version ?? 1,
      };
      const html = await gerarOrcamentoHtml(params);

      // Mesmo padrão usado em Step3Revisao.tsx — render off-screen + html2pdf.
      container.style.position = "fixed";
      container.style.left = "-10000px";
      container.style.top = "0";
      container.innerHTML = html;
      document.body.appendChild(container);
      appended = true;

      const filename = `Proposta_${sanitizarNomeArquivo(params.clienteNome)}_${sanitizarNomeArquivo(params.projetoNome)}.pdf`;
      const html2pdf = (await import("html2pdf.js")).default;

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
    } catch (err) {
      console.error("Erro ao gerar PDF:", err);
      toast.error("Não foi possível gerar o PDF. Tente novamente.");
    } finally {
      if (appended) document.body.removeChild(container);
      setGerando(false);
    }
  };

  const totalGeral = orc ? calcularTotalGeral(orc.ambientes ?? []) : 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card shadow-sm sticky top-0 z-10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Logo" className="h-12 w-auto" />
            <span className="text-lg font-semibold">Detalhes do Pedido</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/admin?tab=pedidos")}
              className="gap-1.5"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar para lista
            </Button>
            <Button
              size="sm"
              onClick={handleReemitirPdf}
              disabled={gerando || !orc}
              className="gap-1.5"
            >
              {gerando ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
              Re-emitir PDF
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        {loading && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando...
          </div>
        )}

        {!loading && !orc && (
          <Card>
            <CardHeader>
              <CardTitle>Orçamento não encontrado</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                O ID informado não corresponde a nenhum orçamento. Confira o link e tente novamente.
              </p>
            </CardContent>
          </Card>
        )}

        {!loading && orc && (
          <>
            {/* 1 — RESUMO */}
            <Card>
              <CardHeader>
                <CardTitle>Resumo</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                  <div>
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">Status</div>
                    <span
                      className={`mt-1 inline-block rounded px-2 py-0.5 text-xs font-medium ${statusClass(orc.status)}`}
                    >
                      {statusLabel(orc.status)}
                    </span>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">Tipo</div>
                    <div className="mt-1 text-sm font-medium">{orc.tipo || "—"}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">Data</div>
                    <div className="mt-1 text-sm font-medium">
                      {orc.data ? format(new Date(orc.data), "dd/MM/yyyy", { locale: ptBR }) : "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">Valor</div>
                    <div className="mt-1 text-sm font-medium">
                      {formatarMoeda(Number(orc.valor) || 0)}
                    </div>
                  </div>
                  {orc.fechado_at && (
                    <div>
                      <div className="text-xs uppercase tracking-wider text-muted-foreground">Fechado em</div>
                      <div className="mt-1 text-sm font-medium">
                        {format(new Date(orc.fechado_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </div>
                    </div>
                  )}
                  {orc.motivo_perda && (
                    <div className="col-span-2 md:col-span-4">
                      <div className="text-xs uppercase tracking-wider text-muted-foreground">Motivo de perda</div>
                      <div className="mt-1 text-sm">{orc.motivo_perda}</div>
                    </div>
                  )}
                  <div className="col-span-2 md:col-span-4 border-t pt-3">
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">Total geral (calculado)</div>
                    <div className="mt-1 text-lg font-semibold">{formatarMoeda(totalGeral)}</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 2 — CLIENTE E ARQUITETO */}
            <Card>
              <CardHeader>
                <CardTitle>Cliente e Arquiteto</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <div className="text-sm font-semibold">Cliente</div>
                    <Field label="Nome" value={orc.clientes?.nome ?? "—"} />
                    <Field label="Contato" value={orc.clientes?.contato ?? "—"} />
                    <Field label="Email" value={orc.clientes?.email ?? "—"} />
                    <Field label="Telefone" value={orc.clientes?.telefone ?? "—"} />
                    <Field label="CPF/CNPJ" value={orc.clientes?.cpf_cnpj ?? "—"} />
                  </div>
                  <div className="space-y-2">
                    <div className="text-sm font-semibold">Arquiteto</div>
                    {orc.clientes?.arquitetos ? (
                      <>
                        <Field label="Nome" value={orc.clientes.arquitetos.nome ?? "—"} />
                        <Field label="Contato" value={orc.clientes.arquitetos.contato ?? "—"} />
                      </>
                    ) : (
                      <div className="text-sm text-muted-foreground">Sem arquiteto vinculado</div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 3 — PROJETO E COLABORADOR */}
            <Card>
              <CardHeader>
                <CardTitle>Projeto e Colaborador</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Field label="Projeto" value={orc.projetos?.nome ?? "—"} />
                  <Field label="Colaborador responsável" value={orc.colaboradores?.nome ?? "—"} />
                </div>
              </CardContent>
            </Card>

            {/* 4 — AMBIENTES */}
            <Card>
              <CardHeader>
                <CardTitle>Ambientes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {(orc.ambientes ?? []).length === 0 ? (
                  <div className="text-sm text-muted-foreground">Sem ambientes registrados.</div>
                ) : (
                  (orc.ambientes ?? []).map((amb, i) => {
                    const luminarias = amb?.luminarias ?? [];
                    const sistemas = amb?.sistemas ?? [];
                    const subtotalAmb = calcularTotalAmbienteSemFita(amb);
                    return (
                      <div key={amb?.id ?? i} className="rounded-lg border p-3">
                        <div className="mb-2 flex items-center justify-between">
                          <h4 className="font-semibold">{amb?.nome ?? `Ambiente ${i + 1}`}</h4>
                          <span className="text-xs text-muted-foreground">
                            Subtotal (s/ fita): {formatarMoeda(subtotalAmb)}
                          </span>
                        </div>

                        {luminarias.length > 0 && (
                          <div className="mb-3">
                            <div className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">Luminárias</div>
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Código</TableHead>
                                  <TableHead>Descrição</TableHead>
                                  <TableHead className="text-right">Qtd</TableHead>
                                  <TableHead className="text-right">Preço un.</TableHead>
                                  <TableHead className="text-right">Subtotal</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {luminarias.map((l, k) => (
                                  <TableRow key={l?.id ?? k}>
                                    <TableCell className="font-mono text-xs">{l?.codigo ?? "—"}</TableCell>
                                    <TableCell className="text-sm">{l?.descricao ?? "—"}</TableCell>
                                    <TableCell className="text-right">{l?.quantidade ?? 0}</TableCell>
                                    <TableCell className="text-right">{formatarMoeda(Number(l?.precoUnitario) || 0)}</TableCell>
                                    <TableCell className="text-right font-medium">
                                      {formatarMoeda(calcularSubtotalLuminaria(l))}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        )}

                        {sistemas.length > 0 && (
                          <div className="space-y-2">
                            <div className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">Sistemas de iluminação</div>
                            {sistemas.map((s, j) => (
                              <div key={s?.id ?? j} className="rounded border bg-muted/30 p-2 text-sm">
                                <div className="font-semibold">Sistema {j + 1}</div>
                                <div className="mt-1 grid grid-cols-1 gap-1 md:grid-cols-3">
                                  <div>
                                    <span className="text-xs text-muted-foreground">Fita: </span>
                                    <span className="font-mono text-xs">{s?.fita?.codigo ?? "—"}</span>
                                    {s?.fita?.descricao && (
                                      <span className="ml-1 text-xs">{s.fita.descricao}</span>
                                    )}
                                  </div>
                                  <div>
                                    <span className="text-xs text-muted-foreground">Driver: </span>
                                    <span className="font-mono text-xs">{s?.driver?.codigo ?? "—"}</span>
                                    {s?.driver?.descricao && (
                                      <span className="ml-1 text-xs">{s.driver.descricao}</span>
                                    )}
                                  </div>
                                  {s?.perfil && (
                                    <div>
                                      <span className="text-xs text-muted-foreground">Perfil: </span>
                                      <span className="font-mono text-xs">{s.perfil.codigo}</span>
                                      {s.perfil.descricao && (
                                        <span className="ml-1 text-xs">{s.perfil.descricao}</span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {luminarias.length === 0 && sistemas.length === 0 && (
                          <div className="text-xs italic text-muted-foreground">Nenhum item neste ambiente.</div>
                        )}
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>

            {/* 5 — HISTÓRICO DE EXCEÇÕES (só se houver) */}
            {exceptions.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Histórico de Exceções</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Produto</TableHead>
                        <TableHead className="text-right">Solicitado</TableHead>
                        <TableHead className="text-right">Mínimo</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {exceptions.map((ex) => (
                        <TableRow key={ex.id}>
                          <TableCell className="text-xs">
                            {format(new Date(ex.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          </TableCell>
                          <TableCell>
                            <div className="font-mono text-xs">{ex.produto_codigo}</div>
                            <div className="text-xs text-muted-foreground">{ex.produto_descricao}</div>
                          </TableCell>
                          <TableCell className="text-right">{formatarMoeda(Number(ex.preco_solicitado) || 0)}</TableCell>
                          <TableCell className="text-right">{formatarMoeda(Number(ex.preco_minimo) || 0)}</TableCell>
                          <TableCell>
                            <Badge className={exceptionStatusClass(ex.status)} variant="secondary">
                              {ex.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </main>
    </div>
  );
};

const Field = ({ label, value }: { label: string; value: string | null | undefined }) => (
  <div className="text-sm">
    <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}: </span>
    <span>{value ?? "—"}</span>
  </div>
);

export default OrcamentoDetalhe;
