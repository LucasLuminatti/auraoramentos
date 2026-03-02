import { useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/logo.png";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Check, X, Eye, EyeOff, Mail } from "lucide-react";

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

const Auth = () => {
  const [searchParams] = useSearchParams();
  const isLogin = searchParams.get("mode") !== "signup";
  const [email, setEmail] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [nome, setNome] = useState("");
  const [cargo, setCargo] = useState("");
  const [departamento, setDepartamento] = useState("");
  const [loading, setLoading] = useState(false);
  const [signUpSuccess, setSignUpSuccess] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const strength = useMemo(() => getPasswordStrength(password), [password]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isLogin) {
      if (!nome.trim()) {
        toast({ title: "Preencha seu nome", variant: "destructive" });
        return;
      }
      if (email !== confirmEmail) {
        toast({ title: "E-mails não conferem", description: "Confirme o e-mail corretamente.", variant: "destructive" });
        return;
      }
      if (password !== confirmPassword) {
        toast({ title: "Senhas não conferem", description: "Confirme a senha corretamente.", variant: "destructive" });
        return;
      }
      if (strength.score < 3) {
        toast({ title: "Senha muito fraca", description: "Crie uma senha mais forte seguindo os critérios abaixo.", variant: "destructive" });
        return;
      }
    }

    setLoading(true);

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast({ title: "Erro ao entrar", description: error.message, variant: "destructive" });
      } else {
        navigate("/");
      }
    } else {
      // Check if email is in allowed_users before proceeding
      const { data: allowed } = await supabase
        .from("allowed_users")
        .select("email")
        .eq("email", email.toLowerCase().trim())
        .maybeSingle();

      if (!allowed) {
        setLoading(false);
        toast({
          title: "Acesso não autorizado",
          description: "Seu e-mail ainda não foi aprovado. Solicite acesso primeiro.",
          variant: "destructive",
        });
        navigate("/request-access");
        return;
      }

      const { data: signUpData, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) {
        toast({ title: "Erro ao cadastrar", description: error.message, variant: "destructive" });
      } else {
        // Create colaborador profile via edge function
        const userId = signUpData.user?.id;
        if (userId) {
          try {
            const res = await supabase.functions.invoke("create-colaborador", {
              body: { nome, cargo, departamento, user_id: userId },
            });
            if (res.error) {
              console.error("Error creating colaborador:", res.error);
            }
          } catch (err) {
            console.error("Error invoking create-colaborador:", err);
          }
        }
        setSignUpSuccess(true);
      }
    }
    setLoading(false);
  };

  if (signUpSuccess) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center gap-4 pt-8 pb-6 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Mail className="h-8 w-8 text-primary" />
            </div>
            <CardTitle>Verifique seu e-mail</CardTitle>
            <p className="text-sm text-muted-foreground">
              Enviamos um link de confirmação para <strong className="text-foreground">{email}</strong>. Acesse sua caixa de entrada e clique no link para ativar sua conta.
            </p>
            <p className="text-xs text-muted-foreground">
              Não encontrou? Verifique a pasta de spam.
            </p>
            <Button
              variant="outline"
              className="mt-2 w-full"
              onClick={() => {
                setSignUpSuccess(false);
                setEmail("");
                setConfirmEmail("");
                setPassword("");
                setConfirmPassword("");
                setNome("");
                setCargo("");
                setDepartamento("");
                navigate("/auth");
              }}
            >
              Voltar para o login
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
          <CardTitle>{isLogin ? "Entrar" : "Criar Conta"}</CardTitle>
          <CardDescription>
            {isLogin
              ? "Faça login para acessar o sistema"
              : "Preencha os dados para criar sua conta"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Dados do colaborador (só no cadastro) */}
            {!isLogin && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome Completo *</Label>
                  <Input
                    id="nome"
                    placeholder="Ex: João Silva"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="cargo">Cargo</Label>
                    <Input
                      id="cargo"
                      placeholder="Ex: Designer"
                      value={cargo}
                      onChange={(e) => setCargo(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="departamento">Setor</Label>
                    <Input
                      id="departamento"
                      placeholder="Ex: Projetos"
                      value={departamento}
                      onChange={(e) => setDepartamento(e.target.value)}
                    />
                  </div>
                </div>
              </>
            )}

            {/* E-mail */}
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

            {/* Confirmar e-mail (só no cadastro) */}
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="confirmEmail">Confirmar E-mail</Label>
                <Input
                  id="confirmEmail"
                  type="email"
                  placeholder="repita seu e-mail"
                  value={confirmEmail}
                  onChange={(e) => setConfirmEmail(e.target.value)}
                  onPaste={(e) => e.preventDefault()}
                  required
                />
                {confirmEmail && email !== confirmEmail && (
                  <p className="text-xs text-destructive">Os e-mails não conferem</p>
                )}
              </div>
            )}

            {/* Senha */}
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
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

            {/* Indicador de força (só no cadastro) */}
            {!isLogin && password && (
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

            {/* Confirmar senha (só no cadastro) */}
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar Senha</Label>
                <Input
                  id="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  placeholder="repita sua senha"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  onPaste={(e) => e.preventDefault()}
                  required
                />
                {confirmPassword && password !== confirmPassword && (
                  <p className="text-xs text-destructive">As senhas não conferem</p>
                )}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Aguarde..." : isLogin ? "Entrar" : "Criar Conta"}
            </Button>
          </form>
          {isLogin && (
            <div className="mt-4 flex flex-col items-center gap-2 text-sm">
              <a
                href="/forgot-password"
                className="text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
              >
                Esqueci minha senha
              </a>
              <span className="text-muted-foreground">
                Primeiro acesso?{" "}
                <a
                  href="/request-access"
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  Solicitar convite
                </a>
              </span>
            </div>
          )}
          {!isLogin && (
            <div className="mt-4 text-center text-sm text-muted-foreground">
              Já tem conta?{" "}
              <a
                href="/auth"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                Entrar
              </a>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
