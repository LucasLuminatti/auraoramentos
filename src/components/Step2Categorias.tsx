import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ArrowRight, Plus, Trash2, Tag } from "lucide-react";
import ProdutoAutocomplete from "./ProdutoAutocomplete";
import type { CategoriaFita, ItemFitaLED, Produto } from "@/types/orcamento";
import { formatarMoeda } from "@/types/orcamento";
import { toast } from "sonner";

interface Step2CategoriasProps {
  categorias: CategoriaFita[];
  onChange: (categorias: CategoriaFita[]) => void;
  onNext: () => void;
  onPrev: () => void;
}

const uid = () => crypto.randomUUID();

/** Fita "vazia" de uma categoria recém-criada — mesmo shape usado nos sistemas. */
const fitaVazia = (): ItemFitaLED => ({
  id: uid(),
  codigo: "",
  descricao: "",
  wm: 0,
  voltagem: 24,
  metragemRolo: 5,
  precoUnitario: 0,
  precoMinimo: 0,
});

/** Etapa "Categorias" do wizard (RULE-014): antes de montar os ambientes, o colaborador
 *  cria as categorias de fita do orçamento — nome livre + a fita que a categoria carrega
 *  (RULE-015: categoria NÃO tem perfil). Os perfis são vinculados à categoria depois, no
 *  ambiente, e toda a metragem vinculada soma na fita da categoria (RULE-016/017).
 *  A etapa é opcional: quem não usa categorias segue com a fita escolhida por sistema. */
const Step2Categorias = ({ categorias, onChange, onNext, onPrev }: Step2CategoriasProps) => {
  const addCategoria = () => {
    onChange([...categorias, { id: uid(), nome: "", fita: fitaVazia() }]);
  };

  const updateCategoria = (index: number, cat: CategoriaFita) => {
    const arr = [...categorias];
    arr[index] = cat;
    onChange(arr);
  };

  const removeCategoria = (index: number) => {
    onChange(categorias.filter((_, i) => i !== index));
  };

  const selecionarFita = (index: number, produto: Produto) => {
    const cat = categorias[index];
    updateCategoria(index, {
      ...cat,
      fita: {
        ...cat.fita,
        codigo: produto.codigo,
        descricao: produto.descricao,
        wm: produto.wm ?? 0,
        voltagem: (produto.voltagem ?? 24) as 12 | 24 | 48,
        // RULE-005: tamanho do rolo vem do catálogo; fallback 5 m
        metragemRolo: produto.tamanho_rolo_m ?? 5,
        precoUnitario: Math.round((produto.preco_tabela || 0) * 100) / 100,
        precoMinimo: Math.round((produto.preco_minimo || 0) * 100) / 100,
        imagemUrl: produto.imagem_url || undefined,
        is_baby: produto.is_baby,
        largura_mm: produto.largura_mm ?? null,
      },
    });
  };

  const handleNext = () => {
    const semNome = categorias.some((c) => !c.nome.trim());
    if (semNome) {
      toast.error("Dê um nome a cada categoria — é ele que vai na etiqueta da fábrica.");
      return;
    }
    // RULE-020: categorias distintas podem usar a MESMA fita (tons/aplicações diferentes),
    // então nomes é que precisam ser únicos — senão a etiqueta fica ambígua na obra.
    const nomes = categorias.map((c) => c.nome.trim().toLowerCase());
    const duplicado = nomes.find((n, i) => nomes.indexOf(n) !== i);
    if (duplicado) {
      toast.error(`Já existe uma categoria chamada "${duplicado}". Use nomes diferentes.`);
      return;
    }
    const semFita = categorias.filter((c) => !c.fita.codigo).map((c) => c.nome.trim());
    if (semFita.length > 0) {
      toast.error("Escolha a fita de cada categoria.", { description: semFita.join(" · ") });
      return;
    }
    onNext();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Categorias de Fita</h2>
          <p className="text-muted-foreground">
            Agrupe a fita por aplicação (sanca quente, marcenaria, embutido no teto…). A metragem de
            todos os ambientes soma na categoria, e o nome vai na etiqueta da fábrica.
          </p>
        </div>
        <Button onClick={addCategoria} className="gap-2">
          <Plus className="h-4 w-4" /> Nova Categoria
        </Button>
      </div>

      <div className="space-y-3">
        {categorias.map((cat, i) => (
          <div key={cat.id} className="rounded-xl border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-primary/70 shrink-0" />
              <Input
                value={cat.nome}
                onChange={(e) => updateCategoria(i, { ...cat, nome: e.target.value })}
                placeholder="Nome da categoria (ex: Sanca quente, Marcenaria, Cabeceira)"
                maxLength={60}
                className="font-medium"
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeCategoria(i)}
                title="Remover categoria"
              >
                <Trash2 className="h-4 w-4 text-destructive/70" />
              </Button>
            </div>

            <div className="space-y-2 pl-6">
              <span className="text-xs font-semibold text-primary uppercase tracking-wide">Fita LED</span>
              <ProdutoAutocomplete
                value={cat.fita.codigo}
                onSelect={(p) => selecionarFita(i, p)}
                placeholder="Código da fita"
                filtro="fita"
              />
              {cat.fita.codigo && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm text-muted-foreground">{cat.fita.descricao}</span>
                  {cat.fita.voltagem && <Badge variant="outline" className="text-xs">{cat.fita.voltagem}V</Badge>}
                  {cat.fita.wm > 0 && <Badge variant="secondary" className="text-xs">{cat.fita.wm}W/m</Badge>}
                  <Badge variant="secondary" className="text-xs">Rolo: {cat.fita.metragemRolo}m</Badge>
                  <Badge variant="secondary" className="text-xs">{formatarMoeda(cat.fita.precoUnitario)}</Badge>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {categorias.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-16 text-center">
          <p className="text-lg text-muted-foreground">Nenhuma categoria criada</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Você pode seguir sem categorias e escolher a fita direto em cada sistema.
          </p>
          <Button variant="outline" className="mt-4 gap-2" onClick={addCategoria}>
            <Plus className="h-4 w-4" /> Criar Categoria
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
    </div>
  );
};

export default Step2Categorias;
