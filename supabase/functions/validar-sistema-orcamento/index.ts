import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── Tipos de entrada ────────────────────────────────────────────────────────

interface SistemaItem {
  // Identificação do sistema
  tipo_sistema: "padrao" | "tiny_magneto" | "magneto_48v" | "s_mode" | "trilha";

  // Perfil selecionado (para sistemas tipo 'padrao' e 's_mode')
  familia_perfil?: string;
  comprimento_perfil_m?: number;
  quantidade_pecas?: number;
  passadas?: number;           // editável pelo usuário; fallback = passadas_padrao do perfil

  // Fita selecionada
  codigo_fita?: string;
  tensao_fita?: number;        // 12, 24 ou 48
  watts_por_metro?: number;
  largura_fita_mm?: number;
  subtipo_fita?: string;       // 'baby' | 'padrao'

  // Driver selecionado
  codigo_driver?: string;
  tensao_driver?: number;      // 12, 24 ou 48
  potencia_driver_w?: number;
  subtipo_driver?: string;     // 'slim' | 'convencional' | 'pro' | 'dimerizavel' | 'magnetico'

  // Sistema Magneto 48V
  potencia_total_modulos_w?: number;

  // Sistema Tiny Magneto / Magneto 48V — layout do trilho
  qtd_perfis_trilho?: number;
  qtd_cantos_trilho?: number;
  cor_trilho?: string;         // 'preto' | 'branco'
  aplicacao_trilho?: string;   // 'embutir' | 'sobrepor' | 'pendente'
  tem_conector_driver?: boolean;
  tem_kit_fixacao?: boolean;   // obrigatório no Magneto embutir

  // Spots
  codigo_spot?: string;
  fator_spot?: number;         // 1=simples, 2=duplo, 3=triplo, 4=quádruplo
  qtd_spots?: number;

  // S-Mode
  comprimentos_modulos_m?: number[];

  // Fita flexível
  qtd_sessoes_fita_flexivel?: number;
  tem_tampas_vedacao?: boolean;

  // Kit pendente
  usa_kit_pendente?: boolean;
}

interface ValidacaoResponse {
  valido: boolean;
  erros: string[];        // CRÍTICO — bloqueiam o avanço
  alertas: string[];      // IMPORTANTE — pedem confirmação
  sugestoes: Record<string, unknown>;  // MELHORIA — sugestões automáticas
}

// ─── Helpers de cálculo ──────────────────────────────────────────────────────

function calcularDrivers(
  metragemFita: number,
  wattsPorMetro: number,
  potenciaDriver: number,
  tensao: number,
): number {
  const potenciaTotal = metragemFita * wattsPorMetro;
  const potenciaSegura = potenciaTotal * 1.05;
  const qtdPorPotencia = Math.ceil(potenciaSegura / potenciaDriver);

  const limiteMetros = tensao === 12 ? 5 : tensao === 24 ? 10 : null;
  const qtdPorExtensao = limiteMetros !== null
    ? Math.ceil(metragemFita / limiteMetros)
    : qtdPorPotencia;

  return Math.max(qtdPorPotencia, qtdPorExtensao);
}

function calcularMetragemFita(
  comprimentoM: number,
  qtdPecas: number,
  passadas: number,
): number {
  return comprimentoM * qtdPecas * passadas;
}

function otimizarRolos(demandaMetros: number) {
  let restante = demandaMetros;
  const rolos15 = Math.floor(restante / 15);
  restante -= rolos15 * 15;
  const rolos10 = Math.floor(restante / 10);
  restante -= rolos10 * 10;
  const rolos5 = Math.ceil(restante / 5);
  const totalM = rolos15 * 15 + rolos10 * 10 + rolos5 * 5;
  return { rolos15, rolos10, rolos5, totalM, sobraM: totalM - demandaMetros };
}

function calcularConectoresEmenda(qtdPerfis: number, qtdCantos: number) {
  return {
    retos: Math.max(0, qtdPerfis - 1 - qtdCantos),
    curvos: qtdCantos,
    total: Math.max(0, qtdPerfis - 1),
  };
}

// ─── Validações por sistema ──────────────────────────────────────────────────

function validarSistemaPadrao(
  item: SistemaItem,
  regrasPerfil: Record<string, unknown> | null,
  erros: string[],
  alertas: string[],
  sugestoes: Record<string, unknown>,
) {
  const {
    tensao_fita, tensao_driver,
    largura_fita_mm, subtipo_fita,
    subtipo_driver, potencia_driver_w,
    comprimento_perfil_m, quantidade_pecas, passadas,
    watts_por_metro, familia_perfil,
  } = item;

  // Regra #1 — Compatibilidade de tensão (CRÍTICO)
  if (tensao_fita != null && tensao_driver != null && tensao_fita !== tensao_driver) {
    erros.push(
      `Tensão incompatível: fita é ${tensao_fita}V mas o driver é ${tensao_driver}V. ` +
      `Use driver ${tensao_fita}V.`,
    );
  }

  if (regrasPerfil) {
    const larguraMaxCanal = regrasPerfil.largura_max_fita_mm as number | null;
    const somenteBaby = regrasPerfil.somente_baby as boolean;
    const driverMaxW = regrasPerfil.driver_max_watts as number | null;
    const driverTipoAceito = regrasPerfil.driver_tipo_aceito as string;

    // Regra #6 — Largura da fita vs canal do perfil (CRÍTICO)
    if (larguraMaxCanal != null && largura_fita_mm != null && largura_fita_mm > larguraMaxCanal) {
      erros.push(
        `Fita larga demais: ${largura_fita_mm}mm não cabe no canal do perfil ${familia_perfil} ` +
        `(máximo ${larguraMaxCanal}mm).`,
      );
    }

    // Regras #15, #16, #17 — Somente Baby (CRÍTICO)
    if (somenteBaby && subtipo_fita !== "baby") {
      erros.push(
        `Perfil ${familia_perfil} aceita SOMENTE fita Baby. ` +
        `Selecione uma fita Baby (largura ≤ ${larguraMaxCanal}mm).`,
      );
    }

    // Regras #18, #19 — Driver máximo em Trik/FK/Alojamento (CRÍTICO)
    if (driverMaxW != null && potencia_driver_w != null && potencia_driver_w > driverMaxW) {
      erros.push(
        `Driver de ${potencia_driver_w}W não cabe fisicamente no perfil ${familia_perfil}. ` +
        `Use driver Slim com no máximo ${driverMaxW}W.`,
      );
    }
    if (driverTipoAceito === "slim" && subtipo_driver && subtipo_driver !== "slim") {
      erros.push(
        `Perfil ${familia_perfil} aceita SOMENTE driver Slim. ` +
        `Drivers Convencionais, PRO ou acima de 72W não cabem fisicamente.`,
      );
    }
  }

  // Regra #2 — Cálculo automático de drivers (CRÍTICO — sugestão)
  if (
    comprimento_perfil_m != null &&
    quantidade_pecas != null &&
    passadas != null &&
    watts_por_metro != null &&
    potencia_driver_w != null &&
    tensao_fita != null
  ) {
    const metragem = calcularMetragemFita(comprimento_perfil_m, quantidade_pecas, passadas);
    const qtdDrivers = calcularDrivers(metragem, watts_por_metro, potencia_driver_w, tensao_fita);
    const rolos = otimizarRolos(metragem);

    sugestoes.drivers = {
      metragem_fita_m: metragem,
      potencia_total_w: metragem * watts_por_metro,
      potencia_segura_w: metragem * watts_por_metro * 1.05,
      qtd_drivers_sugerida: qtdDrivers,
    };
    sugestoes.rolos_fita = rolos;

    // Regras #3, #4 — Alerta de extensão (já incluso no cálculo, mas alertar explicitamente)
    const limiteM = tensao_fita === 12 ? 5 : tensao_fita === 24 ? 10 : null;
    if (limiteM != null && metragem > limiteM) {
      const qtdPorExtensao = Math.ceil(metragem / limiteM);
      const qtdPorPotencia = Math.ceil((metragem * watts_por_metro * 1.05) / potencia_driver_w);
      if (qtdPorExtensao > qtdPorPotencia) {
        alertas.push(
          `Extensão de fita (${metragem}m) excede o limite de ${limiteM}m por driver para ${tensao_fita}V. ` +
          `São necessários ${qtdPorExtensao} drivers por extensão (vs ${qtdPorPotencia} por potência).`,
        );
      }
    }
  }
}

function validarTinyMagneto(
  item: SistemaItem,
  erros: string[],
  alertas: string[],
  sugestoes: Record<string, unknown>,
) {
  // Regra #8 — Driver obrigatoriamente 24V (CRÍTICO)
  if (item.tensao_driver != null && item.tensao_driver !== 24) {
    erros.push(
      `Sistema Tiny Magneto requer driver 24V. Driver ${item.tensao_driver}V é proibido.`,
    );
  }

  // Regra #9 — Conector de driver obrigatório (CRÍTICO)
  if (item.tem_conector_driver === false) {
    erros.push(
      "Conector de driver obrigatório no Tiny Magneto (LM3168 preto / LM3169 branco). " +
      "Adicione 1 conector por driver.",
    );
  }

  // Regra #10 — Não misturar aplicação nem cores (CRÍTICO)
  // (validado pelo frontend ao selecionar componentes — aqui alertamos se cor divergir)
  if (item.cor_trilho) {
    alertas.push(
      `Verifique se todos os componentes do Tiny Magneto estão na cor ${item.cor_trilho}. ` +
      "Não é permitido misturar preto e branco.",
    );
  }

  // Regra #23 — Conectores de emenda (IMPORTANTE)
  if (item.qtd_perfis_trilho != null && item.qtd_perfis_trilho > 1) {
    const cantos = item.qtd_cantos_trilho ?? 0;
    const conectores = calcularConectoresEmenda(item.qtd_perfis_trilho, cantos);
    alertas.push(
      `Conectores de emenda sugeridos: ${conectores.retos} reto(s) + ${conectores.curvos} curvo(s) ` +
      `= ${conectores.total} total. Confirme se os perfis formam uma linha contínua.`,
    );
    sugestoes.conectores_emenda = conectores;
  }

  // Regra #24 — Suportes devem seguir a cor do trilho (IMPORTANTE)
  if (item.cor_trilho) {
    alertas.push(
      `Suportes devem ser ${item.cor_trilho} (ou dourado, que é universal). ` +
      "Confira a cor antes de fechar.",
    );
  }
}

function validarMagneto48V(
  item: SistemaItem,
  erros: string[],
  alertas: string[],
  sugestoes: Record<string, unknown>,
) {
  // Regra #11 — Driver próprio 48V com cálculo automático (CRÍTICO)
  if (item.potencia_total_modulos_w != null) {
    const potSegura = item.potencia_total_modulos_w * 1.05;
    const drivers100 = Math.ceil(potSegura / 100);
    const drivers200 = Math.ceil(potSegura / 200);
    sugestoes.drivers_magneto_48v = {
      potencia_modulos_w: item.potencia_total_modulos_w,
      potencia_segura_w: potSegura,
      opcao_lm2343_100w: drivers100,
      opcao_lm2344_200w: drivers200,
    };
  }

  // Regra #12 — Kit de fixação obrigatório no embutir (CRÍTICO)
  if (item.aplicacao_trilho === "embutir" && !item.tem_kit_fixacao) {
    erros.push(
      "Kit de fixação (LM2987) é obrigatório para trilho Magneto 48V de embutir. " +
      "Adicione ao orçamento.",
    );
  }

  // Regra #13 — Conector de energia obrigatório (CRÍTICO)
  if (item.tem_conector_driver === false) {
    erros.push(
      "Conector de energia obrigatório no Magneto 48V. Quantidade = número de drivers.",
    );
  }

  // Aplicação: não tem pendente (Regra 4.2)
  if (item.aplicacao_trilho === "pendente") {
    erros.push("Sistema Magneto 48V não possui versão pendente. Use embutir ou sobrepor.");
  }

  // Conectores de emenda (mesma lógica Tiny Magneto — Regra #25)
  if (item.qtd_perfis_trilho != null && item.qtd_perfis_trilho > 1) {
    const cantos = item.qtd_cantos_trilho ?? 0;
    const conectores = calcularConectoresEmenda(item.qtd_perfis_trilho, cantos);
    alertas.push(
      `Conectores de emenda sugeridos: ${conectores.retos} reto(s) + ${conectores.curvos} curvo(s).`,
    );
    sugestoes.conectores_emenda = conectores;
  }
}

function validarSMode(
  item: SistemaItem,
  erros: string[],
  alertas: string[],
  sugestoes: Record<string, unknown>,
) {
  // Regra #26 — Tampa cega (IMPORTANTE)
  if (
    item.comprimento_perfil_m != null &&
    item.comprimentos_modulos_m != null &&
    item.comprimentos_modulos_m.length > 0
  ) {
    const somaModulos = item.comprimentos_modulos_m.reduce((a, b) => a + b, 0);
    const tampaCega = Math.max(0, item.comprimento_perfil_m - somaModulos);
    alertas.push(
      `Tampa cega necessária: ${tampaCega.toFixed(2)}m ` +
      `(frame ${item.comprimento_perfil_m}m − módulos ${somaModulos.toFixed(2)}m). ` +
      "Enviar peça inteira e cortar na obra.",
    );
    sugestoes.tampa_cega_m = tampaCega;
  }

  // Regra #27 — Base para acessórios (IMPORTANTE)
  alertas.push(
    "Lembre-se: spots, pendentes e módulos no S-Mode precisam de base específica " +
    "(quantidade de bases = quantidade do acessório). Versão branco ou preto.",
  );

  // Regra #28 — Cor branco/preto (IMPORTANTE)
  if (item.cor_trilho) {
    alertas.push(
      `Verifique se todos os componentes do S-Mode estão na cor ${item.cor_trilho}. ` +
      "Não é permitido misturar preto e branco.",
    );
  }
}

function validarSpots(
  item: SistemaItem,
  erros: string[],
  alertas: string[],
  sugestoes: Record<string, unknown>,
) {
  // Regra #14 — Spots Magneto Tiny requerem driver externo 24V (CRÍTICO)
  if (item.tipo_sistema === "tiny_magneto" && item.codigo_spot) {
    erros.push(
      "Spots do sistema Tiny Magneto requerem driver externo 24V. " +
      "Confirme que o driver 24V está incluído e somado à potência total do sistema.",
    );
  }

  // Regra #22 — Multiplicador de lâmpadas (IMPORTANTE)
  if (item.qtd_spots != null && item.fator_spot != null && item.fator_spot > 1) {
    const qtdLampadas = item.qtd_spots * item.fator_spot;
    alertas.push(
      `${item.qtd_spots} spot(s) com fator ${item.fator_spot} = ${qtdLampadas} lâmpada(s) necessárias.`,
    );
    sugestoes.qtd_lampadas = qtdLampadas;
  }
}

function validarKitPendente(
  item: SistemaItem,
  erros: string[],
) {
  // Regra #20 — Kit pendente não pode ser usado no Magneto nem no Tiny Magneto (CRÍTICO)
  if (
    item.usa_kit_pendente &&
    (item.tipo_sistema === "magneto_48v" || item.tipo_sistema === "tiny_magneto")
  ) {
    erros.push(
      "Kit Pendente não pode ser usado no sistema Magneto nem no Tiny Magneto. " +
      "Use somente com Perfis padrão ou S-Mode.",
    );
  }
}

function validarFitaFlexivel(
  item: SistemaItem,
  alertas: string[],
  sugestoes: Record<string, unknown>,
) {
  // Regra #34 — Tampas de vedação para fita flexível (MELHORIA)
  if (item.qtd_sessoes_fita_flexivel != null && item.qtd_sessoes_fita_flexivel > 0) {
    const qtdTampas = 2 * item.qtd_sessoes_fita_flexivel;
    const qtdPacotes = Math.ceil(qtdTampas / 50);
    sugestoes.tampas_vedacao = {
      qtd_tampas: qtdTampas,
      qtd_pacotes_lm2600: qtdPacotes,
      codigo_produto: "LM2600",
    };
    if (!item.tem_tampas_vedacao) {
      alertas.push(
        `Fita flexível detectada (${item.qtd_sessoes_fita_flexivel} sessão/sessões). ` +
        `Deseja incluir ${qtdPacotes} pacote(s) de tampas de vedação LM2600 (50un)?`,
      );
    }
  }
}

// ─── Handler principal ───────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body: { itens: SistemaItem[] } = await req.json();

    if (!Array.isArray(body.itens) || body.itens.length === 0) {
      return new Response(
        JSON.stringify({ error: "Payload inválido: 'itens' deve ser um array não vazio." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const resultados: Array<{ item_index: number } & ValidacaoResponse> = [];

    for (let i = 0; i < body.itens.length; i++) {
      const item = body.itens[i];
      const erros: string[] = [];
      const alertas: string[] = [];
      const sugestoes: Record<string, unknown> = {};

      // Buscar regras do perfil no banco (se aplicável)
      let regrasPerfil: Record<string, unknown> | null = null;
      if (item.familia_perfil) {
        const { data } = await supabase
          .from("regras_compatibilidade_perfil")
          .select("*")
          .eq("familia_perfil", item.familia_perfil)
          .single();
        regrasPerfil = data;

        // Injetar passadas padrão se usuário não sobrescreveu
        if (item.passadas == null && regrasPerfil?.passadas_padrao) {
          item.passadas = regrasPerfil.passadas_padrao as number;
          sugestoes.passadas_aplicadas = item.passadas;
        }
      }

      // Validações por tipo de sistema
      switch (item.tipo_sistema) {
        case "padrao":
        case "s_mode":
          validarSistemaPadrao(item, regrasPerfil, erros, alertas, sugestoes);
          if (item.tipo_sistema === "s_mode") {
            validarSMode(item, erros, alertas, sugestoes);
          }
          break;
        case "tiny_magneto":
          validarTinyMagneto(item, erros, alertas, sugestoes);
          validarSpots(item, erros, alertas, sugestoes);
          break;
        case "magneto_48v":
          validarMagneto48V(item, erros, alertas, sugestoes);
          break;
        case "trilha":
          validarSpots(item, erros, alertas, sugestoes);
          break;
      }

      // Validações transversais (aplicam a qualquer sistema)
      validarKitPendente(item, erros);
      validarFitaFlexivel(item, alertas, sugestoes);

      resultados.push({
        item_index: i,
        valido: erros.length === 0,
        erros,
        alertas,
        sugestoes,
      });
    }

    const tudoValido = resultados.every((r) => r.valido);

    return new Response(
      JSON.stringify({ valido: tudoValido, resultados }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
