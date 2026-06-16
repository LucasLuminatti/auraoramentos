import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, Trash2, Plus, Pencil, Check, ArrowDown, Link, Unlink, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import ProdutoAutocomplete from "./ProdutoAutocomplete";
import ValidacaoPanel from "./ValidacaoPanel";
import { useValidarSistemas } from "@/hooks/useValidarSistemas";
import type { Ambiente, ItemLuminaria, SistemaIluminacao, ItemPerfil, ItemFitaLED, ItemDriver, Produto } from "@/types/orcamento";
import { calcularMetragemTotal, calcularDemandaFita, calcularConsumoW, calcularQtdDrivers, calcularSubtotalLuminaria, calcularSubtotalSistemaSemFita, formatarMoeda, motivoQtdDrivers, analisarMagneto48V, MARGEM_SEGURANCA_DRIVER, aplicarSufixoMetragem, clonarSistema, detectarTipoAncora } from "@/types/orcamento";
import ComposicaoCard from "./ComposicaoCard";

interface AmbienteCardProps {
  ambiente: Ambiente;
  onChange: (ambiente: Ambiente) => void;
  onRemove: () => void;
  onDuplicate?: () => void;
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

const AmbienteCard = ({ ambiente, onChange, onRemove, onDuplicate }: AmbienteCardProps) => {
  const [isOpen, setIsOpen] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [tempName, setTempName] = useState(ambiente.nome);

  const uid = () => crypto.randomUUID();
  const { validacoes } = useValidarSistemas(ambiente.sistemas);

  // Ref sempre apontando para o ambiente mais recente — usado para reconciliar
  // escritas que acontecem após um await (ex.: sugestão de driver assíncrona),
  // evitando snapshot estável / escrita por índice em linha errada (WR-01).
  const ambienteRef = useRef(ambiente);
  useEffect(() => { ambienteRef.current = ambiente; }, [ambiente]);

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
    const novoSistema: SistemaIluminacao = { id: uid(), perfil: null, fita: novaFita, driver: novoDriver, metragemManual: null, passadasManual: 1, local: null };
    onChange({ ...ambiente, sistemas: [...ambiente.sistemas, novoSistema] });
  };
  const updateSistema = (index: number, sis: SistemaIluminacao) => {
    const arr = [...ambiente.sistemas]; arr[index] = sis;
    onChange({ ...ambiente, sistemas: arr });
  };
  const removeSistema = (index: number) => {
    onChange({ ...ambiente, sistemas: ambiente.sistemas.filter((_, i) => i !== index) });
  };

  const duplicarSistema = (index: number) => {
    const clone = clonarSistema(ambiente.sistemas[index]);
    const arr = [...ambiente.sistemas];
    arr.splice(index + 1, 0, clone);
    onChange({ ...ambiente, sistemas: arr });
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
      if (/TRILHO.*EMBUTIR/.test(d)) {
        toast.warning(`⚡ TINY MAG 24V: requer driver 24V externo. Inclua o driver no sistema de iluminação correspondente.`, { duration: 9000 });
      } else {
        toast.warning(`⚡ TINY MAG 24V: requer driver 24V externo. Inclua o driver no sistema de iluminação correspondente.`, { duration: 9000 });
      }
    }

    // ── REGRA #24: Spot sem LED integrado → lâmpada separada ──
    const temBaseLampada = /\b(GU10|E27|MR11|MR16|AR70|AR111|PAR20|PAR30|DICROICA|DICRO)\b/.test(d);
    const temLedIntegrado = /LED\s+INTEGRADO|COM\s+LED/.test(d);
    if (temBaseLampada && !temLedIntegrado) {
      toast.info(`💡 Este produto não possui LED integrado — lembre-se de incluir a lâmpada separadamente no orçamento.`, { duration: 8000 });
    }

    // ── REGRA #25: Pino Hub requer Spot Hub como base ──
    if (/PINO\s+HUB/.test(d)) {
      const temSpotHub = ambiente.luminarias.some(l => /SPOT\s+HUB/.test((l.descricao || '').toUpperCase()));
      if (!temSpotHub) {
        toast.warning(`🔌 Pino Hub requer um Spot Hub (de Embutir ou No Frame) como base — adicione o Spot Hub antes de instalar.`, { duration: 10000 });
      }
    }

    // ── REGRA #28: Fita Flexível / Neon Flex → oferecer tampas ──
    if (/FITA\s+FLEX|NEON\s+FLEX|FLEXIVEL/.test(d)) {
      toast.info(`✨ Fita Flexível: considere incluir as Tampas de Vedação (LM2600 — 50 un.) para preservar o IP65 após cortes.`, { duration: 10000 });
    }

    updateLuminaria(index, {
      ...ambiente.luminarias[index],
      codigo: produto.codigo,
      descricao: produto.descricao,
      precoUnitario: Math.round((produto.preco_tabela || 0) * 100) / 100,
      precoMinimo: Math.round((produto.preco_minimo || 0) * 100) / 100,
      imagemUrl: imgUrl,
      sistema: produto.sistema_magnetico ?? null,
      potencia_watts: produto.driver_potencia_w ?? null,
      tensao: produto.voltagem ?? null,
    });
  };

  // D-02a: menor potência suficiente entre drivers de mesma voltagem com tensao preenchida.
  // Consumo estimado = metragem real (se já houver) * wm, senão 5m fallback; margem 1.05.
  const buscarDriverSugerido = async (voltagem: number, wm: number, metragemReal: number): Promise<Produto | null> => {
    const metragem = metragemReal > 0 ? metragemReal : 5;
    const consumoEstimado = wm * metragem * MARGEM_SEGURANCA_DRIVER;
    const { data } = await supabase
      .from('produtos')
      .select('id, codigo, descricao, preco_tabela, preco_minimo, voltagem:tensao, driver_potencia_w:potencia_watts, driver_tipo:subtipo')
      .eq('tipo_produto', 'driver')
      .eq('tensao', voltagem)
      .gte('potencia_watts', consumoEstimado)
      .not('descricao', 'ilike', '%DESCONTINUAR%')
      .order('potencia_watts', { ascending: true })
      .limit(1);
    return (data?.[0] as Produto) ?? null;
  };

  const handleSelectProdutoSistema = async (produto: Produto, sistemaIndex: number, component: 'perfil' | 'fita' | 'driver') => {
    const sis = ambiente.sistemas[sistemaIndex];
    const imgUrl = produto.imagem_url || undefined;
    const preco = Math.round((produto.preco_tabela || 0) * 100) / 100;
    const precoMin = Math.round((produto.preco_minimo || 0) * 100) / 100;

    // ── REGRA #1: Validação de Tensão — orientativa, não bloqueante (D-05/D-10) ──
    if (component === 'driver' && produto.voltagem && sis.fita.voltagem) {
      if (produto.voltagem !== sis.fita.voltagem) {
        toast.warning(
          `Atenção: driver ${produto.voltagem}V com fita ${sis.fita.voltagem}V — confira se a combinação está correta.`,
          { duration: 6000 }
        );
      }
    }
    if (component === 'fita' && produto.voltagem && sis.driver.codigo && sis.driver.voltagem) {
      if (produto.voltagem !== sis.driver.voltagem) {
        toast.warning(
          `Atenção: fita ${produto.voltagem}V com driver ${sis.driver.voltagem}V — confira se a combinação está correta.`,
          { duration: 6000 }
        );
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
          descricao: aplicarSufixoMetragem(produto.descricao, base.comprimentoPeca, base.quantidade),
          precoUnitario: preco,
          precoMinimo: precoMin,
          imagemUrl: imgUrl,
          passadas: passadasAuto,
          passadasPadrao: passadasAuto,
          familia_perfil: produto.familia_perfil,
          driver_restr_tipo: produto.driver_restr_tipo,
          driver_restr_max_w: produto.driver_restr_max_w,
          somente_baby: produto.somente_baby,
        },
      });
    } else if (component === 'fita') {
      const fitaAtualizada = {
        ...sis.fita,
        codigo: produto.codigo,
        descricao: produto.descricao,
        precoUnitario: preco,
        precoMinimo: precoMin,
        imagemUrl: imgUrl,
        voltagem: (produto.voltagem ?? sis.fita.voltagem) as 12 | 24 | 48,
        wm: produto.wm ?? sis.fita.wm,
        is_baby: produto.is_baby,
      };

      // Aplica a fita imediatamente (síncrono) — nunca pode ser perdida pela
      // janela do await da sugestão de driver.
      updateSistema(sistemaIndex, { ...sis, fita: fitaAtualizada });

      const fitaVolt = fitaAtualizada.voltagem;
      const driverVazio = !sis.driver.codigo; // D-03: só preenche se vazio
      if (driverVazio && fitaVolt) {
        const metragemReal = calcularDemandaFita({ ...sis, fita: fitaAtualizada });
        const sugerido = await buscarDriverSugerido(fitaVolt, fitaAtualizada.wm, metragemReal);
        if (sugerido) {
          // Reconcilia contra o estado mais recente, localizando o sistema por id
          // (não por índice — pode ter sido reordenado/removido durante o await)
          // e só preenche se o driver continuar vazio (não sobrescreve edição do usuário).
          const latest = ambienteRef.current;
          const idx = latest.sistemas.findIndex((s) => s.id === sis.id);
          if (idx !== -1 && !latest.sistemas[idx].driver.codigo) {
            const alvo = latest.sistemas[idx];
            const arr = [...latest.sistemas];
            arr[idx] = {
              ...alvo,
              driver: {
                ...alvo.driver,
                codigo: sugerido.codigo,
                descricao: sugerido.descricao,
                voltagem: (sugerido.voltagem ?? fitaVolt) as 12 | 24 | 48,
                potencia: sugerido.driver_potencia_w ?? alvo.driver.potencia,
                precoUnitario: Math.round((sugerido.preco_tabela || 0) * 100) / 100,
                precoMinimo: Math.round((sugerido.preco_minimo || 0) * 100) / 100,
                driver_tipo: sugerido.driver_tipo,
              },
            };
            onChange({ ...latest, sistemas: arr });
          }
        }
      }
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

  // ─── Roteamento product-first (Phase 20 / D-01/D-02/D-03) ───
  const handleSelectProdutoGlobal = (produto: Produto) => {
    const tipo = detectarTipoAncora(produto);
    const imgUrl = produto.imagem_url || undefined;
    const preco = Math.round((produto.preco_tabela || 0) * 100) / 100;
    const precoMin = Math.round((produto.preco_minimo || 0) * 100) / 100;

    if (tipo === 'fita') {
      // Rota Fita Padrão — construir sistema pré-populado inline para evitar stale closure (Pitfall 4).
      // Replica a lógica de addSistema() + handleSelectProdutoSistema(produto, i, 'fita')
      // em um único onChange, sem await (sugestão de driver é disparada separadamente abaixo).
      const novaFita: ItemFitaLED = {
        id: uid(),
        codigo: produto.codigo,
        descricao: produto.descricao,
        wm: produto.wm ?? 0,
        voltagem: (produto.voltagem ?? 24) as 12 | 24 | 48,
        metragemRolo: 5,
        precoUnitario: preco,
        precoMinimo: precoMin,
        imagemUrl: imgUrl,
        is_baby: produto.is_baby,
      };
      const novoDriver: ItemDriver = {
        id: uid(),
        codigo: '', descricao: '', potencia: 0,
        voltagem: (produto.voltagem ?? 24) as 12 | 24 | 48,
        precoUnitario: 0, precoMinimo: 0,
      };
      const novoSistema: SistemaIluminacao = {
        id: uid(), perfil: null, fita: novaFita, driver: novoDriver,
        metragemManual: null, passadasManual: 1, local: null,
      };
      const novosSistemas = [...ambiente.sistemas, novoSistema];
      onChange({ ...ambiente, sistemas: novosSistemas });

      // Sugestão automática de driver (mesmo padrão de handleSelectProdutoSistema fita path)
      const fitaVolt = novaFita.voltagem;
      if (fitaVolt) {
        const metragemReal = calcularDemandaFita(novoSistema);
        buscarDriverSugerido(fitaVolt, novaFita.wm, metragemReal).then((sugerido) => {
          if (sugerido) {
            const latest = ambienteRef.current;
            const idx = latest.sistemas.findIndex((s) => s.id === novoSistema.id);
            if (idx !== -1 && !latest.sistemas[idx].driver.codigo) {
              const alvo = latest.sistemas[idx];
              const arr = [...latest.sistemas];
              arr[idx] = {
                ...alvo,
                driver: {
                  ...alvo.driver,
                  codigo: sugerido.codigo,
                  descricao: sugerido.descricao,
                  voltagem: (sugerido.voltagem ?? fitaVolt) as 12 | 24 | 48,
                  potencia: sugerido.driver_potencia_w ?? alvo.driver.potencia,
                  precoUnitario: Math.round((sugerido.preco_tabela || 0) * 100) / 100,
                  precoMinimo: Math.round((sugerido.preco_minimo || 0) * 100) / 100,
                  driver_tipo: sugerido.driver_tipo,
                },
              };
              onChange({ ...latest, sistemas: arr });
            }
          }
        });
      }
      return;
    }

    if (tipo === 'magneto_48v' || tipo === 'tiny_magneto') {
      // Inicia composição: ItemLuminaria raiz (trilho âncora) com composicao: [] (Pattern 2).
      // Preservar toasts existentes (REGRAS #5-#28) — mesma lógica de handleSelectProdutoLuminaria.
      const d = (produto.descricao || '').toUpperCase();
      if (tipo === 'magneto_48v' || /MAGNETO22/.test(d)) {
        if (/TRILHO.*EMBUTIR/.test(d)) {
          toast.warning(`🧲 Trilho magnético 48V de embutir: inclua o Kit de Fixação LM2987 (vendido separadamente) + Conector LM2338 + Driver 100W (LM2343) ou 200W (LM2344).`, { duration: 10000 });
        } else if (/TRILHO/.test(d)) {
          toast.warning(`🧲 Trilho magnético 48V: inclua o Conector Direcional LM2338 + Driver 100W (LM2343) ou 200W (LM2344).`, { duration: 10000 });
        } else if (/MODULO|SPOT/.test(d)) {
          toast.info(`🧲 Módulo/spot magnético 48V: certifique-se de que o trilho e o driver (100W ou 200W) estão no orçamento.`, { duration: 8000 });
        }
      } else if (tipo === 'tiny_magneto' || /TINY\s+MAG/.test(d)) {
        toast.warning(`⚡ TINY MAG 24V: requer driver 24V externo. Inclua o driver no sistema de iluminação correspondente.`, { duration: 9000 });
      }

      const novaRaiz: ItemLuminaria = {
        id: uid(),
        codigo: produto.codigo, descricao: produto.descricao, quantidade: 1,
        precoUnitario: preco, precoMinimo: precoMin, imagemUrl: imgUrl,
        sistema: tipo,
        potencia_watts: produto.driver_potencia_w ?? null,
        tensao: produto.voltagem ?? (tipo === 'magneto_48v' ? 48 : 24),
        composicao: [], // presença ativa o ComposicaoCard
      };
      onChange({ ...ambiente, luminarias: [...ambiente.luminarias, novaRaiz] });
      return;
    }

    if (tipo === 'modular') {
      // Inicia composição SYSTEM MOLD: ItemLuminaria raiz (perfil modular) com composicao: [].
      // composicao: [] presença ativa o ComposicaoCard.
      const novaRaiz: ItemLuminaria = {
        id: uid(),
        codigo: produto.codigo, descricao: produto.descricao, quantidade: 1,
        precoUnitario: preco, precoMinimo: precoMin, imagemUrl: imgUrl,
        sistema: 's_mode',
        potencia_watts: null,            // perfil modular não tem potencia
        tensao: produto.voltagem ?? null,
        composicao: [],                  // presença ativa o ComposicaoCard
      };
      onChange({ ...ambiente, luminarias: [...ambiente.luminarias, novaRaiz] });
      return;
    }

    // 'luminaria' e fallback (D-03): item simples, SEM composicao.
    // Preservar toasts de REGRA #24 e #25 para itens simples.
    const d = (produto.descricao || '').toUpperCase();
    const temBaseLampada = /\b(GU10|E27|MR11|MR16|AR70|AR111|PAR20|PAR30|DICROICA|DICRO)\b/.test(d);
    const temLedIntegrado = /LED\s+INTEGRADO|COM\s+LED/.test(d);
    if (temBaseLampada && !temLedIntegrado) {
      toast.info(`💡 Este produto não possui LED integrado — lembre-se de incluir a lâmpada separadamente no orçamento.`, { duration: 8000 });
    }
    if (/PINO\s+HUB/.test(d)) {
      const temSpotHub = ambiente.luminarias.some(l => /SPOT\s+HUB/.test((l.descricao || '').toUpperCase()));
      if (!temSpotHub) {
        toast.warning(`🔌 Pino Hub requer um Spot Hub (de Embutir ou No Frame) como base — adicione o Spot Hub antes de instalar.`, { duration: 10000 });
      }
    }
    if (/FITA\s+FLEX|NEON\s+FLEX|FLEXIVEL/.test(d)) {
      toast.info(`✨ Fita Flexível: considere incluir as Tampas de Vedação (LM2600 — 50 un.) para preservar o IP65 após cortes.`, { duration: 10000 });
    }

    const novoItem: ItemLuminaria = {
      id: uid(),
      codigo: produto.codigo, descricao: produto.descricao, quantidade: 1,
      precoUnitario: preco, precoMinimo: precoMin, imagemUrl: imgUrl,
      sistema: produto.sistema_magnetico ?? null,
      potencia_watts: produto.driver_potencia_w ?? null,
      tensao: produto.voltagem ?? null,
    };
    onChange({ ...ambiente, luminarias: [...ambiente.luminarias, novoItem] });
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
          {onDuplicate && (
            <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-foreground" title="Duplicar ambiente" onClick={(e) => { e.stopPropagation(); onDuplicate(); }}>
              <span className="sr-only">Duplicar ambiente</span>
              <Copy className="h-4 w-4" />
            </Button>
          )}
          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); onRemove(); }}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="border-t p-4 space-y-4">

          {/* ─── Busca product-first (substitui as abas) ─── */}
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">Adicionar ao ambiente</span>
            <ProdutoAutocomplete
              value=""
              onSelect={handleSelectProdutoGlobal}
              placeholder="Buscar produto por código ou descrição..."
              className="w-full"
            />
          </div>

          {/* ─── Lista unificada (Pattern 10): luminarias[] + sistemas[] ─── */}
          <div className="space-y-3">

            {/* Banner legado analisarMagneto48V — fallback para luminárias antigas sem composicao */}
            {(() => {
              const r = analisarMagneto48V(ambiente);
              if (!r) return null;
              return (
                <div className="rounded-md border border-blue-400/40 bg-blue-50 px-3 py-2 text-xs text-blue-900 space-y-1">
                  <div>🧲 <strong>Sistema Magneto 48V:</strong> {r.qtdModulos} módulo{r.qtdModulos > 1 ? 's' : ''} somando <strong>{r.potenciaTotalW}W</strong>. Driver recomendado: <strong>{r.driverRecomendado}</strong>.</div>
                  {r.avisos.map((a, i) => <div key={i}>⚠️ {a}</div>)}
                </div>
              );
            })()}

            {/* Luminarias: composicao definida → ComposicaoCard; senão → item simples */}
            {ambiente.luminarias.map((item, i) => {
              if (item.composicao !== undefined) {
                return (
                  <ComposicaoCard
                    key={item.id}
                    item={item}
                    indice={i}
                    onChange={(novo) => updateLuminaria(i, novo)}
                    onRemove={() => removeLuminaria(i)}
                  />
                );
              }
              // Item simples (incluindo fallback D-03 para magneto/tiny sem composicao)
              return (
                <div key={item.id} className="flex items-start gap-2 rounded-lg border p-3 bg-muted/30">
                  <div className="flex-1 space-y-2">
                    <ProdutoAutocomplete value={item.codigo} onSelect={(p) => handleSelectProdutoLuminaria(p, i)} placeholder="Código do item" filtro="luminaria" />
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
                      {item.sistema === 'tiny_magneto' && (
                        <Badge variant="outline" className="text-[10px] border-amber-400 text-amber-700 bg-amber-50">requer driver 24V externo</Badge>
                      )}
                    </div>
                    {/* Fallback D-03: item magnético sem composicao — ação de conversão */}
                    {(item.sistema === 'magneto_48v' || item.sistema === 'tiny_magneto') && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 text-xs gap-1"
                        onClick={() => updateLuminaria(i, { ...item, composicao: [] })}
                      >
                        Iniciar como sistema composto
                      </Button>
                    )}
                  </div>
                  <Button size="icon" variant="ghost" className="text-destructive shrink-0" onClick={() => removeLuminaria(i)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}

            {/* Sistemas de Fita Padrão — card byte-identical, apenas movido para fora das tabs */}
            {ambiente.sistemas.map((sis, si) => {
              const demandaFita = calcularDemandaFita(sis);
              const consumoW = calcularConsumoW(sis);
              const qtdDrivers = calcularQtdDrivers(sis);
              const motivoDrivers = motivoQtdDrivers(sis);
              const subtotal = calcularSubtotalSistemaSemFita(sis);

              return (
                <div key={sis.id} className="rounded-lg border bg-muted/20 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2 bg-muted/40 border-b">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">Sistema {si + 1}</span>
                      {(() => {
                        const fv = sis.fita.voltagem, dv = sis.driver.voltagem;
                        const temDivergencia = !!sis.fita.codigo && !!sis.driver.codigo && fv !== undefined && dv !== undefined && fv !== dv;
                        return temDivergencia ? (
                          <Badge variant="destructive" className="text-[10px] px-1.5 py-0">⚠ {fv}V × {dv}V</Badge>
                        ) : null;
                      })()}
                      {(() => {
                        const semPerfilEInvalido = !!sis.fita.codigo && !sis.perfil && (!sis.metragemManual || sis.metragemManual <= 0);
                        return semPerfilEInvalido ? (
                          <Badge variant="destructive" className="text-[10px] px-1.5 py-0">⚠ Metragem obrigatória</Badge>
                        ) : null;
                      })()}
                    </div>
                    <div className="flex items-center gap-2">
                      {subtotal > 0 && <Badge variant="outline" className="text-xs">Subtotal (s/ fita): {formatarMoeda(subtotal)}</Badge>}
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-foreground" title="Duplicar sistema" onClick={() => duplicarSistema(si)}>
                        <span className="sr-only">Duplicar sistema</span>
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => removeSistema(si)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  <div className="p-4 space-y-3">

                    {/* ── LOCAL (opcional, Phase 5 PDF-01) ── */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Local</span>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">Opcional</Badge>
                      </div>
                      <Input
                        value={sis.local ?? ""}
                        onChange={(e) => updateSistema(si, { ...sis, local: e.target.value || null })}
                        placeholder="Sanca, Rasgo, Pé-direito... (deixe em branco se não aplicar)"
                        maxLength={40}
                        className="h-8 text-sm"
                      />
                    </div>

                    {/* ── FITA LED ── */}
                    <div className="space-y-2">
                      <span className="text-xs font-semibold text-primary uppercase tracking-wide">Fita LED</span>
                      <ProdutoAutocomplete value={sis.fita.codigo} onSelect={(p) => handleSelectProdutoSistema(p, si, 'fita')} placeholder="Código da fita" filtro="fita" />
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
                          <ProdutoAutocomplete value={sis.perfil.codigo} onSelect={(p) => handleSelectProdutoSistema(p, si, 'perfil')} placeholder="Código do perfil" filtro="perfil" />
                          <Input value={sis.perfil.descricao} readOnly placeholder="Descrição" className="bg-muted/50" />
                          <div className="flex items-center gap-3 flex-wrap">
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-muted-foreground">Comprimento:</span>
                              <Select value={String(sis.perfil.comprimentoPeca)} onValueChange={(v) => {
                                const novoComp = Number(v) as 1 | 2 | 3;
                                updateSistema(si, { ...sis, perfil: { ...sis.perfil!, comprimentoPeca: novoComp, descricao: aplicarSufixoMetragem(sis.perfil!.descricao, novoComp, sis.perfil!.quantidade) } });
                              }}>
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
                              <Input type="number" min={1} value={sis.perfil.quantidade} onChange={(e) => { const raw = e.target.value; const qtd = raw === "" ? 0 : (parseInt(raw) || 0); updateSistema(si, { ...sis, perfil: { ...sis.perfil!, quantidade: qtd, descricao: aplicarSufixoMetragem(sis.perfil!.descricao, sis.perfil!.comprimentoPeca, qtd) } }); }} className="w-20 h-8" />
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-muted-foreground">Passadas:</span>
                              <Select
                                value={String(sis.perfil.passadas)}
                                onValueChange={(v) => updateSistema(si, { ...sis, perfil: { ...sis.perfil!, passadas: Number(v) as 1 | 2 | 3 } })}
                              >
                                <SelectTrigger className="w-20 h-8"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {[1, 2, 3]
                                    .filter((n) => n <= (sis.perfil!.passadasPadrao ?? 3))
                                    .map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                                </SelectContent>
                              </Select>
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
                      <ProdutoAutocomplete value={sis.driver.codigo} onSelect={(p) => handleSelectProdutoSistema(p, si, 'driver')} placeholder="Código do driver" filtro="driver" filtroVoltagem={sis.fita.voltagem} />
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

            {/* Estado vazio */}
            {ambiente.luminarias.length === 0 && ambiente.sistemas.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">
                Nenhum item adicionado. Use a busca acima para adicionar luminárias ou sistemas.
              </p>
            )}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

export default AmbienteCard;
