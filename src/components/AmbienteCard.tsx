import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, Trash2, Plus, Pencil, Check, ArrowDown, Link, Unlink } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import ProdutoAutocomplete from "./ProdutoAutocomplete";
import ValidacaoPanel from "./ValidacaoPanel";
import { useValidarSistemas } from "@/hooks/useValidarSistemas";
import type { Ambiente, ItemLuminaria, SistemaIluminacao, ItemPerfil, ItemFitaLED, ItemDriver, Produto } from "@/types/orcamento";
import { calcularMetragemTotal, calcularDemandaFita, calcularConsumoW, calcularQtdDrivers, calcularSubtotalLuminaria, calcularSubtotalSistemaSemFita, formatarMoeda, motivoQtdDrivers } from "@/types/orcamento";

interface AmbienteCardProps {
  ambiente: Ambiente;
  onChange: (ambiente: Ambiente) => void;
  onRemove: () => void;
}

function PrecoInput({ value, min, onChange }: { value: number; min: number; onChange: (v: number) => void }) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    onChange(raw === "" ? 0 : (parseFloat(raw) || 0));
  };
  const isAbaixoTabela = min > 0 && value < min;
  return (
    <Input
      type="number"
      min={0}
      step={0.10}
      value={value}
      onChange={handleChange}
      className={cn("w-28", isAbaixoTabela && "border-destructive text-destructive")}
    />
  );
}

const AmbienteCard = ({ ambiente, onChange, onRemove }: AmbienteCardProps) => {
  const [isOpen, setIsOpen] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [tempName, setTempName] = useState(ambiente.nome);

  const uid = () => crypto.randomUUID();
  const { validacoes } = useValidarSistemas(ambiente.sistemas);

  // ─── Luminárias ───
  const addLuminaria = () => {
    onChange({ ...ambiente, luminarias: [...ambiente.luminarias, { id: uid(), codigo: "", descricao: "", quantidade: 1, precoUnitario: 0, precoMinimo: 0 }] });
  };
  const updateLuminaria = (index: number, item: ItemLuminaria) => {
    const arr = [...ambiente.luminarias]; arr[index] = item;
    onChange({ ...ambiente, luminarias: arr });
  };
  const removeLuminaria = (index: number) => {
    onChange({ ...ambiente, luminarias: ambiente.luminarias.filter((_, i) => i !== index) });
  };

  // ─── Sistemas ───
  const addSistema = () => {
    const novaFita: ItemFitaLED = { id: uid(), codigo: "", descricao: "", wm: 0, voltagem: 24, metragemRolo: 5, precoUnitario: 0, precoMinimo: 0 };
    const novoDriver: ItemDriver = { id: uid(), codigo: "", descricao: "", potencia: 0, voltagem: 24, precoUnitario: 0, precoMinimo: 0 };
    const novoSistema: SistemaIluminacao = { id: uid(), perfil: null, fita: novaFita, driver: novoDriver, metragemManual: null, passadasManual: 1 };
    onChange({ ...ambiente, sistemas: [...ambiente.sistemas, novoSistema] });
  };
  const updateSistema = (index: number, sis: SistemaIluminacao) => {
    const arr = [...ambiente.sistemas]; arr[index] = sis;
    onChange({ ...ambiente, sistemas: arr });
  };
  const removeSistema = (index: number) => {
    onChange({ ...ambiente, sistemas: ambiente.sistemas.filter((_, i) => i !== index) });
  };

  const handleSelectProdutoLuminaria = (produto: Produto, index: number) => {
    const imgUrl = produto.imagem_url || undefined;
    const d = (produto.descricao || '').toUpperCase();

    // ── REGRA #5/#6/#7/#8: Sistemas magnéticos — lembretes críticos ──
    if (produto.sistema_magnetico === 'magneto_48v' || /MAGNETO22/.test(d)) {
      if (/TRILHO.*EMBUTIR/.test(d)) {
        toast.warning(`🧲 Trilho magnético 48V de embutir: inclua o Kit de Fixação LM2987 (vendido separadamente) + Conector LM2338 + Driver 100W (LM2343) ou 200W (LM2344).`, { duration: 10000 });
      } else if (/TRILHO/.test(d)) {
        toast.warning(`🧲 Trilho magnético 48V: inclua o Conector Direcional LM2338 + Driver 100W (LM2343) ou 200W (LM2344).`, { duration: 10000 });
      } else if (/MODULO|SPOT/.test(d)) {
        toast.info(`🧲 Módulo/spot magnético 48V: certifique-se de que o trilho e o driver (100W ou 200W) estão no orçamento.`, { duration: 8000 });
      }
    } else if (produto.sistema_magnetico === 'tiny_magneto' || /TINY\s+MAG/.test(d)) {
      toast.warning(`⚡ Tiny Mag 24V: requer Conector de Driver LM3168 (preto) ou LM3169 (branco) + Driver 24V. Driver externo é obrigatório.`, { duration: 10000 });
    }

    updateLuminaria(index, { ...ambiente.luminarias[index], codigo: produto.codigo, descricao: produto.descricao, precoUnitario: Math.round((produto.preco_tabela || 0) * 100) / 100, precoMinimo: Math.round((produto.preco_minimo || 0) * 100) / 100, imagemUrl: imgUrl });
  };

  const handleSelectProdutoSistema = (produto: Produto, sistemaIndex: number, component: 'perfil' | 'fita' | 'driver') => {
    const sis = ambiente.sistemas[sistemaIndex];
    const imgUrl = produto.imagem_url || undefined;
    const preco = Math.round((produto.preco_tabela || 0) * 100) / 100;
    const precoMin = Math.round((produto.preco_minimo || 0) * 100) / 100;

    // ── REGRA #1: Validação de Tensão (CRÍTICO) ──────────────────────────
    if (component === 'driver' && produto.voltagem && sis.fita.voltagem) {
      if (produto.voltagem !== sis.fita.voltagem) {
        toast.error(
          `⚠️ Tensão incompatível! A fita é ${sis.fita.voltagem}V e este driver é ${produto.voltagem}V. Selecione um driver de ${sis.fita.voltagem}V.`,
          { duration: 6000 }
        );
        return;
      }
    }
    if (component === 'fita' && produto.voltagem && sis.driver.voltagem) {
      if (produto.voltagem !== sis.driver.voltagem) {
        toast.error(
          `⚠️ Tensão incompatível! O driver é ${sis.driver.voltagem}V e esta fita é ${produto.voltagem}V. Selecione uma fita de ${sis.driver.voltagem}V.`,
          { duration: 6000 }
        );
        return;
      }
    }

    // ── REGRA #12/#13: Perfil Baby-only aceita apenas fita Baby ──────────
    if (component === 'fita' && sis.perfil?.somente_baby && !(produto.is_baby ?? produto.somente_baby)) {
      toast.error(
        `🚫 O perfil selecionado aceita SOMENTE fita Baby. Selecione uma fita Baby.`,
        { duration: 6000 }
      );
      return;
    }
    if (component === 'perfil' && produto.somente_baby && sis.fita.codigo && !sis.fita.is_baby) {
      toast.warning(
        `⚠️ Este perfil aceita SOMENTE fita Baby. A fita atual (${sis.fita.codigo}) não é Baby — troque a fita.`,
        { duration: 7000 }
      );
    }

    // ── REGRA #9: Alerta produto magnético ───────────────────────────────
    if (component === 'perfil' && produto.sistema_magnetico) {
      toast.warning(
        `⚡ Atenção: Este produto requer driver externo ${produto.sistema_magnetico === '48v' ? '48V' : '24V'}. Certifique-se de incluí-lo no orçamento.`,
        { duration: 7000 }
      );
    }

    if (component === 'perfil') {
      const base: ItemPerfil = sis.perfil || { id: uid(), codigo: "", descricao: "", comprimentoPeca: 1 as const, quantidade: 1, passadas: 1 as const, precoUnitario: 0, precoMinimo: 0 };
      const passadasAuto = (produto.passadas ?? base.passadas) as 1 | 2 | 3;
      updateSistema(sistemaIndex, {
        ...sis,
        perfil: {
          ...base,
          codigo: produto.codigo,
          descricao: produto.descricao,
          precoUnitario: preco,
          precoMinimo: precoMin,
          imagemUrl: imgUrl,
          passadas: passadasAuto,
          familia_perfil: produto.familia_perfil,
          driver_restr_tipo: produto.driver_restr_tipo,
          driver_restr_max_w: produto.driver_restr_max_w,
          somente_baby: produto.somente_baby,
        },
      });
    } else if (component === 'fita') {
      updateSistema(sistemaIndex, {
        ...sis,
        fita: {
          ...sis.fita,
          codigo: produto.codigo,
          descricao: produto.descricao,
          precoUnitario: preco,
          precoMinimo: precoMin,
          imagemUrl: imgUrl,
          voltagem: (produto.voltagem ?? sis.fita.voltagem) as 12 | 24 | 48,
          wm: produto.wm ?? sis.fita.wm,
          is_baby: produto.is_baby,
        },
      });
    } else {
      // ── REGRA #10/#11: Driver restrito por perfil ────────────────────────
      if (sis.perfil?.driver_restr_tipo === 'slim' && produto.driver_tipo !== 'slim') {
        toast.error(
          `🚫 Este perfil aceita SOMENTE Driver Slim. O driver selecionado não é compatível.`,
          { duration: 6000 }
        );
        return;
      }
      if (sis.perfil?.driver_restr_max_w && produto.driver_potencia_w && produto.driver_potencia_w > sis.perfil.driver_restr_max_w) {
        toast.error(
          `🚫 Driver de ${produto.driver_potencia_w}W não cabe fisicamente neste perfil. Máximo: ${sis.perfil.driver_restr_max_w}W.`,
          { duration: 6000 }
        );
        return;
      }
      updateSistema(sistemaIndex, {
        ...sis,
        driver: {
          ...sis.driver,
          codigo: produto.codigo,
          descricao: produto.descricao,
          precoUnitario: preco,
          precoMinimo: precoMin,
          imagemUrl: imgUrl,
          voltagem: (produto.voltagem ?? sis.driver.voltagem) as 12 | 24 | 48,
          potencia: produto.driver_potencia_w ?? sis.driver.potencia,
          driver_tipo: produto.driver_tipo,
        },
      });
    }
  };

  const vincularPerfil = (si: number) => {
    const sis = ambiente.sistemas[si];
    const novoPerfil: ItemPerfil = { id: uid(), codigo: "", descricao: "", comprimentoPeca: 1, quantidade: 1, passadas: 1, precoUnitario: 0, precoMinimo: 0 };
    updateSistema(si, { ...sis, perfil: novoPerfil, metragemManual: null });
  };

  const desvincularPerfil = (si: number) => {
    const sis = ambiente.sistemas[si];
    const metragem = sis.perfil ? calcularMetragemTotal(sis.perfil) : 0;
    const passadas = sis.perfil?.passadas || 1;
    updateSistema(si, { ...sis, perfil: null, metragemManual: metragem || null, passadasManual: passadas });
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="rounded-xl border bg-card shadow-sm">
      <CollapsibleTrigger asChild>
        <div className="flex cursor-pointer items-center justify-between p-4 hover:bg-muted/50 transition-colors rounded-t-xl">
          <div className="flex items-center gap-3">
            <ChevronDown className={cn("h-5 w-5 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
            {editingName ? (
              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <Input value={tempName} onChange={(e) => setTempName(e.target.value)} className="h-8 w-48" autoFocus onKeyDown={(e) => { if (e.key === 'Enter') { onChange({ ...ambiente, nome: tempName }); setEditingName(false); } }} />
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { onChange({ ...ambiente, nome: tempName }); setEditingName(false); }}>
                  <Check className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-foreground">{ambiente.nome}</h3>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); setEditingName(true); }}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>
          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); onRemove(); }}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="border-t p-4">
          <Tabs defaultValue="luminarias">
            <TabsList className="w-full">
              <TabsTrigger value="luminarias" className="flex-1">Luminárias ({ambiente.luminarias.length})</TabsTrigger>
              <TabsTrigger value="sistemas" className="flex-1">Sistemas de Iluminação ({ambiente.sistemas.length})</TabsTrigger>
            </TabsList>

            {/* ─── Tab Luminárias ─── */}
            <TabsContent value="luminarias" className="space-y-3 mt-4">
              {ambiente.luminarias.map((item, i) => (
                <div key={item.id} className="flex items-start gap-2 rounded-lg border p-3 bg-muted/30">
                  <div className="flex-1 space-y-2">
                    <ProdutoAutocomplete value={item.codigo} onSelect={(p) => handleSelectProdutoLuminaria(p, i)} placeholder="Código do item" />
                    <Input value={item.descricao} readOnly placeholder="Descrição" className="bg-muted/50" />
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground whitespace-nowrap">Qtd:</span>
                        <Input type="number" min={1} value={item.quantidade} onChange={(e) => { const raw = e.target.value; updateLuminaria(i, { ...item, quantidade: raw === "" ? 0 : (parseInt(raw) || 0) }); }} className="w-20" />
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground whitespace-nowrap">Preço Un.:</span>
                        <PrecoInput value={item.precoUnitario} min={item.precoMinimo} onChange={(v) => updateLuminaria(i, { ...item, precoUnitario: v })} />
                      </div>
                      {item.precoUnitario > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          Subtotal: {formatarMoeda(calcularSubtotalLuminaria(item))}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Button size="icon" variant="ghost" className="text-destructive shrink-0" onClick={() => removeLuminaria(i)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" className="gap-2" onClick={addLuminaria}>
                <Plus className="h-4 w-4" /> Adicionar Luminária
              </Button>
            </TabsContent>

            {/* ─── Tab Sistemas de Iluminação ─── */}
            <TabsContent value="sistemas" className="space-y-4 mt-4">
              {ambiente.sistemas.map((sis, si) => {
                const demandaFita = calcularDemandaFita(sis);
                const consumoW = calcularConsumoW(sis);
                const qtdDrivers = calcularQtdDrivers(sis);
                const motivoDrivers = motivoQtdDrivers(sis);
                const subtotal = calcularSubtotalSistemaSemFita(sis);

                return (
                  <div key={sis.id} className="rounded-lg border bg-muted/20 overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2 bg-muted/40 border-b">
                      <span className="text-sm font-semibold text-foreground">Sistema {si + 1}</span>
                      <div className="flex items-center gap-2">
                        {subtotal > 0 && <Badge variant="outline" className="text-xs">Subtotal (s/ fita): {formatarMoeda(subtotal)}</Badge>}
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => removeSistema(si)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    <div className="p-4 space-y-3">

                      {/* ── FITA LED ── */}
                      <div className="space-y-2">
                        <span className="text-xs font-semibold text-primary uppercase tracking-wide">Fita LED</span>
                        <ProdutoAutocomplete value={sis.fita.codigo} onSelect={(p) => handleSelectProdutoSistema(p, si, 'fita')} placeholder="Código da fita" />
                        <Input value={sis.fita.descricao} readOnly placeholder="Descrição" className="bg-muted/50" />
                        <div className="flex items-center gap-3 flex-wrap">
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-muted-foreground">W/m:</span>
                            <Input type="number" min={0} step={0.1} value={sis.fita.wm} onChange={(e) => { const raw = e.target.value; updateSistema(si, { ...sis, fita: { ...sis.fita, wm: raw === "" ? 0 : (parseFloat(raw) || 0) } }); }} className="w-20 h-8" />
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-muted-foreground">Rolo:</span>
                            <Select value={String(sis.fita.metragemRolo)} onValueChange={(v) => updateSistema(si, { ...sis, fita: { ...sis.fita, metragemRolo: Number(v) as 5 | 10 | 15 } })}>
                              <SelectTrigger className="w-20 h-8"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="5">5m</SelectItem>
                                <SelectItem value="10">10m</SelectItem>
                                <SelectItem value="15">15m</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-muted-foreground whitespace-nowrap">Preço Un.:</span>
                            <PrecoInput value={sis.fita.precoUnitario} min={sis.fita.precoMinimo} onChange={(v) => updateSistema(si, { ...sis, fita: { ...sis.fita, precoUnitario: v } })} />
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          {sis.fita.voltagem && <Badge variant="outline" className="text-xs">{sis.fita.voltagem}V</Badge>}
                          {consumoW > 0 && <Badge variant="secondary" className="text-xs">Consumo: {consumoW.toFixed(1)}W</Badge>}
                          {demandaFita > 0 && <Badge variant="secondary" className="text-xs">Demanda: {demandaFita}m</Badge>}
                        </div>
                      </div>

                      <div className="flex justify-center"><ArrowDown className="h-4 w-4 text-muted-foreground" /></div>

                      {/* ── PERFIL (opcional) ── */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-primary uppercase tracking-wide">Perfil</span>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">Opcional</Badge>
                          {!sis.perfil ? (
                            <Button size="sm" variant="outline" className="h-6 text-xs gap-1" onClick={() => vincularPerfil(si)}>
                              <Link className="h-3 w-3" /> Vincular Perfil
                            </Button>
                          ) : (
                            <Button size="sm" variant="ghost" className="h-6 text-xs gap-1 text-destructive" onClick={() => desvincularPerfil(si)}>
                              <Unlink className="h-3 w-3" /> Desvincular
                            </Button>
                          )}
                        </div>
                        {sis.perfil ? (
                          <>
                            <ProdutoAutocomplete value={sis.perfil.codigo} onSelect={(p) => handleSelectProdutoSistema(p, si, 'perfil')} placeholder="Código do perfil" />
                            <Input value={sis.perfil.descricao} readOnly placeholder="Descrição" className="bg-muted/50" />
                            <div className="flex items-center gap-3 flex-wrap">
                              <div className="flex items-center gap-1">
                                <span className="text-xs text-muted-foreground">Comprimento:</span>
                                <Select value={String(sis.perfil.comprimentoPeca)} onValueChange={(v) => updateSistema(si, { ...sis, perfil: { ...sis.perfil!, comprimentoPeca: Number(v) as 1 | 2 | 3 } })}>
                                  <SelectTrigger className="w-20 h-8"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="1">1m</SelectItem>
                                    <SelectItem value="2">2m</SelectItem>
                                    <SelectItem value="3">3m</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="text-xs text-muted-foreground">Qtd:</span>
                                <Input type="number" min={1} value={sis.perfil.quantidade} onChange={(e) => { const raw = e.target.value; updateSistema(si, { ...sis, perfil: { ...sis.perfil!, quantidade: raw === "" ? 0 : (parseInt(raw) || 0) } }); }} className="w-20 h-8" />
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="text-xs text-muted-foreground">Passadas:</span>
                                <Badge variant="secondary" className="text-xs">{sis.perfil.passadas}× (auto)</Badge>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 flex-wrap">
                              <Badge variant="secondary" className="text-xs">Metragem: {calcularMetragemTotal(sis.perfil)}m</Badge>
                              <div className="flex items-center gap-1">
                                <span className="text-xs text-muted-foreground whitespace-nowrap">Preço Un.:</span>
                                <PrecoInput value={sis.perfil.precoUnitario} min={sis.perfil.precoMinimo} onChange={(v) => updateSistema(si, { ...sis, perfil: { ...sis.perfil!, precoUnitario: v } })} />
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="flex items-center gap-3 flex-wrap rounded-md border border-dashed p-3 bg-muted/30">
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-muted-foreground">Metragem (m):</span>
                              <Input type="number" min={0} step={0.1} value={sis.metragemManual ?? ""} onChange={(e) => { const raw = e.target.value; updateSistema(si, { ...sis, metragemManual: raw === "" ? null : (parseFloat(raw) || 0) }); }} className="w-24 h-8" placeholder="Ex: 12" />
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-muted-foreground">Passadas:</span>
                              <Select value={String(sis.passadasManual)} onValueChange={(v) => updateSistema(si, { ...sis, passadasManual: Number(v) as 1 | 2 | 3 })}>
                                <SelectTrigger className="w-20 h-8"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="1">1</SelectItem>
                                  <SelectItem value="2">2</SelectItem>
                                  <SelectItem value="3">3</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            {demandaFita > 0 && <Badge variant="secondary" className="text-xs">Demanda fita: {demandaFita}m</Badge>}
                          </div>
                        )}
                      </div>

                      <div className="flex justify-center"><ArrowDown className="h-4 w-4 text-muted-foreground" /></div>

                      {/* ── DRIVER ── */}
                      <div className="space-y-2">
                        <span className="text-xs font-semibold text-primary uppercase tracking-wide">Driver</span>
                        <ProdutoAutocomplete value={sis.driver.codigo} onSelect={(p) => handleSelectProdutoSistema(p, si, 'driver')} placeholder="Código do driver" />
                        <Input value={sis.driver.descricao} readOnly placeholder="Descrição" className="bg-muted/50" />
                        <div className="flex items-center gap-3 flex-wrap">
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-muted-foreground">Potência (W):</span>
                            <Input type="number" min={0} value={sis.driver.potencia} onChange={(e) => { const raw = e.target.value; updateSistema(si, { ...sis, driver: { ...sis.driver, potencia: raw === "" ? 0 : (parseFloat(raw) || 0) } }); }} className="w-24 h-8" />
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-muted-foreground">Voltagem:</span>
                            <Select value={String(sis.driver.voltagem)} onValueChange={(v) => updateSistema(si, { ...sis, driver: { ...sis.driver, voltagem: Number(v) as 12 | 24 | 48 } })}>
                              <SelectTrigger className="w-20 h-8"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="12">12V</SelectItem>
                                <SelectItem value="24">24V</SelectItem>
                                <SelectItem value="48">48V</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 flex-wrap">
                          {qtdDrivers > 0 && <Badge variant="secondary" className="text-xs">Qtd Drivers: {qtdDrivers}</Badge>}
                          {consumoW > 0 && <Badge variant="outline" className="text-xs">Consumo: {consumoW.toFixed(1)}W</Badge>}
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-muted-foreground whitespace-nowrap">Preço Un.:</span>
                            <PrecoInput value={sis.driver.precoUnitario} min={sis.driver.precoMinimo} onChange={(v) => updateSistema(si, { ...sis, driver: { ...sis.driver, precoUnitario: v } })} />
                          </div>
                        </div>
                        {qtdDrivers > 1 && (
                          <div className="rounded-md border border-amber-400/40 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                            {motivoDrivers.motivo === 'potencia' && (
                              <>⚡ Consumo total ({motivoDrivers.consumoW.toFixed(1)}W) excede a potência do driver ({sis.driver.potencia}W). Necessário dividir em <strong>{qtdDrivers} drivers</strong>.</>
                            )}
                            {motivoDrivers.motivo === 'extensao' && (
                              <>📏 Extensão de fita ({motivoDrivers.demandaM}m) excede o limite de {motivoDrivers.limiteM}m para {sis.driver.voltagem}V. Necessário dividir em <strong>{qtdDrivers} drivers</strong>.</>
                            )}
                            {motivoDrivers.motivo === 'potencia_e_extensao' && (
                              <>⚡📏 Consumo ({motivoDrivers.consumoW.toFixed(1)}W) e extensão ({motivoDrivers.demandaM}m) excedem os limites. Necessário dividir em <strong>{qtdDrivers} drivers</strong>.</>
                            )}
                          </div>
                        )}
                      </div>

                      {/* ── PAINEL DE VALIDAÇÃO ── */}
                      <ValidacaoPanel validacao={validacoes[sis.id]} />

                    </div>
                  </div>
                );
              })}
              <Button variant="outline" size="sm" className="gap-2" onClick={addSistema}>
                <Plus className="h-4 w-4" /> Novo Sistema
              </Button>
            </TabsContent>
          </Tabs>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

export default AmbienteCard;
