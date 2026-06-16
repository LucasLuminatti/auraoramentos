import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle } from "lucide-react";
import { ArrowLeft, ArrowRight, Plus } from "lucide-react";
import AmbienteCard from "./AmbienteCard";
import type { Ambiente, ItemLuminaria } from "@/types/orcamento";
import { luminariaPrecisaLampada, ambienteTemLampada, clonarAmbiente, REGRAS_COMPOSICAO, calcularMetragemModulosDifusos, clonarItemLuminaria } from "@/types/orcamento";
import { toast } from "sonner";

interface AdvisoryItem {
  ambienteNome: string;
  tipo: 'fita-sem-driver' | 'driver-sem-fita' | 'perfil-sem-fita' | 'peca-sem-lampada'
      | 'composto-sem-driver' | 'composto-sem-conector' | 'modular-sem-fita';
  descricao: string;
}

/** Detecta avisos de composto incompleto para um único ambiente (VAL-01 / D-03).
 *  Função pura exportada — testável sem montar o componente. */
export function detectarAvisosComposto(amb: Ambiente): AdvisoryItem[] {
  const avisos: AdvisoryItem[] = [];
  for (const lum of amb.luminarias) {
    if (!lum.composicao?.length) continue;
    const comp = lum.composicao;
    const sistema = lum.sistema ?? '';

    // D-03.1: composto magnético sem driver aplicado
    if ((sistema === 'magneto_48v' || sistema === 'tiny_magneto') &&
        !comp.some(c => c.papel === 'driver_recomendado')) {
      avisos.push({ ambienteNome: amb.nome, tipo: 'composto-sem-driver', descricao: lum.descricao });
    }

    // D-03.2: conector obrigatório da família ausente
    const regras = REGRAS_COMPOSICAO[sistema];
    if (regras && !regras.conectoresObrigatorios.some(sku => comp.some(c => c.codigo === sku))) {
      avisos.push({ ambienteNome: amb.nome, tipo: 'composto-sem-conector', descricao: lum.descricao });
    }

    // D-03.3: SYSTEM MOLD sem fita adicionada
    if (sistema === 's_mode') {
      const metragem = calcularMetragemModulosDifusos(comp);
      const temFita = comp.some(c => c.papel === 'fita_modular');
      if (metragem > 0 && !temFita) {
        avisos.push({ ambienteNome: amb.nome, tipo: 'modular-sem-fita', descricao: lum.descricao });
      }
    }
  }
  return avisos;
}

interface Step2Props {
  ambientes: Ambiente[];
  onChange: (ambientes: Ambiente[]) => void;
  onNext: () => void;
  onPrev: () => void;
}

const ADVISORY_LABELS: Record<AdvisoryItem['tipo'], string> = {
  'fita-sem-driver': 'Fita sem driver',
  'driver-sem-fita': 'Driver sem fita',
  'perfil-sem-fita': 'Perfil sem fita LED',
  'peca-sem-lampada': 'Peça sem lâmpada (não tem LED integrado)',
  'composto-sem-driver': 'Sistema composto sem driver aplicado',
  'composto-sem-conector': 'Sistema composto sem o conector obrigatório da família',
  'modular-sem-fita': 'SYSTEM MOLD sem fita adicionada',
};

const Step2Ambientes = ({ ambientes, onChange, onNext, onPrev }: Step2Props) => {
  const [advisoryOpen, setAdvisoryOpen] = useState(false);
  const [advisoryItems, setAdvisoryItems] = useState<AdvisoryItem[]>([]);

  // DUP-01 / D-05: estado do seletor de destino para duplicação de composto
  const [dupState, setDupState] = useState<{ item: ItemLuminaria; origemIdx: number } | null>(null);
  const [dupDestinoId, setDupDestinoId] = useState<string>('');

  const addAmbiente = () => {
    const novo: Ambiente = {
      id: crypto.randomUUID(),
      nome: `Ambiente ${ambientes.length + 1}`,
      luminarias: [],
      sistemas: [],
    };
    onChange([...ambientes, novo]);
  };

  const updateAmbiente = (index: number, amb: Ambiente) => {
    const arr = [...ambientes]; arr[index] = amb;
    onChange(arr);
  };

  const removeAmbiente = (index: number) => {
    onChange(ambientes.filter((_, i) => i !== index));
  };

  const duplicarAmbiente = (index: number) => {
    const clone = clonarAmbiente(ambientes[index]);
    const arr = [...ambientes];
    arr.splice(index + 1, 0, clone);
    onChange(arr);
  };

  // DUP-01 / D-06: clona com novos UUIDs em toda a árvore e insere no ambiente destino
  // Chaveado por id (não índice) — robusto se a lista mudar com o dialog aberto
  const inserirCompostoEm = (destinoId: string, item: ItemLuminaria) => {
    const destino = ambientes.find((a) => a.id === destinoId);
    if (!destino) {
      toast.error("Ambiente de destino não encontrado.");
      setDupState(null);
      setDupDestinoId('');
      return;
    }
    const clone = clonarItemLuminaria(item);
    const arr = ambientes.map((a) =>
      a.id === destinoId ? { ...a, luminarias: [...a.luminarias, clone] } : a
    );
    onChange(arr);
    setDupState(null);
    setDupDestinoId('');
    toast.success(`Sistema duplicado para "${destino.nome}".`);
  };

  // DUP-01 / D-05: inicia o fluxo de duplicação — insere direto se só 1 ambiente
  const iniciarDuplicacaoComposto = (item: ItemLuminaria, origemIdx: number) => {
    if (ambientes.length === 1) {
      inserirCompostoEm(ambientes[0].id, item);
      return;
    }
    setDupDestinoId(ambientes[origemIdx]?.id ?? ''); // pré-seleciona o ambiente de origem
    setDupState({ item, origemIdx });
  };

  const handleNext = () => {
    if (ambientes.length === 0) {
      toast.error("Adicione pelo menos um ambiente");
      return;
    }

    // CALC-01 (D-01..D-05): bloquear sistemas com fita, sem perfil, metragem null/0
    const sistemasInvalidos: string[] = [];
    // D-06/D-07: detectar sistemas totalmente vazios para remover (não bloqueia)
    const ambientesLimpos = ambientes.map((amb) => {
      amb.sistemas.forEach((sis, idx) => {
        const totalmenteVazio = !sis.fita.codigo && !sis.driver.codigo && !sis.perfil;
        if (totalmenteVazio) return; // removido abaixo
        if (sis.fita.codigo && !sis.perfil) {
          const metragemInvalida = !sis.metragemManual || sis.metragemManual <= 0;
          if (metragemInvalida) {
            sistemasInvalidos.push(`${amb.nome} — Sistema ${idx + 1}`);
          }
        }
      });
      return {
        ...amb,
        sistemas: amb.sistemas.filter(
          (sis) => !(!sis.fita.codigo && !sis.driver.codigo && !sis.perfil)
        ),
      };
    });

    if (sistemasInvalidos.length > 0) {
      toast.error("Informe uma metragem válida para este sistema antes de continuar.", {
        description: sistemasInvalidos.join(" · "),
      });
      return; // BLOQUEIO (D-02)
    }

    const removidos =
      ambientes.reduce((acc, a) => acc + a.sistemas.length, 0) -
      ambientesLimpos.reduce((acc, a) => acc + a.sistemas.length, 0);

    if (removidos > 0) {
      onChange(ambientesLimpos); // remove vazios (D-06)
      toast.info(
        removidos === 1
          ? "1 sistema vazio foi removido do orçamento."
          : `${removidos} sistemas vazios foram removidos do orçamento.`
      );
    }

    // RES-05 / D-12..D-16: advisory NÃO-bloqueante sobre itens incompletos
    // Opera sobre ambientesLimpos (pós-remoção de vazios, D-16)
    const itensIncompletos: AdvisoryItem[] = [];
    for (const amb of ambientesLimpos) {
      for (const sis of amb.sistemas) {
        if (sis.fita.codigo && !sis.driver.codigo) {
          itensIncompletos.push({ ambienteNome: amb.nome, tipo: 'fita-sem-driver', descricao: sis.fita.descricao });
        }
        if (sis.driver.codigo && !sis.fita.codigo) {
          itensIncompletos.push({ ambienteNome: amb.nome, tipo: 'driver-sem-fita', descricao: sis.driver.descricao });
        }
        if (sis.perfil && !sis.fita.codigo) {
          itensIncompletos.push({ ambienteNome: amb.nome, tipo: 'perfil-sem-fita', descricao: sis.perfil.descricao });
        }
      }
      if (!ambienteTemLampada(amb)) {
        for (const lum of amb.luminarias) {
          if (luminariaPrecisaLampada(lum.descricao)) {
            itensIncompletos.push({ ambienteNome: amb.nome, tipo: 'peca-sem-lampada', descricao: lum.descricao });
          }
        }
      }
      // VAL-01 / D-03: avisos de compostos incompletos (não-bloqueante)
      itensIncompletos.push(...detectarAvisosComposto(amb));
    }

    if (itensIncompletos.length > 0) {
      setAdvisoryItems(itensIncompletos);
      setAdvisoryOpen(true);
      return; // aguarda decisão do usuário (não-bloqueante — D-12)
    }

    onNext();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Ambientes e Itens</h2>
          <p className="text-muted-foreground">Adicione os ambientes e seus respectivos itens.</p>
        </div>
        <Button onClick={addAmbiente} className="gap-2">
          <Plus className="h-4 w-4" /> Novo Ambiente
        </Button>
      </div>

      <div className="space-y-4">
        {ambientes.map((amb, i) => (
          <AmbienteCard
            key={amb.id}
            ambiente={amb}
            onChange={(a) => updateAmbiente(i, a)}
            onRemove={() => removeAmbiente(i)}
            onDuplicate={() => duplicarAmbiente(i)}
            onDuplicarComposto={(item) => iniciarDuplicacaoComposto(item, i)}
          />
        ))}
      </div>

      {ambientes.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-16 text-center">
          <p className="text-lg text-muted-foreground">Nenhum ambiente adicionado</p>
          <Button variant="outline" className="mt-4 gap-2" onClick={addAmbiente}>
            <Plus className="h-4 w-4" /> Adicionar Ambiente
          </Button>
        </div>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={onPrev} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Button>
        <Button onClick={handleNext} className="gap-2">
          Próximo <ArrowRight className="h-4 w-4" />
        </Button>
      </div>

      {/* DUP-01 / D-05: seletor de ambiente destino para duplicação de composto */}
      <Dialog open={dupState !== null} onOpenChange={(open) => { if (!open) { setDupState(null); setDupDestinoId(''); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Duplicar sistema para qual ambiente?</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-2">
            <p className="text-sm text-muted-foreground">
              Escolha o ambiente de destino para o clone do sistema composto.
            </p>
            <Select value={dupDestinoId} onValueChange={setDupDestinoId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um ambiente..." />
              </SelectTrigger>
              <SelectContent>
                {ambientes.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDupState(null); setDupDestinoId(''); }}>
              Cancelar
            </Button>
            <Button
              disabled={dupDestinoId === ''}
              onClick={() => {
                if (dupState && dupDestinoId !== '') {
                  inserirCompostoEm(dupDestinoId, dupState.item);
                }
              }}
            >
              Duplicar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={advisoryOpen} onOpenChange={setAdvisoryOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              Alguns itens parecem incompletos
            </AlertDialogTitle>
            <AlertDialogDescription>
              Verifique se foi intencional. Você pode revisar ou continuar mesmo assim.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <ul className="max-h-60 overflow-y-auto space-y-2 text-sm">
            {advisoryItems.map((it, i) => (
              <li key={i} className="rounded-md border bg-muted/30 px-3 py-2">
                <span className="font-medium">{it.ambienteNome}</span>
                {' — '}
                <span className="text-muted-foreground">{ADVISORY_LABELS[it.tipo]}</span>
                <div className="text-xs text-muted-foreground truncate">{it.descricao}</div>
              </li>
            ))}
          </ul>
          <AlertDialogFooter>
            <AlertDialogCancel>Revisar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setAdvisoryOpen(false); onNext(); }}>
              Continuar mesmo assim
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Step2Ambientes;
