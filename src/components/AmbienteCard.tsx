import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Trash2, Plus, Pencil, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import ProdutoAutocomplete from "./ProdutoAutocomplete";
import type { Ambiente, ItemLuminaria, ItemPerfil, ItemFitaLED, Produto } from "@/types/orcamento";
import { calcularMetragemTotal, calcularWTotal, calcularQtdRolos, calcularSubtotalLuminaria, calcularSubtotalPerfil, calcularSubtotalFita, formatarMoeda } from "@/types/orcamento";

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

  const addLuminaria = () => {
    onChange({ ...ambiente, luminarias: [...ambiente.luminarias, { id: uid(), codigo: "", descricao: "", quantidade: 1, precoUnitario: 0, precoMinimo: 0 }] });
  };
  const addPerfil = () => {
    onChange({ ...ambiente, perfis: [...ambiente.perfis, { id: uid(), codigo: "", descricao: "", metragem: 0, quantidade: 1, precoUnitario: 0, precoMinimo: 0 }] });
  };
  const addFita = () => {
    onChange({ ...ambiente, fitasLed: [...ambiente.fitasLed, { id: uid(), codigo: "", descricao: "", passadas: 0, wm: 0, metragemRolo: 5, precoUnitario: 0, precoMinimo: 0 }] });
  };

  const updateLuminaria = (index: number, item: ItemLuminaria) => {
    const arr = [...ambiente.luminarias]; arr[index] = item;
    onChange({ ...ambiente, luminarias: arr });
  };
  const updatePerfil = (index: number, item: ItemPerfil) => {
    const arr = [...ambiente.perfis]; arr[index] = item;
    onChange({ ...ambiente, perfis: arr });
  };
  const updateFita = (index: number, item: ItemFitaLED) => {
    const arr = [...ambiente.fitasLed]; arr[index] = item;
    onChange({ ...ambiente, fitasLed: arr });
  };

  const removeLuminaria = (index: number) => {
    onChange({ ...ambiente, luminarias: ambiente.luminarias.filter((_, i) => i !== index) });
  };
  const removePerfil = (index: number) => {
    onChange({ ...ambiente, perfis: ambiente.perfis.filter((_, i) => i !== index) });
  };
  const removeFita = (index: number) => {
    onChange({ ...ambiente, fitasLed: ambiente.fitasLed.filter((_, i) => i !== index) });
  };

  const handleSelectProduto = (produto: Produto, type: 'luminaria' | 'perfil' | 'fita', index: number) => {
    const imgUrl = produto.imagem_url || undefined;
    if (type === 'luminaria') {
      updateLuminaria(index, { ...ambiente.luminarias[index], codigo: produto.codigo, descricao: produto.descricao, precoUnitario: Math.round((produto.preco_tabela || 0) * 100) / 100, precoMinimo: Math.round((produto.preco_minimo || 0) * 100) / 100, imagemUrl: imgUrl });
    } else if (type === 'perfil') {
      updatePerfil(index, { ...ambiente.perfis[index], codigo: produto.codigo, descricao: produto.descricao, precoUnitario: Math.round((produto.preco_tabela || 0) * 100) / 100, precoMinimo: Math.round((produto.preco_minimo || 0) * 100) / 100, imagemUrl: imgUrl });
    } else {
      updateFita(index, { ...ambiente.fitasLed[index], codigo: produto.codigo, descricao: produto.descricao, precoUnitario: Math.round((produto.preco_tabela || 0) * 100) / 100, precoMinimo: Math.round((produto.preco_minimo || 0) * 100) / 100, imagemUrl: imgUrl });
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
                <Input
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  className="h-8 w-48"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === 'Enter') { onChange({ ...ambiente, nome: tempName }); setEditingName(false); } }}
                />
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
              <TabsTrigger value="perfil" className="flex-1">Perfil ({ambiente.perfis.length})</TabsTrigger>
              <TabsTrigger value="fita" className="flex-1">Fita LED ({ambiente.fitasLed.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="luminarias" className="space-y-3 mt-4">
              {ambiente.luminarias.map((item, i) => (
                <div key={item.id} className="flex items-start gap-2 rounded-lg border p-3 bg-muted/30">
                  <div className="flex-1 space-y-2">
                    <ProdutoAutocomplete value={item.codigo} onSelect={(p) => handleSelectProduto(p, 'luminaria', i)} placeholder="Código do item" />
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
                        <div className="rounded-md bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                          Subtotal: {formatarMoeda(calcularSubtotalLuminaria(item))}
                        </div>
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

            <TabsContent value="perfil" className="space-y-3 mt-4">
              {ambiente.perfis.map((item, i) => (
                <div key={item.id} className="flex items-start gap-2 rounded-lg border p-3 bg-muted/30">
                  <div className="flex-1 space-y-2">
                    <ProdutoAutocomplete value={item.codigo} onSelect={(p) => handleSelectProduto(p, 'perfil', i)} placeholder="Código do item" />
                    <Input value={item.descricao} readOnly placeholder="Descrição" className="bg-muted/50" />
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground">Metragem:</span>
                        <Input type="number" min={0} step={1} value={item.metragem} onChange={(e) => { const raw = e.target.value; updatePerfil(i, { ...item, metragem: raw === "" ? 0 : (parseFloat(raw) || 0) }); }} className="w-24" />
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground">Qtd:</span>
                        <Input type="number" min={1} value={item.quantidade} onChange={(e) => { const raw = e.target.value; updatePerfil(i, { ...item, quantidade: raw === "" ? 0 : (parseInt(raw) || 0) }); }} className="w-20" />
                      </div>
                      <div className="rounded-md bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                        Total: {calcularMetragemTotal(item).toFixed(2)}m
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground whitespace-nowrap">Preço Un.:</span>
                        <PrecoInput value={item.precoUnitario} min={item.precoMinimo} onChange={(v) => updatePerfil(i, { ...item, precoUnitario: v })} />
                      </div>
                      {item.precoUnitario > 0 && (
                        <div className="rounded-md bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                          Subtotal: {formatarMoeda(calcularSubtotalPerfil(item))}
                        </div>
                      )}
                    </div>
                  </div>
                  <Button size="icon" variant="ghost" className="text-destructive shrink-0" onClick={() => removePerfil(i)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" className="gap-2" onClick={addPerfil}>
                <Plus className="h-4 w-4" /> Adicionar Perfil
              </Button>
            </TabsContent>

            <TabsContent value="fita" className="space-y-3 mt-4">
              {ambiente.fitasLed.map((item, i) => (
                <div key={item.id} className="flex items-start gap-2 rounded-lg border p-3 bg-muted/30">
                  <div className="flex-1 space-y-2">
                    <ProdutoAutocomplete value={item.codigo} onSelect={(p) => handleSelectProduto(p, 'fita', i)} placeholder="Código do item" />
                    <Input value={item.descricao} readOnly placeholder="Descrição" className="bg-muted/50" />
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground">Passadas:</span>
                        <Input type="number" min={0} step={1} value={item.passadas} onChange={(e) => { const raw = e.target.value; updateFita(i, { ...item, passadas: raw === "" ? 0 : (parseFloat(raw) || 0) }); }} className="w-24" />
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground">W/M:</span>
                        <Input type="number" min={0} step={1} value={item.wm} onChange={(e) => { const raw = e.target.value; updateFita(i, { ...item, wm: raw === "" ? 0 : (parseFloat(raw) || 0) }); }} className="w-24" />
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground">Rolo (m):</span>
                        <Input type="number" min={1} step={1} value={item.metragemRolo} onChange={(e) => { const raw = e.target.value; updateFita(i, { ...item, metragemRolo: raw === "" ? 0 : (parseFloat(raw) || 0) }); }} className="w-24" />
                      </div>
                    </div>
                    <div className="flex gap-3 flex-wrap">
                      <div className="rounded-md bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                        W Total: {calcularWTotal(item).toFixed(1)}W
                      </div>
                      <div className="rounded-md bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                        Rolos: {calcularQtdRolos(item)}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground whitespace-nowrap">Preço Un.:</span>
                        <PrecoInput value={item.precoUnitario} min={item.precoMinimo} onChange={(v) => updateFita(i, { ...item, precoUnitario: v })} />
                      </div>
                      {item.precoUnitario > 0 && (
                        <div className="rounded-md bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                          Subtotal: {formatarMoeda(calcularSubtotalFita(item))}
                        </div>
                      )}
                    </div>
                  </div>
                  <Button size="icon" variant="ghost" className="text-destructive shrink-0" onClick={() => removeFita(i)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" className="gap-2" onClick={addFita}>
                <Plus className="h-4 w-4" /> Adicionar Fita LED
              </Button>
            </TabsContent>
          </Tabs>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

export default AmbienteCard;
