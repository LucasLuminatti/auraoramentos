import { useState } from "react";
import { Link } from "react-router-dom";
import logo from "@/assets/logo.png";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Mail, CheckCircle, Clock, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const RequestAccess = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [state, setState] = useState<"idle" | "success" | "pending">("idle");
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || name.trim().length < 2) {
      toast({ title: "Nome inválido", description: "Informe seu nome completo.", variant: "destructive" });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast({ title: "E-mail inválido", description: "Informe um endereço de e-mail válido.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const res = await supabase.functions.invoke("request-access", {
        body: { name: name.trim(), email: email.toLowerCase().trim() },
      });

      if (res.error) {
        toast({ title: "Erro ao enviar pedido", description: "Tente novamente em alguns instantes.", variant: "destructive" });
        return;
      }

      const data = res.data as { success?: boolean; error?: string; message?: string };

      if (data?.error === "pending") {
        setState("pending");
        return;
      }

      if (data?.error === "approved") {
        toast({
          title: "Acesso já aprovado",
          description: "Seu acesso já foi aprovado! Vá para o login e crie sua conta.",
        });
        return;
      }

      if (data?.error) {
        toast({ title: "Erro", description: data.message || "Tente novamente.", variant: "destructive" });
        return;
      }

      setState("success");
    } catch {
      toast({ title: "Erro ao enviar pedido", description: "Tente novamente em alguns instantes.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (state === "success") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center gap-4 pt-8 pb-6 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
              <CheckCircle className="h-8 w-8 text-emerald-600" />
            </div>
            <CardTitle>Pedido enviado!</CardTitle>
            <p className="text-sm text-muted-foreground">
              Seu pedido de acesso foi registrado para <strong className="text-foreground">{email}</strong>.
              Você receberá um e-mail assim que for aprovado.
            </p>
            <p className="text-xs text-muted-foreground">Não encontrou? Verifique a pasta de spam.</p>
            <Link to="/auth" className="mt-2 w-full">
              <Button variant="outline" className="w-full">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar para o login
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (state === "pending") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center gap-4 pt-8 pb-6 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/10">
              <Clock className="h-8 w-8 text-amber-500" />
            </div>
            <CardTitle>Pedido em andamento</CardTitle>
            <p className="text-sm text-muted-foreground">
              Seu pedido para <strong className="text-foreground">{email}</strong> já está aguardando aprovação.
              Aguarde o e-mail de confirmação.
            </p>
            <Link to="/auth" className="mt-2 w-full">
              <Button variant="outline" className="w-full">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar para o login
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex flex-col items-center gap-2">
            <img src={logo} alt="Aura" className="h-12 w-auto" />
            <span className="text-lg font-semibold text-primary">Criador de Orçamentos</span>
          </div>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Mail className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="mt-2">Solicitar Acesso</CardTitle>
          <CardDescription>
            Preencha os dados abaixo. Após a aprovação, você receberá um e-mail para criar sua conta.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome Completo *</Label>
              <Input
                id="name"
                placeholder="Ex: João Silva"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail corporativo *</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                maxLength={255}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Enviando..." : "Solicitar Acesso"}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm text-muted-foreground">
            Já tem acesso?{" "}
            <Link to="/auth" className="font-medium text-primary underline-offset-4 hover:underline">
              Fazer login
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default RequestAccess;
