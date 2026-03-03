import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, Trash2, Plus, Pencil, Check, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";
import ProdutoAutocomplete from "./ProdutoAutocomplete";
import type { Ambiente, ItemLuminaria, SistemaPerfil, ItemPerfil, ItemFitaLED, ItemDriver, Produto } from "@/types/orcamento";
import { calcularMetragemTotal, calcularDemandaFita, calcularConsumoW, calcularQtdDrivers, calcularSubtotalLuminaria, calcularSubtotalSistemaSemFita, formatarMoeda } from "@/types/orcamento";

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
    const novoPerfil: ItemPerfil = { id: uid(), codigo: "", descricao: "", comprimentoPeca: 1, quantidade: 1, passadas: 1, precoUnitario: 0, precoMinimo: 0 };
    const novoSistema: SistemaPerfil = { id: uid(), perfil: novoPerfil, fita: null, driver: null };
    onChange({ ...ambiente, sistemas: [...ambiente.sistemas, novoSistema] });
  };
  const updateSistema = (index: number, sis: SistemaPerfil) => {
    const arr = [...ambiente.sistemas]; arr[index] = sis;
    onChange({ ...ambiente, sistemas: arr });
  };
  const removeSistema = (index: number) => {
    onChange({ ...ambiente, sistemas: ambiente.sistemas.filter((_, i) => i !== index) });
  };

  const handleSelectProdutoLuminaria = (produto: Produto, index: number) => {
    const imgUrl = produto.imagem_url || undefined;
    updateLuminaria(index, { ...ambiente.luminarias[index], codigo: produto.codigo, descricao: produto.descricao, precoUnitario: Math.round((produto.preco_tabela || 0) * 100) / 100, precoMinimo: Math.round((produto.preco_minimo || 0) * 100) / 100, imagemUrl: imgUrl });
  };

  const handleSelectProdutoSistema = (produto: Produto, sistemaIndex: number, component: 'perfil' | 'fita' | 'driver') => {
    const sis = ambiente.sistemas[sistemaIndex];
    const imgUrl = produto.imagem_url || undefined;
    const preco = Math.round((produto.preco_tabela || 0) * 100) / 100;
    const precoMin = Math.round((produto.preco_minimo || 0) * 100) / 100;

    if (component === 'perfil') {
      updateSistema(sistemaIndex, { ...sis, perfil: { ...sis.perfil, codigo: produto.codigo, descricao: produto.descricao, precoUnitario: preco, precoMinimo: precoMin, imagemUrl: imgUrl } });
    } else if (component === 'fita') {
      const base: ItemFitaLED = sis.fita || { id: uid(), codigo: "", descricao: "", wm: 0, metragemRolo: 5, precoUnitario: 0, precoMinimo: 0 };
      updateSistema(sistemaIndex, { ...sis, fita: { ...base, codigo: produto.codigo, descricao: produto.descricao, precoUnitario: preco, precoMinimo: precoMin, imagemUrl: imgUrl } });
    } else {
      const base: ItemDriver = sis.driver || { id: uid(), codigo: "", descricao: "", potencia: 0, voltagem: 24, precoUnitario: 0, precoMinimo: 0 };
      updateSistema(sistemaIndex, { ...sis, driver: { ...base, codigo: produto.codigo, descricao: produto.descricao, precoUnitario: preco, precoMinimo: precoMin, imagemUrl: imgUrl } });
    }
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
              <TabsTrigger value="sistemas" className="flex-1">Sistemas de Perfil ({ambiente.sistemas.length})</TabsTrigger>
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

            {/* ─── Tab Sistemas de Perfil ─── */}
            <TabsContent value="sistemas" className="space-y-4 mt-4">
              {ambiente.sistemas.map((sis, si) => {
                const metragemTotal = calcularMetragemTotal(sis.perfil);
                const demandaFita = calcularDemandaFita(sis.perfil);
                const consumoW = sis.fita ? calcularConsumoW(sis.perfil, sis.fita) : 0;
                const qtdDrivers = sis.fita && sis.driver ? calcularQtdDrivers(sis.perfil, sis.fita, sis.driver) : 0;
                const subtotal = calcularSubtotalSistemaSemFita(sis);

                return (
                  <div key={sis.id} className="rounded-lg border bg-muted/20 overflow-hidden">
                    {/* Header do sistema */}
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
                      {/* ── PERFIL ── */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-primary uppercase tracking-wide">Perfil</span>
                        </div>
                        <ProdutoAutocomplete value={sis.perfil.codigo} onSelect={(p) => handleSelectProdutoSistema(p, si, 'perfil')} placeholder="Código do perfil" />
                        <Input value={sis.perfil.descricao} readOnly placeholder="Descrição" className="bg-muted/50" />
                        <div className="flex items-center gap-3 flex-wrap">
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-muted-foreground">Comprimento:</span>
                            <Select value={String(sis.perfil.comprimentoPeca)} onValueChange={(v) => updateSistema(si, { ...sis, perfil: { ...sis.perfil, comprimentoPeca: Number(v) as 1 | 2 | 3 } })}>
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
                            <Input type="number" min={1} value={sis.perfil.quantidade} onChange={(e) => { const raw = e.target.value; updateSistema(si, { ...sis, perfil: { ...sis.perfil, quantidade: raw === "" ? 0 : (parseInt(raw) || 0) } }); }} className="w-20 h-8" />
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-muted-foreground">Passadas:</span>
                            <Select value={String(sis.perfil.passadas)} onValueChange={(v) => updateSistema(si, { ...sis, perfil: { ...sis.perfil, passadas: Number(v) as 1 | 2 | 3 } })}>
                              <SelectTrigger className="w-20 h-8"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="1">1</SelectItem>
                                <SelectItem value="2">2</SelectItem>
                                <SelectItem value="3">3</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 flex-wrap">
                          <Badge variant="secondary" className="text-xs">Metragem: {metragemTotal}m</Badge>
                          <Badge variant="secondary" className="text-xs">Demanda fita: {demandaFita}m</Badge>
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-muted-foreground whitespace-nowrap">Preço Un.:</span>
                            <PrecoInput value={sis.perfil.precoUnitario} min={sis.perfil.precoMinimo} onChange={(v) => updateSistema(si, { ...sis, perfil: { ...sis.perfil, precoUnitario: v } })} />
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-center"><ArrowDown className="h-4 w-4 text-muted-foreground" /></div>

                      {/* ── FITA LED ── */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-primary uppercase tracking-wide">Fita LED</span>
                          {!sis.fita && (
                            <Button size="sm" variant="outline" className="h-6 text-xs" onClick={() => {
                              updateSistema(si, { ...sis, fita: { id: uid(), codigo: "", descricao: "", wm: 0, metragemRolo: 5, precoUnitario: 0, precoMinimo: 0 } });
                            }}>
                              <Plus className="h-3 w-3 mr-1" /> Vincular Fita
                            </Button>
                          )}
                        </div>
                        {sis.fita && (
                          <>
                            <ProdutoAutocomplete value={sis.fita.codigo} onSelect={(p) => handleSelectProdutoSistema(p, si, 'fita')} placeholder="Código da fita" />
                            <Input value={sis.fita.descricao} readOnly placeholder="Descrição" className="bg-muted/50" />
                            <div className="flex items-center gap-3 flex-wrap">
                              <div className="flex items-center gap-1">
                                <span className="text-xs text-muted-foreground">W/m:</span>
                                <Input type="number" min={0} step={0.1} value={sis.fita.wm} onChange={(e) => { const raw = e.target.value; updateSistema(si, { ...sis, fita: { ...sis.fita!, wm: raw === "" ? 0 : (parseFloat(raw) || 0) } }); }} className="w-20 h-8" />
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="text-xs text-muted-foreground">Rolo:</span>
                                <Select value={String(sis.fita.metragemRolo)} onValueChange={(v) => updateSistema(si, { ...sis, fita: { ...sis.fita!, metragemRolo: Number(v) as 5 | 10 | 15 } })}>
                                  <SelectTrigger className="w-20 h-8"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="5">5m</SelectItem>
                                    <SelectItem value="10">10m</SelectItem>
                                    <SelectItem value="15">15m</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 flex-wrap">
                              <Badge variant="secondary" className="text-xs">Consumo: {consumoW.toFixed(1)}W</Badge>
                              <div className="flex items-center gap-1">
                                <span className="text-xs text-muted-foreground whitespace-nowrap">Preço Un.:</span>
                                <PrecoInput value={sis.fita.precoUnitario} min={sis.fita.precoMinimo} onChange={(v) => updateSistema(si, { ...sis, fita: { ...sis.fita!, precoUnitario: v } })} />
                              </div>
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => updateSistema(si, { ...sis, fita: null, driver: null })}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </>
                        )}
                      </div>

                      {sis.fita && (
                        <>
                          <div className="flex justify-center"><ArrowDown className="h-4 w-4 text-muted-foreground" /></div>

                          {/* ── DRIVER ── */}
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-primary uppercase tracking-wide">Driver</span>
                              {!sis.driver && (
                                <Button size="sm" variant="outline" className="h-6 text-xs" onClick={() => {
                                  updateSistema(si, { ...sis, driver: { id: uid(), codigo: "", descricao: "", potencia: 0, voltagem: 24, precoUnitario: 0, precoMinimo: 0 } });
                                }}>
                                  <Plus className="h-3 w-3 mr-1" /> Vincular Driver
                                </Button>
                              )}
                            </div>
                            {sis.driver && (
                              <>
                                <ProdutoAutocomplete value={sis.driver.codigo} onSelect={(p) => handleSelectProdutoSistema(p, si, 'driver')} placeholder="Código do driver" />
                                <Input value={sis.driver.descricao} readOnly placeholder="Descrição" className="bg-muted/50" />
                                <div className="flex items-center gap-3 flex-wrap">
                                  <div className="flex items-center gap-1">
                                    <span className="text-xs text-muted-foreground">Potência (W):</span>
                                    <Input type="number" min={0} value={sis.driver.potencia} onChange={(e) => { const raw = e.target.value; updateSistema(si, { ...sis, driver: { ...sis.driver!, potencia: raw === "" ? 0 : (parseFloat(raw) || 0) } }); }} className="w-24 h-8" />
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <span className="text-xs text-muted-foreground">Voltagem:</span>
                                    <Select value={String(sis.driver.voltagem)} onValueChange={(v) => updateSistema(si, { ...sis, driver: { ...sis.driver!, voltagem: Number(v) as 12 | 24 } })}>
                                      <SelectTrigger className="w-20 h-8"><SelectValue /></SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="12">12V</SelectItem>
                                        <SelectItem value="24">24V</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3 flex-wrap">
                                  {qtdDrivers > 0 && <Badge variant="secondary" className="text-xs">Qtd Drivers: {qtdDrivers}</Badge>}
                                  <div className="flex items-center gap-1">
                                    <span className="text-xs text-muted-foreground whitespace-nowrap">Preço Un.:</span>
                                    <PrecoInput value={sis.driver.precoUnitario} min={sis.driver.precoMinimo} onChange={(v) => updateSistema(si, { ...sis, driver: { ...sis.driver!, precoUnitario: v } })} />
                                  </div>
                                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => updateSistema(si, { ...sis, driver: null })}>
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </>
                            )}
                          </div>
                        </>
                      )}
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
