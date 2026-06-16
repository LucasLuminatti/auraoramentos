import { useState, useRef, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Check, AlertCircle, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import ProdutoAutocomplete from "@/components/ProdutoAutocomplete";
import type { ItemLuminaria, ItemComposicao, Produto } from "@/types/orcamento";
import {
  calcularCargaComposicao,
  recomendarDriver48V,
  calcularSubtotalComposicao,
  formatarMoeda,
  MARGEM_SEGURANCA_DRIVER,
  REGRAS_COMPOSICAO,
  calcularMetragemModulosDifusos,
  parsearComprimentoModulo,
} from "@/types/orcamento";

// ─── PrecoInput local (equivalente ao do AmbienteCard) ───

function PrecoInput({
  value,
  min,
  onChange,
}: {
  value: number;
  min: number;
  onChange: (v: number) => void;
}) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    onChange(raw === "" ? 0 : parseFloat(raw) || 0);
  };
  const isAbaixoTabela = min > 0 && value < min;
  return (
    <Input
      type="number"
      min={0}
      step={0.1}
      value={value}
      onChange={handleChange}
      className={cn("w-28", isAbaixoTabela && "border-destructive text-destructive")}
    />
  );
}

// ─── Props ───

interface ComposicaoCardProps {
  item: ItemLuminaria;
  onChange: (item: ItemLuminaria) => void;
  onRemove: () => void;
  onDuplicate?: () => void;   // Phase 21 / DUP-01 (D-04)
  indice: number;
}

// ─── Sugestão 24V ───

interface Sugestao24V {
  sku: string;
  descricao: string;
  potenciaW: number;
  precoTabela: number;
  precoMinimo: number;
}

// ─── ComposicaoCard ───

const ComposicaoCard = ({ item, onChange, onRemove, onDuplicate, indice }: ComposicaoCardProps) => {
  const is48V = item.sistema === "magneto_48v";
  const is24V = item.sistema === "tiny_magneto";
  const isModular = item.sistema === "s_mode";
  const familiaSistema = item.sistema ?? undefined;

  // Ref para reconciliação pós-await (Pitfall 3)
  const itemRef = useRef(item);
  useEffect(() => {
    itemRef.current = item;
  }, [item]);

  // Estado local para busca de módulo
  const [mostrarBuscaModulo, setMostrarBuscaModulo] = useState(false);

  // Estado local para busca de fita modular (SYSTEM MOLD)
  const [mostrarBuscaFita, setMostrarBuscaFita] = useState(false);

  // Estado local para busca manual de driver (estado "Alterar")
  const [mostrarBuscaDriver, setMostrarBuscaDriver] = useState(false);

  // Estado local para driver 24V
  const [sugestao24v, setSugestao24v] = useState<Sugestao24V | null>(null);
  const [buscando24v, setBuscando24v] = useState(false);
  const [sem24v, setSem24v] = useState(false);

  // Invalida buscas de driver em voo — a mais recente sempre vence (evita advisory obsoleto)
  const driverReqId = useRef(0);

  // Derivações
  const composicao = item.composicao ?? [];
  const cargaTotalW = calcularCargaComposicao(item.composicao);
  const modulos = composicao.filter((c) => c.papel === "modulo");
  const driverAplicado = composicao.find((c) => c.papel === "driver_recomendado");

  // Derivações modulares (SYSTEM MOLD)
  const metragemDerivada = isModular ? calcularMetragemModulosDifusos(item.composicao) : 0;
  const fitaModular = composicao.find((c) => c.papel === "fita_modular");

  // Recomendação 48V (pura, sem side-effect)
  const rec48v = is48V ? recomendarDriver48V(cargaTotalW) : null;

  // Busca de driver 24V quando carga muda
  useEffect(() => {
    if (!is24V) return;
    if (cargaTotalW <= 0) {
      setSugestao24v(null);
      setSem24v(false);
      return;
    }
    if (driverAplicado) {
      // Driver já aplicado — não refazer a busca
      return;
    }

    let cancelled = false;
    setBuscando24v(true);
    setSem24v(false);

    (async () => {
      const { data } = await supabase
        .from("produtos")
        .select(
          "id, codigo, descricao, preco_tabela, preco_minimo, driver_potencia_w:potencia_watts"
        )
        .eq("tipo_produto", "driver")
        .eq("tensao", 24)
        .gte("potencia_watts", cargaTotalW * MARGEM_SEGURANCA_DRIVER)
        .not("descricao", "ilike", "%DESCONTINUAR%")
        .order("potencia_watts", { ascending: true })
        .limit(1);

      if (cancelled) return;

      const row = data?.[0] as
        | { codigo: string; descricao: string; driver_potencia_w: number | null; preco_tabela: number; preco_minimo: number }
        | undefined;

      if (row) {
        setSugestao24v({
          sku: row.codigo,
          descricao: row.descricao,
          potenciaW: row.driver_potencia_w ?? 0,
          precoTabela: Math.round((row.preco_tabela || 0) * 100) / 100,
          precoMinimo: Math.round((row.preco_minimo || 0) * 100) / 100,
        });
        setSem24v(false);
      } else {
        setSugestao24v(null);
        setSem24v(true);
      }
      setBuscando24v(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [is24V, cargaTotalW, driverAplicado]);

  // ─── Helpers de mutação ───

  const atualizarComposicaoItem = (id: string, patch: Partial<ItemComposicao>) => {
    const nova = composicao.map((c) => (c.id === id ? { ...c, ...patch } : c));
    onChange({ ...itemRef.current, composicao: nova });
  };

  const removerComposicaoItem = (id: string) => {
    const nova = composicao.filter((c) => c.id !== id);
    onChange({ ...itemRef.current, composicao: nova });
  };

  // Adiciona componente por SKU com fetch (conector, kit, driver manual)
  const adicionarComponentePorSku = async (
    sku: string,
    papel: ItemComposicao["papel"]
  ) => {
    const { data } = await supabase
      .from("produtos")
      .select("id, codigo, descricao, preco_tabela, preco_minimo")
      .eq("codigo", sku)
      .limit(1);

    const row = data?.[0] as
      | { codigo: string; descricao: string; preco_tabela: number; preco_minimo: number }
      | undefined;
    if (!row) return;

    const novo: ItemComposicao = {
      id: crypto.randomUUID(),
      codigo: row.codigo,
      descricao: row.descricao,
      quantidade: 1,
      precoUnitario: Math.round((row.preco_tabela || 0) * 100) / 100,
      precoMinimo: Math.round((row.preco_minimo || 0) * 100) / 100,
      papel,
      obrigatorio: true,
    };

    const base = itemRef.current;
    onChange({ ...base, composicao: [...(base.composicao ?? []), novo] });
  };

  // Aplica driver por SKU (48V)
  const aplicarDriver48V = async (skuRecomendado: string) => {
    const { data } = await supabase
      .from("produtos")
      .select(
        "id, codigo, descricao, preco_tabela, preco_minimo, driver_potencia_w:potencia_watts"
      )
      .eq("codigo", skuRecomendado)
      .limit(1);

    const drv = data?.[0] as
      | { codigo: string; descricao: string; preco_tabela: number; preco_minimo: number; driver_potencia_w: number | null }
      | undefined;
    if (!drv) return;

    const driverItem: ItemComposicao = {
      id: crypto.randomUUID(),
      codigo: drv.codigo,
      descricao: drv.descricao,
      quantidade: 1,
      precoUnitario: Math.round((drv.preco_tabela || 0) * 100) / 100,
      precoMinimo: Math.round((drv.preco_minimo || 0) * 100) / 100,
      papel: "driver_recomendado",
      obrigatorio: true,
      potenciaW: drv.driver_potencia_w ?? undefined,
    };

    // Reconciliação pós-await: usar itemRef, remover driver anterior
    const base = itemRef.current;
    const semDriverAnterior = (base.composicao ?? []).filter(
      (c) => c.papel !== "driver_recomendado"
    );
    onChange({ ...base, composicao: [...semDriverAnterior, driverItem] });
  };

  // Aplica driver 24V a partir da sugestão já carregada
  const aplicarDriver24V = async () => {
    if (!sugestao24v) return;

    const { data } = await supabase
      .from("produtos")
      .select(
        "id, codigo, descricao, preco_tabela, preco_minimo, driver_potencia_w:potencia_watts"
      )
      .eq("codigo", sugestao24v.sku)
      .limit(1);

    const drv = data?.[0] as
      | { codigo: string; descricao: string; preco_tabela: number; preco_minimo: number; driver_potencia_w: number | null }
      | undefined;
    if (!drv) return;

    const driverItem: ItemComposicao = {
      id: crypto.randomUUID(),
      codigo: drv.codigo,
      descricao: drv.descricao,
      quantidade: 1,
      precoUnitario: Math.round((drv.preco_tabela || 0) * 100) / 100,
      precoMinimo: Math.round((drv.preco_minimo || 0) * 100) / 100,
      papel: "driver_recomendado",
      obrigatorio: true,
      potenciaW: drv.driver_potencia_w ?? undefined,
    };

    const base = itemRef.current;
    const semDriverAnterior = (base.composicao ?? []).filter(
      (c) => c.papel !== "driver_recomendado"
    );
    onChange({ ...base, composicao: [...semDriverAnterior, driverItem] });
  };

  // Seleciona módulo da busca escopada
  const handleSelecionarModulo = (produto: Produto) => {
    // Para SYSTEM MOLD, grava comprimento como snapshot via parsearComprimentoModulo
    const comprimento = isModular ? parsearComprimentoModulo(produto.descricao) : undefined;
    const novoModulo: ItemComposicao = {
      id: crypto.randomUUID(),
      codigo: produto.codigo,
      descricao: produto.descricao,
      quantidade: 1,
      precoUnitario: Math.round((produto.preco_tabela || 0) * 100) / 100,
      precoMinimo: Math.round((produto.preco_minimo || 0) * 100) / 100,
      imagemUrl: produto.imagem_url || undefined,
      papel: "modulo",
      obrigatorio: false,
      comprimento,
      potenciaW: isModular ? undefined : (produto.driver_potencia_w ?? undefined),
    };
    const base = itemRef.current;
    onChange({ ...base, composicao: [...(base.composicao ?? []), novoModulo] });
    setMostrarBuscaModulo(false);
  };

  // Adiciona fita modular escolhida pelo vendedor (SYSTEM MOLD) com metragem pré-preenchida
  const handleAdicionarFitaModular = (produto: Produto) => {
    const metragem = calcularMetragemModulosDifusos(itemRef.current.composicao);
    const novaFita: ItemComposicao = {
      id: crypto.randomUUID(),
      codigo: produto.codigo,
      descricao: produto.descricao,
      quantidade: 1,
      precoUnitario: Math.round((produto.preco_tabela || 0) * 100) / 100,
      precoMinimo: Math.round((produto.preco_minimo || 0) * 100) / 100,
      imagemUrl: produto.imagem_url || undefined,
      papel: 'fita_modular',
      obrigatorio: false,
      comprimento: metragem,  // metragem pré-preenchida (D-01)
    };
    const nova = [...(itemRef.current.composicao ?? []), novaFita];
    onChange({ ...itemRef.current, composicao: nova });
    setMostrarBuscaFita(false);
    // Dispara recomendação advisory de driver (não-bloqueante)
    buscarDriverModular(produto.voltagem ?? 24, produto.wm ?? 0, metragem);
  };

  // Busca driver para SYSTEM MOLD (advisory — vendedor clica Aplicar para inserir)
  const buscarDriverModular = async (voltagem: number, wm: number, metragem: number) => {
    const metragemEf = metragem > 0 ? metragem : 5;
    const consumo = wm * metragemEf * MARGEM_SEGURANCA_DRIVER;
    if (consumo <= 0) return;

    // Request-id: uma busca mais nova invalida as anteriores (resolução fora de ordem)
    const reqId = ++driverReqId.current;
    setBuscando24v(true);
    setSem24v(false);

    try {
      const { data } = await supabase
        .from("produtos")
        .select("id, codigo, descricao, preco_tabela, preco_minimo, driver_potencia_w:potencia_watts")
        .eq("tipo_produto", "driver")
        .eq("tensao", voltagem)
        .gte("potencia_watts", consumo)
        .not("descricao", "ilike", "%DESCONTINUAR%")
        .order("potencia_watts", { ascending: true })
        .limit(1);

      if (reqId !== driverReqId.current) return; // superada por uma busca mais recente

      const row = data?.[0] as
        | { codigo: string; descricao: string; driver_potencia_w: number | null; preco_tabela: number; preco_minimo: number }
        | undefined;

      if (row) {
        setSugestao24v({
          sku: row.codigo,
          descricao: row.descricao,
          potenciaW: row.driver_potencia_w ?? 0,
          precoTabela: Math.round((row.preco_tabela || 0) * 100) / 100,
          precoMinimo: Math.round((row.preco_minimo || 0) * 100) / 100,
        });
        setSem24v(false);
      } else {
        setSugestao24v(null);
        setSem24v(true);
      }
    } finally {
      // Só a busca vigente reseta o loading — evita "Calculando..." travado
      if (reqId === driverReqId.current) setBuscando24v(false);
    }
  };

  // Seleciona driver manual (busca de autocomplete no modo "Alterar")
  const handleSelecionarDriverManual = (produto: Produto) => {
    const driverItem: ItemComposicao = {
      id: crypto.randomUUID(),
      codigo: produto.codigo,
      descricao: produto.descricao,
      quantidade: 1,
      precoUnitario: Math.round((produto.preco_tabela || 0) * 100) / 100,
      precoMinimo: Math.round((produto.preco_minimo || 0) * 100) / 100,
      papel: "driver_recomendado",
      obrigatorio: true,
      potenciaW: produto.driver_potencia_w ?? undefined,
    };
    const base = itemRef.current;
    const semDriverAnterior = (base.composicao ?? []).filter(
      (c) => c.papel !== "driver_recomendado"
    );
    onChange({ ...base, composicao: [...semDriverAnterior, driverItem] });
    setMostrarBuscaDriver(false);
  };

  // ─── Checklist ───

  const regras = REGRAS_COMPOSICAO[item.sistema ?? ""] ?? null;
  const ehEmbutir = /EMBUTIR/i.test(item.descricao);

  const temConector = regras
    ? regras.conectoresObrigatorios.some((sku) =>
        composicao.some((c) => c.codigo === sku)
      )
    : false;

  const temKit = regras?.kitFixacaoEmbutir
    ? composicao.some((c) => c.codigo === regras.kitFixacaoEmbutir)
    : false;

  // SKU default do conector por família (D-10)
  const skuConectorDefault = is48V ? "LM2338" : "LM3168";

  // ─── Painel de driver — estado 48V ───

  const renderPainelDriver48V = () => {
    if (!rec48v) return null;

    if (rec48v.estado === "sem_carga") {
      return (
        <div className="rounded-md border border-dashed p-3 bg-muted/30 text-xs text-muted-foreground">
          Adicione módulos para calcular o driver recomendado.
        </div>
      );
    }

    if (rec48v.estado === "excede_200w") {
      return (
        <div className="rounded-md border border-amber-400/40 bg-amber-50 px-3 py-2 text-xs text-amber-900 space-y-1">
          <p>Atenção: carga total {cargaTotalW}W excede 200W.</p>
          <p>
            Recomendado dividir em {Math.ceil(cargaTotalW / 200)} circuitos com
            driver LM2344 (200W) cada.
          </p>
          <p>
            A divisão do trilho é decisão de projeto — adicione os drivers
            manualmente.
          </p>
        </div>
      );
    }

    // estado === 'recomendado'
    if (!driverAplicado) {
      return (
        <div className="rounded-md border border-blue-400/40 bg-blue-50 px-3 py-2 text-xs text-blue-900 space-y-1">
          <p>
            Driver recomendado: {rec48v.sku} ({rec48v.potenciaW}W) — 1 unidade
          </p>
          <p>
            Carga: {cargaTotalW}W × 1,05 = {rec48v.potenciaSeguraW}W calculados
          </p>
          <Button
            size="sm"
            variant="default"
            className="h-8 mt-1"
            onClick={() => aplicarDriver48V(rec48v.sku)}
          >
            Aplicar
          </Button>
        </div>
      );
    }

    // Driver aplicado
    const drvPotencia = driverAplicado.potenciaW ?? 0;
    const drvOk = drvPotencia >= cargaTotalW * MARGEM_SEGURANCA_DRIVER;

    if (drvOk) {
      if (mostrarBuscaDriver) {
        return (
          <div className="rounded-md border border-green-400/40 bg-green-50 px-3 py-2 text-xs text-green-900 space-y-2">
            <p className="flex items-center gap-1">
              <Check className="h-3.5 w-3.5 text-green-700" />
              Driver aplicado: {driverAplicado.codigo} ({drvPotencia}W) ×{" "}
              {driverAplicado.quantidade}
            </p>
            <ProdutoAutocomplete
              value=""
              onSelect={handleSelecionarDriverManual}
              placeholder="Buscar driver..."
              filtro="driver"
              filtroVoltagem={is48V ? 48 : 24}
            />
            <Button
              size="sm"
              variant="outline"
              className="h-8"
              onClick={() => setMostrarBuscaDriver(false)}
            >
              Cancelar
            </Button>
          </div>
        );
      }
      return (
        <div className="rounded-md border border-green-400/40 bg-green-50 px-3 py-2 text-xs text-green-900 space-y-1">
          <p className="flex items-center gap-1">
            <Check className="h-3.5 w-3.5 text-green-700" />
            Driver aplicado: {driverAplicado.codigo} ({drvPotencia}W) ×{" "}
            {driverAplicado.quantidade}
          </p>
          <Button
            size="sm"
            variant="outline"
            className="h-8"
            onClick={() => setMostrarBuscaDriver(true)}
          >
            Alterar
          </Button>
        </div>
      );
    }

    // Subdimensionado — rec48v é garantidamente 'recomendado' aqui (sem_carga e excede_200w
    // já retornaram no topo da função), então rec48v.sku está sempre definido.
    return (
      <div className="rounded-md border border-amber-400/40 bg-amber-50 px-3 py-2 text-xs text-amber-900 space-y-1">
        <p>
          Driver atual ({drvPotencia}W) insuficiente para a carga atual (
          {cargaTotalW}W).
        </p>
        <p>Recomendado: {rec48v.sku} ({rec48v.potenciaW}W)</p>
        <Button
          size="sm"
          variant="default"
          className="h-8 mt-1"
          onClick={() => aplicarDriver48V(rec48v.sku)}
        >
          Reaplicar recomendação
        </Button>
      </div>
    );
  };

  // ─── Painel de driver — estado 24V ───

  const renderPainelDriver24V = () => {
    if (cargaTotalW <= 0) {
      return (
        <div className="rounded-md border border-dashed p-3 bg-muted/30 text-xs text-muted-foreground">
          Adicione módulos para calcular o driver recomendado.
        </div>
      );
    }

    if (buscando24v) {
      return (
        <div className="rounded-md border border-dashed p-3 bg-muted/30 text-xs text-muted-foreground">
          Calculando driver recomendado...
        </div>
      );
    }

    if (driverAplicado) {
      const drvPotencia = driverAplicado.potenciaW ?? 0;
      const drvOk = drvPotencia >= cargaTotalW * MARGEM_SEGURANCA_DRIVER;

      if (drvOk) {
        if (mostrarBuscaDriver) {
          return (
            <div className="rounded-md border border-green-400/40 bg-green-50 px-3 py-2 text-xs text-green-900 space-y-2">
              <p className="flex items-center gap-1">
                <Check className="h-3.5 w-3.5 text-green-700" />
                Driver aplicado: {driverAplicado.codigo} ({drvPotencia}W) ×{" "}
                {driverAplicado.quantidade}
              </p>
              <ProdutoAutocomplete
                value=""
                onSelect={handleSelecionarDriverManual}
                placeholder="Buscar driver..."
                filtro="driver"
                filtroVoltagem={is48V ? 48 : 24}
              />
              <Button
                size="sm"
                variant="outline"
                className="h-8"
                onClick={() => setMostrarBuscaDriver(false)}
              >
                Cancelar
              </Button>
            </div>
          );
        }
        return (
          <div className="rounded-md border border-green-400/40 bg-green-50 px-3 py-2 text-xs text-green-900 space-y-1">
            <p className="flex items-center gap-1">
              <Check className="h-3.5 w-3.5 text-green-700" />
              Driver aplicado: {driverAplicado.codigo} ({drvPotencia}W) ×{" "}
              {driverAplicado.quantidade}
            </p>
            <Button
              size="sm"
              variant="outline"
              className="h-8"
              onClick={() => setMostrarBuscaDriver(true)}
            >
              Alterar
            </Button>
          </div>
        );
      }

      // Subdimensionado
      return (
        <div className="rounded-md border border-amber-400/40 bg-amber-50 px-3 py-2 text-xs text-amber-900 space-y-1">
          <p>
            Driver atual ({drvPotencia}W) insuficiente para a carga atual (
            {cargaTotalW}W).
          </p>
          {sugestao24v && <p>Recomendado: {sugestao24v.sku} ({sugestao24v.potenciaW}W)</p>}
          <Button
            size="sm"
            variant="default"
            className="h-8 mt-1"
            onClick={aplicarDriver24V}
          >
            Reaplicar recomendação
          </Button>
        </div>
      );
    }

    if (sem24v) {
      return (
        <div className="rounded-md border border-dashed p-3 text-xs text-destructive">
          Nenhum driver 24V compatível no catálogo para {cargaTotalW}W. Selecione manualmente.
        </div>
      );
    }

    if (sugestao24v) {
      return (
        <div className="rounded-md border border-blue-400/40 bg-blue-50 px-3 py-2 text-xs text-blue-900 space-y-1">
          <p>
            Driver recomendado: {sugestao24v.sku} ({sugestao24v.potenciaW}W) — 1 unidade
          </p>
          <p>
            Carga: {cargaTotalW}W × 1,05 ={" "}
            {Math.round(cargaTotalW * MARGEM_SEGURANCA_DRIVER * 100) / 100}W calculados
          </p>
          <Button
            size="sm"
            variant="default"
            className="h-8 mt-1"
            onClick={aplicarDriver24V}
          >
            Aplicar
          </Button>
        </div>
      );
    }

    return (
      <div className="rounded-md border border-dashed p-3 bg-muted/30 text-xs text-muted-foreground">
        Adicione módulos para calcular o driver recomendado.
      </div>
    );
  };

  // ─── Render ───

  const subtotalTotal =
    item.precoUnitario * item.quantidade + calcularSubtotalComposicao(item);

  return (
    <div className="rounded-lg border bg-muted/20 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-muted/40 border-b">
        <div className="flex items-center gap-2">
          {is48V && (
            <Badge
              variant="outline"
              className="text-[10px] px-1 py-0 font-semibold border-amber-500 text-amber-700 bg-amber-50"
            >
              MAGNETO 48V
            </Badge>
          )}
          {is24V && (
            <Badge
              variant="outline"
              className="text-[10px] px-1 py-0 font-semibold border-violet-400 text-violet-700 bg-violet-50"
            >
              TINY 24V
            </Badge>
          )}
          {isModular && (
            <Badge
              variant="outline"
              className="text-[10px] px-1 py-0 font-semibold border-sky-400 text-sky-700 bg-sky-50"
            >
              MODULAR
            </Badge>
          )}
          <span className="text-sm font-semibold text-foreground">
            Sistema {indice + 1}
          </span>
          {cargaTotalW > 0 && (
            <Badge variant="secondary" className="text-xs">
              Carga: {cargaTotalW}W
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          {onDuplicate && (
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-muted-foreground"
              title="Duplicar"
              onClick={onDuplicate}
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-destructive"
            onClick={onRemove}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Corpo */}
      <div className="p-4 space-y-3">
        {/* Trilho âncora */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
            Trilho âncora
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <Input
              value={item.codigo}
              readOnly
              className="bg-muted/50 w-28 h-8"
            />
            <Input
              value={item.descricao}
              readOnly
              className="bg-muted/50 flex-1 h-8 min-w-0"
            />
            <Input
              type="number"
              min={1}
              value={item.quantidade}
              onChange={(e) =>
                onChange({
                  ...item,
                  quantidade: parseInt(e.target.value) || 1,
                })
              }
              className="w-20 h-8"
            />
            <PrecoInput
              value={item.precoUnitario}
              min={item.precoMinimo}
              onChange={(v) => onChange({ ...item, precoUnitario: v })}
            />
            <Badge variant="secondary" className="text-xs whitespace-nowrap">
              {formatarMoeda(subtotalTotal)}
            </Badge>
          </div>
        </div>

        {/* Lista de módulos */}
        {modulos.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
              Módulos
            </p>
            <div className="space-y-1.5">
              {modulos.map((m) => (
                <div key={m.id} className="flex items-center gap-2 flex-wrap">
                  <Input
                    value={m.codigo}
                    readOnly
                    className="bg-muted/50 w-28 h-8"
                  />
                  <Input
                    value={m.descricao}
                    readOnly
                    className="bg-muted/50 flex-1 h-8 min-w-0"
                  />
                  <Input
                    type="number"
                    min={1}
                    value={m.quantidade}
                    onChange={(e) =>
                      atualizarComposicaoItem(m.id, {
                        quantidade: parseInt(e.target.value) || 1,
                      })
                    }
                    className="w-20 h-8"
                  />
                  <Badge variant="outline" className="text-xs whitespace-nowrap">
                    {m.potenciaW != null ? m.potenciaW + "W" : "?W"}
                  </Badge>
                  <PrecoInput
                    value={m.precoUnitario}
                    min={m.precoMinimo}
                    onChange={(v) =>
                      atualizarComposicaoItem(m.id, { precoUnitario: v })
                    }
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-destructive"
                    onClick={() => removerComposicaoItem(m.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Botão "+ Adicionar módulo" */}
        {mostrarBuscaModulo ? (
          <div className="space-y-1">
            <ProdutoAutocomplete
              value=""
              onSelect={handleSelecionarModulo}
              placeholder={isModular ? "Buscar difuso SYSTEM MOLD..." : "Buscar módulo..."}
              filtro={isModular ? "modulo_difuso" : "luminaria"}
              filtroSistema={isModular ? undefined : familiaSistema}
            />
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() => setMostrarBuscaModulo(false)}
            >
              Cancelar
            </Button>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="gap-2 mt-2"
            onClick={() => setMostrarBuscaModulo(true)}
          >
            <Plus className="h-4 w-4" />{isModular ? "+ Adicionar difuso" : "+ Adicionar módulo"}
          </Button>
        )}

        {/* Painel de fita derivada (SYSTEM MOLD) */}
        {isModular && (
          <div className="rounded-md border border-sky-300/50 bg-sky-50/50 px-3 py-2 space-y-2">
            <p className="text-xs font-semibold text-sky-900">
              Fita necessária:{" "}
              {metragemDerivada > 0
                ? `${metragemDerivada.toFixed(3).replace(/\.?0+$/, "").replace(".", ",")} m`
                : "—"}
              <span className="font-normal text-sky-700"> (Σ comprimento × qtd dos difusos)</span>
            </p>
            {fitaModular ? (
              <div className="flex items-center gap-2 flex-wrap">
                <Input
                  value={fitaModular.codigo}
                  readOnly
                  className="bg-muted/50 w-28 h-8"
                />
                <Input
                  value={fitaModular.descricao}
                  readOnly
                  className="bg-muted/50 flex-1 h-8 min-w-0"
                />
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">m:</span>
                  <Input
                    type="number"
                    min={0}
                    step={0.1}
                    value={fitaModular.comprimento ?? metragemDerivada}
                    onChange={(e) =>
                      atualizarComposicaoItem(fitaModular.id, {
                        comprimento: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-20 h-8"
                  />
                </div>
                <PrecoInput
                  value={fitaModular.precoUnitario}
                  min={fitaModular.precoMinimo}
                  onChange={(v) =>
                    atualizarComposicaoItem(fitaModular.id, { precoUnitario: v })
                  }
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-destructive"
                  onClick={() => removerComposicaoItem(fitaModular.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              metragemDerivada > 0 && !mostrarBuscaFita && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1"
                  onClick={() => setMostrarBuscaFita(true)}
                >
                  <Plus className="h-3 w-3" /> Adicionar fita
                </Button>
              )
            )}
            {mostrarBuscaFita && (
              <div className="space-y-1">
                <ProdutoAutocomplete
                  filtro="fita"
                  placeholder="Buscar fita LED..."
                  onSelect={handleAdicionarFitaModular}
                  value=""
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                  onClick={() => setMostrarBuscaFita(false)}
                >
                  Cancelar
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Painel de driver */}
        {(is48V || is24V || isModular) && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
              Driver
            </p>
            {is48V && renderPainelDriver48V()}
            {(is24V || isModular) && renderPainelDriver24V()}
          </div>
        )}

        {/* Checklist de componentes obrigatórios */}
        {regras && (
          <div className="rounded-md border px-3 py-2 space-y-1">
            <span className="text-xs font-semibold text-muted-foreground uppercase">
              Componentes obrigatórios
            </span>

            {/* Conector */}
            <div className="flex items-center gap-2">
              {temConector ? (
                <Check className="h-3.5 w-3.5 text-green-600 shrink-0" />
              ) : (
                <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
              )}
              <span className="text-xs flex-1">
                {temConector
                  ? `Conector ${regras.conectoresObrigatorios.join(" / ")} — presente`
                  : `Conector ${skuConectorDefault}${
                      regras.conectoresObrigatorios.length > 1
                        ? ` (ou ${regras.conectoresObrigatorios
                            .filter((s) => s !== skuConectorDefault)
                            .join(" / ")})`
                        : ""
                    } — ausente`}
              </span>
              {!temConector && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 text-[10px] gap-1"
                  onClick={() =>
                    adicionarComponentePorSku(skuConectorDefault, "conector_energia")
                  }
                >
                  + Adicionar
                </Button>
              )}
            </div>

            {/* Kit de fixação (só embutir) */}
            {ehEmbutir && regras.kitFixacaoEmbutir && (
              <div className="flex items-center gap-2">
                {temKit ? (
                  <Check className="h-3.5 w-3.5 text-green-600 shrink-0" />
                ) : (
                  <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                )}
                <span className="text-xs flex-1">
                  {temKit
                    ? `Kit Fixação ${regras.kitFixacaoEmbutir} (embutir) — presente`
                    : `Kit Fixação ${regras.kitFixacaoEmbutir} (embutir) — ausente`}
                </span>
                {!temKit && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 text-[10px] gap-1"
                    onClick={() =>
                      adicionarComponentePorSku(
                        regras.kitFixacaoEmbutir!,
                        "kit_fixacao"
                      )
                    }
                  >
                    + Adicionar
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ComposicaoCard;
