import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Loader2, Save, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProdutoRow {
  id: string;
  codigo: string;
  descricao: string | null;
  nome: string | null;
  preco_tabela: number | null;
  preco_minimo: number | null;
  arquiteto_id: string | null;
  categoria: string | null;
  tipo_produto: string | null;
}

interface Arquiteto {
  id: string;
  nome: string;
}

interface PendingChange {
  preco_tabela: number;
  preco_minimo: number;
}

const PAGE_SIZE = 50;
const ALL = "__all__";

/**
 * Valida o mapa de mudanças pendentes (D-17): preco_minimo deve ser <= preco_tabela
 * para todas as entries. Retorna o id da primeira entry inválida quando aplicável.
 */
export function validarPendingChanges(
  pending: Map<string, PendingChange>,
): { valid: true } | { valid: false; errorId: string } {
  for (const [id, c] of pending) {
    if (c.preco_minimo > c.preco_tabela) {
      return { valid: false, errorId: id };
    }
  }
  return { valid: true };
}

const PrecosBatch = () => {
  const [produtos, setProdutos] = useState<ProdutoRow[]>([]);
  const [arquitetos, setArquitetos] = useState<Arquiteto[]>([]);
  const [categorias, setCategorias] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [pendingChanges, setPendingChanges] = useState<Map<string, PendingChange>>(new Map());

  const [filterArquitetoId, setFilterArquitetoId] = useState<string>("");
  const [filterCategoria, setFilterCategoria] = useState<string>("");
  const [filterSemPreco, setFilterSemPreco] = useState(false);

  // Mount: fetch arquitetos + categorias distinct
  useEffect(() => {
    (async () => {
      const { data: arqs, error: arqErr } = await supabase
        .from("arquitetos")
        .select("id, nome")
        .order("nome");
      if (arqErr) {
        toast.error("Erro ao carregar arquitetos");
      } else {
        setArquitetos((arqs ?? []) as Arquiteto[]);
      }

      const { data: cats, error: catErr } = await supabase
        .from("product_variants")
        .select("categoria")
        .not("categoria", "is", null);
      if (!catErr && cats) {
        const set = new Set<string>();
        for (const r of cats as Array<{ categoria: string | null }>) {
          if (r.categoria) set.add(r.categoria);
        }
        setCategorias([...set].sort((a, b) => a.localeCompare(b, "pt-BR")));
      }
    })();
  }, []);

  const fetchProdutos = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from("product_variants")
      .select(
        "id, codigo, descricao, nome, preco_tabela, preco_minimo, arquiteto_id, categoria, tipo_produto",
        { count: "exact" },
      )
      .order("codigo");
    if (filterArquitetoId) q = q.eq("arquiteto_id", filterArquitetoId);
    if (filterCategoria) q = q.eq("categoria", filterCategoria);
    if (filterSemPreco) q = q.or("preco_tabela.is.null,preco_tabela.eq.0");
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, count, error } = await q.range(from, to);
    if (error) {
      toast.error("Erro ao carregar produtos");
      setLoading(false);
      return;
    }
    setProdutos((data ?? []) as ProdutoRow[]);
    setTotalCount(count ?? 0);
    setLoading(false);
  }, [page, filterArquitetoId, filterCategoria, filterSemPreco]);

  useEffect(() => {
    fetchProdutos();
  }, [fetchProdutos]);

  const guardPending = (): boolean => {
    if (pendingChanges.size > 0) {
      toast.error("Salve ou descarte as alterações pendentes antes de mudar filtro/página");
      return true;
    }
    return false;
  };

  const handleEdit = (id: string, field: "preco_tabela" | "preco_minimo", raw: string) => {
    const num = raw === "" ? 0 : parseFloat(raw);
    if (isNaN(num) || num < 0) return;
    setPendingChanges((prev) => {
      const next = new Map(prev);
      const original = produtos.find((p) => p.id === id);
      if (!original) return prev;
      const base: PendingChange = next.get(id) ?? {
        preco_tabela: Number(original.preco_tabela ?? 0),
        preco_minimo: Number(original.preco_minimo ?? 0),
      };
      next.set(id, { ...base, [field]: num });
      return next;
    });
  };

  const handleDiscard = () => {
    setPendingChanges(new Map());
  };

  const handleSave = async () => {
    const validation = validarPendingChanges(pendingChanges);
    if (!validation.valid) {
      const prod = produtos.find((p) => p.id === validation.errorId);
      toast.error(`Preço mínimo > preço tabela em ${prod?.codigo ?? validation.errorId}`);
      return;
    }
    setSaving(true);
    try {
      const updates = [...pendingChanges.entries()].map(([id, c]) =>
        supabase
          .from("product_variants")
          .update({
            preco_tabela: c.preco_tabela,
            preco_minimo: c.preco_minimo,
            editado_manualmente: true, // D-16
          })
          .eq("id", id),
      );
      const results = await Promise.all(updates);
      const errors = results.filter((r) => r.error);
      if (errors.length > 0) {
        toast.error(
          `${errors.length} de ${results.length} updates falharam — recarregue e tente os restantes`,
        );
      } else {
        toast.success(
          `${results.length} produto${results.length !== 1 ? "s" : ""} atualizado${
            results.length !== 1 ? "s" : ""
          }`,
        );
      }
      setPendingChanges(new Map());
      await fetchProdutos();
    } finally {
      setSaving(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const arquitetosMap: Record<string, string> = {};
  for (const a of arquitetos) arquitetosMap[a.id] = a.nome;

  return (
    <div className="space-y-4">
      {/* Toolbar de filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Arquiteto:</span>
          <Select
            value={filterArquitetoId === "" ? ALL : filterArquitetoId}
            onValueChange={(v) => {
              if (guardPending()) return;
              setFilterArquitetoId(v === ALL ? "" : v);
              setPage(0);
            }}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos</SelectItem>
              {arquitetos.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Categoria:</span>
          <Select
            value={filterCategoria === "" ? ALL : filterCategoria}
            onValueChange={(v) => {
              if (guardPending()) return;
              setFilterCategoria(v === ALL ? "" : v);
              setPage(0);
            }}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todas</SelectItem>
              {categorias.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <Checkbox
            checked={filterSemPreco}
            onCheckedChange={(checked) => {
              if (guardPending()) return;
              setFilterSemPreco(checked === true);
              setPage(0);
            }}
          />
          Sem preço cadastrado
        </label>

        <div className="ml-auto text-sm text-muted-foreground">
          {totalCount > 0
            ? `${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, totalCount)} de ${totalCount} produtos`
            : `${produtos.length} produtos`}
        </div>
      </div>

      {/* Tabela */}
      <div className="rounded-xl border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-32">Código</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead className="w-32">Categoria</TableHead>
              <TableHead className="w-40">Arquiteto</TableHead>
              <TableHead className="w-36 text-right">Preço Tabela</TableHead>
              <TableHead className="w-36 text-right">Preço Mínimo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin inline-block mr-2" />
                  Carregando...
                </TableCell>
              </TableRow>
            ) : produtos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  Nenhum produto encontrado
                </TableCell>
              </TableRow>
            ) : (
              produtos.map((p) => {
                const pending = pendingChanges.get(p.id);
                const valorTabela = pending ? pending.preco_tabela : Number(p.preco_tabela ?? 0);
                const valorMinimo = pending ? pending.preco_minimo : Number(p.preco_minimo ?? 0);
                const minMaiorQueTabela = pending && pending.preco_minimo > pending.preco_tabela;
                return (
                  <TableRow
                    key={p.id}
                    className={cn(pendingChanges.has(p.id) && "bg-yellow-50")}
                  >
                    <TableCell className="font-mono text-sm">{p.codigo}</TableCell>
                    <TableCell className="max-w-md truncate" title={p.descricao ?? ""}>
                      {p.descricao || "—"}
                    </TableCell>
                    <TableCell className="text-sm">{p.categoria || "—"}</TableCell>
                    <TableCell className="text-sm">
                      {p.arquiteto_id ? arquitetosMap[p.arquiteto_id] || "—" : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={valorTabela}
                        onChange={(e) => handleEdit(p.id, "preco_tabela", e.target.value)}
                        className={cn(
                          "w-28 text-right ml-auto",
                          minMaiorQueTabela && "border-destructive",
                        )}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={valorMinimo}
                        onChange={(e) => handleEdit(p.id, "preco_minimo", e.target.value)}
                        className={cn(
                          "w-28 text-right ml-auto",
                          minMaiorQueTabela && "border-destructive",
                        )}
                        title={
                          minMaiorQueTabela ? "Preço mínimo não pode exceder preço tabela" : undefined
                        }
                      />
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Paginação */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          disabled={page === 0 || loading}
          onClick={() => {
            if (guardPending()) return;
            setPage((p) => Math.max(0, p - 1));
          }}
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Anterior
        </Button>
        <span className="text-sm text-muted-foreground">
          Página {page + 1} de {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={page + 1 >= totalPages || loading}
          onClick={() => {
            if (guardPending()) return;
            setPage((p) => p + 1);
          }}
        >
          Próxima
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>

      {/* Footer sticky com pendentes */}
      {pendingChanges.size > 0 && (
        <div className="sticky bottom-0 -mx-4 mt-4 flex items-center justify-between border-t bg-background px-4 py-3 shadow-md">
          <span className="text-sm font-medium">
            {pendingChanges.size} alteração{pendingChanges.size !== 1 ? "ões" : ""} pendente
            {pendingChanges.size !== 1 ? "s" : ""}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleDiscard} disabled={saving}>
              Descartar
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Salvar {pendingChanges.size} alteraç{pendingChanges.size !== 1 ? "ões" : "ão"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PrecosBatch;
