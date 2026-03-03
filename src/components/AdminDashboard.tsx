import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DollarSign, TrendingUp, Target, BarChart3, Clock, Trophy, ThumbsDown } from "lucide-react";
import { differenceInDays, subDays, startOfMonth, subMonths, format, isAfter } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";

interface Orcamento {
  id: string;
  valor: number;
  status: string;
  created_at: string;
  data: string;
  projeto_id: string | null;
  fechado_at?: string | null;
  motivo_perda?: string | null;
  clientes?: { nome: string } | null;
}

interface AdminDashboardProps {
  orcamentos: Orcamento[];
}

const formatCurrency = (v: number) =>
  `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const PIE_COLORS = [
  "hsl(var(--muted-foreground))",
  "hsl(45, 93%, 47%)",
  "hsl(217, 91%, 60%)",
  "hsl(142, 71%, 45%)",
  "hsl(0, 72%, 51%)",
];

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

  const filtered = useMemo(() => {
    if (period === "all") return orcamentos;
    const cutoff = subDays(new Date(), Number(period));
    return orcamentos.filter((o) => isAfter(new Date(o.created_at), cutoff));
  }, [orcamentos, period]);

  const kpis = useMemo(() => {
    const fechados = filtered.filter((o) => o.status === "fechado");
    const perdidos = filtered.filter((o) => o.status === "perdido");
    const aprovados = filtered.filter((o) => o.status === "aprovado");
    const enviados = filtered.filter((o) => o.status === "enviado");

    const receitaEfetiva = fechados.reduce((s, o) => s + Number(o.valor), 0);
    const receitaPrevista = aprovados.reduce((s, o) => s + Number(o.valor), 0);
    const pipeline = enviados.reduce((s, o) => s + Number(o.valor), 0);

    const projetoMap = new Map<string, number[]>();
    filtered.forEach((o) => {
      if (o.projeto_id) {
        if (!projetoMap.has(o.projeto_id)) projetoMap.set(o.projeto_id, []);
        projetoMap.get(o.projeto_id)!.push(Number(o.valor));
      }
    });
    const ticketMedio =
      projetoMap.size > 0
        ? [...projetoMap.values()].reduce(
            (s, vals) => s + vals.reduce((a, b) => a + b, 0) / vals.length,
            0
          ) / projetoMap.size
        : 0;

    // Conversão corrigida: ganhos / (ganhos + perdidos)
    const taxaConversao =
      fechados.length + perdidos.length > 0
        ? (fechados.length / (fechados.length + perdidos.length)) * 100
        : 0;

    // Ciclo médio corrigido: usar fechado_at quando disponível
    const encerrados = [...fechados, ...perdidos].filter((o) => (o as any).fechado_at);
    const ciclos = encerrados.map((o) =>
      Math.abs(differenceInDays(new Date((o as any).fechado_at), new Date(o.created_at)))
    );
    // Fallback para orçamentos sem fechado_at
    const ciclosFallback = [...fechados, ...perdidos]
      .filter((o) => !(o as any).fechado_at)
      .map((o) => Math.abs(differenceInDays(new Date(o.data), new Date(o.created_at))));
    const allCiclos = [...ciclos, ...ciclosFallback];
    const cicloMedio = allCiclos.length > 0 ? allCiclos.reduce((a, b) => a + b, 0) / allCiclos.length : 0;

    return { receitaEfetiva, receitaPrevista, pipeline, ticketMedio, taxaConversao, cicloMedio };
  }, [filtered]);

  // Top 5 clientes por receita fechada
  const topClientes = useMemo(() => {
    const clienteMap = new Map<string, { nome: string; total: number; count: number }>();
    filtered
      .filter((o) => o.status === "fechado")
      .forEach((o) => {
        const nome = (o as any).clientes?.nome || "Sem cliente";
        const cur = clienteMap.get(nome) || { nome, total: 0, count: 0 };
        cur.total += Number(o.valor);
        cur.count++;
        clienteMap.set(nome, cur);
      });
    return [...clienteMap.values()].sort((a, b) => b.total - a.total).slice(0, 5);
  }, [filtered]);

  // Receita mensal (aprovada + fechada)
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
        aprovado: inRange.filter((o) => o.status === "aprovado").reduce((s, o) => s + Number(o.valor), 0),
        fechado: inRange.filter((o) => o.status === "fechado").reduce((s, o) => s + Number(o.valor), 0),
      };
    });
  }, [filtered, period]);

  // Distribuição por status (inclui perdido)
  const statusData = useMemo(() => {
    const counts = { rascunho: 0, enviado: 0, aprovado: 0, fechado: 0, perdido: 0 };
    filtered.forEach((o) => {
      if (o.status in counts) counts[o.status as keyof typeof counts]++;
    });
    return [
      { name: "Rascunho", value: counts.rascunho },
      { name: "Enviado", value: counts.enviado },
      { name: "Aprovado", value: counts.aprovado },
      { name: "Fechado", value: counts.fechado },
      { name: "Perdido", value: counts.perdido },
    ].filter((d) => d.value > 0);
  }, [filtered]);

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

  const cards = [
    { title: "Receita Efetiva", value: formatCurrency(kpis.receitaEfetiva), icon: Trophy },
    { title: "Receita Prevista", value: formatCurrency(kpis.receitaPrevista), icon: DollarSign },
    { title: "Pipeline", value: formatCurrency(kpis.pipeline), icon: TrendingUp },
    { title: "Ticket Médio", value: formatCurrency(kpis.ticketMedio), icon: Target },
    { title: "Conversão", value: `${kpis.taxaConversao.toFixed(1)}%`, icon: BarChart3 },
    { title: "Ciclo Médio", value: `${kpis.cicloMedio.toFixed(0)} dias`, icon: Clock },
  ];

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

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map((c) => (
          <Card key={c.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">{c.title}</CardTitle>
              <c.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold">{c.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
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
                <Tooltip formatter={(v: number, name: string) => [formatCurrency(v), name === "fechado" ? "Fechado" : "Aprovado"]} />
                <Legend formatter={(v) => (v === "fechado" ? "Fechado" : "Aprovado")} />
                <Bar dataKey="aprovado" fill="hsl(217, 91%, 60%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="fechado" fill="hsl(142, 71%, 45%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Distribuição por Status</CardTitle>
          </CardHeader>
          <CardContent className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusData} cx="50%" cy="50%" innerRadius={50} outerRadius={90} dataKey="value" nameKey="name" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {statusData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
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
              Top 5 Clientes por Receita Fechada
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
