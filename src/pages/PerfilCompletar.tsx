import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useColaborador } from "@/hooks/useColaborador";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { formatCPF, formatTelefone, unmask } from "@/lib/masks";
import { validateCPF, validateTelefone } from "@/lib/validators";

const SETORES = [
  { value: "comercial", label: "Comercial" },
  { value: "projetos", label: "Projetos" },
  { value: "logistica", label: "Logística" },
  { value: "financeiro", label: "Financeiro" },
];

const PerfilCompletar = () => {
  const navigate = useNavigate();
  const { colaborador, loading: loadingColab } = useColaborador();
  const [cpf, setCpf] = useState("");
  const [telefone, setTelefone] = useState("");
  const [setor, setSetor] = useState("");
  const [errors, setErrors] = useState<{ cpf?: string; telefone?: string; setor?: string }>({});
  const [saving, setSaving] = useState(false);

  // Pré-preenche se algum campo já existir.
  useEffect(() => {
    if (colaborador) {
      if (colaborador.cpf) setCpf(formatCPF(colaborador.cpf));
      if (colaborador.telefone) setTelefone(formatTelefone(colaborador.telefone));
      if (colaborador.setor) setSetor(colaborador.setor);
    }
  }, [colaborador]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: typeof errors = {};
    if (!validateCPF(cpf)) newErrors.cpf = "CPF inválido";
    if (!validateTelefone(telefone)) newErrors.telefone = "Telefone inválido (use celular com DDD)";
    if (!setor) newErrors.setor = "Selecione um setor";
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    if (!colaborador) {
      toast.error("Colaborador não encontrado");
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from("colaboradores")
      .update({
        cpf: unmask(cpf),
        telefone: unmask(telefone),
        setor,
      })
      .eq("id", colaborador.id);
    setSaving(false);

    if (error) {
      toast.error("Erro ao salvar: " + error.message);
      return;
    }
    toast.success("Cadastro completo!");
    navigate("/");
  };

  if (loadingColab) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Carregando...</div>;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Completar cadastro</CardTitle>
          <CardDescription>
            Preencha os dados que faltam pro seu perfil. Não vai te bloquear, mas é necessário pra fechar o cadastro.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cpf">CPF *</Label>
              <Input
                id="cpf"
                placeholder="000.000.000-00"
                value={cpf}
                onChange={(e) => setCpf(formatCPF(e.target.value))}
                className={errors.cpf ? "border-destructive" : ""}
                required
              />
              {errors.cpf && <p className="text-xs text-destructive">{errors.cpf}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="telefone">Telefone *</Label>
              <Input
                id="telefone"
                placeholder="(11) 98765-4321"
                value={telefone}
                onChange={(e) => setTelefone(formatTelefone(e.target.value))}
                className={errors.telefone ? "border-destructive" : ""}
                required
              />
              {errors.telefone && <p className="text-xs text-destructive">{errors.telefone}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="setor">Setor *</Label>
              <Select value={setor} onValueChange={setSetor}>
                <SelectTrigger id="setor" className={errors.setor ? "border-destructive" : ""}>
                  <SelectValue placeholder="Selecione um setor" />
                </SelectTrigger>
                <SelectContent>
                  {SETORES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.setor && <p className="text-xs text-destructive">{errors.setor}</p>}
            </div>
            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default PerfilCompletar;
