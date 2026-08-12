import { useState, useRef, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Check, AlertCircle, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import ProdutoAutocomplete from "@/components/ProdutoAutocomplete";
import OfertaLampada, { type LampadaOfertada } from "@/components/OfertaLampada";
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
  parsearComprimentoDescricao,
  calcularOcupacaoTrilho,
  escolherTampaCega,
  contarTampasFuroFaltantes,
  ehModuloSpotOuPendente,
  SKU_TAMPA_FURO_MODULAR,
  COMPRIMENTO_TAMPA_FURO_M,
  corDoProduto,
  normalizarCor,
  exigeDriverAlojado,
  classificarDriverSlim,
  ehDriverDeTrilho,
  LIMITE_W_DRIVER_ALOJADO,
  tipoLampadaDoSpot,
  fachosDoSpot,
  type TipoLampada,
} from "@/types/orcamento";

/** Formata metros pt-BR com 2 casas ("1,53"). */
const formatarM = (v: number) => v.toFixed(2).replace(".", ",");

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
  /** RULE-031: true quando não foi possível confirmar que o driver é de TRILHO
   *  (o catálogo não marcou `sistema`/`subtipo` nem o nome traz "TRILHO MAGNETICO").
   *  Vira aviso no painel — nunca some com a sugestão. */
  tipoIncerto?: boolean;
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
  // Consumo (com a folga de segurança) da última busca de driver do modular —
  // no SYSTEM MOLD a carga vem de W/m × metragem da fita, que só existe no async.
  const [consumoModularW, setConsumoModularW] = useState(0);

  // Estado local da sugestão de tampa cega (RULE-037/038)
  const [buscandoTampa, setBuscandoTampa] = useState(false);
  // RULE-039: a oferta de tampa COM FURO é opcional ("posso colocar o spot no difusor") —
  // dispensada, some até o colaborador adicionar outro módulo de spot/pendente.
  const [buscandoTampaFuro, setBuscandoTampaFuro] = useState(false);
  const [tampaFuroDispensada, setTampaFuroDispensada] = useState(false);
  // RULE-044: oferta de lâmpada do módulo de spot recém-incluído (tipo lido do nome).
  const [ofertaLampada, setOfertaLampada] = useState<
    { tipo: TipoLampada; descricao: string; moduloId: string } | null
  >(null);
  // Buffer local do input "m:" dos acessórios (id → texto em edição) — flush no blur,
  // mesmo padrão do input "Qtd drivers" do AmbienteCard (evita repintar no meio da digitação)
  const [comprimentoDraft, setComprimentoDraft] = useState<Record<string, string>>({});
  // Buffer local dos inputs de QUANTIDADE de módulos/acessórios (mesmo motivo:
  // limpar repintava "1" e digitar 15 virava "115" — quantidade é cobrada)
  const [qtdDraft, setQtdDraft] = useState<Record<string, string>>({});

  const qtdInputProps = (c: ItemComposicao) => ({
    value: qtdDraft[c.id] ?? String(c.quantidade),
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      setQtdDraft((d) => ({ ...d, [c.id]: raw }));
      if (raw !== "") atualizarComposicaoItem(c.id, { quantidade: Math.max(1, parseInt(raw) || 1) });
    },
    onBlur: () => {
      setQtdDraft((d) => { const { [c.id]: _, ...rest } = d; return rest; });
    },
  });

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

  // Ocupação do trilho âncora (RULE-056 aviso / RULE-037 sobra) — recalcula a cada render
  const acessorios = composicao.filter((c) => c.papel === "acessorio_opcional");
  const lampadas = composicao.filter((c) => c.papel === "lampada");
  const ocupacao = calcularOcupacaoTrilho(item);
  const EPS_TRILHO = 0.005; // meio centímetro — ruído de float/parse não gera aviso
  const excedeTrilho = !!ocupacao && ocupacao.ocupadoM > ocupacao.trilhoM + EPS_TRILHO;
  const sobraTrilho = ocupacao ? ocupacao.trilhoM - ocupacao.ocupadoComTampasM : 0;

  // RULE-039: uma tampa com furo por módulo de spot/pendente. Derivado a cada render —
  // acompanha quantidade editada e remoção de módulo sem precisar de state.
  const tampasFuroFaltantes = isModular ? contarTampasFuroFaltantes(item.composicao) : 0;

  // Recomendação 48V (pura, sem side-effect)
  const rec48v = is48V ? recomendarDriver48V(cargaTotalW) : null;

  // RULE-029 + RULE-100: driver ALOJADO dentro do trilho/perfil (Trick/Alojamento e
  // modular de SOBREPOR) só aceita Slim de até 72 W — incompatibilidade física, BLOQUEIA.
  const driverAlojado = exigeDriverAlojado({ descricao: item.descricao, sistema: item.sistema });
  // RULE-054/110: cor do produto âncora — o acessório sugerido sai na mesma cor.
  const corAncora = corDoProduto(item.codigo, item.descricao);

  // Carga (já com a folga de segurança) usada no aviso de driver alojado.
  // No magnético vem dos módulos; no modular é W/m da fita × metragem dos difusos — derivado
  // a cada render, não guardado: preso em state, o aviso continuava mostrando a carga antiga
  // depois de remover módulos (a busca de driver só roda ao selecionar a fita).
  const consumoSeguro24v = isModular
    ? (fitaModular?.wm != null
        ? fitaModular.wm * metragemDerivada * MARGEM_SEGURANCA_DRIVER
        : consumoModularW) // snapshot antigo sem W/m: mantém o valor da última busca
    : cargaTotalW * MARGEM_SEGURANCA_DRIVER;
  const excedeDriverAlojado =
    driverAlojado && consumoSeguro24v > LIMITE_W_DRIVER_ALOJADO;

  /** Busca o driver recomendado (menor potência suficiente) para os sistemas 24V.
   *  - `somenteTrilho` (RULE-031): tenta primeiro os drivers de TRILHO; se o catálogo não
   *    marcar nenhum (`sistema`/`subtipo`/nome), refaz sem o filtro e devolve `tipoIncerto`
   *    — melhor sugerir com ressalva do que esconder o painel.
   *  - `tetoW` (RULE-029/100): teto físico do driver alojado dentro do trilho/perfil;
   *    drivers explicitamente NÃO-Slim ficam de fora. */
  const buscarDriver24V = async (opts: {
    consumoSeguroW: number;
    voltagem?: number;
    somenteTrilho?: boolean;
    tetoW?: number | null;
  }): Promise<Sugestao24V | null> => {
    type LinhaDriver = {
      codigo: string;
      descricao: string;
      driver_potencia_w: number | null;
      preco_tabela: number;
      preco_minimo: number;
      driver_tipo: string | null;
      sistema_magnetico: string | null;
    };

    const consultar = async (restringirTrilho: boolean): Promise<LinhaDriver[]> => {
      let q = supabase
        .from("produtos")
        .select(
          "id, codigo, descricao, preco_tabela, preco_minimo, " +
          "driver_potencia_w:potencia_watts, driver_tipo:subtipo, sistema_magnetico:sistema"
        )
        .eq("tipo_produto", "driver")
        .eq("tensao", opts.voltagem ?? 24)
        .gte("potencia_watts", opts.consumoSeguroW)
        .not("descricao", "ilike", "%DESCONTINUAR%");
      if (opts.tetoW != null) q = q.lte("potencia_watts", opts.tetoW);
      if (restringirTrilho) {
        q = q.or(
          "sistema.in.(tiny_magneto,magneto_48v,trilha),subtipo.eq.magnetico,descricao.ilike.%TRILHO%"
        );
      }
      const { data } = await q.order("potencia_watts", { ascending: true }).limit(10);
      return (data ?? []) as LinhaDriver[];
    };

    // RULE-100: com teto, drivers declaradamente NÃO-Slim são descartados (bloqueio);
    // os sem classificação no catálogo entram, porque o dado ainda não existe para todos.
    const escolher = (linhas: LinhaDriver[]): LinhaDriver | null => {
      if (opts.tetoW == null) return linhas[0] ?? null;
      const classificar = (l: LinhaDriver) =>
        classificarDriverSlim({ driverTipo: l.driver_tipo, descricao: l.descricao });
      const possiveis = linhas.filter((l) => classificar(l) !== "nao_slim");
      const slim = possiveis.filter((l) => classificar(l) === "slim");
      return (slim[0] ?? possiveis[0]) ?? null;
    };

    let linhas = opts.somenteTrilho ? await consultar(true) : await consultar(false);
    let usouFallback = false;
    if (opts.somenteTrilho && linhas.length === 0) {
      linhas = await consultar(false);
      usouFallback = true;
    }

    const row = escolher(linhas);
    if (!row) return null;

    const tipoIncerto =
      !!opts.somenteTrilho &&
      (usouFallback ||
        !ehDriverDeTrilho({
          sistema: row.sistema_magnetico,
          subtipo: row.driver_tipo,
          descricao: row.descricao,
        }));

    return {
      sku: row.codigo,
      descricao: row.descricao,
      potenciaW: row.driver_potencia_w ?? 0,
      precoTabela: Math.round((row.preco_tabela || 0) * 100) / 100,
      precoMinimo: Math.round((row.preco_minimo || 0) * 100) / 100,
      tipoIncerto,
    };
  };

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
      // RULE-031: no TINY 24V o driver é de TRILHO — driver de fita LED não serve.
      // Primeira tentativa restrita a drivers de trilho; se o catálogo não permitir
      // identificá-los, cai na busca genérica e marca a sugestão como incerta.
      const escolha = await buscarDriver24V({
        consumoSeguroW: cargaTotalW * MARGEM_SEGURANCA_DRIVER,
        somenteTrilho: true,
        tetoW: driverAlojado ? LIMITE_W_DRIVER_ALOJADO : null,
      });

      if (cancelled) return;

      if (escolha) {
        setSugestao24v(escolha);
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
  }, [is24V, cargaTotalW, driverAplicado, driverAlojado]);

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
    // RULE-055 — AVISO não bloqueante: módulo de cor diferente do trilho âncora.
    // Erro recorrente e caro; a cor vem da coluna `cor` do catálogo e, na falta dela,
    // do código/descrição. Cor desconhecida em qualquer um dos dois → nada é dito.
    // Dourado é universal (mesma leitura da edge) — nunca gera aviso.
    const corCatalogo = normalizarCor(produto.cor);
    const corModulo =
      corCatalogo === "dourado" ? null : (corCatalogo ?? corDoProduto(produto.codigo, produto.descricao));
    if (corAncora && corModulo && corModulo !== corAncora) {
      toast.warning(
        `⚠ Cor divergente: o módulo ${produto.codigo} é ${corModulo} e o trilho âncora é ${corAncora}. Confirme se é isso mesmo.`,
        { duration: 8000 }
      );
    }

    // Para SYSTEM MOLD, grava comprimento como snapshot via parsearComprimentoModulo.
    // Só os DIFUSOS ("...FITA LED 132MM...") casam esse parse, e é proposital: quem tem
    // `comprimento` entra em calcularMetragemModulosDifusos, ou seja, vira fita cobrada.
    // Spot e concentrado ficam sem snapshot (não levam fita); a ocupação do trilho
    // continua contando os dois, via parse genérico da descrição (RULE-056).
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
    // RULE-039: um novo spot/pendente refaz a pergunta da tampa com furo, mesmo que
    // ela já tenha sido dispensada para os módulos anteriores.
    if (ehModuloSpotOuPendente(produto.descricao)) setTampaFuroDispensada(false);

    // RULE-044: módulo de spot do modular também usa lâmpada (GU10/E27) — ofertar no
    // momento da inclusão, com o tipo lido do nome ("MODULO SPOT PARA DICROICA...").
    const tipoLamp = tipoLampadaDoSpot(produto.descricao);
    if (tipoLamp) setOfertaLampada({ tipo: tipoLamp, descricao: produto.descricao, moduloId: novoModulo.id });

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
      wm: produto.wm ?? 0,    // W/m: permite recalcular o consumo quando os módulos mudam
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
    setConsumoModularW(consumo);
    if (consumo <= 0) return;

    // Request-id: uma busca mais nova invalida as anteriores (resolução fora de ordem)
    const reqId = ++driverReqId.current;
    setBuscando24v(true);
    setSem24v(false);

    try {
      // RULE-029/100: no modular de sobrepor (driver alojado no trilho) o teto é 72 W
      // e o driver precisa ser Slim — acima disso não cabe fisicamente.
      const escolha = await buscarDriver24V({
        consumoSeguroW: consumo,
        voltagem,
        tetoW: driverAlojado ? LIMITE_W_DRIVER_ALOJADO : null,
      });

      if (reqId !== driverReqId.current) return; // superada por uma busca mais recente

      if (escolha) {
        setSugestao24v(escolha);
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
    // RULE-029/100 — BLOQUEIO na origem: driver alojado dentro do trilho/perfil
    // só cabe Slim até 72 W (CONF-01: incompatibilidade física bloqueia).
    if (driverAlojado) {
      const potencia = produto.driver_potencia_w ?? 0;
      if (potencia > LIMITE_W_DRIVER_ALOJADO) {
        toast.error(
          `🚫 Driver de ${potencia}W não cabe alojado neste perfil/trilho. Máximo: ${LIMITE_W_DRIVER_ALOJADO}W (driver Slim).`,
          { duration: 7000 }
        );
        return;
      }
      const classe = classificarDriverSlim({ driverTipo: produto.driver_tipo, descricao: produto.descricao });
      if (classe === "nao_slim") {
        toast.error(
          `🚫 Este perfil/trilho aceita SOMENTE driver Slim (até ${LIMITE_W_DRIVER_ALOJADO}W) — o driver selecionado não cabe dentro dele.`,
          { duration: 7000 }
        );
        return;
      }
      if (classe === "indeterminado") {
        toast.warning(
          `⚠ Não foi possível confirmar no catálogo que ${produto.codigo} é um driver Slim — confira antes de fechar (o driver fica alojado dentro do perfil).`,
          { duration: 7000 }
        );
      }
    }

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

  // Sugere e insere a tampa cega da sobra do trilho (RULE-037/038/040).
  // RULE-038: MENOR tampa comercial com comprimento >= sobra; se nenhuma cobre,
  // a MAIOR disponível + aviso. Sempre editável depois (RULE-001).
  const adicionarTampaCega = async () => {
    if (buscandoTampa || sobraTrilho <= EPS_TRILHO) return;
    setBuscandoTampa(true);
    try {
      const { data } = await supabase
        .from("produtos")
        .select("id, codigo, descricao, preco_tabela, preco_minimo, imagem_url")
        .ilike("descricao", "%TAMPA CEGA%")
        .not("descricao", "ilike", "%COM FURO%")     // RULE-039 (tampa de spot) fora do escopo
        .not("descricao", "ilike", "%DESCONTINUAR%")
        .limit(100);

      const rows = (data ?? []) as Array<{
        codigo: string; descricao: string; preco_tabela: number; preco_minimo: number; imagem_url: string | null;
      }>;

      // RULE-054/110: acessório sai na COR do produto âncora — empates de tamanho
      // preferem a tampa da mesma cor (helper puro compartilhado).
      const corAlvo = corDoProduto(itemRef.current.codigo, itemRef.current.descricao);
      const casaCor = (codigo: string, desc: string) =>
        corAlvo && corDoProduto(codigo, desc) === corAlvo ? 1 : 0;

      const candidatas = rows
        // s_mode usa as tampas do PERFIL MODULAR (SYSTEM MOLD); demais famílias ficam de fora
        .filter((p) => !isModular || /MODULAR/i.test(p.descricao ?? ""))
        .map((p) => ({ ...p, comprimentoM: parsearComprimentoDescricao(p.descricao ?? "") ?? 0 }))
        .filter((p) => p.comprimentoM > 0)
        // sort estável: cor certa primeiro
        .sort((a, b) => casaCor(b.codigo, b.descricao) - casaCor(a.codigo, a.descricao));

      const escolha = escolherTampaCega(candidatas, sobraTrilho);
      if (!escolha) {
        toast.warning("Nenhuma tampa cega com medida cadastrada foi encontrada no catálogo — adicione manualmente.");
        return;
      }
      if (!escolha.cobre) {
        toast.warning(
          `Nenhuma tampa cega cobre a sobra de ${formatarM(sobraTrilho)}m — adicionada a maior disponível (${formatarM(escolha.tampa.comprimentoM)}m).`
        );
      }

      const nova: ItemComposicao = {
        id: crypto.randomUUID(),
        codigo: escolha.tampa.codigo,
        descricao: escolha.tampa.descricao,
        quantidade: 1,
        precoUnitario: Math.round((escolha.tampa.preco_tabela || 0) * 100) / 100,
        precoMinimo: Math.round((escolha.tampa.preco_minimo || 0) * 100) / 100,
        imagemUrl: escolha.tampa.imagem_url || undefined,
        papel: "acessorio_opcional",
        obrigatorio: false,
        comprimento: escolha.tampa.comprimentoM,
      };
      const base = itemRef.current;
      onChange({ ...base, composicao: [...(base.composicao ?? []), nova] });
    } finally {
      setBuscandoTampa(false);
    }
  };

  // RULE-039/040 — insere a tampa cega COM FURO dos módulos de spot/pendente do modular.
  // Uma por módulo (quantidade = faltantes), na cor pedida. LM2561 = branco, LM2562 = preto
  // (confirmado pela equipe em 2026-08-12 e conferido nas descrições do catálogo).
  // O comprimento vem da descrição do produto; COMPRIMENTO_TAMPA_FURO_M (13,3 cm) só entra
  // se o cadastro não trouxer medida — a tampa participa da subtração da RULE-037.
  const adicionarTampaFuro = async (cor: "branco" | "preto") => {
    const faltantes = contarTampasFuroFaltantes(itemRef.current.composicao);
    if (buscandoTampaFuro || faltantes <= 0) return;
    const sku = SKU_TAMPA_FURO_MODULAR[cor];
    setBuscandoTampaFuro(true);
    try {
      const { data } = await supabase
        .from("produtos")
        .select("codigo, descricao, preco_tabela, preco_minimo, imagem_url")
        .eq("codigo", sku)
        // RULE-003: nunca oferecer código fora do catálogo atual. Se a tampa sair de linha,
        // a busca volta vazia e cai no aviso abaixo, em vez de sugerir item descontinuado.
        .not("descricao", "ilike", "%DESCONTINUAR%")
        .limit(1);

      const tampa = data?.[0] as
        | { codigo: string; descricao: string; preco_tabela: number; preco_minimo: number; imagem_url: string | null }
        | undefined;
      if (!tampa) {
        toast.error(`A tampa com furo ${sku} não está no catálogo — adicione o item manualmente.`);
        return;
      }

      const base = itemRef.current;
      const composicaoAtual = base.composicao ?? [];
      // Já existe uma linha dessa tampa? Soma na quantidade em vez de criar outra linha —
      // duas linhas do mesmo código dão o mesmo total mas poluem o PDF e a conferência.
      const existente = composicaoAtual.find(
        (c) => c.codigo === tampa.codigo && c.papel === "acessorio_opcional"
      );
      if (existente) {
        onChange({
          ...base,
          composicao: composicaoAtual.map((c) =>
            c.id === existente.id ? { ...c, quantidade: c.quantidade + faltantes } : c
          ),
        });
        return;
      }

      const nova: ItemComposicao = {
        id: crypto.randomUUID(),
        codigo: tampa.codigo,
        descricao: tampa.descricao,
        quantidade: faltantes,
        precoUnitario: Math.round((tampa.preco_tabela || 0) * 100) / 100,
        precoMinimo: Math.round((tampa.preco_minimo || 0) * 100) / 100,
        imagemUrl: tampa.imagem_url || undefined,
        papel: "acessorio_opcional",
        obrigatorio: false,
        comprimento: parsearComprimentoDescricao(tampa.descricao) ?? COMPRIMENTO_TAMPA_FURO_M,
      };
      onChange({ ...base, composicao: [...composicaoAtual, nova] });
    } finally {
      setBuscandoTampaFuro(false);
    }
  };

  /** RULE-044 — insere a lâmpada escolhida na composição, com papel próprio: ela não
   *  ocupa o trilho (RULE-056) nem entra na carga do driver (é 127/220 V na base). */
  const adicionarLampadaModulo = (lamp: LampadaOfertada, quantidade: number) => {
    const base = itemRef.current;
    const nova: ItemComposicao = {
      id: crypto.randomUUID(),
      codigo: lamp.codigo,
      descricao: lamp.descricao,
      quantidade,
      precoUnitario: Math.round((lamp.preco_tabela || 0) * 100) / 100,
      precoMinimo: Math.round((lamp.preco_minimo || 0) * 100) / 100,
      imagemUrl: lamp.imagem_url || undefined,
      papel: "lampada",
      obrigatorio: false,
    };
    onChange({ ...base, composicao: [...(base.composicao ?? []), nova] });
    setOfertaLampada(null);
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

  // SKU default do conector por família (D-10) — RULE-054/110: no TINY 24V o conector
  // sai na COR do trilho âncora (LM3168 preto / LM3169 branco). Cor indefinida mantém
  // o default histórico (preto), sem inventar.
  const skuConectorDefault = is48V
    ? "LM2338"
    : corAncora === "branco"
      ? "LM3169"
      : "LM3168";

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
            Carga: {cargaTotalW}W × {MARGEM_SEGURANCA_DRIVER.toFixed(2).replace(".", ",")} = {rec48v.potenciaSeguraW}W calculados
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
            Carga: {cargaTotalW}W × {MARGEM_SEGURANCA_DRIVER.toFixed(2).replace(".", ",")} ={" "}
            {Math.round(cargaTotalW * MARGEM_SEGURANCA_DRIVER * 100) / 100}W calculados
          </p>
          {/* RULE-031: driver de trilho ≠ driver de fita. Sem marcação no catálogo,
              sugerimos assim mesmo, mas com a ressalva explícita. */}
          {sugestao24v.tipoIncerto && (
            <p className="text-amber-900">
              ⚠ Não foi possível confirmar no catálogo que é um driver de TRILHO — confira antes de aplicar.
            </p>
          )}
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
                    {...qtdInputProps(m)}
                    className="w-20 h-8"
                  />
                  {/* RULE-066: badge de potência removido (redundante com a descrição) — o preço
                      unitário já aparece no PrecoInput ao lado. Exceção: módulo SEM potência
                      cadastrada mantém o alerta "?W" (entra como 0W no cálculo do driver). */}
                  {m.potenciaW == null && (
                    <Badge variant="outline" className="text-xs whitespace-nowrap border-amber-400/60 bg-amber-50 text-amber-900">
                      ?W
                    </Badge>
                  )}
                  <PrecoInput
                    value={m.precoUnitario}
                    min={m.precoMinimo}
                    onChange={(v) =>
                      atualizarComposicaoItem(m.id, { precoUnitario: v })
                    }
                  />
                  {/* RULE-066: valor total da linha (qtd × unitário) em tempo real */}
                  <Badge variant="secondary" className="text-xs whitespace-nowrap">
                    Total: {formatarMoeda(m.precoUnitario * m.quantidade)}
                  </Badge>
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

        {/* Lâmpadas atreladas aos módulos de spot (RULE-044). Sem campo "m:": lâmpada não
            ocupa o trilho e não pode entrar na somativa de capacidade (RULE-056). */}
        {lampadas.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
              Lâmpadas
            </p>
            <div className="space-y-1.5">
              {lampadas.map((l) => (
                <div key={l.id} className="flex items-center gap-2 flex-wrap">
                  <Input value={l.codigo} readOnly className="bg-muted/50 w-28 h-8" />
                  <Input value={l.descricao} readOnly className="bg-muted/50 flex-1 h-8 min-w-0" />
                  <Input type="number" min={1} {...qtdInputProps(l)} className="w-20 h-8" />
                  <PrecoInput
                    value={l.precoUnitario}
                    min={l.precoMinimo}
                    onChange={(v) => atualizarComposicaoItem(l.id, { precoUnitario: v })}
                  />
                  <Badge variant="secondary" className="text-xs whitespace-nowrap">
                    Total: {formatarMoeda(l.precoUnitario * l.quantidade)}
                  </Badge>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-destructive"
                    onClick={() => removerComposicaoItem(l.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Acessórios inseridos na composição (ex.: tampa cega — RULE-037). Editáveis (RULE-001). */}
        {acessorios.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
              Acessórios
            </p>
            <div className="space-y-1.5">
              {acessorios.map((a) => (
                <div key={a.id} className="flex items-center gap-2 flex-wrap">
                  <Input
                    value={a.codigo}
                    readOnly
                    className="bg-muted/50 w-28 h-8"
                  />
                  <Input
                    value={a.descricao}
                    readOnly
                    className="bg-muted/50 flex-1 h-8 min-w-0"
                  />
                  <Input
                    type="number"
                    min={1}
                    {...qtdInputProps(a)}
                    className="w-20 h-8"
                  />
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">m:</span>
                    <Input
                      type="number"
                      min={0}
                      step={0.1}
                      value={comprimentoDraft[a.id] ?? String(a.comprimento ?? parsearComprimentoDescricao(a.descricao) ?? "")}
                      onChange={(e) => {
                        const raw = e.target.value;
                        setComprimentoDraft((d) => ({ ...d, [a.id]: raw }));
                        if (raw !== "") atualizarComposicaoItem(a.id, { comprimento: parseFloat(raw) || 0 });
                      }}
                      onBlur={() => {
                        const raw = comprimentoDraft[a.id];
                        // Limpar volta ao comprimento da descrição (o cálculo da sobra usa esse
                        // fallback — exibir o mesmo valor evita display ≠ cálculo)
                        if (raw === "") atualizarComposicaoItem(a.id, { comprimento: undefined });
                        setComprimentoDraft((d) => { const { [a.id]: _, ...rest } = d; return rest; });
                      }}
                      className="w-20 h-8"
                    />
                  </div>
                  <PrecoInput
                    value={a.precoUnitario}
                    min={a.precoMinimo}
                    onChange={(v) =>
                      atualizarComposicaoItem(a.id, { precoUnitario: v })
                    }
                  />
                  <Badge variant="secondary" className="text-xs whitespace-nowrap">
                    Total: {formatarMoeda(a.precoUnitario * a.quantidade)}
                  </Badge>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-destructive"
                    onClick={() => removerComposicaoItem(a.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Aviso NÃO bloqueante de capacidade do trilho (RULE-056 / BUG-19).
            Tampa cega fica fora da soma — "passa sempre" (RULE-099). */}
        {excedeTrilho && ocupacao && (
          <div className="rounded-md border border-amber-400/40 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            ⚠ Os componentes somam {formatarM(ocupacao.ocupadoM)}m e o trilho tem {formatarM(ocupacao.trilhoM)}m — vai passar um pouquinho.
          </div>
        )}

        {/* Botão "+ Adicionar módulo" */}
        {mostrarBuscaModulo ? (
          <div className="space-y-1">
            <ProdutoAutocomplete
              value=""
              onSelect={handleSelecionarModulo}
              placeholder={isModular ? "Buscar módulo SYSTEM MOLD (difuso, spot...)" : "Buscar módulo..."}
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
            <Plus className="h-4 w-4" />+ Adicionar módulo
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

        {/* RULE-044/111 — lâmpada do módulo de spot, ofertada na inclusão. */}
        {ofertaLampada && (
          <OfertaLampada
            tipo={ofertaLampada.tipo}
            descricaoSpot={ofertaLampada.descricao}
            quantidadeSugerida={
              Math.max(
                1,
                composicao.find((c) => c.id === ofertaLampada.moduloId)?.quantidade || 1
              ) * fachosDoSpot(ofertaLampada.descricao)
            }
            onAdicionar={adicionarLampadaModulo}
            onDispensar={() => setOfertaLampada(null)}
          />
        )}

        {/* RULE-039 — tampa cega COM FURO por módulo de spot/pendente (só s_mode).
            Oferta opcional: o spot também pode ir no difusor, então tem "Não, obrigado".
            A cor sai igual à do trilho âncora (RULE-054/110); quando o catálogo não diz a
            cor do trilho, oferecemos as duas em vez de chutar. */}
        {isModular && tampasFuroFaltantes > 0 && !tampaFuroDispensada && (
          <div className="rounded-md border border-sky-300/50 bg-sky-50/50 px-3 py-2 space-y-2">
            <p className="text-xs font-semibold text-sky-900">
              {tampasFuroFaltantes === 1
                ? "1 módulo de spot/pendente sem tampa com furo — quer incluir?"
                : `${tampasFuroFaltantes} módulos de spot/pendente sem tampa com furo — quer incluir?`}
              <span className="font-normal text-sky-700"> (13,3 cm cada — entra na conta da sobra do trilho)</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {(corAncora ? [corAncora] : (["branco", "preto"] as const)).map((cor) => (
                <Button
                  key={cor}
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1"
                  disabled={buscandoTampaFuro}
                  onClick={() => adicionarTampaFuro(cor)}
                >
                  <Plus className="h-3 w-3" />
                  {buscandoTampaFuro
                    ? "Adicionando..."
                    : `Tampa com furo ${cor} (${SKU_TAMPA_FURO_MODULAR[cor]})`}
                </Button>
              ))}
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={() => setTampaFuroDispensada(true)}
              >
                Não, obrigado
              </Button>
            </div>
          </div>
        )}

        {/* Sugestão de tampa cega por subtração (RULE-037/038) — só s_mode.
            Recalcula dinamicamente conforme componentes entram/saem; some quando sobra ≤ 0.
            Só aparece com ao menos 1 componente no trilho (espelha a regra #26 da edge). */}
        {isModular && ocupacao && sobraTrilho > EPS_TRILHO && (modulos.length > 0 || acessorios.length > 0) && (
          <div className="rounded-md border border-sky-300/50 bg-sky-50/50 px-3 py-2 space-y-2">
            <p className="text-xs font-semibold text-sky-900">
              Sobra no trilho: {formatarM(sobraTrilho)} m — adicionar tampa cega?
              <span className="font-normal text-sky-700">
                {" "}(trilho {formatarM(ocupacao.trilhoM)}m − componentes {formatarM(ocupacao.ocupadoComTampasM)}m)
              </span>
            </p>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1"
              disabled={buscandoTampa}
              onClick={adicionarTampaCega}
            >
              <Plus className="h-3 w-3" />
              {buscandoTampa ? "Buscando tampa..." : "Adicionar tampa cega"}
            </Button>
          </div>
        )}

        {/* Painel de driver */}
        {(is48V || is24V || isModular) && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
              Driver
            </p>
            {/* RULE-029/100: driver alojado dentro do perfil/trilho não passa de 72 W —
                acima disso, dividir em circuitos (mesmo padrão do aviso de 200W do 48V). */}
            {excedeDriverAlojado && (
              <div className="rounded-md border border-amber-400/40 bg-amber-50 px-3 py-2 text-xs text-amber-900 space-y-1 mb-2">
                <p>
                  Atenção: a carga com folga ({Math.round(consumoSeguro24v * 10) / 10}W) excede os{" "}
                  {LIMITE_W_DRIVER_ALOJADO}W do driver Slim que cabe alojado dentro do perfil/trilho.
                </p>
                <p>
                  Recomendado dividir em {Math.ceil(consumoSeguro24v / LIMITE_W_DRIVER_ALOJADO)} circuitos
                  com um driver Slim de até {LIMITE_W_DRIVER_ALOJADO}W cada.
                </p>
                <p>A divisão é decisão de projeto — adicione os drivers manualmente.</p>
              </div>
            )}
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
