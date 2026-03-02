import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/logo.png";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Mail, ArrowLeft } from "lucide-react";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      setSent(true);
    }
    setLoading(false);
  };

  if (sent) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center gap-4 pt-8 pb-6 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Mail className="h-8 w-8 text-primary" />
            </div>
            <CardTitle>Verifique seu e-mail</CardTitle>
            <p className="text-sm text-muted-foreground">
              Se existe uma conta com <strong className="text-foreground">{email}</strong>, enviamos um link para redefinir sua senha.
            </p>
            <p className="text-xs text-muted-foreground">
              Não encontrou? Verifique a pasta de spam.
            </p>
            <a href="/auth" className="mt-2 inline-flex w-full">
              <Button variant="outline" className="w-full">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar para o login
              </Button>
            </a>
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
          <CardTitle>Esqueci minha senha</CardTitle>
          <CardDescription>
            Informe seu e-mail para receber o link de redefinição
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Enviando..." : "Enviar link de redefinição"}
            </Button>
          </form>
          <div className="mt-4 text-center">
            <a
              href="/auth"
              className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline inline-flex items-center gap-1"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Voltar para o login
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ForgotPassword;
