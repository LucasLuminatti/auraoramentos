import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Loader2, X, ListFilter, Plus } from "lucide-react";
import ArquitetoDialog from "@/components/ArquitetoDialog";

export interface ArquitetoOption {
  id: string;
  nome: string;
}

interface ArquitetoAutocompleteProps {
  value: string;
  onSelect: (
    arquiteto: ArquitetoOption | null,
    kind?: 'arquiteto' | 'none' | 'all'
  ) => void;
  placeholder?: string;
  className?: string;
  mode?: 'select' | 'filter';
}

const ArquitetoAutocomplete = ({
  value,
  onSelect,
  placeholder = "Buscar arquiteto...",
  className,
  mode,
}: ArquitetoAutocompleteProps) => {
  const m = mode ?? 'select';
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<ArquitetoOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { setQuery(value); }, [value]);

  // Click outside fecha dropdown
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Debounce 300ms (mesmo do ProdutoAutocomplete)
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(async () => {
      setLoading(true);
      let req = supabase
        .from("arquitetos")
        .select("id, nome")
        .order("nome")
        .limit(10);
      if (query.trim().length > 0) {
        req = req.ilike("nome", `%${query.trim()}%`);
      }
      const { data, error } = await req;
      if (!error && data) setResults(data as ArquitetoOption[]);
      setLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, open]);

  return (
    <div ref={ref} className={cn("relative", className)}>
      <div className="relative">
        <Input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
        />
        {loading && (
          <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>
      {open && (
        <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-lg border bg-popover p-1 shadow-lg">
          {/* "[Todos]" prepended apenas em mode='filter' (D-01 da Phase 6) */}
          {m === 'filter' && (
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-foreground hover:bg-accent transition-colors"
              onClick={() => { onSelect(null, 'all'); setQuery(""); setOpen(false); }}
            >
              <ListFilter className="h-3.5 w-3.5" />
              Todos
            </button>
          )}
          {/* "Nenhum arquiteto" fixo no topo (D-17) — sem criar inline */}
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-muted-foreground hover:bg-accent transition-colors"
            onClick={() => { onSelect(null, 'none'); setQuery(""); setOpen(false); }}
          >
            <X className="h-3.5 w-3.5" />
            Nenhum arquiteto
          </button>
          {loading && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
          {!loading && results.length === 0 && (
            <p className="py-3 text-center text-sm text-muted-foreground">
              Nenhum arquiteto encontrado
            </p>
          )}
          {results.map((a) => (
            <button
              key={a.id}
              type="button"
              className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
              onClick={() => { onSelect(a, 'arquiteto'); setQuery(a.nome); setOpen(false); }}
            >
              <span className="font-medium text-foreground">{a.nome}</span>
            </button>
          ))}
          {/* Criar novo arquiteto inline — apenas em modo 'select' e fora do loading (Feature 4) */}
          {m === 'select' && !loading && (
            <button
              type="button"
              className="mt-1 flex w-full items-center gap-2 rounded-md border-t px-3 py-2 text-left text-sm text-primary hover:bg-accent transition-colors"
              onClick={() => { setOpen(false); setCreateOpen(true); }}
            >
              <Plus className="h-3.5 w-3.5" />
              {query.trim().length > 0 ? `Criar "${query.trim()}"` : "Criar novo arquiteto"}
            </button>
          )}
        </div>
      )}
      {m === 'select' && (
        <ArquitetoDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          mode="create"
          defaultNome={query.trim()}
          onSuccess={(saved) => {
            if (saved) {
              onSelect({ id: saved.id, nome: saved.nome }, 'arquiteto');
              setQuery(saved.nome);
            }
          }}
        />
      )}
    </div>
  );
};

export default ArquitetoAutocomplete;
