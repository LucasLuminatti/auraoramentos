import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { useProdutoSearch } from "@/hooks/useProdutoSearch";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import type { Produto } from "@/types/orcamento";

interface ProdutoAutocompleteProps {
  value: string;
  onSelect: (produto: Produto) => void;
  placeholder?: string;
  className?: string;
}

const ProdutoAutocomplete = ({ value, onSelect, placeholder = "Buscar código ou descrição...", className }: ProdutoAutocompleteProps) => {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const { results, loading } = useProdutoSearch(query);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { setQuery(value); }, [value]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className={cn("relative", className)}>
      <div className="relative">
        <Input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
        />
        {loading && <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />}
      </div>
      {open && (
        <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-lg border bg-popover p-1 shadow-lg">
          {loading && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
          {!loading && results.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">Nenhum produto encontrado</p>
          )}
          {results.map((p) => (
            <button
              key={p.id}
              className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
              onClick={() => { onSelect(p); setQuery(p.codigo); setOpen(false); }}
            >
              <span className="font-mono font-semibold text-primary">{p.codigo}</span>
              <span className="truncate text-muted-foreground flex-1">{p.descricao}</span>
              {p.preco_tabela > 0 && (
                <span className="text-xs font-medium text-primary whitespace-nowrap">
                  R$ {(Math.round(p.preco_tabela * 100) / 100).toFixed(2)}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProdutoAutocomplete;
