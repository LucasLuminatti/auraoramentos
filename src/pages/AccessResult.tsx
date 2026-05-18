import { Link, useSearchParams } from "react-router-dom";
import logo from "@/assets/logo.png";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { CheckCircle, XCircle, Clock, AlertTriangle, ShieldX, ArrowLeft } from "lucide-react";

type Status = "approved" | "rejected" | "expired" | "invalid" | "not-found" | "already-approved" | "already-rejected" | "error";

type Variant = {
  Icon: typeof CheckCircle;
  iconBg: string;
  iconColor: string;
  title: string;
  body: (name: string | null, email: string | null) => React.ReactNode;
};

const VARIANTS: Record<Status, Variant> = {
  approved: {
    Icon: CheckCircle,
    iconBg: "bg-emerald-500/10",
    iconColor: "text-emerald-600",
    title: "Acesso aprovado",
    body: (name, email) => (
      <>
        <p className="text-sm text-muted-foreground">
          {name ? <>Acesso aprovado para <strong className="text-foreground">{name}</strong>.</> : "Acesso aprovado."}
        </p>
        {email && (
          <p className="text-sm text-muted-foreground">
            Um e-mail foi enviado para <strong className="text-foreground">{email}</strong> com o link para criar a conta.
          </p>
        )}
      </>
    ),
  },
  rejected: {
    Icon: XCircle,
    iconBg: "bg-destructive/10",
    iconColor: "text-destructive",
    title: "Pedido recusado",
    body: (name, email) => (
      <>
        <p className="text-sm text-muted-foreground">
          {name ? <>Pedido de <strong className="text-foreground">{name}</strong> recusado.</> : "Pedido recusado."}
        </p>
        {email && (
          <p className="text-sm text-muted-foreground">
            Um e-mail foi enviado para <strong className="text-foreground">{email}</strong> informando sobre a recusa.
          </p>
        )}
      </>
    ),
  },
  expired: {
    Icon: Clock,
    iconBg: "bg-amber-500/10",
    iconColor: "text-amber-500",
    title: "Link expirado",
    body: () => (
      <p className="text-sm text-muted-foreground">
        O link de aprovação é válido por 24 horas. Peça ao solicitante para fazer um novo pedido de acesso.
      </p>
    ),
  },
  invalid: {
    Icon: ShieldX,
    iconBg: "bg-destructive/10",
    iconColor: "text-destructive",
    title: "Link inválido",
    body: () => (
      <p className="text-sm text-muted-foreground">
        Este link de aprovação não é válido ou foi modificado. Peça ao solicitante para fazer um novo pedido.
      </p>
    ),
  },
  "not-found": {
    Icon: AlertTriangle,
    iconBg: "bg-amber-500/10",
    iconColor: "text-amber-500",
    title: "Pedido não encontrado",
    body: () => (
      <p className="text-sm text-muted-foreground">
        O pedido de acesso não foi encontrado no sistema.
      </p>
    ),
  },
  "already-approved": {
    Icon: CheckCircle,
    iconBg: "bg-muted",
    iconColor: "text-muted-foreground",
    title: "Pedido já revisado",
    body: () => (
      <p className="text-sm text-muted-foreground">
        Este pedido já foi <strong className="text-foreground">aprovado</strong> anteriormente.
      </p>
    ),
  },
  "already-rejected": {
    Icon: XCircle,
    iconBg: "bg-muted",
    iconColor: "text-muted-foreground",
    title: "Pedido já revisado",
    body: () => (
      <p className="text-sm text-muted-foreground">
        Este pedido já foi <strong className="text-foreground">recusado</strong> anteriormente.
      </p>
    ),
  },
  error: {
    Icon: AlertTriangle,
    iconBg: "bg-destructive/10",
    iconColor: "text-destructive",
    title: "Erro interno",
    body: () => (
      <p className="text-sm text-muted-foreground">
        Ocorreu um erro inesperado. Tente novamente em alguns instantes.
      </p>
    ),
  },
};

const AccessResult = () => {
  const [searchParams] = useSearchParams();
  const rawStatus = searchParams.get("status") || "error";
  const status: Status = (rawStatus in VARIANTS ? rawStatus : "error") as Status;
  const name = searchParams.get("name");
  const email = searchParams.get("email");

  const variant = VARIANTS[status];
  const Icon = variant.Icon;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center gap-4 pt-8 pb-6 text-center">
          <div className="mx-auto mb-2 flex flex-col items-center gap-2">
            <img src={logo} alt="Aura" className="h-10 w-auto" />
            <span className="text-sm font-semibold text-primary">Criador de Orçamentos</span>
          </div>
          <div className={`flex h-16 w-16 items-center justify-center rounded-full ${variant.iconBg}`}>
            <Icon className={`h-8 w-8 ${variant.iconColor}`} />
          </div>
          <CardTitle>{variant.title}</CardTitle>
          <div className="space-y-2">{variant.body(name, email)}</div>
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
};

export default AccessResult;
