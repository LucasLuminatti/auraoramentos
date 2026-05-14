import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trophy, ThumbsDown, FileClock } from "lucide-react";
import { subDays, startOfMonth, subMonths, format, isAfter } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, Legend,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";

interface Orcamento {
  id: string;
  valor: number;
  status: string;
  created_at: string;
  data: string;
  projeto_id: string | null;
  motivo_perda?: string | null;
  clientes?: { nome: string } | null;
}

interface AdminDashboardProps {
  orcamentos: Orcamento[];
}

const formatCurrency = (v: number) =>
  `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const MOTIVO_LABELS: Record<string, string> = {
  preco: "Preço",
  concorrencia: "Concorrência",
  prazo: "Prazo",
  sem_retorno: "Sem retorno",
  outro: "Outro",
};

const MOTIVO_COLORS = ["hsl(0,72%,51%)", "hsl(25,95%,53%)", "hsl(45,93%,47%)", "hsl(217,91%,60%)", "hsl(var(--muted-foreground))"];

const PERIOD_OPTIONS = [
  { value: "30", label: "Últimos 30 dias" },
  { value: "90", label: "Últimos 3 meses" },
  { value: "180", label: "Últimos 6 meses" },
  { value: "365", label: "Último ano" },
  { value: "all", label: "Todo o período" },
];

const AdminDashboard = ({ orcamentos }: AdminDashboardProps) => {
  const [period, setPeriod] = useState("180");

  // DASH-01: somatório de orçamentos em aberto (cross-rep) — D-10, D-11, D-14
  const { data: emAberto, isLoading: emAbertoLoading } = useQuery({
    queryKey: ['orcamentos-em-aberto'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orcamentos')
        .select('status, valor')
        .in('status', ['rascunho', 'pendente']);
      if (error) throw error;
      return data ?? [];
    },
  });

  const emAbertoTotais = useMemo(() => {
    const rascunho = (emAberto ?? [])
      .filter((o) => o.status === 'rascunho')
      .reduce((s, o) => s + Number(o.valor ?? 0), 0);
    const pendente = (emAberto ?? [])
      .filter((o) => o.status === 'pendente')
      .reduce((s, o) => s + Number(o.valor ?? 0), 0);
    return { rascunho, pendente, total: rascunho + pendente };
  }, [emAberto]);

  const filtered = useMemo(() => {
    if (period === "all") return orcamentos;
    const cutoff = subDays(new Date(), Number(period));
    return orcamentos.filter((o) => isAfter(new Date(o.created_at), cutoff));
  }, [orcamentos, period]);

  // Top 5 clientes por receita aprovada
  const topClientes = useMemo(() => {
    const clienteMap = new Map<string, { nome: string; total: number; count: number }>();
    filtered
      .filter((o) => o.status === "aprovado")
      .forEach((o) => {
        const nome = (o as any).clientes?.nome || "Sem cliente";
        const cur = clienteMap.get(nome) || { nome, total: 0, count: 0 };
        cur.total += Number(o.valor);
        cur.count++;
        clienteMap.set(nome, cur);
      });
    return [...clienteMap.values()].sort((a, b) => b.total - a.total).slice(0, 5);
  }, [filtered]);

  // Receita mensal (pendente + aprovada)
  const monthlyData = useMemo(() => {
    const now = new Date();
    const numMonths = period === "all" ? 12 : Math.min(Math.ceil(Number(period) / 30), 12);
    const months: { label: string; start: Date; end: Date }[] = [];
    for (let i = numMonths - 1; i >= 0; i--) {
      const s = startOfMonth(subMonths(now, i));
      const e = startOfMonth(subMonths(now, i - 1));
      months.push({ label: format(s, "MMM/yy", { locale: ptBR }), start: s, end: e });
    }
    return months.map((m) => {
      const inRange = filtered.filter((o) => {
        const d = new Date(o.created_at);
        return d >= m.start && d < m.end;
      });
      return {
        mes: m.label,
        pendente: inRange.filter((o) => o.status === "pendente").reduce((s, o) => s + Number(o.valor), 0),
        aprovado: inRange.filter((o) => o.status === "aprovado").reduce((s, o) => s + Number(o.valor), 0),
      };
    });
  }, [filtered, period]);

  // Motivos de perda
  const motivosData = useMemo(() => {
    const counts = new Map<string, number>();
    filtered
      .filter((o) => o.status === "perdido" && (o as any).motivo_perda)
      .forEach((o) => {
        const m = (o as any).motivo_perda as string;
        counts.set(m, (counts.get(m) || 0) + 1);
      });
    return [...counts.entries()]
      .map(([key, value]) => ({ name: MOTIVO_LABELS[key] || key, value }))
      .sort((a, b) => b.value - a.value);
  }, [filtered]);

  return (
    <div className="space-y-6">
      {/* Period Filter */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Visão Geral</h2>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIOD_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Orçamentos em Aberto (DASH-01) */}
      <Card className="border-l-4 border-l-primary">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-sm font-medium">Orçamentos em Aberto</CardTitle>
          <FileClock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Rascunho</span>
            <span className="font-medium">{emAbertoLoading ? '—' : formatCurrency(emAbertoTotais.rascunho)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Pendente</span>
            <span className="font-medium">{emAbertoLoading ? '—' : formatCurrency(emAbertoTotais.pendente)}</span>
          </div>
          <div className="border-t pt-2 flex items-center justify-between">
            <span className="font-semibold">Total</span>
            <span className="text-lg font-bold">{emAbertoLoading ? '—' : formatCurrency(emAbertoTotais.total)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Charts */}
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Receita Mensal</CardTitle>
          </CardHeader>
          <CardContent className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="mes" className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number, name: string) => [formatCurrency(v), name === "pendente" ? "Pendente" : "Aprovado"]} />
                <Legend formatter={(v) => (v === "pendente" ? "Pendente" : "Aprovado")} />
                <Bar dataKey="pendente" fill="hsl(45, 93%, 47%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="aprovado" fill="hsl(142, 71%, 45%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Motivos de Perda */}
      {motivosData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ThumbsDown className="h-4 w-4 text-red-500" />
              Motivos de Perda
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={motivosData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                <YAxis dataKey="name" type="category" width={120} tick={{ fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip />
                <Bar dataKey="value" name="Ocorrências" radius={[0, 4, 4, 0]}>
                  {motivosData.map((_, i) => (
                    <Cell key={i} fill={MOTIVO_COLORS[i % MOTIVO_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Top 5 Clientes */}
      {topClientes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Trophy className="h-4 w-4 text-yellow-500" />
              Top 5 Clientes por Receita Aprovada
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="text-center">Orçamentos</TableHead>
                  <TableHead className="text-right">Receita Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topClientes.map((c, i) => (
                  <TableRow key={c.nome}>
                    <TableCell className="font-bold text-muted-foreground">{i + 1}</TableCell>
                    <TableCell className="font-medium">{c.nome}</TableCell>
                    <TableCell className="text-center">{c.count}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(c.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AdminDashboard;
