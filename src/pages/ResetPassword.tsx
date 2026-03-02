import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/logo.png";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Check, X, Eye, EyeOff, CheckCircle, Loader2, AlertTriangle } from "lucide-react";

function getPasswordStrength(password: string) {
  const checks = {
    minLength: password.length >= 8,
    hasUpper: /[A-Z]/.test(password),
    hasLower: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecial: /[^A-Za-z0-9]/.test(password),
  };
  const score = Object.values(checks).filter(Boolean).length;
  const label =
    score <= 1 ? "Muito fraca" : score === 2 ? "Fraca" : score === 3 ? "Média" : score === 4 ? "Forte" : "Muito forte";
  const color =
    score <= 1 ? "bg-destructive" : score === 2 ? "bg-orange-500" : score === 3 ? "bg-yellow-500" : score === 4 ? "bg-emerald-400" : "bg-emerald-600";
  return { checks, score, label, color, percent: (score / 5) * 100 };
}

const RULES = [
  { key: "minLength" as const, text: "Mínimo 8 caracteres" },
  { key: "hasUpper" as const, text: "Uma letra maiúscula" },
  { key: "hasLower" as const, text: "Uma letra minúscula" },
  { key: "hasNumber" as const, text: "Um número" },
  { key: "hasSpecial" as const, text: "Um caractere especial (!@#$...)" },
];

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  const strength = useMemo(() => getPasswordStrength(password), [password]);

  useEffect(() => {
    let resolved = false;

    const markReady = () => {
      if (!resolved) {
        resolved = true;
        setSessionReady(true);
        setSessionLoading(false);
      }
    };

    const markFailed = () => {
      if (!resolved) {
        resolved = true;
        setSessionLoading(false);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        markReady();
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        markReady();
      }
    });

    const timeout = setTimeout(markFailed, 5000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast({ title: "Senhas não conferem", variant: "destructive" });
      return;
    }
    if (strength.score < 3) {
      toast({ title: "Senha muito fraca", description: "Crie uma senha mais forte.", variant: "destructive" });
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      toast({ title: "Erro ao redefinir senha", description: error.message, variant: "destructive" });
    } else {
      await supabase.auth.signOut();
      setSuccess(true);
    }
    setLoading(false);
  };

  if (sessionLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center gap-4 pt-8 pb-6 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Verificando link...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!sessionReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center gap-4 pt-8 pb-6 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
            <CardTitle>Link inválido ou expirado</CardTitle>
            <p className="text-sm text-muted-foreground">
              Este link de recuperação não é mais válido. Solicite um novo link para redefinir sua senha.
            </p>
            <Button className="mt-2 w-full" onClick={() => navigate("/forgot-password")}>
              Solicitar novo link
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center gap-4 pt-8 pb-6 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <CheckCircle className="h-8 w-8 text-primary" />
            </div>
            <CardTitle>Senha redefinida!</CardTitle>
            <p className="text-sm text-muted-foreground">
              Sua senha foi alterada com sucesso. Você já pode acessar o sistema.
            </p>
            <Button className="mt-2 w-full" onClick={() => navigate("/auth")}>
              Fazer login
            </Button>
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
          <CardTitle>Redefinir senha</CardTitle>
          <CardDescription>Crie sua nova senha</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Nova senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {password && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Força da senha:</span>
                  <span className="font-medium">{strength.label}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full transition-all duration-300 rounded-full ${strength.color}`}
                    style={{ width: `${strength.percent}%` }}
                  />
                </div>
                <ul className="mt-1 space-y-1">
                  {RULES.map((rule) => (
                    <li key={rule.key} className="flex items-center gap-2 text-xs">
                      {strength.checks[rule.key] ? (
                        <Check className="h-3.5 w-3.5 text-emerald-500" />
                      ) : (
                        <X className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                      <span className={strength.checks[rule.key] ? "text-foreground" : "text-muted-foreground"}>
                        {rule.text}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar nova senha</Label>
              <Input
                id="confirmPassword"
                type={showPassword ? "text" : "password"}
                placeholder="repita sua senha"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
              {confirmPassword && password !== confirmPassword && (
                <p className="text-xs text-destructive">As senhas não conferem</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Salvando..." : "Redefinir senha"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ResetPassword;
