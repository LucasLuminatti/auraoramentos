import { useState, useRef, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  calcularRolosFitaModular,
  calcularQtdDriversComposicao,
  TAMANHOS_ROLO_CATALOGO,
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
    // Rótulo acessível também é o que permite mirar a quantidade certa no E2E (a tela tem
    // vários campos numéricos por linha).
    "aria-label": `Quantidade ${c.codigo}`,
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
  // Conector de energia e kit de fixação entravam na composição (e no subtotal) sem aparecer
  // em lugar nenhum do card: cobrados às cegas, sem quantidade, preço nem remoção.
  // Qualquer papel não coberto pelas listas acima cai aqui — nada mais fica invisível.
  const outrosComponentes = composicao.filter(
    (c) =>
      c.papel !== "modulo" &&
      c.papel !== "driver_recomendado" &&
      c.papel !== "fita_modular" &&
      c.papel !== "acessorio_opcional" &&
      c.papel !== "lampada"
  );
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

  // RULE-005/006: a fita do SYSTEM MOLD acompanha os difusos. A metragem era gravada uma vez,
  // na escolha da fita — incluir 10 difusos depois deixava a linha com 1 rolo e o card dizendo
  // "fita 11 m". Só roda quando a soma dos difusos MUDA (não no mount): reabrir o passo 2 não
  // pode desfazer a quantidade ajustada à mão no passo 3. Metragem digitada pelo vendedor manda.
  const metragemDerivadaAnterior = useRef(metragemDerivada);
  useEffect(() => {
    if (metragemDerivadaAnterior.current === metragemDerivada) return;
    metragemDerivadaAnterior.current = metragemDerivada;
    if (!isModular) return;
    const base = itemRef.current;
    const fita = (base.composicao ?? []).find((c) => c.papel === "fita_modular");
    // sem `metragemRolo` = item gravado antes da cobrança por rolo: fica como está
    if (!fita || fita.metragemEditada || fita.metragemRolo == null) return;
    const quantidade = calcularRolosFitaModular(metragemDerivada, fita.metragemRolo);
    if (fita.comprimento === metragemDerivada && fita.quantidade === quantidade) return;
    onChange({
      ...base,
      composicao: (base.composicao ?? []).map((c) =>
        c.id === fita.id ? { ...c, comprimento: metragemDerivada, quantidade } : c
      ),
    });
    // onChange muda de identidade a cada render do pai; o gatilho é só a metragem derivada
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metragemDerivada, isModular]);

  /** Carga CRUA (sem a folga) que o driver do composto precisa alimentar.
   *  Magnético: soma dos módulos. SYSTEM MOLD: W/m × metragem dos difusos — é a fita que puxa
   *  o driver, mesma conta que escolhe o SKU em `buscarDriver24V`.
   *  Recebe o item para poder ser reavaliado depois do await (Pitfall 3). */
  const cargaDoDriver = (base: ItemLuminaria): number => {
    if (!isModular) return calcularCargaComposicao(base.composicao);
    const fita = (base.composicao ?? []).find((c) => c.papel === "fita_modular");
    const metragem = calcularMetragemModulosDifusos(base.composicao);
    if (fita?.wm != null) return fita.wm * metragem;
    return consumoModularW / MARGEM_SEGURANCA_DRIVER; // snapshot antigo: valor da última busca
  };

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
        .not("descricao", "ilike", "%DESCONTINUAR%")
        .eq("ativo", true);
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

  // Sempre sobre `itemRef.current`: o efeito de sincronização da fita modular grava depois do
  // commit, e mapear o `composicao` do render podia regravar a fita com valores antigos.
  const atualizarComposicaoItem = (id: string, patch: Partial<ItemComposicao>) => {
    const nova = (itemRef.current.composicao ?? []).map((c) => (c.id === id ? { ...c, ...patch } : c));
    onChange({ ...itemRef.current, composicao: nova });
  };

  /** Devolve a fita do modular ao cálculo pelos difusos (desfaz a metragem digitada). */
  const usarMetragemDosDifusos = (fita: ItemComposicao) => {
    const m = calcularMetragemModulosDifusos(itemRef.current.composicao);
    atualizarComposicaoItem(fita.id, {
      comprimento: m,
      metragemEditada: false,
      ...(fita.metragemRolo != null ? { quantidade: calcularRolosFitaModular(m, fita.metragemRolo) } : {}),
    });
  };

  const removerComposicaoItem = (id: string) => {
    const nova = (itemRef.current.composicao ?? []).filter((c) => c.id !== id);
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

    // Reconciliação pós-await: usar itemRef, remover driver anterior
    const base = itemRef.current;
    const driverItem: ItemComposicao = {
      id: crypto.randomUUID(),
      codigo: drv.codigo,
      descricao: drv.descricao,
      // RULE-026: carga acima da potência do driver pede mais de um (folga de 20% inclusa).
      // Entrava fixo em 1 — o orçamento saía com um driver só para 2 circuitos. Editável depois.
      // `|| 1`: carga desconhecida (snapshot antigo sem W/m) não zera a peça aplicada à mão.
      quantidade: calcularQtdDriversComposicao(cargaDoDriver(base), drv.driver_potencia_w) || 1,
      precoUnitario: Math.round((drv.preco_tabela || 0) * 100) / 100,
      precoMinimo: Math.round((drv.preco_minimo || 0) * 100) / 100,
      papel: "driver_recomendado",
      obrigatorio: true,
      potenciaW: drv.driver_potencia_w ?? undefined,
    };

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

    const base = itemRef.current;
    const driverItem: ItemComposicao = {
      id: crypto.randomUUID(),
      codigo: drv.codigo,
      descricao: drv.descricao,
      // RULE-026 — ver comentário em aplicarDriver48V
      quantidade: calcularQtdDriversComposicao(cargaDoDriver(base), drv.driver_potencia_w) || 1,
      precoUnitario: Math.round((drv.preco_tabela || 0) * 100) / 100,
      precoMinimo: Math.round((drv.preco_minimo || 0) * 100) / 100,
      papel: "driver_recomendado",
      obrigatorio: true,
      potenciaW: drv.driver_potencia_w ?? undefined,
    };

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
    // RULE-005/006: a fita é vendida em ROLO, então a quantidade cobrada são os rolos que a
    // metragem dos difusos exige (com 5% de perda por rolo) — até 2026-09-16 entrava sempre
    // `1`, e 12 m de difusor saíam com o preço de um rolo só.
    const roloPresumido = produto.tamanho_rolo_m == null || produto.tamanho_rolo_m <= 0;
    const metragemRolo = roloPresumido ? 5 : (produto.tamanho_rolo_m as number);
    const novaFita: ItemComposicao = {
      id: crypto.randomUUID(),
      codigo: produto.codigo,
      descricao: produto.descricao,
      quantidade: calcularRolosFitaModular(metragem, metragemRolo),
      metragemRolo,
      ...(roloPresumido ? { roloPresumido: true } : {}),
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

    const base = itemRef.current;
    const driverItem: ItemComposicao = {
      id: crypto.randomUUID(),
      codigo: produto.codigo,
      descricao: produto.descricao,
      // RULE-026 — ver comentário em aplicarDriver48V. Vale também para o driver escolhido à
      // mão: carga de 150W com Slim de 72W entra como 3 (um por circuito), não como 1.
      quantidade: calcularQtdDriversComposicao(cargaDoDriver(base), produto.driver_potencia_w) || 1,
      precoUnitario: Math.round((produto.preco_tabela || 0) * 100) / 100,
      precoMinimo: Math.round((produto.preco_minimo || 0) * 100) / 100,
      papel: "driver_recomendado",
      obrigatorio: true,
      potenciaW: produto.driver_potencia_w ?? undefined,
    };
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
        .eq("ativo", true)
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
        .eq("ativo", true)
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

  // ─── Painel de driver — box "aplicado" (compartilhado 48V/24V) ───

  /** Box do driver já aplicado. A QUANTIDADE é editável aqui (RULE-001): o número que entra é o
   *  cálculo da folga de 20%, mas a divisão em circuitos é decisão de projeto.
   *  `alerta` (subdimensionado) entra DENTRO deste box, e não como um box separado: trocar de
   *  box desmontava o input no meio da digitação — quem digitasse "12" perdia o "2" ao passar
   *  por "1" (quantidade insuficiente). */
  const renderDriverAplicado = (
    drv: ItemComposicao,
    drvPotencia: number,
    alerta?: React.ReactNode
  ) => (
    <div
      className={cn(
        "rounded-md border px-3 py-2 text-xs space-y-2",
        alerta
          ? "border-amber-400/40 bg-amber-50 text-amber-900"
          : "border-green-400/40 bg-green-50 text-green-900"
      )}
    >
      <div className="flex items-center gap-1 flex-wrap">
        {alerta ? (
          <AlertCircle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
        ) : (
          <Check className="h-3.5 w-3.5 text-green-700 shrink-0" />
        )}
        <span>
          Driver aplicado: {drv.codigo} ({drvPotencia}W) ×
        </span>
        <Input
          type="number"
          min={1}
          step={1}
          className="h-7 w-16 text-xs"
          {...qtdInputProps(drv)}
          aria-label="Quantidade de drivers"
        />
        {drvPotencia > 0 && (
          <span className={alerta ? "text-amber-800" : "text-green-700"}>
            = {Math.round(drvPotencia * drv.quantidade * 10) / 10}W
          </span>
        )}
      </div>
      {alerta}
      {mostrarBuscaDriver ? (
        <>
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
        </>
      ) : (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-8"
            onClick={() => setMostrarBuscaDriver(true)}
          >
            Alterar
          </Button>
          {/* Driver sem carga (módulos removidos) continuava cobrado sem jeito de tirar */}
          <Button
            size="sm"
            variant="ghost"
            className="h-8 text-destructive"
            onClick={() => removerComposicaoItem(drv.id)}
          >
            <Trash2 className="h-3.5 w-3.5 mr-1" />
            Remover
          </Button>
        </div>
      )}
    </div>
  );

  // ─── Painel de driver — estado 48V ───

  const renderPainelDriver48V = () => {
    if (!rec48v) return null;

    if (rec48v.estado === "sem_carga") {
      // Driver aplicado continua cobrado mesmo sem módulo (ou com módulo "?W") — tem que
      // continuar na tela para poder ser conferido ou removido.
      if (driverAplicado) return renderDriverAplicado(driverAplicado, driverAplicado.potenciaW ?? 0);
      return (
        <div className="rounded-md border border-dashed p-3 bg-muted/30 text-xs text-muted-foreground">
          Adicione módulos para calcular o driver recomendado.
        </div>
      );
    }

    if (rec48v.estado === "excede_200w") {
      // Nº de circuitos pela mesma conta do driver (RULE-026: folga de 20% sobre a carga).
      // Antes dividia pela potência crua e o aviso podia pedir menos circuitos do que o cálculo.
      const nCircuitos = calcularQtdDriversComposicao(cargaTotalW, 200);
      const drvPotencia = driverAplicado?.potenciaW ?? 0;
      const faltaPotencia =
        !!driverAplicado &&
        drvPotencia * driverAplicado.quantidade < cargaTotalW * MARGEM_SEGURANCA_DRIVER;
      return (
        <div className="space-y-2">
          <div className="rounded-md border border-amber-400/40 bg-amber-50 px-3 py-2 text-xs text-amber-900 space-y-1">
            <p>Atenção: carga total {cargaTotalW}W excede 200W.</p>
            <p>
              Recomendado dividir em {nCircuitos} circuitos com driver LM2344 (200W) cada.
            </p>
            <p>A divisão do trilho é decisão de projeto — a quantidade fica editável.</p>
            {!driverAplicado && (
              <Button
                size="sm"
                variant="default"
                className="h-8 mt-1"
                onClick={() => aplicarDriver48V("LM2344")}
              >
                Aplicar {nCircuitos}× LM2344
              </Button>
            )}
          </div>
          {/* Acima de 200W o painel voltava só o aviso: o driver já aplicado desaparecia da
              tela e a quantidade ficava sem como ser conferida/editada. */}
          {driverAplicado &&
            renderDriverAplicado(
              driverAplicado,
              drvPotencia,
              faltaPotencia ? (
                <div className="space-y-1">
                  <p>
                    Potência aplicada insuficiente para {cargaTotalW}W ×{" "}
                    {MARGEM_SEGURANCA_DRIVER.toFixed(2).replace(".", ",")} ={" "}
                    {Math.round(cargaTotalW * MARGEM_SEGURANCA_DRIVER * 10) / 10}W.
                  </p>
                  <Button
                    size="sm"
                    variant="default"
                    className="h-8"
                    onClick={() => aplicarDriver48V("LM2344")}
                  >
                    Reaplicar {nCircuitos}× LM2344
                  </Button>
                </div>
              ) : undefined
            )}
        </div>
      );
    }

    // estado === 'recomendado'
    if (!driverAplicado) {
      const nRec = calcularQtdDriversComposicao(cargaTotalW, rec48v.potenciaW) || 1;
      return (
        <div className="rounded-md border border-blue-400/40 bg-blue-50 px-3 py-2 text-xs text-blue-900 space-y-1">
          <p>
            Driver recomendado: {rec48v.sku} ({rec48v.potenciaW}W) — {nRec}{" "}
            {nRec === 1 ? "unidade" : "unidades"}
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
    // A potência disponível é a do driver × quantidade: 2 × 100W cobrem 160W de carga segura.
    // Antes só a unitária era comparada e o aviso de subdimensionado nunca saía do lugar.
    const drvOk = drvPotencia * driverAplicado.quantidade >= cargaTotalW * MARGEM_SEGURANCA_DRIVER;

    // Subdimensionado — rec48v é garantidamente 'recomendado' aqui (sem_carga e excede_200w
    // já retornaram no topo da função), então rec48v.sku está sempre definido.
    const alerta = drvOk ? undefined : (
      <div className="space-y-1">
        <p>
          Potência aplicada insuficiente para a carga atual ({cargaTotalW}W ×{" "}
          {MARGEM_SEGURANCA_DRIVER.toFixed(2).replace(".", ",")} ={" "}
          {rec48v.potenciaSeguraW}W). Recomendado: {rec48v.sku} ({rec48v.potenciaW}W).
        </p>
        <Button
          size="sm"
          variant="default"
          className="h-8"
          onClick={() => aplicarDriver48V(rec48v.sku)}
        >
          Reaplicar recomendação
        </Button>
      </div>
    );
    return renderDriverAplicado(driverAplicado, drvPotencia, alerta);
  };

  // ─── Painel de driver — estado 24V ───

  const renderPainelDriver24V = () => {
    // Carga de referência: no SYSTEM MOLD é a fita (os difusos não têm potência própria, então
    // `cargaTotalW` é 0 e o painel escondia a sugestão do driver da fita). No magnético é a
    // soma dos módulos — `cargaDoDriver` devolve exatamente `cargaTotalW` nesse caso.
    const cargaDriverW = cargaDoDriver(item);

    // Driver aplicado vem ANTES dos gates: com carga 0 ou busca em voo o box desaparecia da
    // tela e a quantidade cobrada ficava sem como ser conferida.
    if (driverAplicado) {
      const drvPotencia = driverAplicado.potenciaW ?? 0;
      // Potência disponível = unitária × quantidade (ver comentário no painel 48V)
      const drvOk = drvPotencia * driverAplicado.quantidade >= cargaDriverW * MARGEM_SEGURANCA_DRIVER;

      // Subdimensionado: o alerta entra dentro do próprio box (o input de quantidade fica)
      const alerta = drvOk ? undefined : (
        <div className="space-y-1">
          <p>
            Potência aplicada insuficiente para a carga atual (
            {Math.round(cargaDriverW * 10) / 10}W ×{" "}
            {MARGEM_SEGURANCA_DRIVER.toFixed(2).replace(".", ",")} ={" "}
            {Math.round(cargaDriverW * MARGEM_SEGURANCA_DRIVER * 10) / 10}W).
            {sugestao24v && ` Recomendado: ${sugestao24v.sku} (${sugestao24v.potenciaW}W).`}
          </p>
          {sugestao24v && (
            <Button size="sm" variant="default" className="h-8" onClick={aplicarDriver24V}>
              Reaplicar recomendação
            </Button>
          )}
        </div>
      );
      return renderDriverAplicado(driverAplicado, drvPotencia, alerta);
    }

    if (cargaDriverW <= 0) {
      return (
        <div className="rounded-md border border-dashed p-3 bg-muted/30 text-xs text-muted-foreground">
          {isModular
            ? "Adicione a fita para calcular o driver recomendado."
            : "Adicione módulos para calcular o driver recomendado."}
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

    if (sem24v) {
      return (
        <div className="rounded-md border border-dashed p-3 text-xs text-destructive">
          Nenhum driver 24V compatível no catálogo para{" "}
          {Math.round(cargaDriverW * MARGEM_SEGURANCA_DRIVER * 10) / 10}W. Selecione manualmente.
        </div>
      );
    }

    if (sugestao24v) {
      const nRec = calcularQtdDriversComposicao(cargaDriverW, sugestao24v.potenciaW) || 1;
      return (
        <div className="rounded-md border border-blue-400/40 bg-blue-50 px-3 py-2 text-xs text-blue-900 space-y-1">
          <p>
            Driver recomendado: {sugestao24v.sku} ({sugestao24v.potenciaW}W) — {nRec}{" "}
            {nRec === 1 ? "unidade" : "unidades"}
          </p>
          <p>
            Carga: {Math.round(cargaDriverW * 10) / 10}W ×{" "}
            {MARGEM_SEGURANCA_DRIVER.toFixed(2).replace(".", ",")} ={" "}
            {Math.round(cargaDriverW * MARGEM_SEGURANCA_DRIVER * 100) / 100}W calculados
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
        {isModular
          ? "Adicione a fita para calcular o driver recomendado."
          : "Adicione módulos para calcular o driver recomendado."}
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

        {/* Conector de energia / kit de fixação (papéis obrigatórios do checklist). Ficavam
            cobrados sem linha própria — agora com quantidade, preço e remoção (RULE-001). */}
        {outrosComponentes.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
              Outros componentes
            </p>
            <div className="space-y-1.5">
              {outrosComponentes.map((o) => (
                <div key={o.id} className="flex items-center gap-2 flex-wrap">
                  <Input value={o.codigo} readOnly className="bg-muted/50 w-28 h-8" />
                  <Input
                    value={o.descricao}
                    readOnly
                    className="bg-muted/50 flex-1 h-8 min-w-0"
                  />
                  <Input type="number" min={1} {...qtdInputProps(o)} className="w-20 h-8" />
                  <PrecoInput
                    value={o.precoUnitario}
                    min={o.precoMinimo}
                    onChange={(v) => atualizarComposicaoItem(o.id, { precoUnitario: v })}
                  />
                  <Badge variant="secondary" className="text-xs whitespace-nowrap">
                    Total: {formatarMoeda(o.precoUnitario * o.quantidade)}
                  </Badge>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-destructive"
                    onClick={() => removerComposicaoItem(o.id)}
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
                  {/* Rascunho local (mesmo padrão dos acessórios): apagar o campo não grava 0.
                      Sair com ele vazio devolve a metragem aos difusos. */}
                  <Input
                    type="number"
                    min={0}
                    step={0.1}
                    aria-label="Metragem da fita"
                    value={comprimentoDraft[fitaModular.id] ?? String(Math.round((fitaModular.comprimento ?? metragemDerivada) * 1000) / 1000)}
                    onChange={(e) => {
                      const raw = e.target.value;
                      setComprimentoDraft((d) => ({ ...d, [fitaModular.id]: raw }));
                      if (raw === "") return;
                      // a metragem define quantos ROLOS entram no pedido (RULE-005/006)
                      const m = Math.max(0, parseFloat(raw) || 0);
                      atualizarComposicaoItem(fitaModular.id, {
                        comprimento: m,
                        metragemEditada: true,
                        ...(fitaModular.metragemRolo != null
                          ? { quantidade: calcularRolosFitaModular(m, fitaModular.metragemRolo) }
                          : {}),
                      });
                    }}
                    onBlur={() => {
                      if (comprimentoDraft[fitaModular.id] === "") usarMetragemDosDifusos(fitaModular);
                      setComprimentoDraft((d) => { const { [fitaModular.id]: _, ...rest } = d; return rest; });
                    }}
                    className="w-20 h-8"
                  />
                </div>
                {/* RULE-005: tamanho do rolo editável, como no sistema de fita comum */}
                <Select
                  value={fitaModular.metragemRolo != null ? String(fitaModular.metragemRolo) : undefined}
                  onValueChange={(v) => {
                    const rolo = Number(v);
                    atualizarComposicaoItem(fitaModular.id, {
                      metragemRolo: rolo,
                      roloPresumido: false,
                      quantidade: calcularRolosFitaModular(fitaModular.comprimento ?? metragemDerivada, rolo),
                    });
                  }}
                >
                  <SelectTrigger className="h-8 w-28 text-xs" aria-label="Tamanho do rolo">
                    <SelectValue placeholder="rolo?" />
                  </SelectTrigger>
                  <SelectContent>
                    {[...new Set([...TAMANHOS_ROLO_CATALOGO, ...(fitaModular.metragemRolo != null ? [fitaModular.metragemRolo] : [])])]
                      .sort((a, b) => a - b)
                      .map((t) => (
                        <SelectItem key={t} value={String(t)}>
                          rolo {t} m
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {fitaModular.roloPresumido && (
                  <span className="text-xs text-amber-700">
                    ⚠ rolo não cadastrado — confirme o tamanho
                  </span>
                )}
                {fitaModular.metragemRolo != null && (
                  <Badge variant="secondary" className="text-xs whitespace-nowrap">
                    {fitaModular.quantidade}×{fitaModular.metragemRolo}m · Total:{" "}
                    {formatarMoeda(fitaModular.precoUnitario * fitaModular.quantidade)}
                  </Badge>
                )}
                {fitaModular.metragemEditada &&
                  Math.abs((fitaModular.comprimento ?? 0) - metragemDerivada) > 0.0005 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs"
                      onClick={() => usarMetragemDosDifusos(fitaModular)}
                    >
                      Usar soma dos difusos ({formatarM(metragemDerivada)} m)
                    </Button>
                  )}
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
                <p>
                  A divisão é decisão de projeto: ao escolher o driver Slim abaixo, a quantidade já
                  entra com um por circuito — confira e ajuste se o projeto dividir diferente.
                </p>
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
