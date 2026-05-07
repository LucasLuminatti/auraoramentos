import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Loader2, ListFilter } from "lucide-react";

export interface ClienteOption {
  id: string;
  nome: string;
}

interface ClienteFilterAutocompleteProps {
  value: string;
  onSelect: (cli: ClienteOption | null, kind?: 'cliente' | 'all') => void;
  placeholder?: string;
  className?: string;
}

const ClienteFilterAutocomplete = ({
  value,
  onSelect,
  placeholder = "Filtrar por cliente...",
  className,
}: ClienteFilterAutocompleteProps) => {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<ClienteOption[]>([]);
  const [loading, setLoading] = useState(false);
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

  // Debounce 300ms (mesmo pattern do ArquitetoAutocomplete)
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(async () => {
      setLoading(true);
      let req = supabase
        .from("clientes")
        .select("id, nome")
        .order("nome")
        .limit(10);
      if (query.trim().length > 0) {
        req = req.ilike("nome", `%${query.trim()}%`);
      }
      const { data, error } = await req;
      if (!error && data) setResults(data as ClienteOption[]);
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
          {/* "[Todos]" prepended — modo filter sempre. Sem sentinel "[Nenhum]" porque cliente_id é NOT NULL em orcamentos (D-04). */}
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-foreground hover:bg-accent transition-colors"
            onClick={() => { onSelect(null, 'all'); setQuery(""); setOpen(false); }}
          >
            <ListFilter className="h-3.5 w-3.5" />
            Todos
          </button>
          {loading && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
          {!loading && results.length === 0 && (
            <p className="py-3 text-center text-sm text-muted-foreground">
              Sem resultados
            </p>
          )}
          {results.map((c) => (
            <button
              key={c.id}
              type="button"
              className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
              onClick={() => { onSelect(c, 'cliente'); setQuery(c.nome); setOpen(false); }}
            >
              <span className="font-medium text-foreground">{c.nome}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ClienteFilterAutocomplete;
