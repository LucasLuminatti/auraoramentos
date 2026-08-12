import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, Trash2, Plus, Pencil, Check, ArrowDown, Link, Unlink, Copy, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import ProdutoAutocomplete from "./ProdutoAutocomplete";
import ValidacaoPanel from "./ValidacaoPanel";
import { useValidarSistemas } from "@/hooks/useValidarSistemas";
import type { Ambiente, ItemLuminaria, SistemaIluminacao, ItemPerfil, ItemFitaLED, ItemDriver, Produto, CategoriaFita, ItemComposicao } from "@/types/orcamento";
import { calcularMetragemTotal, calcularDemandaFita, calcularConsumoW, calcularQtdDrivers, calcularQtdDriversEfetiva, calcularSubtotalLuminaria, calcularSubtotalSistemaSemFita, formatarMoeda, motivoQtdDrivers, analisarMagneto48V, MARGEM_SEGURANCA_DRIVER, TAMANHOS_ROLO_CATALOGO, aplicarSufixoMetragem, clonarSistema, detectarTipoAncora, perfilSomenteFitaBaby, perfilRejeitaFitaIP, fitaEhIP, fitaEhBaby, exigeDriverAlojado, classificarDriverSlim, LIMITE_W_DRIVER_ALOJADO, tipoLampadaDoSpot, fachosDoSpot, ehSpotConnectNoFrame, skuJuncaoConnect, avisoConferirPassadas, type TipoLampada } from "@/types/orcamento";
import ComposicaoCard from "./ComposicaoCard";
import OfertaLampada, { type LampadaOfertada } from "./OfertaLampada";

interface AmbienteCardProps {
  ambiente: Ambiente;
  onChange: (ambiente: Ambiente) => void;
  onRemove: () => void;
  onDuplicate?: () => void;
  onDuplicarComposto?: (item: ItemLuminaria) => void;   // Phase 21 / DUP-01 (D-05)
  /** Categorias de fita do orçamento (RULE-014) para vincular ao sistema (RULE-016). */
  categorias?: CategoriaFita[];
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

const AmbienteCard = ({ ambiente, onChange, onRemove, onDuplicate, onDuplicarComposto, categorias = [] }: AmbienteCardProps) => {
  const [isOpen, setIsOpen] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [tempName, setTempName] = useState(ambiente.nome);
  // Buffer local do input "Qtd drivers" por sistema (id → texto em edição).
  // Sem ele, limpar o campo repinta o valor calculado na hora e os dígitos
  // seguintes concatenam com ele (ex.: calc 2, digitar 15 → "215").
  const [qtdDriversDraft, setQtdDriversDraft] = useState<Record<string, string>>({});
  // RULE-011 / BUG-26: sugestões de fitas compatíveis por sistema (id → painel).
  // Só SUGERE (RULE-010 proíbe auto-escolher); painel fechável (RULE-002).
  const [fitasSugeridas, setFitasSugeridas] = useState<Record<string, { larguraMax: number; fitas: Produto[] } | undefined>>({});
  // RULE-044/045: oferta de lâmpada aberta para uma luminária (id → tipo detectado no nome).
  // A oferta acontece no MOMENTO da inclusão do spot; dispensar remove a entrada.
  const [ofertasLampada, setOfertasLampada] = useState<Record<string, TipoLampada>>({});

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

    // ── REGRA #24: spot sem LED integrado → lâmpada separada.
    // Quando o nome declara o TIPO da lâmpada, quem avisa é o painel de oferta
    // (RULE-044), já com as opções compatíveis — o toast genérico fica só para os
    // casos em que não dá para saber o tipo.
    const temBaseLampada = /\b(GU10|E27|MR11|MR16|AR70|AR111|PAR20|PAR30|DICROICA|DICRO)\b/.test(d);
    const temLedIntegrado = /LED\s+INTEGRADO|COM\s+LED/.test(d);
    if (temBaseLampada && !temLedIntegrado && !tipoLampadaDoSpot(produto.descricao)) {
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

    const alvo = ambiente.luminarias[index];
    updateLuminaria(index, {
      ...alvo,
      codigo: produto.codigo,
      descricao: produto.descricao,
      precoUnitario: Math.round((produto.preco_tabela || 0) * 100) / 100,
      precoMinimo: Math.round((produto.preco_minimo || 0) * 100) / 100,
      imagemUrl: imgUrl,
      sistema: produto.sistema_magnetico ?? null,
      potencia_watts: produto.driver_potencia_w ?? null,
      tensao: produto.voltagem ?? null,
    });

    // RULE-044: escolher o produto de um item vazio também é "incluir o spot".
    const tipoLampada = tipoLampadaDoSpot(produto.descricao);
    setOfertasLampada((o) => {
      const { [alvo.id]: _, ...resto } = o;
      return tipoLampada ? { ...resto, [alvo.id]: tipoLampada } : resto;
    });
  };

  // D-02a: menor potência suficiente entre drivers de mesma voltagem com tensao preenchida.
  // Consumo estimado = metragem real (se já houver) * wm, senão 5m fallback; margem 1.05.
  // RULE-029/100: quando o driver fica ALOJADO dentro do perfil (Trick/Alojamento),
  // a sugestão respeita o teto físico (72 W) e prefere Slim — o que não cabe não é sugerido.
  const buscarDriverSugerido = async (
    voltagem: number,
    wm: number,
    metragemReal: number,
    restricao?: { tetoW?: number | null; exigeSlim?: boolean },
  ): Promise<Produto | null> => {
    const metragem = metragemReal > 0 ? metragemReal : 5;
    const consumoEstimado = wm * metragem * MARGEM_SEGURANCA_DRIVER;
    let query = supabase
      .from('produtos')
      .select('id, codigo, descricao, preco_tabela, preco_minimo, voltagem:tensao, driver_potencia_w:potencia_watts, driver_tipo:subtipo')
      .eq('tipo_produto', 'driver')
      .eq('tensao', voltagem)
      .gte('potencia_watts', consumoEstimado)
      .not('descricao', 'ilike', '%DESCONTINUAR%');
    if (restricao?.tetoW != null) query = query.lte('potencia_watts', restricao.tetoW);
    const { data } = await query
      .order('potencia_watts', { ascending: true })
      .limit(restricao?.exigeSlim ? 10 : 1);

    const linhas = (data ?? []) as Produto[];
    if (!linhas.length) return null;
    if (!restricao?.exigeSlim) return linhas[0];
    // Descarta o que o catálogo marca como NÃO-Slim; prefere o Slim confirmado.
    const classificar = (p: Produto) => classificarDriverSlim({ driverTipo: p.driver_tipo, descricao: p.descricao });
    const possiveis = linhas.filter((p) => classificar(p) !== 'nao_slim');
    const slim = possiveis.filter((p) => classificar(p) === 'slim');
    return slim[0] ?? possiveis[0] ?? null;
  };

  /** RULE-029/100: restrição de driver imposta pelo perfil do sistema.
   *  Usa os campos do catálogo quando existem e cai na família/nome do perfil
   *  (Trick/Alojamento) quando o cadastro ainda não tem a restrição. */
  const restricaoDriverDoPerfil = (perfil: ItemPerfil | null) => {
    const alojado = exigeDriverAlojado({
      descricao: perfil?.descricao,
      familiaPerfil: perfil?.familia_perfil,
    });
    return {
      alojado,
      tetoW: perfil?.driver_restr_max_w ?? (alojado ? LIMITE_W_DRIVER_ALOJADO : null),
      exigeSlim: perfil?.driver_restr_tipo === 'slim' || alojado,
    };
  };

  // RULE-011 / BUG-26: ao escolher o perfil, buscar fitas COMPATÍVEIS com a família
  // (largura_mm <= largura_max_fita_mm em regras_compatibilidade_perfil) e SUGERIR.
  // Família sem regra cadastrada (ou sem limite) → não mostra nada, sem erro.
  const buscarFitasCompativeis = async (perfilProduto: Produto, sistemaId: string) => {
    // Perfil trocado: descarta sugestão anterior do sistema
    setFitasSugeridas((prev) => ({ ...prev, [sistemaId]: undefined }));
    const familia = perfilProduto.familia_perfil;
    if (!familia) return;

    const { data: regras } = await supabase
      .from('regras_compatibilidade_perfil')
      .select('largura_max_fita_mm')
      .eq('familia_perfil', familia)
      .limit(1);
    const larguraMax = regras?.[0]?.largura_max_fita_mm;
    if (larguraMax == null) return;

    let query = supabase
      .from('produtos')
      .select(
        'id, codigo, descricao, preco_tabela, preco_minimo, imagem_url, ' +
        'voltagem:tensao, wm:watts_por_metro, is_baby:somente_baby, somente_baby, largura_mm, tamanho_rolo_m, tipo_produto'
      )
      .eq('tipo_produto', 'fita')
      .lte('largura_mm', larguraMax)
      .not('descricao', 'ilike', '%DESCONTINUAR%')
      .order('largura_mm', { ascending: true })
      .order('codigo');
    // Perfil Baby-only: só fitas Baby são fisicamente compatíveis (REGRA #12/#13 / RULE-103)
    const soBaby = perfilSomenteFitaBaby({
      descricao: perfilProduto.descricao,
      familiaPerfil: familia,
      somenteBaby: perfilProduto.somente_baby,
    });
    if (soBaby) query = query.eq('somente_baby', true);
    const { data: fitas } = await query.limit(12);

    // Reconciliação pós-await: só exibe se o sistema ainda existir com ESTE perfil
    const alvo = ambienteRef.current.sistemas.find((s) => s.id === sistemaId);
    if (!alvo || alvo.perfil?.codigo !== perfilProduto.codigo) return;
    if (!fitas?.length) return;

    // RULE-103/104: a sugestão nunca oferece o que está bloqueado na origem.
    // (o filtro de IP é feito aqui, não no SQL: "%IP%" casaria dentro de outras palavras)
    const rejeitaIP = perfilRejeitaFitaIP({ descricao: perfilProduto.descricao, familiaPerfil: familia });
    const compativeis = (fitas as Produto[])
      .filter((f) => !soBaby || fitaEhBaby({ descricao: f.descricao, isBaby: f.is_baby ?? f.somente_baby }))
      .filter((f) => !rejeitaIP || !fitaEhIP(f.descricao))
      .slice(0, 8);
    if (!compativeis.length) return;
    setFitasSugeridas((prev) => ({ ...prev, [sistemaId]: { larguraMax, fitas: compativeis } }));
  };

  // Aplica uma fita sugerida reutilizando o fluxo normal de seleção de fita
  // (snapshot completo incl. largura_mm, reset de qtdDriversManual, sugestão de driver).
  const aplicarFitaSugerida = (fita: Produto, sistemaId: string) => {
    const idx = ambiente.sistemas.findIndex((s) => s.id === sistemaId);
    if (idx === -1) return;
    handleSelectProdutoSistema(fita, idx, 'fita');
    setFitasSugeridas((prev) => ({ ...prev, [sistemaId]: undefined }));
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

    // ── REGRA #12/#13 + RULE-103: perfil Baby-only (Light Mini / Ripado) — BLOQUEIO ──
    // A flag `somente_baby` do catálogo tem precedência; a família/nome cobre o que
    // ainda não está cadastrado. Motivo é físico: outra fita não cabe no canal.
    const perfilAtualSoBaby = sis.perfil
      ? perfilSomenteFitaBaby({
          descricao: sis.perfil.descricao,
          familiaPerfil: sis.perfil.familia_perfil,
          somenteBaby: sis.perfil.somente_baby,
        })
      : false;
    if (component === 'fita' && perfilAtualSoBaby && !fitaEhBaby({ descricao: produto.descricao, isBaby: produto.is_baby ?? produto.somente_baby })) {
      toast.error(
        `🚫 O perfil selecionado aceita SOMENTE fita Baby (não cabe outra). Selecione uma fita Baby.`,
        { duration: 6000 }
      );
      return;
    }
    // ── RULE-104: perfil Nano / Cantoneira não aceita fita com IP — BLOQUEIO ──
    const perfilAtualRejeitaIP = sis.perfil
      ? perfilRejeitaFitaIP({ descricao: sis.perfil.descricao, familiaPerfil: sis.perfil.familia_perfil })
      : false;
    if (component === 'fita' && perfilAtualRejeitaIP && fitaEhIP(produto.descricao)) {
      toast.error(
        `🚫 Perfil Nano/Cantoneira não aceita fita com IP (${produto.codigo}) — não cabe no canal. Selecione uma fita sem IP.`,
        { duration: 7000 }
      );
      return;
    }
    if (component === 'perfil' && sis.fita.codigo) {
      const novoSoBaby = perfilSomenteFitaBaby({
        descricao: produto.descricao,
        familiaPerfil: produto.familia_perfil,
        somenteBaby: produto.somente_baby,
      });
      if (novoSoBaby && !fitaEhBaby({ descricao: sis.fita.descricao, isBaby: sis.fita.is_baby })) {
        toast.warning(
          `⚠️ Este perfil aceita SOMENTE fita Baby. A fita atual (${sis.fita.codigo}) não é Baby — troque a fita.`,
          { duration: 7000 }
        );
      }
      if (perfilRejeitaFitaIP({ descricao: produto.descricao, familiaPerfil: produto.familia_perfil }) && fitaEhIP(sis.fita.descricao)) {
        toast.warning(
          `⚠️ Perfil Nano/Cantoneira não aceita fita com IP. A fita atual (${sis.fita.codigo}) tem IP — troque a fita.`,
          { duration: 7000 }
        );
      }
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
      // RULE-011: perfil escolhido → sugerir fitas compatíveis (nunca auto-escolher, RULE-010)
      buscarFitasCompativeis(produto, sis.id);
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
        largura_mm: produto.largura_mm ?? null, // RULE-013: snapshot p/ validação perfil×fita na edge
        metragemRolo: produto.tamanho_rolo_m ?? 5, // RULE-005: rolo vem do catálogo; fallback 5m
      };

      // Trocar manualmente a fita de um sistema vinculado o tira da categoria: o grupo
      // consolida pela fita da categoria (RULE-017), então manter o vínculo faria a fita
      // nova ser cobrada como se fosse a da categoria — e ela sumiria do Resumo de Fitas.
      const catAtual = sis.categoriaId ? categorias.find((c) => c.id === sis.categoriaId) : undefined;
      const saiuDaCategoria = !!catAtual && catAtual.fita.codigo !== produto.codigo;
      if (saiuDaCategoria) {
        toast.info(`Fita diferente da categoria "${catAtual!.nome}" — este sistema foi desvinculado da categoria.`);
      }

      // Aplica a fita imediatamente (síncrono) — nunca pode ser perdida pela
      // janela do await da sugestão de driver.
      // Trocar a fita invalida o override de qtd de drivers (o cálculo muda de base);
      // override obsoleto seria cobrado silenciosamente no Step 3/PDF.
      updateSistema(sistemaIndex, {
        ...sis,
        fita: fitaAtualizada,
        qtdDriversManual: null,
        categoriaId: saiuDaCategoria ? null : sis.categoriaId,
      });

      const fitaVolt = fitaAtualizada.voltagem;
      const driverVazio = !sis.driver.codigo; // D-03: só preenche se vazio
      if (driverVazio && fitaVolt) {
        const metragemReal = calcularDemandaFita({ ...sis, fita: fitaAtualizada });
        const restr = restricaoDriverDoPerfil(sis.perfil);
        const sugerido = await buscarDriverSugerido(fitaVolt, fitaAtualizada.wm, metragemReal, {
          tetoW: restr.tetoW,
          exigeSlim: restr.exigeSlim,
        });
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
      // ── REGRA #10/#11 + RULE-029/100: driver restrito por perfil ─────────
      // Driver alojado dentro do perfil (Trick/Alojamento) = Slim até 72 W. BLOQUEIA
      // quando o catálogo diz que o driver NÃO é Slim; quando o dado não existe, avisa.
      const restr = restricaoDriverDoPerfil(sis.perfil);
      if (restr.exigeSlim) {
        const classe = classificarDriverSlim({ driverTipo: produto.driver_tipo, descricao: produto.descricao });
        if (classe === 'nao_slim') {
          toast.error(
            `🚫 Este perfil aceita SOMENTE Driver Slim. O driver selecionado não é compatível.`,
            { duration: 6000 }
          );
          return;
        }
        if (classe === 'indeterminado') {
          toast.warning(
            `⚠️ Este perfil aceita SOMENTE Driver Slim e o catálogo não classifica ${produto.codigo} — confira antes de fechar.`,
            { duration: 7000 }
          );
        }
      }
      if (restr.tetoW != null && produto.driver_potencia_w && produto.driver_potencia_w > restr.tetoW) {
        toast.error(
          `🚫 Driver de ${produto.driver_potencia_w}W não cabe fisicamente neste perfil. Máximo: ${restr.tetoW}W.`,
          { duration: 6000 }
        );
        return;
      }
      updateSistema(sistemaIndex, {
        ...sis,
        // Trocar o driver invalida o override de qtd (potência/voltagem mudam o cálculo)
        qtdDriversManual: null,
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

  /** RULE-016: vincular o sistema a uma categoria COPIA a fita da categoria para o sistema
   *  (o snapshot continua sendo do sistema — preço e W/m seguem editáveis, RULE-001) e faz a
   *  metragem deste sistema somar na fita da categoria no Resumo de Fitas.
   *  `categoriaId` vazio = desvincular; a fita já aplicada permanece, só volta a consolidar
   *  por código. Trocar a fita invalida o override de qtd de drivers (mesma razão da troca
   *  manual de fita). */
  const vincularCategoria = (si: number, categoriaId: string) => {
    const sis = ambiente.sistemas[si];
    if (!categoriaId) {
      updateSistema(si, { ...sis, categoriaId: null });
      return;
    }
    const cat = categorias.find((c) => c.id === categoriaId);
    if (!cat) return;
    updateSistema(si, {
      ...sis,
      categoriaId,
      fita: { ...cat.fita, id: sis.fita.id },
      qtdDriversManual: null,
    });
  };

  // ─── Peças avulsas do sistema de perfil (RULE-106) ───
  const adicionarAcessorioSistema = (si: number, produto: Produto) => {
    const sis = ambienteRef.current.sistemas[si];
    if (!sis) return;
    const nova: ItemComposicao = {
      id: uid(),
      codigo: produto.codigo,
      descricao: produto.descricao,
      quantidade: 1,
      precoUnitario: Math.round((produto.preco_tabela || 0) * 100) / 100,
      precoMinimo: Math.round((produto.preco_minimo || 0) * 100) / 100,
      imagemUrl: produto.imagem_url || undefined,
      papel: 'acessorio_opcional',
      obrigatorio: false,
    };
    updateSistema(si, { ...sis, acessorios: [...(sis.acessorios ?? []), nova] });
  };

  const atualizarAcessorioSistema = (si: number, acessorioId: string, patch: Partial<ItemComposicao>) => {
    const sis = ambienteRef.current.sistemas[si];
    if (!sis) return;
    updateSistema(si, {
      ...sis,
      acessorios: (sis.acessorios ?? []).map((a) => (a.id === acessorioId ? { ...a, ...patch } : a)),
    });
  };

  const removerAcessorioSistema = (si: number, acessorioId: string) => {
    const sis = ambienteRef.current.sistemas[si];
    if (!sis) return;
    updateSistema(si, {
      ...sis,
      acessorios: (sis.acessorios ?? []).filter((a) => a.id !== acessorioId),
    });
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
        metragemRolo: produto.tamanho_rolo_m ?? 5, // RULE-005: rolo vem do catálogo; fallback 5m
        precoUnitario: preco,
        precoMinimo: precoMin,
        imagemUrl: imgUrl,
        is_baby: produto.is_baby,
        largura_mm: produto.largura_mm ?? null, // RULE-013: snapshot p/ validação perfil×fita na edge
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

    if (tipo === 'perfil') {
      // RULE-062 / BUG-09: perfil abre um SISTEMA (perfil + fita + driver) com o perfil já
      // preenchido — a fita fica em branco de propósito (RULE-010: nunca auto-escolher fita).
      // O sistema recém-criado é o último da lista, e é nele que roda a sugestão de fitas
      // compatíveis (RULE-011) e os bloqueios Baby/IP (RULE-103/104).
      const novoPerfil: ItemPerfil = {
        id: uid(),
        codigo: produto.codigo,
        descricao: produto.descricao,
        comprimentoPeca: 1,
        quantidade: 1,
        passadas: (produto.passadas ?? 1) as 1 | 2 | 3,
        precoUnitario: preco,
        precoMinimo: precoMin,
        imagemUrl: imgUrl,
        familia_perfil: produto.familia_perfil,
        driver_restr_tipo: produto.driver_restr_tipo,
        driver_restr_max_w: produto.driver_restr_max_w,
        somente_baby: produto.somente_baby,
        passadasPadrao: (produto.passadas ?? 3) as 1 | 2 | 3,
      };
      const novoSistema: SistemaIluminacao = {
        id: uid(),
        perfil: novoPerfil,
        fita: { id: uid(), codigo: "", descricao: "", wm: 0, voltagem: 24, metragemRolo: 5, precoUnitario: 0, precoMinimo: 0 },
        driver: { id: uid(), codigo: "", descricao: "", potencia: 0, voltagem: 24, precoUnitario: 0, precoMinimo: 0 },
        metragemManual: null,
        passadasManual: 1,
        local: null,
      };
      onChange({ ...ambiente, sistemas: [...ambiente.sistemas, novoSistema] });
      // RULE-011: perfil escolhido → sugerir fitas compatíveis (nunca auto-escolher)
      buscarFitasCompativeis(produto, novoSistema.id);
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
    if (temBaseLampada && !temLedIntegrado && !tipoLampadaDoSpot(produto.descricao)) {
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

    // RULE-044/045: a lâmpada é atrelada NO MOMENTO da inclusão do spot ("depois não dá
    // para colocar"). Vale para spot de embutir e para spot de trilho — nos dois a
    // quantidade fica livre. Se o nome não declara o tipo, nada é ofertado.
    const tipoLampada = tipoLampadaDoSpot(produto.descricao);
    if (tipoLampada) {
      setOfertasLampada((o) => ({ ...o, [novoItem.id]: tipoLampada }));
    }

    // RULE-112: spots CONNECT NO FRAME instalados lado a lado precisam do acessório de
    // junção, que muda conforme o tipo de lâmpada (LM2657 até PAR20 / LM2658 nos maiores).
    // Lembrete, não inserção: quantos spots ficam juntos é decisão de projeto.
    const skuJuncao = ehSpotConnectNoFrame(produto.descricao) ? skuJuncaoConnect(tipoLampada) : null;
    if (skuJuncao) {
      toast.info(
        `🔗 Se estes spots forem instalados lado a lado, inclua o acessório de junção ${skuJuncao} (um entre cada par).`,
        { duration: 9000 },
      );
    }
  };

  /** RULE-044 — insere a lâmpada escolhida como item do ambiente, logo após o spot. */
  const adicionarLampadaDoSpot = (
    spotId: string,
    lampada: LampadaOfertada,
    quantidade: number,
  ) => {
    const base = ambienteRef.current;
    const idx = base.luminarias.findIndex((l) => l.id === spotId);
    const novaLampada: ItemLuminaria = {
      id: uid(),
      codigo: lampada.codigo,
      descricao: lampada.descricao,
      quantidade,
      precoUnitario: Math.round((lampada.preco_tabela || 0) * 100) / 100,
      precoMinimo: Math.round((lampada.preco_minimo || 0) * 100) / 100,
      imagemUrl: lampada.imagem_url || undefined,
      sistema: null,
      potencia_watts: lampada.potencia_watts ?? null,
      tensao: null,
    };
    const arr = [...base.luminarias];
    arr.splice(idx === -1 ? arr.length : idx + 1, 0, novaLampada);
    onChange({ ...base, luminarias: arr });
    setOfertasLampada(({ [spotId]: _, ...resto }) => resto);
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
              clearOnSelect
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
              // RULE-044/045/111: oferta de lâmpada do spot recém-incluído. Fica logo
              // abaixo do item que a originou; quantidade sugerida = qtd × fachos.
              const ofertaTipo = ofertasLampada[item.id];
              const painelLampada = ofertaTipo ? (
                <OfertaLampada
                  tipo={ofertaTipo}
                  descricaoSpot={item.descricao}
                  quantidadeSugerida={Math.max(1, item.quantidade || 1) * fachosDoSpot(item.descricao)}
                  onAdicionar={(lamp, qtd) => adicionarLampadaDoSpot(item.id, lamp, qtd)}
                  onDispensar={() => setOfertasLampada(({ [item.id]: _, ...resto }) => resto)}
                />
              ) : null;

              if (item.composicao !== undefined) {
                return (
                  <ComposicaoCard
                    key={item.id}
                    item={item}
                    indice={i}
                    onChange={(novo) => updateLuminaria(i, novo)}
                    onRemove={() => removeLuminaria(i)}
                    onDuplicate={onDuplicarComposto ? () => onDuplicarComposto(item) : undefined}
                  />
                );
              }
              // Item simples (incluindo fallback D-03 para magneto/tiny sem composicao)
              return (
                <div key={item.id} className="space-y-2">
                  <div className="flex items-start gap-2 rounded-lg border p-3 bg-muted/30">
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
                  {painelLampada}
                </div>
              );
            })}

            {/* Sistemas de Fita Padrão — card byte-identical, apenas movido para fora das tabs */}
            {ambiente.sistemas.map((sis, si) => {
              const demandaFita = calcularDemandaFita(sis);
              const consumoW = calcularConsumoW(sis);
              // RULE-005: mesmo fallback de calcularRolosPorGrupo — snapshot antigo com 0/undefined
              // não pode exibir "0m" no Select enquanto o Step 3 cobra rolos de 5 m.
              const roloEfetivo = sis.fita.metragemRolo > 0 ? sis.fita.metragemRolo : 5;
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

                    {/* ── CATEGORIA DE FITA (RULE-016) ── */}
                    {categorias.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Categoria de fita</span>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">Opcional</Badge>
                        </div>
                        <Select value={sis.categoriaId ?? "__nenhuma__"} onValueChange={(v) => vincularCategoria(si, v === "__nenhuma__" ? "" : v)}>
                          <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Sem categoria" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__nenhuma__">Sem categoria</SelectItem>
                            {categorias.map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.nome || "(sem nome)"}{c.fita.codigo ? ` · ${c.fita.codigo}` : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {sis.categoriaId && (
                          <p className="text-[11px] text-muted-foreground">
                            A metragem deste sistema soma na fita da categoria — o rolo é comprado uma vez para o orçamento inteiro.
                          </p>
                        )}
                      </div>
                    )}

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
                          <Select value={String(roloEfetivo)} onValueChange={(v) => updateSistema(si, { ...sis, fita: { ...sis.fita, metragemRolo: Number(v) } })}>
                            <SelectTrigger className="w-20 h-8"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {/* RULE-005: tamanhos reais do catálogo; snapshot legado (ex.: 15m) entra na lista para
                                  não sumir do Select. Valor exibido é o EFETIVO — o mesmo que precifica no Step 3. */}
                              {[...new Set([...TAMANHOS_ROLO_CATALOGO, roloEfetivo])].sort((a, b) => a - b).map((t) => (
                                <SelectItem key={t} value={String(t)}>{t}m</SelectItem>
                              ))}
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
                          {/* RULE-009 — perfil sem regra de passadas no catálogo (477 dos 672 em
                              2026-08-12) entra com 1 passada. Quando o nome diz que o canal é
                              largo, isso costuma estar errado e sai barato demais. Só avisa:
                              mudar as passadas sozinho alteraria o preço da fita. */}
                          {(() => {
                            const aviso = avisoConferirPassadas(sis.perfil);
                            return aviso ? (
                              <div className="rounded-md border border-amber-400/40 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                                ⚠ {aviso}
                              </div>
                            ) : null;
                          })()}
                          <div className="flex items-center gap-3 flex-wrap">
                            <Badge variant="secondary" className="text-xs">Metragem: {calcularMetragemTotal(sis.perfil)}m</Badge>
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-muted-foreground whitespace-nowrap">Preço Un.:</span>
                              <PrecoInput value={sis.perfil.precoUnitario} min={sis.perfil.precoMinimo} onChange={(v) => updateSistema(si, { ...sis, perfil: { ...sis.perfil!, precoUnitario: v } })} />
                            </div>
                          </div>
                          {/* RULE-011 / BUG-26: fitas compatíveis com o perfil — painel dispensável (RULE-002),
                              clicar aplica a fita; NUNCA auto-escolhe (RULE-010) */}
                          {(() => {
                            const sug = fitasSugeridas[sis.id];
                            if (!sug) return null;
                            return (
                              <div className="rounded-md border border-blue-400/40 bg-blue-50 px-3 py-2 text-xs text-blue-900 space-y-1.5">
                                <div className="flex items-start justify-between gap-2">
                                  <p className="font-semibold">
                                    Fitas compatíveis com o perfil (largura ≤ {sug.larguraMax}mm) — clique para aplicar:
                                  </p>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-5 w-5 shrink-0 text-blue-900 hover:text-blue-950"
                                    title="Fechar sugestões"
                                    onClick={() => setFitasSugeridas((prev) => ({ ...prev, [sis.id]: undefined }))}
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                                <div className="space-y-1">
                                  {sug.fitas.map((f) => (
                                    <button
                                      key={f.id ?? f.codigo}
                                      type="button"
                                      className="w-full text-left rounded border border-blue-300/50 bg-background/60 px-2 py-1 hover:bg-blue-100 transition-colors"
                                      onClick={() => aplicarFitaSugerida(f, sis.id)}
                                    >
                                      <span className="font-medium">{f.codigo}</span>
                                      {f.largura_mm != null && <span className="text-blue-700"> · {f.largura_mm}mm</span>}
                                      <span className="text-blue-800"> — {f.descricao}</span>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            );
                          })()}
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
                        {/* RULE-001: qtd de drivers cobrada é editável — override manual com fallback no cálculo */}
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-muted-foreground whitespace-nowrap">Qtd drivers:</span>
                          <Input
                            type="number"
                            min={0}
                            value={qtdDriversDraft[sis.id] ?? String(calcularQtdDriversEfetiva(sis))}
                            onChange={(e) => {
                              const raw = e.target.value;
                              setQtdDriversDraft((d) => ({ ...d, [sis.id]: raw }));
                              if (raw !== "") updateSistema(si, { ...sis, qtdDriversManual: Math.max(0, parseInt(raw) || 0) });
                            }}
                            onBlur={() => {
                              const raw = qtdDriversDraft[sis.id];
                              if (raw === "") updateSistema(si, { ...sis, qtdDriversManual: null });
                              setQtdDriversDraft((d) => { const { [sis.id]: _, ...rest } = d; return rest; });
                            }}
                            className="w-20 h-8"
                          />
                          {calcularQtdDriversEfetiva(sis) !== qtdDrivers && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">manual (calc: {qtdDrivers})</Badge>
                          )}
                        </div>
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

                    {/* ── PEÇAS AVULSAS (RULE-106) ──
                        A equipe deixou claro que "perfil dinâmico" não é um produto: qualquer
                        perfil pode receber peças (tampa cega, spot, suporte). Sem automação —
                        o vendedor escolhe, e o valor entra no subtotal do sistema. */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Peças avulsas</span>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">Opcional</Badge>
                      </div>
                      {(sis.acessorios ?? []).map((a) => (
                        <div key={a.id} className="flex items-center gap-2 flex-wrap">
                          <Input value={a.codigo} readOnly className="bg-muted/50 w-28 h-8" />
                          <Input value={a.descricao} readOnly className="bg-muted/50 flex-1 h-8 min-w-0" />
                          <Input
                            type="number"
                            min={1}
                            value={a.quantidade}
                            onChange={(e) => {
                              const raw = e.target.value;
                              atualizarAcessorioSistema(si, a.id, { quantidade: raw === "" ? 1 : Math.max(1, parseInt(raw) || 1) });
                            }}
                            className="w-20 h-8"
                          />
                          <PrecoInput
                            value={a.precoUnitario}
                            min={a.precoMinimo}
                            onChange={(v) => atualizarAcessorioSistema(si, a.id, { precoUnitario: v })}
                          />
                          <Badge variant="secondary" className="text-xs whitespace-nowrap">
                            Total: {formatarMoeda(a.precoUnitario * a.quantidade)}
                          </Badge>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive"
                            onClick={() => removerAcessorioSistema(si, a.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                      <ProdutoAutocomplete
                        value=""
                        onSelect={(p) => adicionarAcessorioSistema(si, p)}
                        placeholder="Adicionar peça avulsa a este perfil (tampa, spot, suporte...)"
                        clearOnSelect
                      />
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
